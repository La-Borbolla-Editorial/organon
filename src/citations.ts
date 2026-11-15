// Citas con formato: metadatos CSL-JSON (Zotero) + estilo .csl + citeproc.
// Añadir un estilo es añadir su archivo .csl a src/csl y una línea a STYLES.
import { Cite } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import CSL from 'citeproc'
import apa from './csl/apa.csl?raw'
import chicagoAuthorDate from './csl/chicago-author-date.csl?raw'
import chicagoNotes from './csl/chicago-notes-bibliography.csl?raw'
import chicagoShort from './csl/chicago-shortened-notes-bibliography.csl?raw'
import localeEn from './csl/locales-en-US.xml?raw'
import localeEs from './csl/locales-es-ES.xml?raw'
import mla from './csl/modern-language-association.csl?raw'
import type { CslItem } from './types'

export const STYLES = {
  'chicago-short': { name: 'Chicago (notas abreviadas y bibliografía)', xml: chicagoShort },
  'chicago-notes': { name: 'Chicago (notas completas y bibliografía)', xml: chicagoNotes },
  'chicago-author-date': { name: 'Chicago (autor-año)', xml: chicagoAuthorDate },
  apa: { name: 'APA 7.ª', xml: apa },
  mla: { name: 'MLA 9.ª', xml: mla },
} as const
export type StyleId = keyof typeof STYLES
export const DEFAULT_STYLE: StyleId = 'chicago-short'

export const LOCALES = { 'es-ES': 'Español', 'en-US': 'English' } as const
export type LocaleId = keyof typeof LOCALES
export const DEFAULT_LOCALE: LocaleId = 'es-ES'
const LOCALE_XML: Record<string, string> = { 'es-ES': localeEs, 'en-US': localeEn }

export interface CiteOptions {
  style: StyleId
  locale: LocaleId
}

// ---- Importación desde Zotero --------------------------------------------

/** Lee una exportación de Zotero: BibTeX/BibLaTeX (.bib) o CSL JSON (.json). */
export async function parseZoteroExport(text: string): Promise<CslItem[]> {
  const t = text.trim()
  let items: any[]
  if (t.startsWith('[') || t.startsWith('{')) {
    const data = JSON.parse(t)
    items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [data]
  } else {
    items = (await Cite.async(t)).data
  }
  return items
    .filter((i) => i && typeof i === 'object' && (i.title || i.author || i.editor))
    .map((i) => {
      const { _graph, ...rest } = i
      return { type: 'document', ...rest, id: String(rest.id ?? rest['citation-key'] ?? '') }
    })
}

// ---- Formato --------------------------------------------------------------

const items = new Map<string, CslItem>()
const engines = new Map<string, any>()

function engine(o: CiteOptions) {
  const key = `${o.style}|${o.locale}`
  let e = engines.get(key)
  if (!e) {
    const sys = {
      retrieveLocale: (lang: string) => LOCALE_XML[lang] ?? localeEn,
      retrieveItem: (id: string) => items.get(id),
    }
    e = new CSL.Engine(sys, STYLES[o.style].xml, o.locale, true)
    engines.set(key, e)
  }
  return e
}

function register(csl: CslItem) {
  const prev = items.get(csl.id)
  if (prev && JSON.stringify(prev) !== JSON.stringify(csl)) engines.clear() // citeproc guarda copia de los ítems
  items.set(csl.id, csl)
}

const locate = (page: string): Record<string, string> => (page.trim() ? { locator: page.trim(), label: 'page' } : {})

/**
 * Referencia canónica tal como se citará: la primera línea del campo de la ficha
 * («Ord. II, d. 3, p. 1, q. 6, n. 188»), que ya nombra la obra. Lo que va debajo son notas.
 */
export const canonicalText = (canonical?: string) => (canonical ?? '').trim().split(/\n/)[0].trim()

/** Cita (HTML) de una fuente con su página (o su referencia canónica), p. ej. «Pini, “Scotus on Individuation”, 69». */
export function formatCitation(csl: CslItem, page: string, o: CiteOptions, canonical?: string): string {
  // Una obra canónica se cita por su referencia canónica, sin autor ni edición.
  if (canonicalText(canonical)) return escapeHtml(canonicalText(canonical))
  try {
    register(csl)
    const e = engine(o)
    e.updateItems([csl.id])
    return e.makeCitationCluster([{ id: csl.id, ...locate(page) }])
  } catch (err) {
    console.error('citeproc', err)
    return escapeHtml([authorsLabel(csl), csl.title, page].filter(Boolean).join(', '))
  }
}

/** Entrada de bibliografía (HTML) de una fuente. */
export function formatBibliographyEntry(csl: CslItem, o: CiteOptions): string {
  try {
    register(csl)
    const e = engine(o)
    e.updateItems([csl.id])
    const [, entries] = e.makeBibliography()
    return String(entries[0] ?? '').trim()
  } catch (err) {
    console.error('citeproc', err)
    return escapeHtml([authorsLabel(csl), csl.title].filter(Boolean).join('. '))
  }
}

// ---- Un documento entero: citas numeradas en orden y bibliografía -----------------

export interface CiteItem {
  csl: CslItem
  page: string
  /** Referencia canónica («II d. 3 n. 29»): se cita en lugar de la página. */
  canonical?: string
  /** Texto que precede a la referencia dentro de la nota: «cf.», «véase»… */
  prefix?: string
}

export interface Sequence {
  /** Texto (HTML) de cada cita, en el orden recibido. Vacío si la cita no tenía fuentes. */
  texts: string[]
  /** true si el estilo cita en notas al pie; false si cita en el texto (autor-año). */
  isNote: boolean
  /** Entradas de bibliografía (HTML) de todas las fuentes citadas, ya ordenadas. */
  bibliography: string[]
}

/**
 * Da formato a todas las citas de un documento, en orden. A diferencia de
 * `formatCitation`, aquí el estilo sabe qué se citó antes: primera cita
 * completa y siguientes abreviadas, «ibid.», etc., según lo que mande el estilo.
 */
// Lo último compuesto: al escribir texto corriente las citas no cambian y no se recalculan.
let lastSequence: { key: string; result: Sequence } | null = null

export function formatSequence(clusters: CiteItem[][], o: CiteOptions): Sequence {
  const local = new Map<string, CslItem>()
  for (const cluster of clusters) for (const item of cluster) local.set(item.csl.id, item.csl)
  // Las obras canónicas no pasan por citeproc: se citan por su referencia canónica, tal cual.
  const canon = (item: CiteItem) => canonicalText(item.canonical)
  // Una nota solo canónica también se le pasa a citeproc (sin usar su texto), para que el
  // «Ibid.» de la nota siguiente no salte por encima de ella.
  const silent = new Set<string>()
  const citations = clusters.flatMap((cluster, i) => {
    let cited = cluster.filter((item) => !canon(item))
    if (!cited.length && cluster.length) { cited = cluster.map((item) => ({ ...item, page: '', prefix: undefined })); silent.add(`c${i}`) }
    return cited.length ? [{
      citationID: `c${i}`,
      citationItems: cited.map((item) => ({
        id: item.csl.id,
        ...locate(item.page),
        ...(item.prefix ? { prefix: `${item.prefix} ` } : {}),
      })),
      properties: { noteIndex: 0 },
    }] : []
  })
  citations.forEach((c, n) => { c.properties.noteIndex = n + 1 })
  // Su edición sí va a la bibliografía, aunque no se cite por páginas.
  const citedIds = new Set(citations.flatMap((c) => c.citationItems.map((it) => it.id)))
  const uncited = [...new Set(clusters.flat().filter((item) => canon(item) && !citedIds.has(item.csl.id)).map((item) => item.csl.id))]
  const canonicals = clusters.map((cluster) => cluster.filter(canon).map((item) => escapeHtml(`${item.prefix ? `${item.prefix} ` : ''}${canon(item)}`)))
  const key = JSON.stringify([o.style, o.locale, clusters.length, citations, uncited, canonicals, [...local.values()]])
  if (lastSequence?.key === key) return lastSequence.result

  const sys = { retrieveLocale: (lang: string) => LOCALE_XML[lang] ?? localeEn, retrieveItem: (id: string) => local.get(id) }
  const e = new CSL.Engine(sys, STYLES[o.style].xml, o.locale, true)
  const texts = clusters.map(() => '')
  // Todas las citas de una vez: citeproc las procesa en un solo pase, con sus posiciones
  // (ibid., forma breve…) y la desambiguación. Una a una, el coste crecía al cuadrado.
  if (citations.length || uncited.length) {
    const out = e.rebuildProcessorState(citations, 'html', uncited) as [string, number, string][]
    for (const [id, , text] of out) if (!silent.has(id)) texts[Number(id.slice(1))] = text
  }
  const isNote = e.opt.xclass === 'note'
  // Junta las referencias canónicas con lo que haya compuesto citeproc en la misma cita.
  clusters.forEach((cluster, i) => {
    const refs = canonicals[i]
    if (!refs.length) return
    const first = canon(cluster[0]) !== ''
    if (isNote) {
      const parts = texts[i] ? [texts[i].replace(/\.$/, '')] : []
      texts[i] = `${(first ? [...refs, ...parts] : [...parts, ...refs]).join('; ')}.`
    } else {
      // Autor-año: dentro del mismo paréntesis.
      const inner = texts[i] ? [texts[i].replace(/^\(|\)$/g, '')] : []
      texts[i] = `(${(first ? [...refs, ...inner] : [...inner, ...refs]).join('; ')})`
    }
  })
  const bib = local.size ? e.makeBibliography() : null
  const result = { texts, isNote, bibliography: bib ? (bib[1] as string[]).map((entry) => entry.trim()) : [] }
  lastSequence = { key, result }
  return result
}

// ---- Etiquetas breves para la interfaz -----------------------------------

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

export function authorsLabel(csl: CslItem): string {
  const people: any[] = csl.author?.length ? csl.author : (csl.editor ?? [])
  const names = people.map((p) => p.family ?? p.literal ?? p.given ?? '').filter(Boolean)
  if (names.length <= 2) return names.join(' y ')
  return `${names[0]} et al.`
}

export function yearLabel(csl: CslItem): string {
  const y = csl.issued?.['date-parts']?.[0]?.[0] ?? csl.issued?.literal ?? csl.issued?.raw
  return y ? String(y) : ''
}

/** Primera página impresa según los metadatos («68-95» → 68), si la hay. */
export function firstPageFromCsl(csl: CslItem): { first: number; last: number | null } | null {
  const m = /^\s*(\d+)\s*(?:[-–—]+\s*(\d+))?/.exec(String(csl.page ?? ''))
  if (!m) return null
  return { first: Number(m[1]), last: m[2] ? Number(m[2]) : null }
}
