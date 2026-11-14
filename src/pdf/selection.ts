// De la selección del navegador a un ancla: página(s), rectángulos y texto.
import type { Anchor } from '../types'

type Rect = [x: number, y: number, w: number, h: number]

export interface Capture {
  anchor: Anchor
  /** Punto de la ventana donde termina la selección (para colocar el botón). */
  client: { x: number; y: number }
  /** Encabezados y pies de página que se quitaron de una cita que cruza de página. */
  dropped: string[]
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

/** Un trozo de texto seleccionado, con su sitio en la página (coordenadas 0–1). */
export interface Piece {
  page: number
  text: string
  rect: Rect
}

type Line = { page: number; pieces: Piece[]; y: number; h: number; text: string }

function toLines(pieces: Piece[]): Line[] {
  const lines: Line[] = []
  for (const p of pieces) {
    const last = lines[lines.length - 1]
    const sameLine = last && last.page === p.page && Math.abs(last.y + last.h / 2 - (p.rect[1] + p.rect[3] / 2)) < Math.min(last.h, p.rect[3]) * 0.6
    if (sameLine) {
      const prev = last.pieces[last.pieces.length - 1].rect
      // Hueco apreciable entre dos fragmentos de la misma línea → son palabras distintas.
      const gap = p.rect[0] - (prev[0] + prev[2])
      last.text += (gap > prev[3] * 0.12 && !/\s$/.test(last.text) && !/^\s/.test(p.text) ? ' ' : '') + p.text
      last.pieces.push(p)
    } else lines.push({ page: p.page, pieces: [p], y: p.rect[1], h: p.rect[3], text: p.text })
  }
  return lines
}

const hasPageNumber = (text: string) => /^\s*\d{1,4}\b|\b\d{1,4}\s*$|^\s*[ivxlcdm]+\s*$/i.test(text)

/**
 * En una selección que cruza de página, quita los encabezados y pies que
 * quedan en medio (título corrido, número de página): no son parte de la cita.
 * Una línea se considera encabezado si está arriba del todo en una página que
 * no es la primera y va separada del texto o lleva el número de página; y pie,
 * lo mismo al final de una página que no es la última.
 */
export function dropRunningHeads(pieces: Piece[]): { kept: Piece[]; dropped: string[] } {
  const pages = [...new Set(pieces.map((p) => p.page))].sort((a, b) => a - b)
  if (pages.length < 2) return { kept: pieces, dropped: [] }
  const lines = toLines(pieces)
  const drop = new Set<Line>()
  for (const page of pages) {
    const own = lines.filter((l) => l.page === page)
    if (page !== pages[0]) {
      // Hasta dos líneas de encabezado (título corrido y número en líneas distintas).
      for (let i = 0; i < Math.min(2, own.length - 1); i++) {
        const line = own[i]
        const apart = own[i + 1].y - (line.y + line.h) > line.h * 0.9
        if (line.y < 0.16 && (apart || hasPageNumber(line.text))) drop.add(line)
        else break
      }
    }
    if (page !== pages[pages.length - 1]) {
      for (let i = own.length - 1; i >= Math.max(1, own.length - 2); i--) {
        const line = own[i]
        const apart = line.y - (own[i - 1].y + own[i - 1].h) > line.h * 0.9
        if (line.y > 0.84 && (apart || hasPageNumber(line.text))) drop.add(line)
        else break
      }
    }
  }
  const gone = new Set([...drop].flatMap((l) => l.pieces))
  return { kept: pieces.filter((p) => !gone.has(p)), dropped: [...drop].map((l) => l.text.trim()).filter(Boolean) }
}

/** El texto de los trozos, con un salto por línea (como lo daría el navegador). */
export const piecesText = (pieces: Piece[]) => toLines(pieces).map((l) => l.text).join('\n')

export function captureSelection(viewer: HTMLElement): Capture | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const root = range.commonAncestorContainer
  if (!viewer.contains(root)) return null
  if (!cleanQuote(sel.toString())) return null

  const textNodes: Text[] = []
  if (root.nodeType === Node.TEXT_NODE) textNodes.push(root as Text)
  else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (range.intersectsNode(n)) textNodes.push(n as Text)
  }

  const all: Piece[] = []
  let lastClient: DOMRect | null = null
  const clientOf = new Map<Piece, DOMRect>()
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
    let first = true
    for (const r of sub.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue
      // El texto del nodo va con su primer rectángulo; los demás solo aportan resaltado.
      const piece: Piece = { page, text: first ? sub.toString() : '', rect: [(r.left - left) / pageDiv.clientWidth, (r.top - top) / pageDiv.clientHeight, r.width / pageDiv.clientWidth, r.height / pageDiv.clientHeight] }
      first = false
      clientOf.set(piece, r)
      all.push(piece)
    }
  }
  if (all.length === 0) return null

  // En una sola página vale el texto del navegador; entre varias se quitan encabezados y pies.
  const { kept, dropped } = dropRunningHeads(all)
  const pieces = kept.length ? kept : all
  const multi = new Set(pieces.map((p) => p.page)).size > 1
  const exact = cleanQuote(multi ? piecesText(pieces) : sel.toString())
  if (!exact) return null
  lastClient = clientOf.get(pieces[pieces.length - 1])!

  const byPage = new Map<number, Rect[]>()
  for (const p of pieces) byPage.set(p.page, [...(byPage.get(p.page) ?? []), p.rect])
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
    dropped: kept.length ? dropped : [],
  }
}
