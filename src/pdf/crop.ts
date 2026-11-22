// Imagen de un trozo de una hoja del PDF (los recortes).
import type { PDFDocumentProxy } from './pdfjs'

/** Resolución del recorte: 3 × 72 = 216 puntos por pulgada, nítido para leer e imprimir. */
const SCALE = 3
/** Lado mayor máximo de la imagen, en píxeles: una hoja entera no pasa de unos pocos MB. */
const MAX_SIDE = 2600

/** PNG del rectángulo `rect` (0–1) de la hoja `page`. */
export async function renderCrop(doc: PDFDocumentProxy, page: number, rect: [number, number, number, number]): Promise<Uint8Array> {
  const p = await doc.getPage(page)
  const base = p.getViewport({ scale: 1 })
  const [x, y, w, h] = rect
  const scale = Math.min(SCALE, MAX_SIDE / Math.max(w * base.width, h * base.height))
  const vp = p.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * vp.width))
  canvas.height = Math.max(1, Math.round(h * vp.height))
  // Se dibuja la hoja desplazada para que solo caiga en el lienzo el trozo elegido.
  await p.render({ canvas, viewport: vp, transform: [1, 0, 0, 1, -x * vp.width, -y * vp.height] }).promise
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('No se pudo crear la imagen del recorte.')
  return new Uint8Array(await blob.arrayBuffer())
}

// Imágenes ya leídas, por nombre de archivo (blob: URL).
const urls = new Map<string, Promise<string>>()

/** URL para mostrar la imagen de un recorte guardado en `recortes/`. */
export function recorteUrl(name: string, read: (name: string) => Promise<Uint8Array>): Promise<string> {
  let u = urls.get(name)
  if (!u) {
    u = read(name).then((bytes) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' })))
    u.catch(() => urls.delete(name))
    urls.set(name, u)
  }
  return u
}
