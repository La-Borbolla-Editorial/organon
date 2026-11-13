// Conjetura de la paginación a partir del propio PDF. Nunca se da por buena:
// la fuente queda «sin verificar» hasta que el usuario la confirma.
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { DEFAULT_PAGINATION, fromRoman, type NumStyle, type PageRange } from '../pagination'

export interface Guess {
  ranges: PageRange[]
  /** Explicación breve de dónde salió, para mostrarla al verificar. */
  note: string
  /** true si las páginas muestreadas no tienen capa de texto (falta OCR). */
  noText: boolean
}

function parseLabel(label: string): { n: number; style: NumStyle } | null {
  const t = label.trim()
  if (/^\d+$/.test(t)) return { n: Number(t), style: 'arabic' }
  const r = fromRoman(t)
  if (r !== null) return { n: r, style: t === t.toLowerCase() ? 'roman' : 'ROMAN' }
  return null
}

/** Etiquetas de página incrustadas en el PDF → tramos. */
export function rangesFromLabels(labels: string[]): PageRange[] | null {
  if (labels.every((l, i) => l === String(i + 1))) return null // triviales: no dicen nada
  const ranges: PageRange[] = []
  let prev: { n: number; style: NumStyle } | null = null
  labels.forEach((label, i) => {
    const cur = parseLabel(label)
    const last = ranges[ranges.length - 1]
    if (!cur) {
      if (!last || last.style !== 'none') ranges.push({ pdfStart: i + 1, first: 1, style: 'none', perPage: 1 })
    } else if (!prev || !last || last.style !== cur.style || cur.n !== prev.n + 1) {
      ranges.push({ pdfStart: i + 1, first: cur.n, style: cur.style, perPage: 1 })
    }
    prev = cur
  })
  return ranges.some((r) => r.style !== 'none') ? ranges : null
}

/** Números que aparecen en el encabezado o el pie de una página. */
async function marginNumbers(doc: PDFDocumentProxy, pageNo: number): Promise<{ nums: { n: number; x: number }[]; chars: number; wide: boolean }> {
  const page = await doc.getPage(pageNo)
  const [x0, y0, x1, y1] = page.view
  const w = x1 - x0
  const h = y1 - y0
  const content = await page.getTextContent()
  const nums: { n: number; x: number }[] = []
  let chars = 0
  for (const item of content.items) {
    if (!('str' in item)) continue
    chars += item.str.trim().length
    const y = (item.transform[5] - y0) / h
    if (y > 0.13 && y < 0.87) continue
    const x = (item.transform[4] - x0) / w
    const words = item.str.trim().split(/\s+/)
    // Solo números sueltos o al principio/fin de la línea («68 G. PINI», «— 12 —»).
    for (const [k, word] of [[0, words[0]], [1, words[words.length - 1]]] as const) {
      const m = /^[^\w]*(\d{1,4})[^\w]*$/.exec(word ?? '')
      if (m) nums.push({ n: Number(m[1]), x: k === 0 ? x : x + (item.width ?? 0) / w })
      if (words.length === 1) break
    }
  }
  return { nums, chars, wide: w > h * 1.2 }
}

function mode<T>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: { value: T; count: number } | null = null
  for (const [value, count] of counts) if (!best || count > best.count) best = { value, count }
  return best
}

export async function guessPagination(doc: PDFDocumentProxy, cslPages: { first: number; last: number | null } | null): Promise<Guess> {
  const total = doc.numPages

  // 1. Encabezados y pies: el número impreso de verdad. Es la señal más fiable.
  const step = Math.max(1, Math.ceil(total / 24))
  const sample: number[] = []
  for (let p = 1; p <= total; p += step) sample.push(p)
  let textPages = 0
  let widePages = 0
  const single: number[] = [] // n - p, una página por hoja
  const double: number[] = [] // n - 2p, hojas dobles (número de la mitad izquierda)
  for (const p of sample) {
    const { nums, chars, wide } = await marginNumbers(doc, p)
    if (chars > 20) textPages++
    if (wide) widePages++
    for (const n of new Set(nums.map((m) => m.n))) single.push(n - p)
    for (const m of nums) double.push((m.x < 0.5 ? m.n : m.n - 1) - 2 * p)
  }
  const noText = textPages === 0
  const need = Math.max(3, Math.ceil(sample.length * 0.4))
  const s = mode(single)
  const d = mode(double)
  const spreads = widePages > sample.length / 2 && d && d.count >= need && (!s || d.count > s.count)
  if (spreads && d) {
    const first = d.value + 2
    const range: PageRange = first >= 1 ? { pdfStart: 1, first, style: 'arabic', perPage: 2 } : { pdfStart: Math.ceil((1 - d.value) / 2), first: 1, style: 'arabic', perPage: 2 }
    if (first < 1) range.first = d.value + 2 * range.pdfStart
    return { ranges: [range], note: 'Conjetura: hojas dobles, según los números impresos en encabezados y pies.', noText }
  }
  if (s && s.count >= need) {
    const range: PageRange = s.value >= 0 ? { pdfStart: 1, first: 1 + s.value, style: 'arabic', perPage: 1 } : { pdfStart: 1 - s.value, first: 1, style: 'arabic', perPage: 1 }
    return { ranges: [range], note: 'Conjetura: según los números impresos en encabezados y pies.', noText }
  }

  // 2. Etiquetas de página incrustadas en el PDF.
  const labels = await doc.getPageLabels().catch(() => null)
  const fromLabels = labels && rangesFromLabels(labels)
  if (fromLabels) return { ranges: fromLabels, note: 'Conjetura: según las etiquetas de página del PDF.', noText }

  // 3. Rango de páginas de los metadatos (artículos y capítulos).
  if (cslPages) {
    const length = cslPages.last ? cslPages.last - cslPages.first + 1 : null
    // Si sobran hojas, se supone que son portadas añadidas al principio (JSTOR, etc.).
    const extra = length && total >= length && total - length <= 3 ? total - length : 0
    return {
      ranges: [{ pdfStart: 1 + extra, first: cslPages.first, style: 'arabic', perPage: 1 }],
      note: `Conjetura: según el rango de páginas de Zotero (${cslPages.first}${cslPages.last ? `–${cslPages.last}` : ''}).`,
      noText,
    }
  }
  return { ranges: DEFAULT_PAGINATION, note: 'Sin pistas en el PDF: se supone que la página impresa coincide con la del PDF.', noText }
}
