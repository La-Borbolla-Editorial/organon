import { backend } from '../backend'
import { firstPageFromCsl } from '../citations'
import { setSourcePdf } from '../store'
import type { Source } from '../types'
import { guessPagination } from './guess'
import { openPdf } from './pdfjs'

const slug = (s: string) => s.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() || 'fuente'

/**
 * Adjunta (o sustituye) el PDF de una fuente: lo copia a `pdfs/`, conjetura su
 * paginación y la deja sin verificar.
 */
export async function attachPdf(source: Pick<Source, 'id' | 'citekey' | 'csl' | 'pdfFile'>, file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const doc = await openPdf(bytes.slice()) // PDF.js se queda con el búfer: se le da una copia
  const guess = await guessPagination(doc, firstPageFromCsl(source.csl))
  const pages = doc.numPages
  await doc.loadingTask.destroy()
  const name = source.pdfFile ?? `${slug(source.citekey)}-${source.id.slice(0, 8)}.pdf`
  await backend.savePdf(name, bytes)
  await setSourcePdf(source.id, name, pages, guess.ranges, guess.note)
}
