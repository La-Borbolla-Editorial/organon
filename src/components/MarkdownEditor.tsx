import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { EditorSelection, EditorState, Prec, StateEffect, StateField, type Range } from '@codemirror/state'
import { Decoration, hoverTooltip, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { EditorView, minimalSetup } from 'codemirror'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { findTokens, splitFrontMatter, type RenderedToken, type Token } from '../draft'
import { renumber, touchesList } from '../lists'

export interface TokenInfo {
  ok: boolean
  /** Texto de la ayuda que aparece al pasar el ratón. */
  title: string
  detail: string
}

/** Una ficha tal como se asoma en el editor, debajo de la línea que la nombra. */
export interface PeekItem {
  /** «s. 51» */
  label: string
  title: string
  quote: string
  /** Fuente y página. */
  meta: string
  error?: string
}

export type EditorMode = 'rich' | 'markdown'
export type Format = 'bold' | 'italic' | 'h1' | 'h2' | 'h3' | 'list' | 'numbered' | 'quote'

export interface MarkdownEditorHandle {
  /** Aplica (o quita) un formato a la selección o a sus líneas. */
  format: (f: Format) => void
  /** Inserta texto en el cursor (sustituye la selección). */
  insert: (text: string) => void
  /** Sustituye todo el documento (p. ej. al cambiar la cabecera). */
  setText: (text: string) => void
  goTo: (pos: number) => void
  focus: () => void
}

interface Props {
  /** Texto inicial. Para cargar otro borrador, monta otro editor (`key`). */
  initial: string
  /** Ficheros del proyecto: de ellos salen los marcadores («f.», «e.»…) que se reconocen. */
  ficheros: { name: string; marker: string }[]
  onChange: (text: string) => void
  describe: (token: Token) => TokenInfo
  /** Las fichas de una referencia, para asomarlas en el editor sin meterlas en el texto. */
  peek: (token: Token) => PeekItem[]
  /** Asomar todas las fichas (true) o solo las que se abran una a una (false). */
  peekAll: boolean
  /**
   * `rich`: se escribe viendo el resultado (títulos, cursivas, citas y números de nota);
   * `markdown`: se ve el texto tal cual. El archivo es el mismo en los dos modos.
   */
  mode: EditorMode
  /** Formato en vivo: con `false`, texto plano puro (sin formato, realce ni referencias pintadas). */
  liveFormat: boolean
  /** Cómo queda cada referencia en el texto final, en orden (para el modo `rich`). */
  rendered: RenderedToken[]
  /** Comillas del idioma de las citas: «» o “”. */
  quotes: [string, string]
  /** Cambia cuando cambian las fichas o los ficheros: se repintan las referencias. */
  revision: unknown
}

const refresh = StateEffect.define<null>()
const togglePeek = StateEffect.define<number>()
const setPeekAll = StateEffect.define<boolean>()
const setMode = StateEffect.define<EditorMode>()
const setLive = StateEffect.define<boolean>()

const hidden = Decoration.replace({})

type FicheroKey = { name: string; marker: string }
/** Cambian los ficheros (sus marcadores): hay que volver a buscar las referencias. */
const setFicheros = StateEffect.define<FicheroKey[]>()
/** Las referencias del texto, buscadas una vez por cambio y compartidas por todo el editor. */
const tokensField = StateField.define<{ ficheros: FicheroKey[]; list: Token[] }>({
  create: () => ({ ficheros: [], list: [] }),
  update(value, tr) {
    let { ficheros } = value
    for (const e of tr.effects) if (e.is(setFicheros)) ficheros = e.value
    if (!tr.docChanged && ficheros === value.ficheros) return value
    if (ficheros !== value.ficheros) return { ficheros, list: findTokens(tr.state.doc.toString(), ficheros) }
    // Una referencia nunca cruza de línea: solo se buscan de nuevo las líneas tocadas,
    // y las demás se desplazan con el cambio.
    const doc = tr.state.doc
    const touched: [number, number][] = []
    tr.changes.iterChangedRanges((_fa, _ta, fromB, toB) => {
      const a = doc.lineAt(fromB).from, b = doc.lineAt(toB).to
      const last = touched[touched.length - 1]
      if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
      else touched.push([a, b])
    })
    const inTouched = (from: number, to: number) => touched.some(([a, b]) => from <= b && to >= a)
    const list: Token[] = []
    for (const t of value.list) {
      const from = tr.changes.mapPos(t.from, 1), to = tr.changes.mapPos(t.to, -1)
      if (to > from && !inTouched(from, to)) list.push({ ...t, from, to })
    }
    for (const [a, b] of touched) {
      for (const t of findTokens(doc.sliceString(a, b), ficheros)) list.push({ ...t, from: t.from + a, to: t.to + a })
    }
    list.sort((x, y) => x.from - y.from)
    return { ficheros, list }
  },
})
const tokens = (state: EditorState) => state.field(tokensField).list

/**
 * Tras lo que escribe la persona (no al cargar ni al deshacer), la lista tocada se
 * renumera: cada punto lleva el número que le toca en su nivel.
 */
const autoNumber = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !(tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('move'))) return tr
  const doc = tr.newDoc
  let first = Infinity, last = 0
  tr.changes.iterChangedRanges((_fa, _ta, fromB, toB) => {
    first = Math.min(first, doc.lineAt(fromB).number)
    last = Math.max(last, doc.lineAt(toB).number)
  })
  if (!touchesList(doc, first, last)) return tr
  const changes = renumber(doc, first, last)
  return changes.length ? [tr, { changes, sequential: true }] : tr
})

class Bullet extends WidgetType {
  eq() { return true }
  toDOM() {
    const s = document.createElement('span')
    s.className = 'cm-rich-bullet'
    s.textContent = '•'
    return s
  }
}

/** Una referencia tal como se leerá: la cita (si la inserta) y el número de su nota. */
class RenderedRef extends WidgetType {
  constructor(readonly t: RenderedToken, readonly quotes: [string, string], readonly isNote: boolean) { super() }
  eq(other: RenderedRef) {
    const a = this.t, b = other.t
    return a.raw === b.raw && a.inText === b.inText && a.block === b.block && a.mark === b.mark && a.note === b.note && a.failed === b.failed && this.isNote === other.isNote && this.quotes === other.quotes
  }
  toDOM(view: EditorView) {
    const { t } = this
    const el = document.createElement('span')
    el.className = `cm-rich-ref${t.failed ? ' bad' : ''}`
    el.title = t.failed ? 'Referencia sin resolver. Clic para editarla.' : `${t.note || t.mark}\n${t.raw} · clic para editar`
    if (t.kind === 'insert' && t.inText) {
      const q = el.appendChild(document.createElement('span'))
      q.className = 'cm-rich-quoted'
      q.textContent = t.block ? t.inText : `${this.quotes[0]}${t.inText.replace(/\s*\n+\s*/g, ' ')}${this.quotes[1]}`
    }
    const mark = el.appendChild(document.createElement(this.isNote || t.failed ? 'sup' : 'span'))
    mark.className = 'cm-rich-mark'
    mark.textContent = this.isNote || t.failed ? t.mark : ` ${t.mark}`
    // Un clic deja el cursor dentro de la referencia, que entonces se muestra tal cual.
    el.onmousedown = (e) => {
      e.preventDefault()
      // La posición se pregunta al pulsar: el mismo dibujo sirve aunque el texto se desplace.
      view.dispatch({ selection: { anchor: Math.min(view.posAtDOM(el) + 1, view.state.doc.length) } })
      view.focus()
    }
    return el
  }
  ignoreEvent() { return true }
}

/** Botoncito tras cada referencia: abre o cierra su ficha. */
class PeekToggle extends WidgetType {
  constructor(readonly open: boolean) { super() }
  eq(other: PeekToggle) { return other.open === this.open }
  toDOM(view: EditorView) {
    const b = document.createElement('button')
    b.className = `cm-peek-toggle${this.open ? ' open' : ''}`
    b.type = 'button'
    b.textContent = this.open ? '▾' : '▸'
    b.title = this.open ? 'Ocultar la ficha' : 'Ver la ficha aquí (no se añade al texto)'
    b.setAttribute('aria-label', b.title)
    b.onmousedown = (e) => {
      e.preventDefault()
      // El botón va justo detrás de su referencia: se busca la que acaba ahí.
      const at = view.posAtDOM(b)
      const token = view.state.field(tokensField).list.find((t) => t.to === at)
      if (token) view.dispatch({ effects: togglePeek.of(token.from) })
    }
    return b
  }
  ignoreEvent() { return true }
}

/** La ficha asomada: se ve en el editor, pero no forma parte del texto. */
class PeekBlock extends WidgetType {
  private readonly key: string
  constructor(readonly items: PeekItem[]) { super(); this.key = JSON.stringify(items) }
  eq(other: PeekBlock) { return other.key === this.key }
  toDOM(view: EditorView) {
    const box = document.createElement('div')
    box.className = 'cm-peek'
    // Mientras el editor tiene el foco, deshace cualquier selección que no sea suya.
    // Al soltarlo, el texto de la ficha se selecciona y se copia como en cualquier página.
    box.onmousedown = () => view.contentDOM.blur()
    for (const item of this.items) {
      const card = box.appendChild(document.createElement('div'))
      card.className = `cm-peek-item${item.error ? ' bad' : ''}`
      const head = card.appendChild(document.createElement('div'))
      head.className = 'cm-peek-head'
      head.appendChild(document.createElement('span')).textContent = item.label
      head.appendChild(document.createElement('strong')).textContent = item.error ?? item.title
      if (item.meta) head.appendChild(document.createElement('em')).textContent = item.meta
      if (item.quote) card.appendChild(document.createElement('blockquote')).textContent = item.quote
    }
    return box
  }
  // El editor no interviene dentro de la ficha: así su texto se puede seleccionar y copiar.
  ignoreEvent() { return true }
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor({ initial, ficheros, onChange, describe, peek, peekAll, mode, liveFormat, rendered, quotes, revision }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // Lo que usan las extensiones de CodeMirror, siempre al día sin recrear el editor.
  const formatRef = useRef<(f: Format) => void>(() => {})
  const live = useRef({ ficheros, onChange, describe, peek, rendered, quotes })
  live.current = { ficheros, onChange, describe, peek, rendered, quotes }

  useEffect(() => {
    // Lo que se sabe de cada referencia (por su texto) se recuerda hasta que cambian las
    // fichas: así escribir no vuelve a buscar cada ficha en cada tecla.
    const memo = { describe: live.current.describe, peek: live.current.peek, info: new Map<string, TokenInfo>(), items: new Map<string, PeekItem[]>() }
    const fresh = () => {
      if (memo.describe !== live.current.describe || memo.peek !== live.current.peek) {
        memo.describe = live.current.describe
        memo.peek = live.current.peek
        memo.info.clear()
        memo.items.clear()
      }
    }
    const raw = (state: EditorState, t: Token) => state.doc.sliceString(t.from, t.to)
    const describeOf = (state: EditorState, t: Token) => {
      fresh()
      const key = raw(state, t)
      let info = memo.info.get(key)
      if (!info) memo.info.set(key, (info = live.current.describe(t)))
      return info
    }
    const peekOf = (state: EditorState, t: Token) => {
      fresh()
      const key = raw(state, t)
      let items = memo.items.get(key)
      if (!items) memo.items.set(key, (items = live.current.peek(t)))
      return items
    }

    // Qué fichas están asomadas. Con `all`, todas menos las de `flipped`; sin él, solo esas.
    const peeks = StateField.define<{ all: boolean; flipped: number[] }>({
      create: () => ({ all: peekAll, flipped: [] }),
      update(value, tr) {
        let { all, flipped } = value
        if (tr.docChanged) flipped = flipped.map((pos) => tr.changes.mapPos(pos, 1))
        for (const e of tr.effects) {
          if (e.is(togglePeek)) flipped = flipped.includes(e.value) ? flipped.filter((p) => p !== e.value) : [...flipped, e.value]
          if (e.is(setPeekAll)) { all = e.value; flipped = [] }
        }
        return { all, flipped }
      },
    })
    const isOpen = (state: EditorState, t: Token) => { const { all, flipped } = state.field(peeks); return all !== flipped.includes(t.from) }

    const liveField = StateField.define<boolean>({
      create: () => liveFormat,
      update: (value, tr) => tr.effects.reduce((on, e) => (e.is(setLive) ? e.value : on), value),
    })

    const modeField = StateField.define<EditorMode>({
      create: () => mode,
      update: (value, tr) => tr.effects.reduce((m, e) => (e.is(setMode) ? e.value : m), value),
    })

    // ---- Lo que va en bloque (fichas asomadas, cabecera plegada) ----------------------
    // CodeMirror solo admite bloques que vengan de un campo de estado, y estos cubren todo el texto.
    const buildBlocks = (state: EditorState): DecorationSet => {
      const out: Range<Decoration>[] = []
      const front = splitFrontMatter(state.doc.sliceString(0, Math.min(state.doc.length, 4000))).offset
      if (front > 0 && state.field(modeField) === 'rich' && state.field(liveField)) {
        const end = Math.max(0, front - 1)
        const sel = state.selection.ranges
        if (!sel.some((r) => r.from <= end && r.to >= 0)) out.push(Decoration.replace({ block: true }).range(0, end))
      }
      for (const t of tokens(state)) {
        if (isOpen(state, t)) out.push(Decoration.widget({ widget: new PeekBlock(peekOf(state, t)), block: true, side: 2 }).range(state.doc.lineAt(t.to).to))
      }
      return Decoration.set(out, true)
    }
    const blocks = StateField.define<DecorationSet>({
      create: buildBlocks,
      update(value, tr) {
        const effect = tr.effects.some((e) => e.is(refresh) || e.is(togglePeek) || e.is(setPeekAll) || e.is(setMode) || e.is(setLive) || e.is(setFicheros))
        // Fuera de la cabecera, mover el cursor no cambia nada aquí.
        const nearFront = tr.selection !== undefined && (tr.state.selection.main.from < 4000 || tr.startState.selection.main.from < 4000)
        return tr.docChanged || effect || nearFront ? buildBlocks(tr.state) : value
      },
      provide: (field) => EditorView.decorations.from(field),
    })

    // ---- Lo que va en línea, solo en la parte visible ---------------------------------
    /** Decoraciones del modo enriquecido: oculta la sintaxis de Markdown y le da su aspecto. */
    const richDecorations = (state: EditorState, from: number, to: number, visible: Token[], out: Range<Decoration>[], hideSyntax: boolean) => {
      const doc = state.doc
      const sel = state.selection.ranges
      const touches = (a: number, b: number) => sel.some((r) => r.from <= b && r.to >= a)
      const onLine = (pos: number) => { const line = doc.lineAt(pos); return touches(line.from, line.to) }
      // En modo Markdown la sintaxis se ve siempre: solo se realza (títulos, negritas…).
      const hide = (a: number, b: number) => { if (hideSyntax && b > a) out.push(hidden.range(a, b)) }
      const lineClass = (a: number, b: number, cls: string) => {
        // Solo las líneas visibles: un bloque largo no se recorre entero.
        for (let pos = Math.max(a, from); pos <= Math.min(b, to); ) {
          const line = doc.lineAt(pos)
          out.push(Decoration.line({ class: cls }).range(line.from))
          pos = line.to + 1
        }
      }
      const front = splitFrontMatter(doc.sliceString(0, Math.min(doc.length, 4000))).offset
      if (front > 0 && from < front && touches(0, Math.max(0, front - 1))) lineClass(0, Math.max(0, front - 1), 'cm-rich-front')

      // Línea a línea, con expresiones sencillas: un analizador de Markdown completo volvía
      // a leer el esquema entero (una sola lista larguísima) en cada tecla.
      let fenced = false
      for (let pos = Math.max(from, front); pos <= to; ) {
        const line = doc.lineAt(pos)
        pos = line.to + 1
        const text = line.text
        if (/^\s*(```|~~~)/.test(text)) { fenced = !fenced; continue }
        if (fenced) continue
        const at = line.from
        const heading = /^(#{1,6})(\s+|$)/.exec(text)
        if (heading) {
          out.push(Decoration.line({ class: `cm-rich-h cm-rich-h${heading[1].length}` }).range(at))
          // «## » se oculta salvo en la línea donde está el cursor.
          if (!onLine(at)) hide(at, at + heading[0].length)
        }
        const quote = /^(\s*)>\s?/.exec(text)
        if (quote) {
          out.push(Decoration.line({ class: 'cm-rich-quote' }).range(at))
          if (!onLine(at)) hide(at + quote[1].length, at + quote[0].length)
        }
        const bullet = /^(\s*)([-*+])\s/.exec(text)
        if (bullet) {
          const a = at + bullet[1].length
          if (hideSyntax && !touches(a, a + 1)) out.push(Decoration.replace({ widget: new Bullet() }).range(a, a + 1))
        }
        // Lo que no se toca: las referencias a fichas y el código en línea.
        const taken: [number, number][] = visible.filter((t) => t.from < line.to && t.to > at).map((t) => [t.from - at, t.to - at])
        const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x)
        const inline = (re: RegExp, open: number, close: number, cls: string, exclusive = true) => {
          for (const m of text.matchAll(re)) {
            const a = m.index!, b = a + m[0].length
            if (!free(a, b)) continue
            if (exclusive) taken.push([a, b])
            out.push(Decoration.mark({ class: cls }).range(at + a, at + b))
            if (!touches(at + a, at + b)) { hide(at + a, at + a + open); hide(at + b - close, at + b) }
          }
        }
        inline(/`[^`\n]+`/g, 1, 1, 'cm-rich-code')
        for (const m of text.matchAll(/\[([^\]\n]+)\]\(([^)\n]*)\)/g)) {
          const a = m.index!, b = a + m[0].length
          if (!free(a, b)) continue
          taken.push([a, b])
          // [texto](url): solo se ve el texto, salvo con el cursor dentro.
          if (!touches(at + a, at + b)) {
            const close = a + 1 + m[1].length
            hide(at + a, at + a + 1)
            hide(at + close, at + b)
            out.push(Decoration.mark({ class: 'cm-rich-link' }).range(at + a + 1, at + close))
          }
        }
        inline(/\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\*)|__(?=\S)(.+?)(?<=\S)__(?!_)/g, 2, 2, 'cm-rich-strong', false)
        inline(/(?<![*\w])\*(?![*\s])(.+?)(?<![\s*])\*(?=\*\*(?!\*)|[^*]|$)|(?<![_\w])_(?![_\s])(.+?)(?<![\s_])_(?![_\w])/g, 1, 1, 'cm-rich-em')
      }
    }

    const buildInline = (view: EditorView): DecorationSet => {
      const { state } = view
      // Sin formato en vivo, nada: el texto tal cual.
      if (!state.field(liveField)) return Decoration.none
      const rich = state.field(modeField) === 'rich'
      const all = tokens(state)
      const sel = state.selection.ranges
      const { quotes, rendered } = live.current
      const out: Range<Decoration>[] = []
      for (const { from, to } of view.visibleRanges) {
        // Primera referencia visible, por búsqueda binaria; su índice es el de la composición.
        let lo = 0, hi = all.length
        while (lo < hi) { const mid = (lo + hi) >> 1; if (all[mid].to < from) lo = mid + 1; else hi = mid }
        const visible: Token[] = []
        for (let i = lo; i < all.length && all[i].from <= to; i++) visible.push(all[i])
        richDecorations(state, from, to, visible, out, rich)
        visible.forEach((t, k) => {
          const index = lo + k
          const shown = rendered[index]
          if (rich && shown && shown.raw === raw(state, t) && !sel.some((r) => r.from <= t.to && r.to >= t.from)) {
            out.push(Decoration.replace({ widget: new RenderedRef({ ...shown, from: t.from }, quotes, /^\d+$/.test(shown.mark)) }).range(t.from, t.to))
            if (shown.block && shown.inText) out.push(Decoration.line({ class: 'cm-rich-quote' }).range(state.doc.lineAt(t.from).from))
          } else {
            const info = describeOf(state, t)
            out.push(Decoration.mark({ class: `cm-ficha cm-ficha-${t.kind}${info.ok ? '' : ' cm-ficha-bad'}` }).range(t.from, t.to))
          }
          out.push(Decoration.widget({ widget: new PeekToggle(isOpen(state, t)), side: 1 }).range(t.to))
        })
      }
      return Decoration.set(out, true)
    }

    const inline = ViewPlugin.fromClass(class {
      decorations: DecorationSet
      constructor(view: EditorView) { this.decorations = buildInline(view) }
      update(u: ViewUpdate) {
        const effect = u.transactions.some((tr) => tr.effects.some((e) => e.is(refresh) || e.is(togglePeek) || e.is(setPeekAll) || e.is(setMode) || e.is(setLive) || e.is(setFicheros)))
        // En modo enriquecido, mover el cursor cambia qué sintaxis se muestra.
        const moved = u.selectionSet && u.state.field(modeField) === 'rich'
        if (u.docChanged || u.viewportChanged || effect || moved ) this.decorations = buildInline(u.view)
      }
    }, {
      decorations: (p) => p.decorations,
      provide: (p) => EditorView.atomicRanges.of((v) => (v.plugin(p)?.decorations ?? Decoration.none).update({ filter: (_f, _t, d) => d.spec.widget instanceof RenderedRef })),
    })

    // ---- Formato --------------------------------------------------------------------
    const wrap = (v: EditorView, mark: string) => {
      v.dispatch(v.state.changeByRange((range) => {
        const text = v.state.sliceDoc(range.from, range.to)
        const before = v.state.sliceDoc(range.from - mark.length, range.from)
        const after = v.state.sliceDoc(range.to, range.to + mark.length)
        // Ya lo tiene alrededor → se quita.
        if (before === mark && after === mark) {
          return { changes: [{ from: range.from - mark.length, to: range.from }, { from: range.to, to: range.to + mark.length }], range: EditorSelection.range(range.from - mark.length, range.to - mark.length) }
        }
        if (text.length >= 2 * mark.length && text.startsWith(mark) && text.endsWith(mark)) {
          const inner = text.slice(mark.length, -mark.length)
          return { changes: { from: range.from, to: range.to, insert: inner }, range: EditorSelection.range(range.from, range.from + inner.length) }
        }
        return { changes: [{ from: range.from, insert: mark }, { from: range.to, insert: mark }], range: EditorSelection.range(range.from + mark.length, range.to + mark.length) }
      }), { scrollIntoView: true, userEvent: 'input' })
      v.focus()
      return true
    }
    // Enter en un punto de lista sigue la lista (el número siguiente, la misma viñeta);
    // en un punto vacío, la termina. Igual con las citas en bloque.
    const continueMarkup = (v: EditorView) => {
      const { state } = v
      if (state.selection.ranges.length !== 1 || !state.selection.main.empty) return false
      const head = state.selection.main.head
      const line = state.doc.lineAt(head)
      const m = /^(\s*)(?:(\d+)([.)])|([-*+])|(>))(\s+)/.exec(line.text)
      if (!m || head < line.from + m[0].length) return false
      if (line.text.slice(m[0].length).trim() === '' && head === line.to) {
        v.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, userEvent: 'delete' })
        return true
      }
      const marker = m[2] ? `${Number(m[2]) + 1}${m[3]}` : (m[4] ?? m[5])
      const insert = `\n${m[1]}${marker}${m[6]}`
      v.dispatch({ changes: { from: head, to: head, insert }, selection: { anchor: head + insert.length }, scrollIntoView: true, userEvent: 'input' })
      return true
    }

    const PREFIX = /^(\s*)(#{1,6} |> |[-*+] |\d+[.)] )?/
    const prefix = (v: EditorView, want: string) => {
      const changes: { from: number; to: number; insert: string }[] = []
      const seen = new Set<number>()
      for (const range of v.state.selection.ranges) {
        for (let pos = range.from; pos <= range.to; ) {
          const line = v.state.doc.lineAt(pos)
          pos = line.to + 1
          if (seen.has(line.from) || (line.text.trim() === '' && range.from !== range.to)) continue
          seen.add(line.from)
          const m = PREFIX.exec(line.text)!
          const has = m[2] ?? ''
          const same = want === '1. ' ? /^\d+[.)] $/.test(has) : has === want
          changes.push({ from: line.from + m[1].length, to: line.from + m[0].length, insert: same ? '' : want })
        }
      }
      v.dispatch({ changes, scrollIntoView: true, userEvent: 'input' })
      v.focus()
      return true
    }
    formatRef.current = (f) => {
      const v = view.current
      if (!v) return
      if (f === 'bold') wrap(v, '**')
      else if (f === 'italic') wrap(v, '*')
      else prefix(v, { h1: '# ', h2: '## ', h3: '### ', list: '- ', numbered: '1. ', quote: '> ' }[f])
    }

    const tooltip = hoverTooltip((v, pos) => {
      const t = tokens(v.state).find((x) => pos >= x.from && pos <= x.to)
      if (!t) return null
      return {
        pos: t.from,
        end: t.to,
        above: true,
        create() {
          const info = describeOf(v.state, t)
          const dom = document.createElement('div')
          dom.className = `cm-ficha-tip${info.ok ? '' : ' bad'}`
          const title = dom.appendChild(document.createElement('strong'))
          title.textContent = info.title
          if (info.detail) dom.appendChild(document.createElement('p')).textContent = info.detail
          return { dom }
        },
      }
    })

    const v = new EditorView({
      parent: host.current!,
      doc: initial,
      extensions: [
        minimalSetup,
        // Tab sangra la línea (o las seleccionadas) y Mayús+Tab la desangra: así se
        // anidan los puntos de un esquema. Esc y luego Tab saca el foco del editor.
        keymap.of([indentWithTab]),
        indentUnit.of('\t'),
        EditorState.tabSize.of(4),
        EditorView.lineWrapping,
        autoNumber,
        tokensField.init((state) => ({ ficheros: live.current.ficheros, list: findTokens(state.doc.toString(), live.current.ficheros) })),
        peeks,
        modeField,
        liveField,
        blocks,
        inline,
        // Prioridad alta: el teclado por defecto de CodeMirror usa Cmd+I para
        // «seleccionar el nodo padre» y, sin esto, gana él.
        Prec.high(keymap.of([{ key: 'Mod-b', run: (v) => wrap(v, '**') }, { key: 'Mod-i', run: (v) => wrap(v, '*') }, { key: 'Enter', run: continueMarkup }])),
        EditorView.editorAttributes.of((v) => ({ class: !v.state.field(liveField) ? 'cm-mode-markdown cm-mode-plain' : v.state.field(modeField) === 'rich' ? 'cm-mode-rich' : 'cm-mode-markdown' })),
        tooltip,
        EditorView.updateListener.of((u) => { if (u.docChanged) live.current.onChange(u.state.doc.toString()) }),
        EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', 'aria-label': 'Texto' }),
      ],
    })
    view.current = v
    return () => { v.destroy(); view.current = null }
    // El editor se crea una vez por borrador; `initial` solo vale al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { view.current?.dispatch({ effects: refresh.of(null) }) }, [revision])
  useEffect(() => { view.current?.dispatch({ effects: setFicheros.of(ficheros) }) }, [ficheros])
  useEffect(() => { view.current?.dispatch({ effects: setPeekAll.of(peekAll) }) }, [peekAll])
  useEffect(() => { view.current?.dispatch({ effects: setMode.of(mode) }) }, [mode])
  useEffect(() => { view.current?.dispatch({ effects: setLive.of(liveFormat) }) }, [liveFormat])
  // Cuando llega la composición nueva del texto, se repintan las referencias.
  useEffect(() => { view.current?.dispatch({ effects: refresh.of(null) }) }, [rendered])

  useImperativeHandle(ref, () => ({
    format: (f) => formatRef.current(f),
    insert(text) {
      const v = view.current
      if (!v) return
      const { from, to } = v.state.selection.main
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true })
      v.focus()
    },
    setText(text) {
      const v = view.current
      if (v && v.state.doc.toString() !== text) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } })
    },
    goTo(pos) {
      const v = view.current
      if (!v) return
      v.dispatch({ selection: { anchor: Math.min(pos, v.state.doc.length) }, scrollIntoView: true })
      v.focus()
    },
    focus: () => view.current?.focus(),
  }), [])

  return <div className="md-editor" ref={host} />
})
