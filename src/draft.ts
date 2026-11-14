// Borradores: Markdown con referencias a fichas.
//
//   {f. 51}               inserta la cita de la ficha 51, con su nota
//   {f. 51 «un pedazo»}   inserta solo ese pedazo de la cita
//   [f. 51]               solo la referencia (para una paráfrasis)
//   [cf. f. 51; f. 60]    varias fichas en una nota, con texto delante
//
// Opciones, tras el número y en cualquier orden:
//   «…»      el pedazo que se cita (entre llaves va al texto; entre corchetes, a la nota)
//   +        añade la cita completa de la ficha a la nota
//   p. 70    cita esa página en vez de la de la ficha
//
// «f.» es el marcador del fichero y cada fichero puede tener el suyo («e.»,
// «s.»…): así el marcador dice de qué fichero es la ficha. Si varios ficheros
// comparten marcador, se usa el fichero por defecto del borrador (cabecera
// `fichero:`), el nombre escrito delante ({Escoto f. 3}) o, si solo hay una
// ficha con ese número, esa.
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

export const DEFAULT_MARKER = 'f.'

/** Un marcador válido: corto, sin espacios ni signos que confundan a la sintaxis. */
export function markerProblem(marker: string): string | null {
  const m = marker.trim()
  if (!m) return 'El marcador no puede estar vacío.'
  if (m.length > 8) return 'El marcador es demasiado largo (máximo 8 caracteres).'
  if (/[\s{}[\];«»"“”+\\^]/.test(m) || /^\d/.test(m) || /\d$/.test(m)) return 'El marcador no puede llevar espacios, números al principio o al final, ni estos signos: { } [ ] ; « » " +'
  return null
}

/** Marcador libre para un fichero nuevo: «f.» si nadie lo usa; si no, la inicial del nombre («e.»). */
export function suggestMarker(name: string, ficheros: Pick<Fichero, 'marker'>[]): string {
  const taken = new Set(ficheros.map((f) => fold(f.marker)))
  const letters = fold(name).replace(/[^a-z]/g, '')
  for (const candidate of [DEFAULT_MARKER, ...[1, 2, 3].map((n) => (letters.length >= n ? `${letters.slice(0, n)}.` : ''))]) {
    if (candidate && !taken.has(candidate)) return candidate
  }
  return DEFAULT_MARKER
}

type FicheroKey = Pick<Fichero, 'name' | 'marker'>

export interface FichaRef {
  /** Marcador con el que se escribió («f.», «e.»…). */
  marker: string
  /** Nombre de fichero escrito delante, si lo hay. */
  fichero: string | null
  num: number
  /** Texto delante de la referencia que no es un fichero: «cf.», «véase»… */
  prefix: string
  /** Pedazo de la cita que se quiere mostrar, si se indicó. */
  fragment: string | null
  /** `+`: la cita completa de la ficha va también en la nota. */
  fullInNote: boolean
  /** Página que se cita en lugar de la de la ficha. */
  page: string | null
}

export interface Token {
  kind: 'insert' | 'cite'
  /** Posición en el texto completo del borrador. */
  from: number
  to: number
  refs: FichaRef[]
}

// {…}  o  […]  (este último, si no es un enlace ni una nota de Markdown).
const TOKEN = /\{([^{}\n]+)\}|\\?\[(?!\^)([^[\]\n]+?)\\?\](?![(:[])/g
const QUOTED = /^(?:«([^»]*)»|“([^”]*)”|"([^"]*)")/
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function parseOptions(rest: string): Pick<FichaRef, 'fragment' | 'fullInNote' | 'page'> | null {
  const out: Pick<FichaRef, 'fragment' | 'fullInNote' | 'page'> = { fragment: null, fullInNote: false, page: null }
  let t = rest
  for (;;) {
    t = t.replace(/^[\s,]+/, '')
    if (!t) return out
    let m: RegExpExecArray | null
    if ((m = QUOTED.exec(t))) {
      if (out.fragment !== null) return null
      out.fragment = (m[1] ?? m[2] ?? m[3]).trim()
    } else if ((m = /^\+/.exec(t))) out.fullInNote = true
    else if ((m = /^pp?\.\s*([\divxlcdm]+(?:\s*[-–]\s*[\divxlcdm]+)?)/i.exec(t))) out.page = m[1].replace(/\s*[-–]\s*/, '-')
    else return null
    t = t.slice(m[0].length)
  }
}

function parseRefs(inner: string, ficheros: FicheroKey[]): FichaRef[] | null {
  const markers = [...new Set(ficheros.map((f) => f.marker))].sort((a, b) => b.length - a.length)
  if (!markers.length) return null
  // (lo de delante) MARCADOR número (opciones)
  const item = new RegExp(`^\\s*(.*?)[\\s,:]*(?<![\\p{L}\\p{N}])(${markers.map(escapeRe).join('|')})\\s*(\\d+)(?!\\d)(.*)$`, 'iu')
  const refs: FichaRef[] = []
  // Las opciones pueden llevar «;» dentro de las comillas: se parte solo fuera de ellas.
  for (const part of inner.replace(/\\$/, '').match(/(?:«[^»]*»|“[^”]*”|"[^"]*"|[^;])+/g) ?? []) {
    const m = item.exec(part)
    const options = m && parseOptions(m[4])
    if (!m || !options) return null
    // Lo que hay delante puede ser un prefijo («cf.»), un fichero o ambos: «cf. Escoto».
    const words = m[1].trim().split(/\s+/).filter(Boolean)
    let fichero: string | null = null
    let cut = words.length
    for (let i = 0; i < words.length && !fichero; i++) {
      fichero = ficheros.find((f) => fold(f.name) === fold(words.slice(i).join(' ')))?.name ?? null
      if (fichero) cut = i
    }
    refs.push({ marker: m[2], fichero, num: Number(m[3]), prefix: words.slice(0, cut).join(' '), ...options })
  }
  return refs.length ? refs : null
}

export function findTokens(md: string, ficheros: FicheroKey[]): Token[] {
  const tokens: Token[] = []
  for (const m of md.matchAll(TOKEN)) {
    const refs = parseRefs(m[1] ?? m[2], ficheros)
    if (refs) tokens.push({ kind: m[1] !== undefined ? 'insert' : 'cite', from: m.index, to: m.index + m[0].length, refs })
  }
  return tokens
}

export interface TokenOptions {
  fragment?: string
  fullInNote?: boolean
}

/** Texto de una referencia, como se escribe en el borrador. */
export function tokenText(kind: Token['kind'], ficha: Ficha, ctx: Pick<DraftContext, 'fichas' | 'ficheros'>, fallback: Fichero | null, options: TokenOptions = {}): string {
  const fichero = ctx.ficheros.find((f) => f.id === ficha.ficheroId)
  const marker = fichero?.marker ?? DEFAULT_MARKER
  // El nombre solo hace falta si el marcador no basta para saber qué ficha es.
  const sameMarker = ctx.ficheros.filter((f) => fold(f.marker) === fold(marker))
  const rivals = ctx.fichas.filter((f) => f.num === ficha.num && sameMarker.some((x) => x.id === f.ficheroId))
  const implied = sameMarker.length === 1 || (fallback && sameMarker.some((f) => f.id === fallback.id) ? fallback.id === ficha.ficheroId : rivals.length === 1)
  const fragment = options.fragment?.replace(/\s+/g, ' ').trim()
  const inner = `${implied || !fichero ? '' : `${fichero.name} `}${marker} ${ficha.num}${fragment ? ` «${fragment.replace(/[«»]/g, '"')}»` : ''}${options.fullInNote ? ' +' : ''}`
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
  const byMarker = ctx.ficheros.filter((f) => fold(f.marker) === fold(ref.marker))
  let pool = byMarker
  if (ref.fichero) pool = ctx.ficheros.filter((f) => fold(f.name) === fold(ref.fichero!))
  else if (fallback && byMarker.some((f) => f.id === fallback.id)) pool = [fallback]
  const where = pool.length === 1 ? ` en «${pool[0].name}»` : ''
  const candidates = ctx.fichas.filter((f) => f.num === ref.num && pool.some((p) => p.id === f.ficheroId))
  if (candidates.length === 0) return { error: `No existe la ficha ${ref.marker} ${ref.num}${where}.` }
  if (candidates.length > 1) {
    const names = candidates.map((f) => ctx.ficheros.find((x) => x.id === f.ficheroId)?.name ?? '?')
    return { error: `Hay una ficha ${ref.num} en varios ficheros con el marcador «${ref.marker}» (${names.join(', ')}). Dale a cada fichero su propio marcador, elige un fichero por defecto o escribe el nombre delante: {${names[0]} ${ref.marker} ${ref.num}}.` }
  }
  const ficha = candidates[0]
  return { ficha, source: ctx.sources.find((s) => s.id === ficha.sourceId) ?? null }
}

/**
 * ¿Es `fragment` un pedazo literal de `text`? Se ignoran las diferencias de
 * espacios y de comillas tipográficas, y se admiten elipsis («…», «[...]»)
 * entre trozos, que deben aparecer en el mismo orden.
 */
export function isFragmentOf(fragment: string, text: string): boolean {
  const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"').replace(/\s+/g, ' ').trim()
  const haystack = norm(text)
  let from = 0
  for (const piece of norm(fragment).split(/\s*(?:\[\s*(?:\.\.\.|…)\s*\]|\.\.\.|…)\s*/).filter(Boolean)) {
    const at = haystack.indexOf(piece, from)
    if (at === -1) return false
    from = at + piece.length
  }
  return true
}

export interface Problem {
  message: string
  /** Posición del problema en el borrador. */
  from: number
}

/** Cómo queda una referencia en el texto final (para mostrarla así en el editor). */
export interface RenderedToken {
  /** La referencia tal como está escrita. */
  raw: string
  /** Posición en el texto completo. */
  from: number
  kind: Token['kind']
  /** Cita que aparece en el texto (solo con llaves). */
  inText: string | null
  /** true si va sola en su párrafo: cita en bloque. */
  block: boolean
  /** Número de la nota o, en estilos autor-año, la referencia entre paréntesis. */
  mark: string
  /** Texto de la nota al pie, si la hay. */
  note: string
  failed: boolean
}

export interface Resolved {
  /** Markdown corriente: citas, notas `[^n]` y bibliografía. */
  markdown: string
  tokens: RenderedToken[]
  problems: Problem[]
  citations: number
  sources: number
}

const escapeMd = (s: string) => s.replace(/([\\*_[\]<`])/g, '\\$1')
const oneLine = (s: string) => s.replace(/\s*\n+\s*/g, ' ').trim()

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
/** Encabezado de la bibliografía en el idioma de las citas. */
export const bibliographyHeading = (locale: string) => BIBLIOGRAPHY[locale] ?? BIBLIOGRAPHY['en-US']

const BIBLIOGRAPHY: Record<string, string> = { 'es-ES': 'Bibliografía', 'en-US': 'Bibliography' }

export function resolveDraft(md: string, ctx: DraftContext, options: { bibliography?: boolean } = {}): Resolved {
  const { body, offset } = splitFrontMatter(md)
  const fallback = defaultFichero(md, ctx.ficheros)
  const tokens = findTokens(body, ctx.ficheros)
  const problems: Problem[] = []
  const [open, close] = QUOTES[ctx.cite.locale] ?? QUOTES['en-US']
  const quoted = (text: string) => `${open}${escapeMd(oneLine(text))}${close}`

  // 1. Qué cita cada referencia, qué va en el texto y qué va en la nota.
  const resolved = tokens.map((token) => {
    const items: CiteItem[] = []
    const warnings: string[] = []
    /** Texto citado en el cuerpo (solo con llaves). */
    let inText: string | null = null
    /** Citas que acompañan a la referencia dentro de la nota. */
    const inNote: string[] = []
    token.refs.forEach((ref, i) => {
      const found = lookupRef(ref, fallback, ctx)
      if ('error' in found) return void warnings.push(found.error)
      const { ficha } = found
      const label = `${ref.marker} ${ref.num}`
      const full = ficha.cita.trim()
      if (ref.fragment && !isFragmentOf(ref.fragment, full)) warnings.push(`El pedazo «${ref.fragment.slice(0, 50)}${ref.fragment.length > 50 ? '…' : ''}» no aparece tal cual en la ficha ${label}. Revísalo.`)
      if ((ref.fullInNote || (token.kind === 'insert' && !ref.fragment)) && !full) warnings.push(`La ficha ${label} no tiene texto de cita.`)
      if (token.kind === 'insert' && i === 0) inText = ref.fragment ?? full
      // Entre corchetes, el pedazo va a la nota; «+» añade la cita completa.
      if (token.kind === 'cite' && ref.fragment) inNote.push(ref.fragment)
      if (ref.fullInNote && full) inNote.push(full)
      if (!found.source) return void warnings.push(`La ficha ${label} no tiene fuente: no se puede citar.`)
      const page = ref.page ?? ficha.pageLabel
      if (!page.trim()) warnings.push(`La ficha ${label} no tiene página.`)
      items.push({ csl: found.source.csl, page, prefix: ref.prefix || undefined })
    })
    if (token.kind === 'insert' && token.refs.length > 1) warnings.push('Entre llaves solo cabe una ficha: usa una referencia por cita.')
    for (const message of warnings) problems.push({ message, from: offset + token.from })
    return { token, items, inText: inText as string | null, inNote, failed: items.length === 0 }
  })

  // 2. Texto de cada cita, en orden, según el estilo.
  const seq = formatSequence(resolved.map((r) => r.items), ctx.cite)

  // 3. Sustituir cada referencia.
  let out = ''
  let last = 0
  const notes: string[] = []
  const note = (text: string) => `[^${notes.push(text)}]`
  const rendered: RenderedToken[] = []
  resolved.forEach((r, i) => {
    const { token } = r
    const text = htmlToMd(seq.texts[i])
    const extra = r.inNote.map(quoted).join('; ')
    let mark: string
    if (r.failed) mark = ` **[⚠ sin referencia]**${extra ? note(`${extra}.`) : ''}`
    else if (seq.isNote) mark = note(extra ? `${text.replace(/\.$/, '')}: ${extra}.` : text)
    // Estilos autor-año: la referencia va en el texto y la cita añadida, en una nota.
    else mark = ` ${text}${extra ? note(`${extra}.`) : ''}`

    const notesBefore = rendered.reduce((n, t) => n + (t.note ? 1 : 0), 0)
    const ownNote = notes.length > notesBefore ? notes[notes.length - 1] : ''
    const shown = r.failed ? '⚠' : seq.isNote ? String(notes.length) : text
    let block = false
    let replacement = mark.trimStart()
    if (token.kind === 'insert' && r.inText) {
      // Sola en su párrafo → cita en bloque; dentro de una frase → entre comillas.
      const lineStart = body.lastIndexOf('\n', token.from - 1) + 1
      const lineEnd = body.indexOf('\n', token.to) === -1 ? body.length : body.indexOf('\n', token.to)
      const alone = body.slice(lineStart, token.from).trim() === '' && body.slice(token.to, lineEnd).trim() === ''
      block = alone
      replacement = alone
        ? `${escapeMd(r.inText).split(/\n+/).map((p) => `> ${p.trim()}`).join('\n>\n')}${mark}`
        : `${quoted(r.inText)}${mark}`
    } else if (!seq.isNote && !r.failed && /\S$/.test(body.slice(0, token.from))) replacement = mark // «…texto (Pini 2005, 69)»
    rendered.push({ raw: body.slice(token.from, token.to), from: offset + token.from, kind: token.kind, inText: r.inText, block, mark: shown, note: ownNote, failed: r.failed })
    out += body.slice(last, token.from) + replacement
    last = token.to
  })
  out += body.slice(last)

  out = out.replace(/\s+$/, '') + '\n'
  if (notes.length) out += `\n${notes.map((n, i) => `[^${i + 1}]: ${n}`).join('\n\n')}\n`
  if (options.bibliography !== false && seq.bibliography.length) {
    out += `\n## ${BIBLIOGRAPHY[ctx.cite.locale] ?? BIBLIOGRAPHY['en-US']}\n\n${seq.bibliography.map(htmlToMd).join('\n\n')}\n`
  }
  return { markdown: out, tokens: rendered, problems, citations: resolved.filter((r) => !r.failed).length, sources: seq.bibliography.length }
}
