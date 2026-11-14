import { indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { ensureSyntaxTree, indentUnit, syntaxTree } from '@codemirror/language'
import { EditorSelection, EditorState, StateEffect, StateField, type Range } from '@codemirror/state'
import { Decoration, hoverTooltip, keymap, WidgetType, type DecorationSet } from '@codemirror/view'
import { EditorView, minimalSetup } from 'codemirror'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { findTokens, splitFrontMatter, type RenderedToken, type Token } from '../draft'

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

const hidden = Decoration.replace({})

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
    return a.raw === b.raw && a.inText === b.inText && a.block === b.block && a.mark === b.mark && a.note === b.note && a.failed === b.failed && a.from === b.from
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
      view.dispatch({ selection: { anchor: Math.min(t.from + 1, view.state.doc.length) } })
      view.focus()
    }
    return el
  }
  ignoreEvent() { return true }
}

/** Botoncito tras cada referencia: abre o cierra su ficha. */
class PeekToggle extends WidgetType {
  constructor(readonly from: number, readonly open: boolean) { super() }
  eq(other: PeekToggle) { return other.from === this.from && other.open === this.open }
  toDOM(view: EditorView) {
    const b = document.createElement('button')
    b.className = `cm-peek-toggle${this.open ? ' open' : ''}`
    b.type = 'button'
    b.textContent = this.open ? '▾' : '▸'
    b.title = this.open ? 'Ocultar la ficha' : 'Ver la ficha aquí (no se añade al texto)'
    b.setAttribute('aria-label', b.title)
    b.onmousedown = (e) => {
      e.preventDefault()
      view.dispatch({ effects: togglePeek.of(this.from) })
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

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor({ initial, ficheros, onChange, describe, peek, peekAll, mode, rendered, quotes, revision }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // Lo que usan las extensiones de CodeMirror, siempre al día sin recrear el editor.
  const formatRef = useRef<(f: Format) => void>(() => {})
  const live = useRef({ ficheros, onChange, describe, peek, rendered, quotes })
  live.current = { ficheros, onChange, describe, peek, rendered, quotes }

  useEffect(() => {
    const tokensOf = (state: EditorState) => findTokens(state.doc.toString(), live.current.ficheros)
    const tokensIn = (v: EditorView) => tokensOf(v.state)

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

    const modeField = StateField.define<EditorMode>({
      create: () => mode,
      update: (value, tr) => tr.effects.reduce((m, e) => (e.is(setMode) ? e.value : m), value),
    })

    /** Decoraciones del modo enriquecido: oculta la sintaxis de Markdown y le da su aspecto. */
    const richDecorations = (state: EditorState, tokens: Token[], out: Range<Decoration>[]) => {
      const doc = state.doc
      const sel = state.selection.ranges
      const touches = (from: number, to: number) => sel.some((r) => r.from <= to && r.to >= from)
      const onLine = (pos: number) => { const line = doc.lineAt(pos); return touches(line.from, line.to) }
      const hide = (from: number, to: number) => { if (to > from) out.push(hidden.range(from, to)) }
      const lineClass = (from: number, to: number, cls: string) => {
        for (let pos = from; pos <= to; ) {
          const line = doc.lineAt(pos)
          out.push(Decoration.line({ class: cls }).range(line.from))
          pos = line.to + 1
        }
      }

      // La cabecera (--- fichero: X ---) se pliega mientras no se esté editando.
      const front = splitFrontMatter(doc.toString()).offset
      if (front > 0) {
        const end = Math.max(0, front - 1)
        if (touches(0, end)) lineClass(0, end, 'cm-rich-front')
        else out.push(Decoration.replace({ block: true }).range(0, end))
      }

      const tree = ensureSyntaxTree(state, doc.length, 80) ?? syntaxTree(state)
      tree.iterate({
        enter(node) {
          if (node.to <= front) return false
          const { name, from, to } = node
          const heading = /^ATXHeading(\d)$/.exec(name)
          if (heading) lineClass(from, from, `cm-rich-h cm-rich-h${heading[1]}`)
          else if (name === 'HeaderMark') {
            // «## » se oculta salvo en la línea donde está el cursor.
            if (!onLine(from)) hide(from, doc.sliceString(to, to + 1) === ' ' ? to + 1 : to)
          } else if (name === 'Blockquote') lineClass(from, to, 'cm-rich-quote')
          else if (name === 'QuoteMark') {
            if (!onLine(from)) hide(from, doc.sliceString(to, to + 1) === ' ' ? to + 1 : to)
          } else if (name === 'ListMark') {
            if (/^[-*+]$/.test(doc.sliceString(from, to)) && !touches(from, to)) out.push(Decoration.replace({ widget: new Bullet() }).range(from, to))
          } else if (name === 'Emphasis') out.push(Decoration.mark({ class: 'cm-rich-em' }).range(from, to))
          else if (name === 'StrongEmphasis') out.push(Decoration.mark({ class: 'cm-rich-strong' }).range(from, to))
          else if (name === 'InlineCode') out.push(Decoration.mark({ class: 'cm-rich-code' }).range(from, to))
          else if (name === 'EmphasisMark' || name === 'CodeMark') {
            const parent = node.node.parent
            if (parent && parent.name !== 'FencedCode' && !touches(parent.from, parent.to)) hide(from, to)
          } else if (name === 'Link') {
            // Una referencia a ficha ([f. 51]) no es un enlace: de ella se ocupa quien pinta las referencias.
            if (tokens.some((t) => t.from < to && t.to > from)) return false
            // [texto](url): solo se ve el texto, salvo con el cursor dentro.
            const close = node.node.getChildren('LinkMark')[1]
            if (close && !touches(from, to)) {
              hide(from, from + 1)
              hide(close.from, to)
              out.push(Decoration.mark({ class: 'cm-rich-link' }).range(from + 1, close.from))
            }
            return false
          }
          return true
        },
      })
    }

    const build = (state: EditorState): DecorationSet => {
      const { all, flipped } = state.field(peeks)
      const rich = state.field(modeField) === 'rich'
      const out: Range<Decoration>[] = []
      const tokens = tokensOf(state)
      if (rich) richDecorations(state, tokens, out)
      const sel = state.selection.ranges
      const { quotes } = live.current
      tokens.forEach((t, index) => {
        const info = live.current.describe(t)
        const open = all !== flipped.includes(t.from)
        // En modo enriquecido la referencia se ve como quedará, salvo que el cursor esté en ella.
        const shown = live.current.rendered[index]
        const raw = state.doc.sliceString(t.from, t.to)
        if (rich && shown && shown.raw === raw && !sel.some((r) => r.from <= t.to && r.to >= t.from)) {
          out.push(Decoration.replace({ widget: new RenderedRef({ ...shown, from: t.from }, quotes, /^\d+$/.test(shown.mark)) }).range(t.from, t.to))
          if (shown.block && shown.inText) out.push(Decoration.line({ class: 'cm-rich-quote' }).range(state.doc.lineAt(t.from).from))
        } else {
          out.push(Decoration.mark({ class: `cm-ficha cm-ficha-${t.kind}${info.ok ? '' : ' cm-ficha-bad'}` }).range(t.from, t.to))
        }
        out.push(Decoration.widget({ widget: new PeekToggle(t.from, open), side: 1 }).range(t.to))
        if (open) out.push(Decoration.widget({ widget: new PeekBlock(live.current.peek(t)), block: true, side: 2 }).range(state.doc.lineAt(t.to).to))
      })
      return Decoration.set(out, true)
    }

    // Los bloques (las fichas asomadas) solo pueden venir de un campo de estado.
    const highlight = StateField.define<DecorationSet>({
      create: build,
      update(value, tr) {
        const effect = tr.effects.some((e) => e.is(refresh) || e.is(togglePeek) || e.is(setPeekAll) || e.is(setMode))
        // En modo enriquecido, mover el cursor cambia qué sintaxis se muestra.
        const moved = tr.selection !== undefined && tr.state.field(modeField) === 'rich'
        return tr.docChanged || effect || moved ? build(tr.state) : value
      },
      provide: (field) => [EditorView.decorations.from(field), EditorView.atomicRanges.of((v) => v.state.field(field).update({ filter: (_f, _t, d) => d.spec.widget instanceof RenderedRef }))],
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
      const t = tokensIn(v).find((x) => pos >= x.from && pos <= x.to)
      if (!t) return null
      return {
        pos: t.from,
        end: t.to,
        above: true,
        create() {
          const info = live.current.describe(t)
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
        markdown(),
        // Tab sangra la línea (o las seleccionadas) y Mayús+Tab la desangra: así se
        // anidan los puntos de un esquema. Esc y luego Tab saca el foco del editor.
        keymap.of([indentWithTab]),
        indentUnit.of('\t'),
        EditorState.tabSize.of(4),
        EditorView.lineWrapping,
        peeks,
        modeField,
        highlight,
        keymap.of([{ key: 'Mod-b', run: (v) => wrap(v, '**') }, { key: 'Mod-i', run: (v) => wrap(v, '*') }]),
        EditorView.editorAttributes.of((v) => ({ class: v.state.field(modeField) === 'rich' ? 'cm-mode-rich' : 'cm-mode-markdown' })),
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
  useEffect(() => { view.current?.dispatch({ effects: setPeekAll.of(peekAll) }) }, [peekAll])
  useEffect(() => { view.current?.dispatch({ effects: setMode.of(mode) }) }, [mode])
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
