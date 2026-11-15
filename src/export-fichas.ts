// Documento de trabajo: el texto tal como se escribió, con las fichas que nombra
// desplegadas debajo de cada punto (como al asomarlas en el editor), listo para imprimir.
type Renderer = { render(src: string): string }
import { authorsLabel } from './citations'
import { findTokens, lookupRef, splitFrontMatter, type DraftContext, type FichaRef } from './draft'
import type { Fichero } from './types'

// Marcas que no pueden aparecer en un texto normal: rodean el número de la referencia.
const OPEN = ''
const CLOSE = ''
const MARK = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g')

/** «f. 51», «Escoto f. 3, p. 70», «cf. f. 51 «pedazo»». */
function refLabel(ref: FichaRef): string {
  return [ref.prefix, ref.fichero, `${ref.marker} ${ref.num}`].filter(Boolean).join(' ')
    + (ref.page ? `, p. ${ref.page}` : '')
    + (ref.fragment ? ` «${ref.fragment}»` : '')
}

/** Encabezado de la ficha: «f. 51 — King, «The Problem…», p. 179». */
function cardHead(ref: FichaRef, fallback: Fichero | null, ctx: DraftContext): { head: string; quote: string; bad: boolean } {
  const found = lookupRef(ref, fallback, ctx)
  const label = `${ref.marker} ${ref.num}`
  if ('error' in found) return { head: label, quote: found.error, bad: true }
  const { ficha, source } = found
  const parts: string[] = []
  if (source) {
    const who = authorsLabel(source.csl)
    const title = source.csl.title ? `«${source.csl.title}»` : ''
    parts.push([who, title].filter(Boolean).join(', '))
  }
  if (ficha.pageLabel) parts.push(`p. ${ficha.pageLabel}`)
  const where = parts.filter(Boolean).join(', ')
  return { head: where ? `${label} — ${where}` : label, quote: ficha.cita || ficha.notaPermanente, bad: false }
}

/**
 * HTML del texto con las fichas a la vista. Las referencias se quedan en el texto
 * entre paréntesis, «(f. 51)», y cada ficha nombrada se despliega en un recuadro
 * debajo del párrafo o punto del esquema que la nombra, una vez por punto.
 */
export function composeWithFichas(draft: string, md: Renderer, fallback: Fichero | null, ctx: DraftContext): string {
  const { body } = splitFrontMatter(draft)
  const tokens = findTokens(body, ctx.ficheros)
  let marked = ''
  let at = 0
  tokens.forEach((t, i) => {
    marked += body.slice(at, t.from) + OPEN + i + CLOSE
    at = t.to
  })
  marked += body.slice(at)

  const doc = new DOMParser().parseFromString(`<body>${md.render(marked)}</body>`, 'text/html')
  // Recoge los textos con marcas antes de tocarlos: al cambiarlos, el recorrido se pierde.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.includes(OPEN)) nodes.push(n as Text)

  // Por bloque (párrafo o punto del esquema), las fichas que nombra, sin repetir.
  const perBlock = new Map<Element, Map<string, FichaRef>>()
  for (const node of nodes) {
    const frag = doc.createDocumentFragment()
    let last = 0
    const text = node.nodeValue ?? ''
    for (const m of text.matchAll(MARK)) {
      frag.append(text.slice(last, m.index))
      last = m.index + m[0].length
      const token = tokens[Number(m[1])]
      const span = doc.createElement('span')
      span.className = 'wk-ref'
      span.textContent = `(${token.refs.map(refLabel).join('; ')})`
      frag.append(span)
      const block = node.parentElement?.closest('li, p, h1, h2, h3, h4, h5, h6, td, th')
      if (!block) continue
      const refs = perBlock.get(block) ?? new Map<string, FichaRef>()
      for (const ref of token.refs) {
        const key = `${(ref.fichero ?? '').toLowerCase()}|${ref.marker.toLowerCase()}|${ref.num}`
        if (!refs.has(key)) refs.set(key, ref)
      }
      perBlock.set(block, refs)
    }
    frag.append(text.slice(last))
    node.replaceWith(frag)
  }

  for (const [block, refs] of perBlock) {
    const box = doc.createElement('div')
    box.className = 'wk-fichas'
    for (const ref of refs.values()) {
      const { head, quote, bad } = cardHead(ref, fallback, ctx)
      const card = box.appendChild(doc.createElement('div'))
      card.className = bad ? 'wk-ficha bad' : 'wk-ficha'
      card.appendChild(doc.createElement('div')).className = 'wk-head'
      card.lastElementChild!.textContent = head
      for (const para of quote.split(/\n\s*\n/)) {
        const p = card.appendChild(doc.createElement('p'))
        p.textContent = para.trim()
      }
    }
    // En un punto del esquema, las fichas van antes de sus subpuntos.
    if (block.tagName === 'LI') {
      const sub = Array.from(block.children).find((c) => c.tagName === 'UL' || c.tagName === 'OL')
      block.insertBefore(box, sub ?? null)
    } else if (block.tagName === 'TD' || block.tagName === 'TH') block.append(box)
    else block.after(box)
  }
  return doc.body.innerHTML
}
