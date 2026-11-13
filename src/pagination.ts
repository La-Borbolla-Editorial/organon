// Paginación: de la página del PDF a la página IMPRESA que se cita.
//
// Cada fuente tiene una lista de tramos. Un tramo dice: «desde la página
// `pdfStart` del PDF, la página impresa es `first`, numerada en `style`, con
// `perPage` páginas impresas por hoja del PDF». Rige hasta el tramo siguiente.
// Las páginas anteriores al primer tramo no tienen número.

export type NumStyle = 'arabic' | 'roman' | 'ROMAN' | 'none'

export interface PageRange {
  pdfStart: number
  first: number
  style: NumStyle
  perPage: 1 | 2
}

export const DEFAULT_PAGINATION: PageRange[] = [{ pdfStart: 1, first: 1, style: 'arabic', perPage: 1 }]

const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
]

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n)
  let out = ''
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v }
  return out
}

export function fromRoman(s: string): number | null {
  const t = s.toLowerCase()
  if (!/^[ivxlcdm]+$/.test(t)) return null
  let n = 0
  let i = 0
  for (const [v, sym] of ROMAN) while (t.startsWith(sym, i)) { n += v; i += sym.length }
  return i === t.length && toRoman(n) === t ? n : null
}

export function normalize(ranges: PageRange[]): PageRange[] {
  const byStart = new Map<number, PageRange>()
  for (const r of ranges) byStart.set(r.pdfStart, r)
  return [...byStart.values()].sort((a, b) => a.pdfStart - b.pdfStart)
}

export function rangeFor(ranges: PageRange[], pdfPage: number): PageRange | null {
  let found: PageRange | null = null
  for (const r of normalize(ranges)) if (r.pdfStart <= pdfPage) found = r
  return found
}

/** Página impresa de una página del PDF. `null` si esa página no tiene número. */
export function printedPage(ranges: PageRange[], pdfPage: number, half: 0 | 1 = 0): string | null {
  const r = rangeFor(ranges, pdfPage)
  if (!r || r.style === 'none') return null
  const n = r.first + (pdfPage - r.pdfStart) * r.perPage + (r.perPage === 2 ? half : 0)
  if (n < 1) return null
  if (r.style === 'roman') return toRoman(n)
  if (r.style === 'ROMAN') return toRoman(n).toUpperCase()
  return String(n)
}

/** Etiqueta de una hoja completa: «70» o, en hojas dobles, «70-71». */
export function sheetLabel(ranges: PageRange[], pdfPage: number): string | null {
  const a = printedPage(ranges, pdfPage, 0)
  const b = printedPage(ranges, pdfPage, 1)
  return a && b && a !== b ? `${a}-${b}` : a
}

/** Página(s) a citar para una selección que va de `start` a `end`. */
export function citedPages(
  ranges: PageRange[],
  start: { page: number; half: 0 | 1 },
  end: { page: number; half: 0 | 1 },
): string {
  const a = printedPage(ranges, start.page, start.half)
  const b = printedPage(ranges, end.page, end.half)
  if (a && b && a !== b) return `${a}-${b}`
  return a ?? b ?? ''
}

/**
 * «La página `pdfPage` del PDF lleva impreso `label`.» Devuelve los tramos
 * corregidos: mueve el tramo que cubre esa página o, con `fromHere`, abre uno
 * nuevo a partir de ella. `null` si `label` no es un número de página.
 */
export function anchorPage(ranges: PageRange[], pdfPage: number, label: string, fromHere = false): PageRange[] | null {
  const t = label.trim()
  let n: number | null = null
  let style: NumStyle = 'arabic'
  if (/^\d+$/.test(t)) n = Number(t)
  else if ((n = fromRoman(t)) !== null) style = t === t.toLowerCase() ? 'roman' : 'ROMAN'
  if (n === null) return null
  const cur = rangeFor(ranges, pdfPage)
  if (!cur || fromHere) {
    return normalize([...ranges.filter((r) => r.pdfStart !== pdfPage), { pdfStart: pdfPage, first: n, style, perPage: cur?.perPage ?? 1 }])
  }
  const first = n - (pdfPage - cur.pdfStart) * cur.perPage
  if (first < 1) {
    // El tramo empezaría antes de la página 1: que empiece donde la numeración vale 1.
    const pdfStart = pdfPage - Math.floor((n - 1) / cur.perPage)
    const rest = ranges.filter((r) => r !== cur && r.pdfStart !== pdfStart)
    return normalize([...rest, { ...cur, pdfStart, first: n - (pdfPage - pdfStart) * cur.perPage, style }])
  }
  return normalize(ranges.map((r) => (r === cur ? { ...r, first, style } : r)))
}
