// Marcas del PDF: lo que hay bajo el cursor, el orden en el documento y el paso a ficha.
import type { Anchor, Ficha, HlColor, Marca } from '../types'

type Rect = [x: number, y: number, w: number, h: number]

const inRect = (x: number, y: number, [rx, ry, rw, rh]: Rect, pad = 0) => x >= rx - pad && x <= rx + rw + pad && y >= ry - pad && y <= ry + rh + pad

export const anchorHit = (a: Anchor | null | undefined, page: number, x: number, y: number) =>
  !!a?.rects.some((g) => g.page === page && g.r.some((r) => inRect(x, y, r)))

/** Radio (en fracción del ancho de la hoja) en que se pulsa una nota. */
const NOTE_RADIUS = 0.018

/**
 * Lo que hay bajo un punto de la hoja (coordenadas 0–1). Las notas van primero (son pequeñas y
 * están encima); luego recortes y resaltados. Entre varios, gana el último creado.
 */
export function marcaAt(marcas: Marca[], page: number, x: number, y: number): Marca | null {
  const notes = marcas.filter((m) => m.kind === 'nota' && m.page === page && m.at && Math.hypot(m.at[0] - x, m.at[1] - y) <= NOTE_RADIUS * 1.5)
  if (notes.length) return notes[notes.length - 1]
  const rest = marcas.filter((m) => (m.kind === 'recorte' ? m.page === page && m.rect && inRect(x, y, m.rect) : m.kind === 'resaltado' && anchorHit(m.anchor, page, x, y)))
  return rest[rest.length - 1] ?? null
}

/** Dónde empieza una marca o una ficha en el documento: hoja y altura. */
export function startOf(item: Marca | Ficha): { page: number; y: number } | null {
  if ('kind' in item) {
    if (item.kind === 'resaltado') return item.anchor?.rects[0] ? { page: item.anchor.rects[0].page, y: item.anchor.rects[0].r[0]?.[1] ?? 0 } : null
    if (item.kind === 'nota') return item.page && item.at ? { page: item.page, y: item.at[1] } : null
    return item.page && item.rect ? { page: item.page, y: item.rect[1] } : null
  }
  const g = item.anchor?.rects[0]
  return g ? { page: g.page, y: g.r[0]?.[1] ?? 0 } : null
}

/** En el orden en que aparecen en el PDF (lo que no tiene sitio, al final). */
export function inDocumentOrder<T extends Marca | Ficha>(items: T[]): T[] {
  const key = (it: T) => startOf(it) ?? { page: Infinity, y: 0 }
  return [...items].sort((a, b) => key(a).page - key(b).page || key(a).y - key(b).y)
}

/** El ancla de un recorte: un único rectángulo, sin texto. */
export function recorteAnchor(page: number, rect: Rect): Anchor {
  const half = (rect[0] + rect[2] / 2 > 0.5 ? 1 : 0) as 0 | 1
  return { start: { page, half }, end: { page, half }, exact: '', rects: [{ page, r: [rect] }] }
}

/** Rectángulo normalizado (ancho y alto positivos, dentro de la hoja) entre dos esquinas. */
export function rectBetween(a: [number, number], b: [number, number]): Rect {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const x0 = clamp(Math.min(a[0], b[0]))
  const y0 = clamp(Math.min(a[1], b[1]))
  return [x0, y0, clamp(Math.max(a[0], b[0])) - x0, clamp(Math.max(a[1], b[1])) - y0]
}

/** Lo que una ficha hereda de la marca de la que nace. */
export function fichaFieldsFrom(m: Marca): { anchor: Anchor; cita: string; color?: HlColor; imagen?: string } | null {
  if (m.kind === 'resaltado' && m.anchor) return { anchor: m.anchor, cita: m.anchor.exact, color: m.color }
  if (m.kind === 'recorte' && m.page && m.rect) return { anchor: recorteAnchor(m.page, m.rect), cita: '', imagen: m.imagen }
  return null
}
