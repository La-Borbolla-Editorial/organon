// El orden importa: pdf_viewer.mjs lee globalThis.pdfjsLib, que define pdf.mjs.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { EventBus, FindState, PDFFindController, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { EventBus, FindState, PDFFindController, PDFLinkService, PDFViewer }
export type { PDFDocumentProxy } from 'pdfjs-dist'

export function openPdf(data: Uint8Array) {
  return pdfjs.getDocument({
    data,
    cMapUrl: '/pdfjs/cmaps/',
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
  }).promise
}

/** true si las páginas muestreadas no tienen texto seleccionable (PDF escaneado sin OCR). */
export async function lacksTextLayer(doc: pdfjs.PDFDocumentProxy): Promise<boolean> {
  const n = doc.numPages
  const sample = [...new Set([1, Math.ceil(n / 3), Math.ceil(n / 2), Math.ceil((2 * n) / 3), n])]
  let chars = 0
  for (const p of sample) {
    const content = await (await doc.getPage(p)).getTextContent()
    for (const item of content.items) if ('str' in item) chars += item.str.trim().length
    if (chars > 40) return false
  }
  return true
}
