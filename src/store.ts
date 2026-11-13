// Datos del proyecto abierto. Un proyecto es una carpeta con tres archivos
// JSON legibles (más `pdfs/`):
//
//   organon.json   ajustes del proyecto y lista de ficheros
//   fuentes.json   fuentes: metadatos CSL, PDF adjunto y paginación
//   fichas.json    fichas
//
// Todo se carga en memoria al abrir el proyecto (son cientos de fichas, no
// millones) y cada cambio reescribe el archivo afectado de forma atómica.
import { backend } from './backend'
import { DEFAULT_PAGINATION, type PageRange } from './pagination'
import { suggestCitekey } from './source-form'
import { matchSource, type ImportedFicha } from './fichero-io'
import { DEFAULT_COLUMNS, type Column, type CslItem, type Ficha, type Fichero, type Source } from './types'

const FORMAT = 1
const FILES = { project: 'organon.json', sources: 'fuentes.json', fichas: 'fichas.json' } as const

interface ProjectFile {
  format: number
  settings: Record<string, string>
  ficheros: Fichero[]
}

interface Data {
  project: ProjectFile
  sources: Source[]
  fichas: Ficha[]
}

let data: Data | null = null

function db(): Data {
  if (!data) throw new Error('No hay ningún proyecto abierto.')
  return data
}

async function readJson<T>(name: string): Promise<T | null> {
  const text = await backend.readData(name)
  if (text === null || !text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch (e) {
    throw new Error(`El archivo ${name} del proyecto está dañado: ${e instanceof Error ? e.message : e}`)
  }
}

/** Carga en memoria el proyecto que el núcleo tiene abierto. Si la carpeta es nueva, lo inicia. */
export async function loadProject(): Promise<void> {
  data = null
  const project = await readJson<ProjectFile>(FILES.project)
  if (project && project.format > FORMAT) throw new Error('Este proyecto se creó con una versión más reciente de Organon.')
  const sources = await readJson<{ fuentes: Source[] }>(FILES.sources)
  const fichas = await readJson<{ fichas: Ficha[] }>(FILES.fichas)
  data = {
    project: {
      format: FORMAT,
      settings: project?.settings ?? {},
      ficheros: ((project?.ficheros?.length ? project.ficheros : [{ id: 'general', name: 'General' }]) as Partial<Fichero>[] as Fichero[]).map((f) => ({ ...f, columns: f.columns?.length ? f.columns : DEFAULT_COLUMNS })),
    },
    sources: sources?.fuentes ?? [],
    fichas: fichas?.fichas ?? [],
  }
  if (!project) await persist('project')
}

export function unloadProject(): void {
  data = null
}

// Las coordenadas de los resaltados se guardan con 4 decimales: de sobra y más legible.
const stringify = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v), 2) + '\n'

// Las escrituras van en cola para que nunca se pisen entre sí.
let queue: Promise<unknown> = Promise.resolve()
function persist(...which: (keyof typeof FILES)[]): Promise<void> {
  const d = db()
  const files = which.map((w) => ({
    name: FILES[w],
    content: stringify(w === 'project' ? d.project : w === 'sources' ? { format: FORMAT, fuentes: d.sources } : { format: FORMAT, fichas: d.fichas }),
  }))
  const run = queue.then(() => backend.writeData(files))
  queue = run.catch(() => {})
  return run
}

const now = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

// ---- Ajustes del proyecto ---------------------------------------------------

export const getSettings = async (): Promise<Record<string, string>> => ({ ...db().project.settings })

export async function setSettings(patch: Record<string, string>): Promise<void> {
  const d = db()
  d.project = { ...d.project, settings: { ...d.project.settings, ...patch } }
  await persist('project')
}

// ---- Ficheros ------------------------------------------------------------------

export const listFicheros = async (): Promise<Fichero[]> => db().project.ficheros

export async function createFichero(name: string, columns: Column[] = DEFAULT_COLUMNS): Promise<string> {
  const d = db()
  const id = newId()
  d.project = { ...d.project, ficheros: [...d.project.ficheros, { id, name, columns }] }
  await persist('project')
  return id
}

export async function updateFichero(id: string, patch: Partial<Pick<Fichero, 'name' | 'columns'>>): Promise<void> {
  const d = db()
  d.project = { ...d.project, ficheros: d.project.ficheros.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
  await persist('project')
}

/** Elimina un fichero CON sus fichas. Siempre queda al menos un fichero. */
export async function deleteFichero(id: string): Promise<void> {
  const d = db()
  if (d.project.ficheros.length <= 1) throw new Error('El proyecto necesita al menos un fichero.')
  d.project = { ...d.project, ficheros: d.project.ficheros.filter((f) => f.id !== id) }
  d.fichas = d.fichas.filter((f) => f.ficheroId !== id)
  await persist('project', 'fichas')
}

/**
 * Vuelca en un fichero las fichas leídas de un CSV. Con `updateById`, las que
 * ya existen con el mismo ID se actualizan (conservan su posición en el PDF y
 * su fuente si el CSV no la reconoce); el resto se añade.
 */
export async function importFichas(ficheroId: string, rows: ImportedFicha[], updateById: boolean): Promise<{ added: number; updated: number }> {
  const d = db()
  const existing = new Map(d.fichas.filter((f) => f.ficheroId === ficheroId).map((f) => [f.num, f]))
  let nextNum = Math.max(0, ...existing.keys(), ...rows.map((r) => r.num ?? 0)) + 1
  const taken = new Set(existing.keys())
  const replaced = new Map<string, Ficha>()
  const added: Ficha[] = []
  for (const { num, ...fields } of rows) {
    const old = updateById && num !== null ? existing.get(num) : undefined
    if (old) {
      const sourceId = fields.sourceId ?? old.sourceId
      const pageChanged = fields.pageLabel !== old.pageLabel
      replaced.set(old.id, { ...old, ...fields, sourceId, extra: { ...fields.extra }, pageManual: old.pageManual || pageChanged, updatedAt: now() })
    } else {
      let n = num
      if (n === null || taken.has(n)) n = nextNum++
      taken.add(n)
      added.push({ ...fields, id: newId(), num: n, ficheroId, pageManual: true, anchor: null, createdAt: now(), updatedAt: now() })
    }
  }
  d.fichas = [...d.fichas.map((f) => replaced.get(f.id) ?? f), ...added]
  await persist('fichas')
  return { added: added.length, updated: replaced.size }
}

/**
 * Busca fuente para las fichas importadas que aún no la tienen, usando el
 * autor y el título que traían en el CSV. Devuelve cuántas vinculó.
 */
export async function linkOrphanFichas(): Promise<number> {
  const d = db()
  const headers = new Map(d.project.ficheros.map((f) => [f.id, { autor: f.columns.find((c) => c.field === 'autor')?.header, fuente: f.columns.find((c) => c.field === 'fuente')?.header }]))
  let linked = 0
  d.fichas = d.fichas.map((f) => {
    if (f.sourceId) return f
    const h = headers.get(f.ficheroId)
    const source = matchSource(d.sources, (h?.autor && f.extra[h.autor]) || '', (h?.fuente && f.extra[h.fuente]) || '')
    if (!source) return f
    linked++
    return { ...f, sourceId: source.id }
  })
  if (linked) await persist('fichas')
  return linked
}

// ---- Fuentes ------------------------------------------------------------------

const byCitekey = (a: Source, b: Source) => a.citekey.localeCompare(b.citekey, 'es', { sensitivity: 'base' })

export const listSources = async (): Promise<Source[]> => [...db().sources].sort(byCitekey)

export const getSource = async (id: string): Promise<Source | null> => db().sources.find((s) => s.id === id) ?? null

function replaceSource(id: string, patch: Partial<Source>) {
  const d = db()
  d.sources = d.sources.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

/** Importa ítems CSL. Los que ya existen (misma clave de cita) actualizan sus metadatos. */
export async function upsertSources(items: CslItem[]): Promise<{ added: number; updated: number }> {
  const d = db()
  let added = 0
  let updated = 0
  for (const item of items) {
    const citekey = String(item['citation-key'] ?? item.id ?? '').trim() || newId()
    const existing = d.sources.find((s) => s.citekey === citekey)
    if (existing) {
      updated++
      replaceSource(existing.id, { csl: { ...item, id: existing.id } })
    } else {
      added++
      const id = newId()
      d.sources = [...d.sources, { id, citekey, csl: { ...item, id }, pdfFile: null, pdfPages: null, pagination: DEFAULT_PAGINATION, paginationVerified: false, paginationNote: '' }]
    }
  }
  await persist('sources')
  return { added, updated }
}

/** Crea una fuente a mano (sin `id`) o guarda los metadatos editados de una existente. */
export async function saveSource(csl: Record<string, any>, id?: string): Promise<string> {
  const d = db()
  if (id) {
    replaceSource(id, { csl: { ...csl, id } })
  } else {
    id = newId()
    const citekey = suggestCitekey(csl, new Set(d.sources.map((s) => s.citekey)))
    d.sources = [...d.sources, { id, citekey, csl: { ...csl, id }, pdfFile: null, pdfPages: null, pagination: DEFAULT_PAGINATION, paginationVerified: false, paginationNote: '' }]
  }
  await persist('sources')
  return id
}

export async function setSourcePdf(id: string, pdfFile: string, pdfPages: number, pagination: PageRange[], note: string): Promise<void> {
  replaceSource(id, { pdfFile, pdfPages, pagination, paginationVerified: false, paginationNote: note })
  await persist('sources')
}

/**
 * Guarda la paginación de una fuente y, a la vez, las páginas recalculadas de
 * las fichas que el usuario aceptó cambiar (los dos archivos o ninguno).
 */
export async function savePagination(id: string, pagination: PageRange[], verified: boolean, note: string, relabel: { fichaId: string; pageLabel: string }[]): Promise<void> {
  const d = db()
  replaceSource(id, { pagination, paginationVerified: verified, paginationNote: note })
  if (!relabel.length) return persist('sources')
  const next = new Map(relabel.map((r) => [r.fichaId, r.pageLabel]))
  d.fichas = d.fichas.map((f) => (next.has(f.id) ? { ...f, pageLabel: next.get(f.id)!, updatedAt: now() } : f))
  await persist('sources', 'fichas')
}

/** Elimina la fuente. Sus fichas se conservan, sin fuente. */
export async function deleteSource(id: string): Promise<void> {
  const d = db()
  d.sources = d.sources.filter((s) => s.id !== id)
  const orphans = d.fichas.some((f) => f.sourceId === id)
  d.fichas = d.fichas.map((f) => (f.sourceId === id ? { ...f, sourceId: null, updatedAt: now() } : f))
  await persist(...(orphans ? (['sources', 'fichas'] as const) : (['sources'] as const)))
}

// ---- Fichas -------------------------------------------------------------------

export const getFicha = async (id: string): Promise<Ficha | null> => db().fichas.find((f) => f.id === id) ?? null

export async function listFichas(filter: { sourceId?: string; ficheroId?: string } = {}): Promise<Ficha[]> {
  const all = db().fichas
  if (filter.ficheroId) return all.filter((f) => f.ficheroId === filter.ficheroId).sort((a, b) => a.num - b.num)
  if (!filter.sourceId) return [...all].sort((a, b) => a.ficheroId.localeCompare(b.ficheroId) || a.num - b.num)
  return all.filter((f) => f.sourceId === filter.sourceId).sort((a, b) => (a.anchor?.start.page ?? 0) - (b.anchor?.start.page ?? 0) || a.num - b.num)
}

export async function countFichasBySource(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const f of db().fichas) if (f.sourceId) counts[f.sourceId] = (counts[f.sourceId] ?? 0) + 1
  return counts
}

export async function listTags(): Promise<string[]> {
  return [...new Set(db().fichas.flatMap((f) => f.tags))].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export type FichaDraft = Omit<Ficha, 'id' | 'num' | 'createdAt' | 'updatedAt'> & { id?: string }

export async function saveFicha(draft: FichaDraft): Promise<string> {
  const d = db()
  const { id: draftId, ...fields } = draft
  let id = draftId
  const nextNum = () => Math.max(0, ...d.fichas.filter((f) => f.ficheroId === fields.ficheroId).map((f) => f.num)) + 1
  if (id) {
    // Al cambiar de fichero, la ficha recibe un ID nuevo en el de destino.
    d.fichas = d.fichas.map((f) => (f.id === id ? { ...f, ...fields, num: f.ficheroId === fields.ficheroId ? f.num : nextNum(), updatedAt: now() } : f))
  } else {
    id = newId()
    const num = nextNum()
    d.fichas = [...d.fichas, { id, num, ...fields, createdAt: now(), updatedAt: now() }]
  }
  await persist('fichas')
  return id
}

export async function deleteFicha(id: string): Promise<void> {
  const d = db()
  d.fichas = d.fichas.filter((f) => f.id !== id)
  await persist('fichas')
}
