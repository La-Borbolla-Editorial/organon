import { indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { EditorState, StateEffect, StateField, type Range } from '@codemirror/state'
import { Decoration, hoverTooltip, keymap, WidgetType, type DecorationSet } from '@codemirror/view'
import { EditorView, minimalSetup } from 'codemirror'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { findTokens, type Token } from '../draft'

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

export interface MarkdownEditorHandle {
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
  /** Cambia cuando cambian las fichas o los ficheros: se repintan las referencias. */
  revision: unknown
}

const refresh = StateEffect.define<null>()
const togglePeek = StateEffect.define<number>()
const setPeekAll = StateEffect.define<boolean>()

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
  toDOM() {
    const box = document.createElement('div')
    box.className = 'cm-peek'
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
  ignoreEvent() { return false }
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor({ initial, ficheros, onChange, describe, peek, peekAll, revision }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // Lo que usan las extensiones de CodeMirror, siempre al día sin recrear el editor.
  const live = useRef({ ficheros, onChange, describe, peek })
  live.current = { ficheros, onChange, describe, peek }

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

    const build = (state: EditorState): DecorationSet => {
      const { all, flipped } = state.field(peeks)
      const out: Range<Decoration>[] = []
      for (const t of tokensOf(state)) {
        const info = live.current.describe(t)
        const open = all !== flipped.includes(t.from)
        out.push(Decoration.mark({ class: `cm-ficha cm-ficha-${t.kind}${info.ok ? '' : ' cm-ficha-bad'}` }).range(t.from, t.to))
        out.push(Decoration.widget({ widget: new PeekToggle(t.from, open), side: 1 }).range(t.to))
        if (open) out.push(Decoration.widget({ widget: new PeekBlock(live.current.peek(t)), block: true, side: 2 }).range(state.doc.lineAt(t.to).to))
      }
      return Decoration.set(out, true)
    }

    // Los bloques (las fichas asomadas) solo pueden venir de un campo de estado.
    const highlight = StateField.define<DecorationSet>({
      create: build,
      update: (value, tr) => (tr.docChanged || tr.effects.some((e) => e.is(refresh) || e.is(togglePeek) || e.is(setPeekAll)) ? build(tr.state) : value),
      provide: (field) => EditorView.decorations.from(field),
    })

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
        highlight,
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

  useImperativeHandle(ref, () => ({
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
