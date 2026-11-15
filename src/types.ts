import type { PageRange } from './pagination'

/** Ítem CSL-JSON tal como lo exporta Zotero. Es la fuente de verdad de los metadatos. */
export type CslItem = Record<string, any> & { id: string }

export interface Source {
  id: string
  citekey: string
  csl: CslItem
  pdfFile: string | null
  pdfPages: number | null
  pagination: PageRange[]
  paginationVerified: boolean
  /** Cómo se obtuvo la paginación actual (conjetura automática, a mano…). */
  paginationNote: string
  /**
   * Obra canónica (la Ordinatio, la Metafísica…): sus fichas se citan por su referencia
   * canónica («II d. 3 n. 29»), no por la página de esta edición.
   */
  canonical?: boolean
}

/** Un extremo de la selección: página del PDF (desde 1) y mitad de la hoja (0 izq., 1 der.). */
export interface AnchorPoint {
  page: number
  half: 0 | 1
}

/** Posición exacta de una cita dentro del PDF. Coordenadas relativas a la página (0–1). */
export interface Anchor {
  start: AnchorPoint
  end: AnchorPoint
  /** Texto seleccionado, tal como salió del PDF. */
  exact: string
  rects: { page: number; r: [x: number, y: number, w: number, h: number][] }[]
}

export interface Ficha {
  id: string
  ficheroId: string
  /** ID visible, como en la hoja de cálculo. */
  num: number
  notaPermanente: string
  cita: string
  sourceId: string | null
  /** Página IMPRESA que se cita. Texto libre: «69», «69-70», «xii». */
  pageLabel: string
  /** true si la escribí a mano: nunca se recalcula. */
  pageManual: boolean
  anchor: Anchor | null
  tags: string[]
  /** Obra canónica / referencias (texto libre). */
  referencia: string
  notas: string
  /** Columnas adicionales del CSV, sin tocar. */
  extra: Record<string, string>
  createdAt: string
  updatedAt: string
}

/** A qué campo de la ficha corresponde una columna del CSV. */
export type FieldKey = 'num' | 'notaPermanente' | 'cita' | 'tags' | 'autor' | 'fuente' | 'pageLabel' | 'referencia' | 'notas' | 'extra'

export interface Column {
  /** Encabezado tal como aparece en la hoja de cálculo. */
  header: string
  field: FieldKey
  /** Ancho de la columna en la tabla, en píxeles (si se ha cambiado a mano). */
  width?: number
}

/** Un fichero es como una pestaña de la hoja: sus fichas y sus columnas, en su orden. */
export interface Fichero {
  id: string
  name: string
  /** Cómo se nombran sus fichas en los borradores: «f.» en {f. 51}. Cada fichero puede tener el suyo. */
  marker: string
  columns: Column[]
}

export const DEFAULT_COLUMNS: Column[] = [
  { header: 'ID', field: 'num' },
  { header: 'Nota permanente', field: 'notaPermanente' },
  { header: 'Cita', field: 'cita' },
  { header: 'Tags', field: 'tags' },
  { header: 'Autor', field: 'autor' },
  { header: 'Paper/Texto', field: 'fuente' },
  { header: 'Página', field: 'pageLabel' },
  { header: 'Obra Canónica', field: 'referencia' },
  { header: 'Notas', field: 'notas' },
]
