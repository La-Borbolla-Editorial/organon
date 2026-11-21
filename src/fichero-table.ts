// La tabla del fichero como hoja de cálculo: columnas propias, filtros y orden
// por columna, y el orden manual de las filas. Todo sin interfaz: se prueba
// por separado.
import { byManualOrder, cellText, CHECKED, isChecked } from './fichero-io'
import type { Column, Ficha, Source } from './types'

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ---- Valores de las columnas propias ------------------------------------------------

export { CHECKED, isChecked } from './fichero-io'

/**
 * Un número escrito a mano: «12,5», «12.5», «1.000», «1 000», «1.000,5», «1,000.5».
 * Con un solo separador seguido de tres cifras («1.000», «2,500») se entiende
 * separador de miles; «0,125» sí es decimal. NaN si no es un número.
 */
export function parseNumber(v: string): number {
  let s = v.trim().replace(/[\s\u00a0\u202f]/g, '')
  if (!/^-?\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return NaN
  const dots = (s.match(/\./g) ?? []).length
  const commas = (s.match(/,/g) ?? []).length
  if (dots && commas) {
    // El último separador es el decimal; el otro, de miles.
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
    const thousands = decimal === '.' ? ',' : '.'
    if (s.split(decimal).length > 2) return NaN
    s = s.split(thousands).join('').replace(',', '.')
  } else if (dots + commas > 1) {
    const sep = dots ? '.' : ','
    if (!/^-?\d{1,3}(?:[.,]\d{3})+$/.test(s)) return NaN
    s = s.split(sep).join('')
  } else if (dots + commas === 1) {
    const [int, frac] = s.split(/[.,]/)
    const thousands = frac.length === 3 && !/^-?0$/.test(int)
    s = thousands ? int + frac : `${int}.${frac}`
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Una fecha escrita a mano, como AAAA-MM-DD: «2026-03-14», «14/03/2026»,
 * «14-3-2026», «14.03.26» (el día va primero). null si no es una fecha.
 */
export function parseDate(v: string): string | null {
  const s = v.trim()
  let y: number, m: number, d: number
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s)
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    ;[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
    if (y < 100) y += 2000
  } else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ---- Filtros ------------------------------------------------------------------------

/** Cómo se filtra (y ordena) una columna. */
export type FilterKind = 'texto' | 'valores' | 'numero' | 'fecha'

export function filterKind(c: Column): FilterKind {
  switch (c.field) {
    case 'num': return 'numero'
    case 'tags': case 'autor': case 'fuente': return 'valores'
    case 'extra':
      if (c.kind === 'numero') return 'numero'
      if (c.kind === 'fecha') return 'fecha'
      if (c.kind === 'lista' || c.kind === 'casilla') return 'valores'
      return 'texto'
    default: return 'texto'
  }
}

export interface ColumnFilter {
  /** Texto que debe contener la celda. */
  q?: string
  /** Solo las celdas vacías, o solo las que tienen algo. */
  empty?: 'vacia' | 'llena'
  /** Valores que se ocultan (filtrar por valores). '' es «vacía». Un valor nuevo se ve siempre. */
  hidden?: string[]
  /** Valores que se muestran: así lo guardaba 0.6.0. Se sigue leyendo; el menú lo convierte en `hidden`. */
  values?: string[]
  /** Rango, en números y fechas (ambos extremos incluidos). */
  min?: string
  max?: string
}

/** Cómo se ve un fichero: su orden por columna y sus filtros, por encabezado. Se recuerda por fichero. */
export interface TableView {
  sort?: { header: string; desc?: boolean }
  filters: Record<string, ColumnFilter>
}

export const EMPTY_VIEW: TableView = { filters: {} }

export const filterActive = (f: ColumnFilter | undefined): boolean =>
  !!f && (!!f.q?.trim() || !!f.empty || !!f.values || !!f.hidden?.length || !!f.min?.trim() || !!f.max?.trim())

/** Lee la vista guardada, descartando lo que se refiere a columnas que ya no existen. */
export function readView(json: string | undefined, columns: Column[]): TableView {
  if (!json) return EMPTY_VIEW
  try {
    const v = JSON.parse(json) as TableView
    const headers = new Set(columns.map((c) => c.header))
    const filters = Object.fromEntries(Object.entries(v.filters ?? {}).filter(([h, f]) => headers.has(h) && filterActive(f)))
    return { sort: v.sort && headers.has(v.sort.header) ? v.sort : undefined, filters }
  } catch {
    return EMPTY_VIEW
  }
}

/** Valores de una ficha en una columna «por valores». La fuente se identifica por su id, no por su título. */
export function cellValues(f: Ficha, c: Column, source: Source | undefined): string[] {
  if (c.field === 'tags') return f.tags.length ? f.tags : ['']
  if (c.field === 'fuente') return [f.sourceId ?? '']
  if (c.kind === 'casilla') return [isChecked(f.extra[c.header]) ? CHECKED : '']
  return [cellText(f, c, source).trim()]
}

export function valueLabel(c: Column, value: string, sourceById: Map<string, Source>): string {
  if (c.field === 'fuente') {
    if (!value) return 'Sin fuente vinculada'
    const s = sourceById.get(value)
    return s ? String(s.csl.title ?? s.citekey) : '(fuente eliminada)'
  }
  if (c.kind === 'casilla') return value ? 'Sí' : 'No'
  return value || '(vacía)'
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

/** Los valores distintos de una columna, con cuántas fichas tienen cada uno. Las opciones de una lista, en su orden. */
export function distinctValues(fichas: Ficha[], c: Column, sourceOf: (f: Ficha) => Source | undefined, sourceById: Map<string, Source>): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  if (c.kind === 'lista') for (const o of c.options ?? []) counts.set(o, 0)
  if (c.kind === 'casilla') { counts.set(CHECKED, 0); counts.set('', 0) }
  for (const f of fichas) for (const v of new Set(cellValues(f, c, sourceOf(f)))) counts.set(v, (counts.get(v) ?? 0) + 1)
  const listed = c.kind === 'lista' || c.kind === 'casilla' ? [...counts.keys()] : []
  const rank = (v: string) => (v === '' ? Infinity : listed.indexOf(v) === -1 ? listed.length : listed.indexOf(v))
  return [...counts]
    .map(([value, count]) => ({ value, label: valueLabel(c, value, sourceById), count }))
    .sort((a, b) => rank(a.value) - rank(b.value) || collator.compare(a.label, b.label))
}

/** ¿Pasa la ficha el filtro de esta columna? `text` es lo que muestra la celda. */
export function matchFilter(f: Ficha, c: Column, filter: ColumnFilter, source: Source | undefined, text: string): boolean {
  if (filter.empty) {
    const blank = c.kind === 'casilla' ? !isChecked(f.extra[c.header]) : c.field === 'fuente' ? !f.sourceId && !text.trim() : !text.trim()
    if (blank !== (filter.empty === 'vacia')) return false
  }
  const q = filter.q?.trim()
  if (q && !fold(text).includes(fold(q))) return false
  if (filter.values) {
    const wanted = new Set(filter.values)
    if (!cellValues(f, c, source).some((v) => wanted.has(v))) return false
  }
  if (filter.hidden?.length) {
    // Con varios tags, la ficha se ve si alguno de ellos no está oculto.
    const hidden = new Set(filter.hidden)
    if (cellValues(f, c, source).every((v) => hidden.has(v))) return false
  }
  const min = filter.min?.trim()
  const max = filter.max?.trim()
  if (min || max) {
    if (filterKind(c) === 'fecha') {
      const d = parseDate(text)
      if (!d || (min && d < min) || (max && d > max)) return false
    } else {
      const n = c.field === 'num' ? f.num : parseNumber(text)
      if (Number.isNaN(n)) return false
      if (min && !Number.isNaN(parseNumber(min)) && n < parseNumber(min)) return false
      if (max && !Number.isNaN(parseNumber(max)) && n > parseNumber(max)) return false
    }
  }
  return true
}

// ---- Orden por columna ------------------------------------------------------------

/**
 * Ordena por una columna. Las celdas vacías van siempre al final, en los dos
 * sentidos; a igualdad, manda el orden manual.
 */
export function sortByColumn(fichas: Ficha[], c: Column, desc: boolean, sourceOf: (f: Ficha) => Source | undefined): Ficha[] {
  const kind = filterKind(c)
  const keyed = fichas.map((f, i) => {
    const text = cellText(f, c, sourceOf(f)).trim()
    let key: number | string | null
    if (c.field === 'num') key = f.num
    else if (c.kind === 'casilla') key = isChecked(f.extra[c.header]) ? 0 : null
    else if (kind === 'numero') key = Number.isNaN(parseNumber(text)) ? (text ? text : null) : parseNumber(text)
    else if (kind === 'fecha') key = parseDate(text) ?? (text || null) // fechas: en cualquier formato, por fecha
    else key = text || null
    return { f, i, key }
  })
  const dir = desc ? -1 : 1
  keyed.sort((a, b) => {
    if (a.key === null || b.key === null) return a.key === b.key ? a.i - b.i : a.key === null ? 1 : -1
    let r: number
    if (typeof a.key === 'number' && typeof b.key === 'number') r = a.key - b.key
    else if (typeof a.key === 'number') r = -1 // números antes que textos
    else if (typeof b.key === 'number') r = 1
    else r = collator.compare(a.key, b.key)
    return r * dir || a.i - b.i
  })
  return keyed.map((k) => k.f)
}

// ---- Orden manual -----------------------------------------------------------------

export { byManualOrder, orderKey } from './fichero-io'

/**
 * Mueve una ficha delante de otra (o al final, con `beforeId` null) y devuelve
 * las nuevas posiciones de las fichas que cambian. Las posiciones son siempre
 * 1, 2, 3…: el número de la ficha, que es su ID en los borradores, no cambia.
 */
export function reorder(fichas: Ficha[], movedId: string, beforeId: string | null): Map<string, number> {
  const list = [...fichas].sort(byManualOrder)
  const moved = list.find((f) => f.id === movedId)
  if (!moved) return new Map()
  const rest = list.filter((f) => f !== moved)
  const at = beforeId ? rest.findIndex((f) => f.id === beforeId) : -1
  rest.splice(at === -1 ? rest.length : at, 0, moved)
  const changes = new Map<string, number>()
  rest.forEach((f, i) => { if (f.orden !== i + 1) changes.set(f.id, i + 1) })
  return changes
}

// ---- Editar las columnas de un fichero ------------------------------------------------

/** Una columna en el editor. `orig` es su encabezado guardado; sin él, es nueva. */
export interface ColumnDraft extends Column {
  orig?: string
}

/** Columnas de campos de Organon que guardan en `extra` el texto original del CSV. Solo se ocultan. */
export const KEEPS_CSV_TEXT = new Set<Column['field']>(['num', 'autor', 'fuente'])

export function columnsProblem(drafts: ColumnDraft[]): string | null {
  const seen = new Set<string>()
  for (const d of drafts) {
    const h = d.header.trim()
    if (!h) return 'Todas las columnas necesitan un nombre.'
    if (seen.has(fold(h))) return `Hay dos columnas que se llaman «${h}».`
    seen.add(fold(h))
    if (d.field === 'extra' && d.kind === 'lista' && !(d.options ?? []).some((o) => o.trim())) return `La lista «${h}» necesita al menos una opción.`
  }
  if (!drafts.some((d) => !d.hidden)) return 'Deja al menos una columna visible.'
  return null
}

/** Cuántas fichas tienen algo escrito en la columna `header` (lo que se pierde al eliminarla). */
export const filledCount = (fichas: Ficha[], header: string) => fichas.filter((f) => (f.extra[header] ?? '').trim() !== '').length

/**
 * Aplica el editor de columnas: devuelve las columnas limpias y las fichas del
 * fichero que cambian. Al renombrar, los valores pasan al nombre nuevo; al
 * eliminar una columna, sus valores se borran.
 */
export function applyColumns(fichas: Ficha[], before: Column[], drafts: ColumnDraft[]): { columns: Column[]; changed: Ficha[] } {
  const columns: Column[] = drafts.map(({ orig: _o, ...c }) => {
    const col: Column = { header: c.header.trim(), field: c.field }
    if (c.width !== undefined) col.width = c.width
    if (c.field === 'extra' && c.kind && c.kind !== 'texto') col.kind = c.kind
    if (col.kind === 'lista') col.options = [...new Set((c.options ?? []).map((o) => o.trim()).filter(Boolean))]
    if (c.hidden) col.hidden = true
    return col
  })
  // ID, autor y título guardan en `extra` lo que traía el CSV (lo que identifica a una ficha sin
  // fuente): eso no se borra aunque la columna desaparezca.
  const owned = before.filter((c) => !KEEPS_CSV_TEXT.has(c.field) || drafts.some((d) => d.orig === c.header)).map((c) => c.header)
  const moves = drafts.flatMap((d, i) => (d.orig !== undefined ? [[d.orig, columns[i].header] as const] : []))
  const changed: Ficha[] = []
  for (const f of fichas) {
    const extra = { ...f.extra }
    for (const h of owned) delete extra[h]
    for (const [from, to] of moves) if (f.extra[from] !== undefined) extra[to] = f.extra[from]
    const keys = Object.keys(extra)
    if (keys.length !== Object.keys(f.extra).length || keys.some((k) => extra[k] !== f.extra[k])) changed.push({ ...f, extra })
  }
  return { columns, changed }
}
