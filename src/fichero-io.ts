// Importación y exportación de un fichero en CSV, sin pérdida: cada fichero
// recuerda sus columnas (encabezado y orden) y cada ficha conserva en `extra`
// el valor original de las columnas que Organon no interpreta.
import { authorsLabel } from './citations'
import { parseCsv, toCsv } from './csv'
import type { Column, CslItem, Ficha, FieldKey, Source } from './types'

export const FIELD_NAMES: Record<FieldKey, string> = {
  num: 'ID',
  notaPermanente: 'Nota permanente',
  cita: 'Cita',
  tags: 'Tags',
  autor: 'Autor de la fuente',
  fuente: 'Título de la fuente',
  pageLabel: 'Página',
  referencia: 'Obra canónica / referencias',
  notas: 'Notas',
  extra: 'Otra columna (se conserva tal cual)',
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const GUESSES: [FieldKey, RegExp][] = [
  ['num', /^(id|n|no|num|numero)$/],
  ['notaPermanente', /^(nota permanente|titulo|idea)$/],
  ['cita', /^(cita|quote|texto citado)$/],
  ['tags', /^(tags?|temas?|etiquetas?)$/],
  ['autor', /^(autor|autores|author)$/],
  ['fuente', /^(paper texto|paper|texto|fuente|obra|titulo de la fuente)$/],
  ['pageLabel', /^(pagina|paginas|pag|pags|p|pp|page)$/],
  ['referencia', /^(obra canonica|referencias?)$/],
  ['notas', /^(notas?|comentarios?)$/],
]

/** Propone a qué campo corresponde cada encabezado. Cada campo se usa una sola vez. */
export function guessColumns(headers: string[]): Column[] {
  const used = new Set<FieldKey>()
  return headers.map((header) => {
    const field = GUESSES.find(([f, re]) => !used.has(f) && re.test(norm(header)))?.[0] ?? 'extra'
    if (field !== 'extra') used.add(field)
    return { header, field }
  })
}

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

export function readCsv(text: string): ParsedCsv {
  const [headers = [], ...rows] = parseCsv(text)
  return { headers, rows: rows.filter((r) => r.some((c) => c.trim() !== '')) }
}

export const splitTags = (cell: string) => cell.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean)

// ---- Reconocer la fuente de una ficha importada --------------------------------

/** Fuente cuyo título y autor coinciden con los del CSV; `null` si no hay una sola candidata clara. */
export function matchSource(sources: Source[], author: string, title: string): Source | null {
  const a = norm(author)
  const t = norm(title)
  if (!a && !t) return null
  const byAuthor = (csl: CslItem) => {
    const people: any[] = [...(csl.author ?? []), ...(csl.editor ?? [])]
    return people.some((p) => {
      const family = norm(p.family ?? p.literal ?? '')
      return family !== '' && (` ${a} `.includes(` ${family} `) || ` ${family} `.includes(` ${a} `))
    })
  }
  const byTitle = (csl: CslItem) => {
    const full = norm(String(csl.title ?? ''))
    const short = norm(String(csl['title-short'] ?? ''))
    return full !== '' && (full === t || short === t || full.startsWith(`${t} `) || t.startsWith(`${full} `))
  }
  const found = sources.filter((s) => (!t || byTitle(s.csl)) && (!a || byAuthor(s.csl)))
  return found.length === 1 ? found[0] : null
}

// ---- Importar ---------------------------------------------------------------------

export type ImportedFicha = Pick<Ficha, 'notaPermanente' | 'cita' | 'tags' | 'pageLabel' | 'referencia' | 'notas' | 'extra' | 'sourceId'> & {
  /** ID de la hoja, si es un número entero. */
  num: number | null
}

/**
 * Convierte las filas del CSV en fichas. Los valores de las columnas de autor
 * y título se guardan también en `extra`, para exportarlos después tal cual.
 * `defaultSourceId` es la fuente de todas las fichas cuando el CSV no la indica.
 */
export function rowsToFichas(csv: ParsedCsv, columns: Column[], sources: Source[], defaultSourceId: string | null): ImportedFicha[] {
  return csv.rows.map((row) => {
    const f: ImportedFicha = { num: null, notaPermanente: '', cita: '', tags: [], pageLabel: '', referencia: '', notas: '', extra: {}, sourceId: null }
    let author = ''
    let title = ''
    columns.forEach((col, i) => {
      const value = row[i] ?? ''
      switch (col.field) {
        case 'num':
          if (/^\s*\d+\s*$/.test(value)) f.num = Number(value)
          else if (value !== '') f.extra[col.header] = value
          break
        case 'tags': f.tags = splitTags(value); break
        case 'autor': author = value; if (value !== '') f.extra[col.header] = value; break
        case 'fuente': title = value; if (value !== '') f.extra[col.header] = value; break
        case 'extra': if (value !== '') f.extra[col.header] = value; break
        default: f[col.field] = value
      }
    })
    f.sourceId = matchSource(sources, author, title)?.id ?? defaultSourceId
    return f
  })
}

// ---- Casillas ----------------------------------------------------------------------

/** Lo que se guarda en una casilla marcada. Al leer se aceptan también TRUE, x, 1… (Sheets exporta TRUE). */
export const CHECKED = 'sí'
export const isChecked = (v: string | undefined) => !!v && /^(s[ií]|true|verdadero|x|1|✓|✔)$/i.test(v.trim())

// ---- Orden manual -----------------------------------------------------------------

/** Posición en el orden manual: la guardada o, si nunca se movió, su número. */
export const orderKey = (f: Ficha) => f.orden ?? f.num
export const byManualOrder = (a: Ficha, b: Ficha) => orderKey(a) - orderKey(b) || a.num - b.num

// ---- Exportar ---------------------------------------------------------------------

/** Texto de una ficha en una columna de su fichero (lo que se ve en la tabla y lo que se exporta). */
export function cellText(f: Ficha, col: Column, source: Source | undefined): string {
  switch (col.field) {
    case 'num': return f.extra[col.header] ?? String(f.num)
    case 'tags': return f.tags.join(', ')
    case 'autor': return f.extra[col.header] ?? (source ? authorsLabel(source.csl) : '')
    case 'fuente': return f.extra[col.header] ?? String(source?.csl.title ?? '')
    case 'extra': return f.extra[col.header] ?? ''
    default: return f[col.field]
  }
}

/** Las fichas van en el orden manual del fichero. */
export function fichasToCsv(fichas: Ficha[], columns: Column[], sources: Source[]): string {
  const byId = new Map(sources.map((s) => [s.id, s]))
  const sorted = [...fichas].sort(byManualOrder)
  // Las casillas salen como TRUE / FALSE: así Google Sheets las reconoce como casillas.
  const cell = (f: Ficha, c: Column) => (c.field === 'extra' && c.kind === 'casilla'
    ? (isChecked(f.extra[c.header]) ? 'TRUE' : 'FALSE')
    : cellText(f, c, f.sourceId ? byId.get(f.sourceId) : undefined))
  return toCsv([columns.map((c) => c.header), ...sorted.map((f) => columns.map((c) => cell(f, c)))])
}
