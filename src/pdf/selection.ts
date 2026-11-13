// De la selección del navegador a un ancla: página(s), rectángulos y texto.
import type { Anchor } from '../types'

type Rect = [x: number, y: number, w: number, h: number]

export interface Capture {
  anchor: Anchor
  /** Punto de la ventana donde termina la selección (para colocar el botón). */
  client: { x: number; y: number }
}

/** Limpia el texto seleccionado: une líneas y palabras cortadas por guion a fin de línea. */
export function cleanQuote(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/(\p{L})[-­]\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .trim()
}

/** Une los rectángulos de una misma línea (PDF.js crea un <span> por fragmento). */
function mergeLines(rects: Rect[]): Rect[] {
  const out: Rect[] = []
  for (const r of rects) {
    const last = out[out.length - 1]
    const sameLine = last && Math.abs(last[1] + last[3] / 2 - (r[1] + r[3] / 2)) < Math.min(last[3], r[3]) * 0.6
    if (last && sameLine && r[0] <= last[0] + last[2] + 0.03 && r[0] + r[2] >= last[0]) {
      const x = Math.min(last[0], r[0])
      const y = Math.min(last[1], r[1])
      out[out.length - 1] = [x, y, Math.max(last[0] + last[2], r[0] + r[2]) - x, Math.max(last[1] + last[3], r[1] + r[3]) - y]
    } else out.push(r)
  }
  return out
}

export function captureSelection(viewer: HTMLElement): Capture | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const root = range.commonAncestorContainer
  if (!viewer.contains(root)) return null
  const exact = cleanQuote(sel.toString())
  if (!exact) return null

  const textNodes: Text[] = []
  if (root.nodeType === Node.TEXT_NODE) textNodes.push(root as Text)
  else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (range.intersectsNode(n)) textNodes.push(n as Text)
  }

  const byPage = new Map<number, Rect[]>()
  let lastClient: DOMRect | null = null
  for (const node of textNodes) {
    const pageDiv = node.parentElement?.closest<HTMLElement>('.textLayer')?.closest<HTMLElement>('.page')
    if (!pageDiv) continue
    const sub = document.createRange()
    sub.selectNodeContents(node)
    if (node === range.startContainer) sub.setStart(node, range.startOffset)
    if (node === range.endContainer) sub.setEnd(node, range.endOffset)
    const box = pageDiv.getBoundingClientRect()
    const left = box.left + pageDiv.clientLeft
    const top = box.top + pageDiv.clientTop
    const page = Number(pageDiv.dataset.pageNumber)
    for (const r of sub.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue
      lastClient = r
      const list = byPage.get(page) ?? []
      list.push([(r.left - left) / pageDiv.clientWidth, (r.top - top) / pageDiv.clientHeight, r.width / pageDiv.clientWidth, r.height / pageDiv.clientHeight])
      byPage.set(page, list)
    }
  }
  if (!lastClient || byPage.size === 0) return null

  const rects = [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([page, r]) => ({ page, r: mergeLines(r) }))
  const first = rects[0]
  const last = rects[rects.length - 1]
  // Mitad de la hoja (solo importa en hojas dobles): dónde empieza y dónde acaba la selección.
  const firstRect = first.r[0]
  const lastRect = last.r[last.r.length - 1]
  return {
    anchor: {
      start: { page: first.page, half: firstRect[0] < 0.5 ? 0 : 1 },
      end: { page: last.page, half: lastRect[0] + lastRect[2] <= 0.5 ? 0 : 1 },
      exact,
      rects,
    },
    client: { x: lastClient.right, y: lastClient.bottom },
  }
}
