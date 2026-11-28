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
  /** Valores de las columnas propias del fichero (y de las del CSV que Organon no interpreta), por encabezado. */
  extra: Record<string, string>
  /** Posición en el orden manual del fichero. Sin ella, la ficha va en el lugar de su número. */
  orden?: number
  /** Color de su resaltado en el PDF. Sin él, amarillo. */
  color?: HlColor
  /** Imagen de un recorte del PDF (archivo en `recortes/`), si la ficha nació de uno. */
  imagen?: string
  createdAt: string
  updatedAt: string
}

/** A qué campo de la ficha corresponde una columna del CSV. */
/** `usos` es calculada: cuántas veces citan la ficha los textos de Escritura. No se guarda ni se importa. */
export type FieldKey = 'num' | 'notaPermanente' | 'cita' | 'tags' | 'autor' | 'fuente' | 'pageLabel' | 'referencia' | 'notas' | 'usos' | 'extra'

/** Qué guarda una columna propia (`field: 'extra'`). Los valores son siempre texto, como en el CSV. */
export type ColumnKind = 'texto' | 'numero' | 'fecha' | 'casilla' | 'lista'

export const COLUMN_KINDS: Record<ColumnKind, string> = {
  texto: 'Texto',
  numero: 'Número',
  fecha: 'Fecha',
  casilla: 'Casilla (sí / no)',
  lista: 'Lista de opciones',
}

export interface Column {
  /** Encabezado tal como aparece en la hoja de cálculo. Único dentro del fichero. */
  header: string
  field: FieldKey
  /** Ancho de la columna en la tabla, en píxeles (si se ha cambiado a mano). */
  width?: number
  /** Solo en las columnas propias. Sin él, texto. */
  kind?: ColumnKind
  /** Opciones de una columna `lista`. */
  options?: string[]
  /** Oculta en la tabla. Se sigue viendo en la ficha y se sigue exportando. */
  hidden?: boolean
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
  { header: 'Veces usada', field: 'usos' },
]

// ---- Marcas del PDF (marcas.json) ----------------------------------------------

/**
 * Colores del resaltado. Organon no les da ningún significado: cada quien decide qué quiere decir
 * cada uno. Se guardan por nombre; el tono exacto lo pone el tema.
 */
export const HL_COLORS = ['amarillo', 'verde', 'azul', 'rosa', 'naranja', 'morado'] as const
export type HlColor = (typeof HL_COLORS)[number]
export const DEFAULT_HL_COLOR: HlColor = 'amarillo'
export const isHlColor = (c: unknown): c is HlColor => HL_COLORS.includes(c as HlColor)

export type MarcaKind = 'resaltado' | 'nota' | 'recorte'

/** Algo marcado en el PDF de una fuente que no es (todavía) una ficha. */
export interface Marca {
  id: string
  sourceId: string
  kind: MarcaKind
  /** Resaltado: el pasaje, igual que el de una ficha. */
  anchor?: Anchor
  color?: HlColor
  /** Nota y recorte: hoja del PDF (desde 1). */
  page?: number
  /** Nota: punto de la hoja (0–1). */
  at?: [x: number, y: number]
  /** Recorte: rectángulo de la hoja (0–1). */
  rect?: [x: number, y: number, w: number, h: number]
  /** Nota: su texto. */
  texto?: string
  /** Recorte: archivo de la imagen en `recortes/`. */
  imagen?: string
  /** Si vino de una anotación del PDF (Zotero, Vista Previa…): cuál, para no importarla dos veces. */
  origen?: string
  createdAt: string
  updatedAt: string
}
