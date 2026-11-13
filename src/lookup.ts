// Metadatos de una fuente a partir de su DOI o su ISBN. Son las únicas
// consultas a internet que hace Organon y solo envían ese identificador.
//   DOI  → doi.org (Crossref, DataCite…), que ya responde en CSL-JSON
//   ISBN → Open Library
import type { CslItem } from './types'

export type Identifier = { kind: 'doi'; value: string } | { kind: 'isbn'; value: string }

/** Reconoce un DOI o un ISBN aunque venga pegado con prefijo, enlace o guiones. */
export function parseIdentifier(input: string): Identifier | null {
  const t = input.trim()
  const doi = /\b(10\.\d{4,9}\/\S+)/.exec(t)
  if (doi) return { kind: 'doi', value: doi[1].replace(/[.,;)\]]+$/, '') }
  const isbn = t.replace(/^isbn(-1[03])?:?/i, '').replace(/[\s-]/g, '').toUpperCase()
  if (/^(\d{9}[\dX]|97[89]\d{10})$/.test(isbn)) return { kind: 'isbn', value: isbn }
  return null
}

// Crossref usa sus propios nombres de tipo; CSL usa otros.
const TYPES: Record<string, string> = {
  'journal-article': 'article-journal',
  'book-chapter': 'chapter',
  'book-section': 'chapter',
  'book-part': 'chapter',
  'reference-entry': 'entry-encyclopedia',
  'proceedings-article': 'paper-conference',
  monograph: 'book',
  'edited-book': 'book',
  'reference-book': 'book',
  dissertation: 'thesis',
  'posted-content': 'article',
}

const first = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v))
const people = (v: unknown) =>
  Array.isArray(v) ? v.filter((p) => p && (p.family || p.literal || p.name)).map((p) => (p.family ? { family: String(p.family), given: String(p.given ?? '') } : { literal: String(p.literal ?? p.name) })) : undefined

/** Deja de la respuesta de doi.org solo los campos bibliográficos, en CSL limpio. */
export function cslFromDoi(raw: Record<string, any>): Omit<CslItem, 'id'> {
  const out: Record<string, any> = { type: TYPES[raw.type] ?? raw.type ?? 'document', title: first(raw.title).replace(/\s+/g, ' ').trim() }
  const subtitle = first(raw.subtitle).trim()
  if (subtitle && !out.title.toLowerCase().includes(subtitle.toLowerCase())) out.title += `: ${subtitle}`
  for (const role of ['author', 'editor', 'translator'] as const) {
    const list = people(raw[role])
    if (list?.length) out[role] = list
  }
  const container = first(raw['container-title']).trim()
  if (container) out['container-title'] = container
  const year = (raw.issued ?? raw['published-print'] ?? raw.published)?.['date-parts']?.[0]?.[0]
  if (year) out.issued = { 'date-parts': [[Number(year)]] }
  for (const key of ['volume', 'issue', 'page', 'publisher', 'publisher-place', 'edition', 'DOI', 'URL'] as const) {
    if (raw[key] != null && String(raw[key]).trim() !== '') out[key] = String(raw[key])
  }
  const isbn = first(raw.ISBN)
  if (isbn) out.ISBN = isbn
  return out
}

/** «Thomas Williams» → { family: 'Williams', given: 'Thomas' } */
export function splitName(name: string) {
  const t = name.trim().replace(/\s+/g, ' ')
  if (t.includes(',')) {
    const [family, ...given] = t.split(',')
    return { family: family.trim(), given: given.join(',').trim() }
  }
  const parts = t.split(' ')
  if (parts.length === 1) return { literal: t }
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(' ') }
}

export function cslFromOpenLibrary(book: Record<string, any>, isbn: string): Omit<CslItem, 'id'> {
  const out: Record<string, any> = { type: 'book', title: [book.title, book.subtitle].filter(Boolean).join(': '), ISBN: isbn }
  const authors = (book.authors ?? []).map((a: any) => splitName(String(a.name ?? ''))).filter((a: any) => a.family || a.literal)
  if (authors.length) out.author = authors
  const year = /\b(\d{4})\b/.exec(String(book.publish_date ?? ''))?.[1]
  if (year) out.issued = { 'date-parts': [[Number(year)]] }
  if (book.publishers?.[0]?.name) out.publisher = String(book.publishers[0].name)
  if (book.publish_places?.[0]?.name) out['publisher-place'] = String(book.publish_places[0].name)
  return out
}

export async function lookup(id: Identifier): Promise<Omit<CslItem, 'id'>> {
  let res: Response
  try {
    res =
      id.kind === 'doi'
        ? await fetch(`https://doi.org/${encodeURI(id.value)}`, { headers: { Accept: 'application/vnd.citationstyles.csl+json' } })
        : await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${id.value}&format=json&jscmd=data`)
  } catch {
    throw new Error('No se pudo conectar. Comprueba la conexión a internet.')
  }
  if (id.kind === 'doi') {
    if (res.status === 404) throw new Error(`No existe el DOI ${id.value}.`)
    if (!res.ok) throw new Error(`El servicio de DOI respondió con un error (${res.status}).`)
    return cslFromDoi(await res.json())
  }
  if (!res.ok) throw new Error(`Open Library respondió con un error (${res.status}).`)
  const book = (await res.json())[`ISBN:${id.value}`]
  if (!book) throw new Error(`Open Library no tiene el ISBN ${id.value}. Rellena los datos a mano.`)
  return cslFromOpenLibrary(book, id.value)
}
