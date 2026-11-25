// Cuántas veces citan los textos de Escritura cada ficha: con {f. N} o [f. N], igual que las
// reconoce la vista previa (marcador, fichero delante o fichero por defecto del texto).
import { defaultFichero, findTokens, lookupRef, type DraftContext } from './draft'

type Ctx = Pick<DraftContext, 'fichas' | 'ficheros' | 'sources'>

/** Citas de cada ficha (por id) en un texto. Las referencias que no se encuentran no cuentan. */
export function countIn(md: string, ctx: Ctx): Map<string, number> {
  const out = new Map<string, number>()
  const fallback = defaultFichero(md, ctx.ficheros)
  for (const token of findTokens(md, ctx.ficheros)) {
    for (const ref of token.refs) {
      const found = lookupRef(ref, fallback, ctx)
      if ('ficha' in found && found.ficha) out.set(found.ficha.id, (out.get(found.ficha.id) ?? 0) + 1)
    }
  }
  return out
}

/** Suma las citas de varios textos. */
export function addCounts(...maps: ReadonlyMap<string, number>[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of maps) for (const [id, n] of m) out.set(id, (out.get(id) ?? 0) + n)
  return out
}

// Textos ya leídos, por nombre y sello: solo se vuelve a leer lo que cambió.
const cache = new Map<string, { stamp: string | null; text: string }>()

/** El texto de todos los borradores de Escritura del proyecto abierto. */
export async function readAllDrafts(): Promise<{ name: string; text: string }[]> {
  // Se carga aquí y no arriba: el resto del módulo son cuentas que se prueban sin la app.
  const { backend } = await import('./backend')
  const list = await backend.listDrafts()
  const out: { name: string; text: string }[] = []
  for (const d of list) {
    let hit = cache.get(d.name)
    if (!hit || hit.stamp !== d.stamp || d.stamp === null) {
      const { content, stamp } = await backend.readDraft(d.name)
      hit = { stamp, text: content }
      cache.set(d.name, hit)
    }
    out.push({ name: d.name, text: hit.text })
  }
  for (const name of [...cache.keys()]) if (!list.some((d) => d.name === name)) cache.delete(name)
  return out
}

/** Citas de cada ficha en cada texto y en total. */
export function usageOf(drafts: { name: string; text: string }[], ctx: Ctx): { byDraft: Map<string, Map<string, number>>; total: Map<string, number> } {
  const byDraft = new Map(drafts.map((d) => [d.name, countIn(d.text, ctx)]))
  return { byDraft, total: addCounts(...byDraft.values()) }
}
