// Anotaciones de un PDF: leer las que trae (Zotero, Vista Previa, el iPad…) y escribir una copia
// del PDF con las marcas de Organon. El PDF original nunca se toca.
import type { PDFDocumentProxy } from './pdfjs'
import { cleanQuote } from './selection'
import type { Anchor, HlColor } from '../types'

type Rect = [x: number, y: number, w: number, h: number]

// Tipos de anotación de PDF (los números de pdf.js).
const TEXT = 1
const FREETEXT = 3
const HIGHLIGHT = 9
const UNDERLINE = 10
const SQUIGGLY = 11
const STRIKEOUT = 12
/** Las que se convierten en marcas: subrayados de todo tipo y notas. */
const PASSAGE_TYPES = new Set([HIGHLIGHT, UNDERLINE, SQUIGGLY, STRIKEOUT])
const NOTE_TYPES = new Set([TEXT, FREETEXT])
/** Lo mismo, con su nombre en el PDF (para quitarlas de la copia exportada). */
export const IMPORTABLE_SUBTYPES = ['Highlight', 'Underline', 'Squiggly', 'StrikeOut', 'Text', 'FreeText']

/** Una anotación leída del PDF, ya en coordenadas de Organon (0–1 de la hoja). */
export interface ImportedAnnotation {
  /** Identificador de la anotación dentro del PDF (para no importarla dos veces). */
  origen: string
  kind: 'resaltado' | 'nota'
  page: number
  anchor?: Anchor
  color?: HlColor
  at?: [number, number]
  /** Texto de la nota, o comentario del resaltado. */
  texto: string
}

// ---- Color --------------------------------------------------------------------------

/**
 * Tonos de referencia de cada color de Organon, cercanos a los que usan Zotero y Vista Previa
 * (sus resaltados vienen muy saturados). El rojo y el magenta van a rosa; el gris, a amarillo.
 */
const REFERENCE: [HlColor, [number, number, number]][] = [
  ['amarillo', [255, 212, 0]], ['amarillo', [255, 226, 122]], ['amarillo', [170, 170, 170]],
  ['verde', [95, 178, 54]], ['verde', [181, 227, 160]], ['verde', [124, 252, 0]],
  ['azul', [46, 168, 229]], ['azul', [159, 208, 247]], ['azul', [0, 122, 255]],
  ['rosa', [255, 102, 102]], ['rosa', [229, 110, 238]], ['rosa', [249, 184, 211]], ['rosa', [255, 0, 0]],
  ['naranja', [241, 152, 55]], ['naranja', [255, 194, 133]],
  ['morado', [162, 138, 229]], ['morado', [212, 189, 245]], ['morado', [128, 0, 255]],
]

/** El color de Organon más parecido a un color RGB (0–255). */
export function nearestColor(rgb: ArrayLike<number> | null | undefined): HlColor {
  if (!rgb || rgb.length < 3) return 'amarillo'
  let best: HlColor = 'amarillo'
  let dist = Infinity
  for (const [c, [r, g, b]] of REFERENCE) {
    // Distancia «redmean»: más fiel a cómo vemos el color que la euclídea simple.
    const rm = (rgb[0] + r) / 2
    const d = (2 + rm / 256) * (rgb[0] - r) ** 2 + 4 * (rgb[1] - g) ** 2 + (2 + (255 - rm) / 256) * (rgb[2] - b) ** 2
    if (d < dist) { dist = d; best = c }
  }
  return best
}

/** RGB (0–1) con que se exporta cada color: el tono de Organon. */
export const EXPORT_RGB: Record<HlColor, [number, number, number]> = {
  amarillo: [1, 0.886, 0.478], verde: [0.71, 0.89, 0.627], azul: [0.624, 0.816, 0.969],
  rosa: [0.976, 0.722, 0.827], naranja: [1, 0.761, 0.522], morado: [0.831, 0.741, 0.961],
}

// ---- Texto bajo un rectángulo ------------------------------------------------------------

/** Un trozo de texto de la hoja con su caja (0–1). */
export interface TextBox { str: string; x: number; y: number; w: number; h: number }

/**
 * El texto que cubren unos rectángulos (las líneas de un resaltado), cortando las palabras por
 * la proporción de cada trozo que queda dentro. Es una aproximación: el ancho de cada letra no
 * se conoce, pero en un resaltado los bordes suelen caer entre palabras.
 */
export function textUnder(boxes: TextBox[], rects: Rect[]): string {
  const lines: string[] = []
  for (const [rx, ry, rw, rh] of rects) {
    const inLine = boxes
      .filter((b) => { const cy = b.y + b.h / 2; return cy >= ry && cy <= ry + rh && b.x < rx + rw && b.x + b.w > rx })
      .sort((a, b) => a.x - b.x)
    let line = ''
    let lastEnd = -1
    for (const b of inLine) {
      const n = b.str.length
      const from = b.w > 0 ? Math.max(0, Math.round(((rx - b.x) / b.w) * n)) : 0
      const to = b.w > 0 ? Math.min(n, Math.round(((rx + rw - b.x) / b.w) * n)) : n
      const piece = b.str.slice(from, to)
      if (!piece) continue
      // Un hueco visible entre dos trozos es un espacio.
      if (line && lastEnd >= 0 && b.x - lastEnd > b.h * 0.15 && !line.endsWith(' ') && !piece.startsWith(' ')) line += ' '
      line += piece
      lastEnd = b.x + b.w
    }
    if (line.trim()) lines.push(trimPartialWords(line, inLine.length > 0 && cutsWord(inLine[0], rx, 'start'), inLine.length > 0 && cutsWord(inLine[inLine.length - 1], rx + rw, 'end')))
  }
  return cleanQuote(lines.join('\n'))
}

/** true si el borde del resaltado cae a media palabra dentro de ese trozo. */
function cutsWord(b: TextBox, edge: number, side: 'start' | 'end'): boolean {
  const n = b.str.length
  const at = Math.round(((edge - b.x) / b.w) * n)
  if (at <= 0 || at >= n) return false
  return side === 'start' ? /\S/.test(b.str[at - 1]) && /\S/.test(b.str[at]) : /\S/.test(b.str[at - 1]) && /\S/.test(b.str[at])
}

/**
 * Quita un trocito de palabra (1–3 letras) que se coló por un borde: «e. One word» → «One word».
 * Con el ancho de las letras estimado, un borde puede pasarse por una o dos letras.
 */
export function trimPartialWords(line: string, start: boolean, end: boolean): string {
  let s = line
  if (start) s = s.replace(/^\S{1,3}\s+(?=\S)/, '')
  if (end) s = s.replace(/(?<=\S)\s+\S{1,3}$/, '')
  return s
}

/** Une los cuadriláteros (QuadPoints) de una anotación en rectángulos, en píxeles de la vista. */
function quadsToRects(quads: ArrayLike<number>, toView: (x: number, y: number) => number[]): Rect[] {
  const out: Rect[] = []
  for (let i = 0; i + 7 < quads.length; i += 8) {
    const pts = [0, 2, 4, 6].map((k) => toView(quads[i + k], quads[i + k + 1]))
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    out.push([Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)])
  }
  return out
}

// ---- Leer -------------------------------------------------------------------------

/** Cuántas anotaciones importables trae el PDF (sin leer su texto). */
export async function countAnnotations(doc: PDFDocumentProxy): Promise<number> {
  let n = 0
  for (let p = 1; p <= doc.numPages; p++) {
    const annots = await (await doc.getPage(p)).getAnnotations()
    n += annots.filter((a: { annotationType: number }) => PASSAGE_TYPES.has(a.annotationType) || NOTE_TYPES.has(a.annotationType)).length
  }
  return n
}

/** Lee las anotaciones del PDF y las convierte en marcas. */
export async function readAnnotations(doc: PDFDocumentProxy): Promise<ImportedAnnotation[]> {
  const out: ImportedAnnotation[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const annots = (await page.getAnnotations()) as Array<{
      id: string; annotationType: number; quadPoints?: ArrayLike<number> | null; rect: number[]
      color?: ArrayLike<number> | null; contentsObj?: { str?: string }
    }>
    const relevant = annots.filter((a) => PASSAGE_TYPES.has(a.annotationType) || NOTE_TYPES.has(a.annotationType))
    if (!relevant.length) continue
    const vp = page.getViewport({ scale: 1 })
    const toView = (x: number, y: number) => vp.convertToViewportPoint(x, y)
    const norm = ([x, y, w, h]: Rect): Rect => [x / vp.width, y / vp.height, w / vp.width, h / vp.height]
    let boxes: TextBox[] | null = null
    const textBoxes = async () => {
      if (boxes) return boxes
      const content = await page.getTextContent()
      boxes = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue
        const t = item.transform as number[]
        const [x, y] = toView(t[4], t[5])
        const h = Math.hypot(t[2], t[3]) || item.height
        boxes.push({ str: item.str, x: x / vp.width, y: (y - h) / vp.height, w: item.width / vp.width, h: h / vp.height })
      }
      return boxes
    }
    for (const a of relevant) {
      const texto = (a.contentsObj?.str ?? '').trim()
      const origen = `${p}:${a.id}`
      if (PASSAGE_TYPES.has(a.annotationType)) {
        const viewRects = a.quadPoints?.length ? quadsToRects(a.quadPoints, toView) : quadsToRects([a.rect[0], a.rect[3], a.rect[2], a.rect[3], a.rect[0], a.rect[1], a.rect[2], a.rect[1]], toView)
        const rects = viewRects.map(norm).sort((r, s) => r[1] - s[1] || r[0] - s[0])
        if (!rects.length) continue
        const half = (r: Rect) => (r[0] + r[2] / 2 > 0.5 ? 1 : 0) as 0 | 1
        const anchor: Anchor = {
          start: { page: p, half: half(rects[0]) }, end: { page: p, half: half(rects[rects.length - 1]) },
          exact: textUnder(await textBoxes(), rects), rects: [{ page: p, r: rects }],
        }
        out.push({ origen, kind: 'resaltado', page: p, anchor, color: nearestColor(a.color), texto })
      } else {
        // La nota se coloca en la esquina superior izquierda de su icono.
        const [x, y] = toView(a.rect[0], a.rect[3])
        out.push({ origen, kind: 'nota', page: p, at: [Math.min(1, Math.max(0, x / vp.width)), Math.min(1, Math.max(0, y / vp.height))], texto })
      }
    }
  }
  return out
}

// ---- Escribir -------------------------------------------------------------------------

/** Lo que se escribe en la copia: rectángulos en coordenadas de Organon (0–1). */
export type ExportItem =
  | { kind: 'resaltado'; page: number; rects: Rect[]; color: HlColor; texto: string; id: string }
  | { kind: 'nota'; page: number; at: [number, number]; texto: string; id: string }
  | { kind: 'recuadro'; page: number; rect: Rect; texto: string; id: string }

const ACCENT: [number, number, number] = [0.478, 0.18, 0.18]

/**
 * Una copia del PDF con las marcas como anotaciones estándar. Con `replaceImported`, antes se
 * quitan de la copia las anotaciones del PDF que ya se importaron a Organon, para que no salgan
 * dos veces.
 */
export async function pdfWithMarks(bytes: Uint8Array, doc: PDFDocumentProxy, items: ExportItem[], replaceImported: boolean): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFArray, PDFDict, PDFHexString, PDFRef } = await import('pdf-lib')
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  const pages = pdf.getPages()
  const ctx = pdf.context
  const now = `D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`
  const text = (s: string) => PDFHexString.fromText(s)

  if (replaceImported) {
    const drop = new Set(IMPORTABLE_SUBTYPES)
    for (const page of pages) {
      const annots = page.node.Annots()
      if (!annots) continue
      const keep = PDFArray.withContext(ctx)
      const removed = new Set<string>()
      for (let i = 0; i < annots.size(); i++) {
        const ref = annots.get(i)
        const dict = ctx.lookup(ref)
        const subtype = dict instanceof PDFDict ? dict.lookup(PDFName.of('Subtype')) : null
        if (subtype instanceof PDFName && drop.has(subtype.decodeText())) removed.add(ref.toString())
      }
      for (let i = 0; i < annots.size(); i++) {
        const ref = annots.get(i)
        const dict = ctx.lookup(ref)
        // Sus ventanas emergentes (Popup) se van con ellas.
        const parent = dict instanceof PDFDict ? dict.get(PDFName.of('Parent')) : undefined
        if (removed.has(ref.toString()) || (parent instanceof PDFRef && removed.has(parent.toString()))) continue
        keep.push(ref)
      }
      page.node.set(PDFName.of('Annots'), keep)
    }
  }

  // Conversión de Organon (0–1, desde arriba) a puntos del PDF, con la rotación de cada hoja.
  const viewports = new Map<number, { w: number; h: number; toPdf: (x: number, y: number) => number[] }>()
  for (const n of new Set(items.map((i) => i.page))) {
    const vp = (await doc.getPage(n)).getViewport({ scale: 1 })
    viewports.set(n, { w: vp.width, h: vp.height, toPdf: (x, y) => vp.convertToPdfPoint(x, y) })
  }
  const box = (n: number, [x, y, w, h]: Rect) => {
    const v = viewports.get(n)!
    const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => v.toPdf(px * v.w, py * v.h))
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
  }
  const f = (v: number) => (Math.round(v * 100) / 100).toString()

  for (const item of items) {
    const page = pages[item.page - 1]
    if (!page) continue
    let dict: Record<string, unknown>
    if (item.kind === 'resaltado') {
      const boxes = item.rects.map((r) => box(item.page, r))
      const rect = [Math.min(...boxes.map((b) => b.x0)), Math.min(...boxes.map((b) => b.y0)), Math.max(...boxes.map((b) => b.x1)), Math.max(...boxes.map((b) => b.y1))]
      const [r, g, b] = EXPORT_RGB[item.color]
      // Apariencia propia (para los lectores que no la generan): rectángulos en modo «multiplicar».
      const ops = `/GS0 gs ${f(r)} ${f(g)} ${f(b)} rg ${boxes.map((q) => `${f(q.x0)} ${f(q.y0)} ${f(q.x1 - q.x0)} ${f(q.y1 - q.y0)} re`).join(' ')} f`
      const ap = ctx.register(ctx.stream(ops, {
        Type: 'XObject', Subtype: 'Form', BBox: rect, FormType: 1,
        Resources: { ExtGState: { GS0: { Type: 'ExtGState', BM: 'Multiply', ca: 1 } } },
      }))
      dict = {
        Type: 'Annot', Subtype: 'Highlight', Rect: rect, C: [r, g, b], CA: 1, F: 4,
        QuadPoints: boxes.flatMap((q) => [q.x0, q.y1, q.x1, q.y1, q.x0, q.y0, q.x1, q.y0]),
        AP: { N: ap },
      }
    } else if (item.kind === 'nota') {
      const v = viewports.get(item.page)!
      const [x, y] = v.toPdf(item.at[0] * v.w, item.at[1] * v.h)
      dict = { Type: 'Annot', Subtype: 'Text', Rect: [x, y - 20, x + 20, y], Name: 'Comment', C: [1, 0.843, 0.369], F: 4, Open: false }
    } else {
      const q = box(item.page, item.rect)
      const rect = [q.x0, q.y0, q.x1, q.y1]
      const ap = ctx.register(ctx.stream(`${ACCENT.map(f).join(' ')} RG 1.5 w ${f(q.x0 + 0.75)} ${f(q.y0 + 0.75)} ${f(q.x1 - q.x0 - 1.5)} ${f(q.y1 - q.y0 - 1.5)} re S`, {
        Type: 'XObject', Subtype: 'Form', BBox: rect, FormType: 1,
      }))
      dict = { Type: 'Annot', Subtype: 'Square', Rect: rect, C: ACCENT, F: 4, BS: { W: 1.5 }, AP: { N: ap } }
    }
    const annot = ctx.obj(dict as never) as unknown as import('pdf-lib').PDFDict
    annot.set(PDFName.of('T'), text('Organon'))
    annot.set(PDFName.of('M'), PDFHexString.fromText(now))
    annot.set(PDFName.of('NM'), text(`organon-${item.id}`))
    if (item.texto) annot.set(PDFName.of('Contents'), text(item.texto))
    page.node.addAnnot(ctx.register(annot))
  }
  return pdf.save({ useObjectStreams: false })
}
