// Borradores: Markdown con referencias a fichas.
//
//   {f. 51}            inserta la cita de la ficha 51, con su nota
//   [f. 51]            solo la referencia (para una paráfrasis)
//   [cf. f. 51; f. 60] varias fichas en una nota, con texto delante
//   {Escoto f. 3}      la ficha 3 del fichero «Escoto»
//
// Sin nombre de fichero se usa el fichero por defecto del borrador (cabecera
// `fichero:`) y, si no lo tiene, la única ficha con ese número.
//
// `resolveDraft` convierte el borrador en Markdown corriente: citas en su sitio,
// notas al pie numeradas y bibliografía. De ahí salen la vista previa y las
// exportaciones.
import { formatSequence, type CiteItem, type CiteOptions } from './citations'
import type { Ficha, Fichero, Source } from './types'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// ---- Cabecera del borrador ---------------------------------------------------------

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** Separa la cabecera (`---` … `---`) del texto. `offset` es dónde empieza el texto. */
export function splitFrontMatter(md: string): { meta: Record<string, string>; body: string; offset: number } {
  const m = FRONT.exec(md)
  if (!m) return { meta: {}, body: md, offset: 0 }
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(line)
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return { meta, body: md.slice(m[0].length), offset: m[0].length }
}

/** Pone (o quita, con valor vacío) una clave de la cabecera sin tocar el resto. */
export function setFrontMatter(md: string, key: string, value: string): string {
  const m = FRONT.exec(md)
  const lines = m ? m[1].split(/\r?\n/).filter((l) => !new RegExp(`^${key}\\s*:`, 'i').test(l)) : []
  if (value) lines.push(`${key}: ${value}`)
  const body = m ? md.slice(m[0].length) : md
  return lines.length ? `---\n${lines.join('\n')}\n---\n${body.startsWith('\n') ? '' : '\n'}${body}` : body.replace(/^\n/, '')
}

// ---- Referencias a fichas -----------------------------------------------------------

export interface FichaRef {
  /** Nombre de fichero escrito delante, si lo hay. */
  fichero: string | null
  num: number
  /** Texto delante de la referencia que no es un fichero: «cf.», «véase»… */
  prefix: string
}

export interface Token {
  kind: 'insert' | 'cite'
  /** Posición en el texto completo del borrador. */
  from: number
  to: number
  refs: FichaRef[]
}

// {…f. 51…}  o  […f. 51…]  (este último, si no es un enlace ni una nota de Markdown).
const TOKEN = /\{([^{}\n]*?\bf\.\s*\d+[^{}\n]*?)\}|\\?\[(?!\^)([^[\]\n]*?\bf\.\s*\d+[^[\]\n]*?)\\?\](?![(:[])/g

function parseRefs(inner: string, ficheros: string[]): FichaRef[] | null {
  const refs: FichaRef[] = []
  for (const part of inner.replace(/\\$/, '').split(';')) {
    const m = /^\s*(.*?)[\s,:]*\bf\.\s*(\d+)\s*$/.exec(part)
    if (!m) return null
    // Lo que hay delante puede ser un prefijo («cf.»), un fichero o ambos: «cf. Escoto».
    const words = m[1].trim().split(/\s+/).filter(Boolean)
    let fichero: string | null = null
    let cut = words.length
    for (let i = 0; i < words.length && !fichero; i++) {
      fichero = ficheros.find((f) => fold(f) === fold(words.slice(i).join(' '))) ?? null
      if (fichero) cut = i
    }
    refs.push({ fichero, num: Number(m[2]), prefix: words.slice(0, cut).join(' ') })
  }
  return refs
}

export function findTokens(md: string, ficheroNames: string[]): Token[] {
  const tokens: Token[] = []
  for (const m of md.matchAll(TOKEN)) {
    const refs = parseRefs(m[1] ?? m[2], ficheroNames)
    if (refs) tokens.push({ kind: m[1] !== undefined ? 'insert' : 'cite', from: m.index, to: m.index + m[0].length, refs })
  }
  return tokens
}

/** Texto de una referencia, como se escribe en el borrador. */
export function tokenText(kind: Token['kind'], ficha: Ficha, fichero: Fichero | undefined, defaultFicheroId: string | null, unique: boolean): string {
  const needsName = fichero && fichero.id !== defaultFicheroId && !(defaultFicheroId === null && unique)
  const inner = `${needsName ? `${fichero.name} ` : ''}f. ${ficha.num}`
  return kind === 'insert' ? `{${inner}}` : `[${inner}]`
}

// ---- Resolver ---------------------------------------------------------------------------

export interface DraftContext {
  fichas: Ficha[]
  ficheros: Fichero[]
  sources: Source[]
  cite: CiteOptions
}

export type Lookup = { ficha: Ficha; source: Source | null } | { error: string }

/** Fichero por defecto del borrador (cabecera `fichero:`), si existe. */
export function defaultFichero(md: string, ficheros: Fichero[]): Fichero | null {
  const name = splitFrontMatter(md).meta.fichero
  return (name && ficheros.find((f) => fold(f.name) === fold(name))) || null
}

export function lookupRef(ref: FichaRef, fallback: Fichero | null, ctx: DraftContext): Lookup {
  const named = ref.fichero ? ctx.ficheros.find((f) => fold(f.name) === fold(ref.fichero!)) : fallback
  const candidates = ctx.fichas.filter((f) => f.num === ref.num && (!named || f.ficheroId === named.id))
  if (candidates.length === 0) return { error: `No existe la ficha ${ref.num}${named ? ` en «${named.name}»` : ''}.` }
  if (candidates.length > 1) {
    const names = candidates.map((f) => ctx.ficheros.find((x) => x.id === f.ficheroId)?.name ?? '?').join(', ')
    return { error: `Hay una ficha ${ref.num} en varios ficheros (${names}). Escribe el fichero delante, p. ej. {${names.split(', ')[0]} f. ${ref.num}}, o elige un fichero por defecto.` }
  }
  const ficha = candidates[0]
  return { ficha, source: ctx.sources.find((s) => s.id === ficha.sourceId) ?? null }
}

export interface Problem {
  message: string
  /** Posición del problema en el borrador. */
  from: number
}

export interface Resolved {
  /** Markdown corriente: citas, notas `[^n]` y bibliografía. */
  markdown: string
  problems: Problem[]
  citations: number
  sources: number
}

const escapeMd = (s: string) => s.replace(/([\\*_[\]<`])/g, '\\$1')

/** HTML de citeproc → Markdown. */
export function htmlToMd(html: string): string {
  return html
    .replace(/<\/?(i|em)>/g, '*')
    .replace(/<\/?(b|strong)>/g, '**')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const QUOTES: Record<string, [string, string]> = { 'es-ES': ['«', '»'], 'en-US': ['“', '”'] }
const BIBLIOGRAPHY: Record<string, string> = { 'es-ES': 'Bibliografía', 'en-US': 'Bibliography' }

export function resolveDraft(md: string, ctx: DraftContext, options: { bibliography?: boolean } = {}): Resolved {
  const { body, offset } = splitFrontMatter(md)
  const fallback = defaultFichero(md, ctx.ficheros)
  const tokens = findTokens(body, ctx.ficheros.map((f) => f.name))
  const problems: Problem[] = []

  // 1. Qué cita cada referencia.
  const resolved = tokens.map((token) => {
    const items: CiteItem[] = []
    const warnings: string[] = []
    let quote: string | null = null
    token.refs.forEach((ref, i) => {
      const found = lookupRef(ref, fallback, ctx)
      if ('error' in found) return void warnings.push(found.error)
      if (token.kind === 'insert' && i === 0) quote = found.ficha.cita.trim()
      if (!found.source) return void warnings.push(`La ficha ${ref.num} no tiene fuente: no se puede citar.`)
      if (!found.ficha.pageLabel.trim()) warnings.push(`La ficha ${ref.num} no tiene página.`)
      items.push({ csl: found.source.csl, page: found.ficha.pageLabel, prefix: ref.prefix || undefined })
    })
    if (token.kind === 'insert' && token.refs.length > 1) warnings.push('Entre llaves solo cabe una ficha: usa una referencia {f. N} por cita.')
    if (token.kind === 'insert' && quote === '') warnings.push(`La ficha ${token.refs[0].num} no tiene texto de cita.`)
    for (const message of warnings) problems.push({ message, from: offset + token.from })
    return { token, items, quote: quote as string | null, failed: items.length === 0 }
  })

  // 2. Texto de cada cita, en orden, según el estilo.
  const seq = formatSequence(resolved.map((r) => r.items), ctx.cite)
  const [open, close] = QUOTES[ctx.cite.locale] ?? QUOTES['en-US']

  // 3. Sustituir cada referencia.
  let out = ''
  let last = 0
  const notes: string[] = []
  resolved.forEach((r, i) => {
    const { token } = r
    const text = htmlToMd(seq.texts[i])
    let mark: string
    if (r.failed) mark = ' **[⚠ sin referencia]**'
    else if (seq.isNote) {
      notes.push(text)
      mark = `[^${notes.length}]`
    } else mark = ` ${text}`

    let replacement = mark.trimStart()
    if (token.kind === 'insert' && r.quote) {
      // Sola en su párrafo → cita en bloque; dentro de una frase → entre comillas.
      const lineStart = body.lastIndexOf('\n', token.from - 1) + 1
      const lineEnd = body.indexOf('\n', token.to) === -1 ? body.length : body.indexOf('\n', token.to)
      const alone = body.slice(lineStart, token.from).trim() === '' && body.slice(token.to, lineEnd).trim() === ''
      const quote = escapeMd(r.quote)
      replacement = alone
        ? `${quote.split(/\n+/).map((p) => `> ${p.trim()}`).join('\n>\n')}${mark}`
        : `${open}${quote.replace(/\s*\n+\s*/g, ' ')}${close}${mark}`
    } else if (!seq.isNote && !r.failed && /\S$/.test(body.slice(0, token.from))) replacement = mark // «…texto (Pini 2005, 69)»
    out += body.slice(last, token.from) + replacement
    last = token.to
  })
  out += body.slice(last)

  out = out.replace(/\s+$/, '') + '\n'
  if (notes.length) out += `\n${notes.map((n, i) => `[^${i + 1}]: ${n}`).join('\n\n')}\n`
  if (options.bibliography !== false && seq.bibliography.length) {
    out += `\n## ${BIBLIOGRAPHY[ctx.cite.locale] ?? BIBLIOGRAPHY['en-US']}\n\n${seq.bibliography.map(htmlToMd).join('\n\n')}\n`
  }
  return { markdown: out, problems, citations: resolved.filter((r) => !r.failed).length, sources: seq.bibliography.length }
}
