// Entre el formulario de una fuente y su ítem CSL. Al editar se parte del CSL
// existente y solo se tocan los campos del formulario: lo demás se conserva.
import { splitName } from './lookup'
import type { CslItem } from './types'

export const SOURCE_TYPES = {
  book: 'Libro',
  chapter: 'Capítulo de libro',
  'article-journal': 'Artículo de revista',
  thesis: 'Tesis',
  'entry-encyclopedia': 'Entrada de enciclopedia',
  'paper-conference': 'Ponencia en actas',
  webpage: 'Página web',
  document: 'Otro',
} as const

export interface SourceFields {
  type: string
  title: string
  /** Una persona por línea: «Apellido, Nombre». */
  author: string
  editor: string
  translator: string
  containerTitle: string
  year: string
  volume: string
  issue: string
  page: string
  edition: string
  publisher: string
  publisherPlace: string
  DOI: string
  ISBN: string
  URL: string
}

export const EMPTY_FIELDS: SourceFields = {
  type: 'book', title: '', author: '', editor: '', translator: '', containerTitle: '', year: '', volume: '', issue: '', page: '',
  edition: '', publisher: '', publisherPlace: '', DOI: '', ISBN: '', URL: '',
}

/** Qué campos tiene sentido pedir para cada tipo. */
export function fieldsFor(type: string): Set<keyof SourceFields> {
  const base: (keyof SourceFields)[] = ['author', 'title', 'year', 'translator', 'DOI', 'URL']
  const book: (keyof SourceFields)[] = ['editor', 'edition', 'publisher', 'publisherPlace', 'volume', 'ISBN']
  switch (type) {
    case 'book': return new Set([...base, ...book])
    case 'chapter': case 'entry-encyclopedia': case 'paper-conference': return new Set([...base, ...book, 'containerTitle', 'page'])
    case 'article-journal': return new Set([...base, 'containerTitle', 'volume', 'issue', 'page'])
    case 'thesis': return new Set([...base, 'publisher', 'publisherPlace'])
    case 'webpage': return new Set([...base, 'containerTitle'])
    default: return new Set(Object.keys(EMPTY_FIELDS) as (keyof SourceFields)[])
  }
}

const namesToText = (list: any[] | undefined) =>
  (list ?? []).map((p) => (p.family ? [p.family, p.given].filter(Boolean).join(', ') : String(p.literal ?? ''))).filter(Boolean).join('\n')

const textToNames = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean).map(splitName)

export function fieldsFromCsl(csl: Partial<CslItem>): SourceFields {
  const year = csl.issued?.['date-parts']?.[0]?.[0] ?? csl.issued?.literal ?? csl.issued?.raw ?? ''
  const s = (k: string) => (csl[k] == null ? '' : String(csl[k]))
  return {
    type: csl.type && csl.type in SOURCE_TYPES ? csl.type : csl.type ? 'document' : 'book',
    title: s('title'), author: namesToText(csl.author), editor: namesToText(csl.editor), translator: namesToText(csl.translator),
    containerTitle: s('container-title'), year: String(year), volume: s('volume'), issue: s('issue'), page: s('page'), edition: s('edition'),
    publisher: s('publisher'), publisherPlace: s('publisher-place'), DOI: s('DOI'), ISBN: s('ISBN'), URL: s('URL'),
  }
}

const CSL_KEYS: [keyof SourceFields, string][] = [
  ['title', 'title'], ['containerTitle', 'container-title'], ['volume', 'volume'], ['issue', 'issue'], ['page', 'page'], ['edition', 'edition'],
  ['publisher', 'publisher'], ['publisherPlace', 'publisher-place'], ['DOI', 'DOI'], ['ISBN', 'ISBN'], ['URL', 'URL'],
]

/** Aplica el formulario sobre `base` (el CSL anterior, o vacío). Los campos que el tipo no usa se dejan como estaban. */
export function applyFields(base: Record<string, any>, f: SourceFields): Record<string, any> {
  const shown = fieldsFor(f.type)
  const out: Record<string, any> = { ...base }
  // Si el tipo original no está en la lista («Otro»), no se pierde al guardar.
  if (!(f.type === 'document' && base.type && !(base.type in SOURCE_TYPES))) out.type = f.type
  for (const [field, key] of CSL_KEYS) {
    if (!shown.has(field)) continue
    const value = f[field].trim()
    if (value) out[key] = value
    else delete out[key]
  }
  for (const role of ['author', 'editor', 'translator'] as const) {
    if (!shown.has(role)) continue
    const names = textToNames(f[role])
    if (names.length) out[role] = names
    else delete out[role]
  }
  if (shown.has('year')) {
    const y = f.year.trim()
    if (/^-?\d{1,4}$/.test(y)) out.issued = { 'date-parts': [[Number(y)]] }
    else if (y) out.issued = { literal: y }
    else delete out.issued
  }
  return out
}

/** Clave de cita al estilo de Zotero: «williams2003». */
export function suggestCitekey(csl: Record<string, any>, taken: Set<string>): string {
  const person = (csl.author ?? csl.editor ?? [])[0]
  const name = String(person?.family ?? person?.literal ?? csl.title ?? 'fuente').split(/\s+/)[0]
  const base = (name.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'fuente') + (csl.issued?.['date-parts']?.[0]?.[0] ?? '')
  if (!taken.has(base)) return base
  for (let i = 0; ; i++) {
    const key = base + String.fromCharCode(98 + (i % 25)) + (i >= 25 ? Math.floor(i / 25) : '')
    if (!taken.has(key)) return key
  }
}
