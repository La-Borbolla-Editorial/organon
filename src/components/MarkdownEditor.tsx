import { markdown } from '@codemirror/lang-markdown'
import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import { Decoration, hoverTooltip, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { EditorView, minimalSetup } from 'codemirror'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { findTokens, type Token } from '../draft'

export interface TokenInfo {
  ok: boolean
  /** Texto de la ayuda que aparece al pasar el ratón. */
  title: string
  detail: string
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
  ficheroNames: string[]
  onChange: (text: string) => void
  describe: (token: Token) => TokenInfo
  /** Cambia cuando cambian las fichas o los ficheros: se repintan las referencias. */
  revision: unknown
}

const refresh = StateEffect.define<null>()

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor({ initial, ficheroNames, onChange, describe, revision }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // Lo que usan las extensiones de CodeMirror, siempre al día sin recrear el editor.
  const live = useRef({ ficheroNames, onChange, describe })
  live.current = { ficheroNames, onChange, describe }

  useEffect(() => {
    const tokensIn = (v: EditorView) => findTokens(v.state.doc.toString(), live.current.ficheroNames)

    const highlight = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(v: EditorView) { this.decorations = this.build(v) }
        update(u: ViewUpdate) {
          if (u.docChanged || u.transactions.some((t) => t.effects.some((e) => e.is(refresh)))) this.decorations = this.build(u.view)
        }
        build(v: EditorView) {
          const b = new RangeSetBuilder<Decoration>()
          for (const t of tokensIn(v)) {
            const info = live.current.describe(t)
            b.add(t.from, t.to, Decoration.mark({ class: `cm-ficha cm-ficha-${t.kind}${info.ok ? '' : ' cm-ficha-bad'}` }))
          }
          return b.finish()
        }
      },
      { decorations: (p) => p.decorations },
    )

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
        EditorView.lineWrapping,
        highlight,
        tooltip,
        EditorView.updateListener.of((u) => { if (u.docChanged) live.current.onChange(u.state.doc.toString()) }),
        EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', 'aria-label': 'Texto del borrador' }),
      ],
    })
    view.current = v
    return () => { v.destroy(); view.current = null }
    // El editor se crea una vez por borrador; `initial` solo vale al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { view.current?.dispatch({ effects: refresh.of(null) }) }, [revision])

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
