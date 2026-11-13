import { useMemo, useState } from 'react'
import { formatBibliographyEntry, type CiteOptions } from '../citations'
import { lookup, parseIdentifier } from '../lookup'
import { applyFields, EMPTY_FIELDS, fieldsFor, fieldsFromCsl, findDuplicate, SOURCE_TYPES, type SourceFields } from '../source-form'
import { saveSource } from '../store'
import type { Source } from '../types'

interface Props {
  /** Fuente que se edita; sin ella, se crea una nueva. */
  source?: Source
  /** Fuentes de la biblioteca, para avisar si esta ya está. */
  sources: Source[]
  cite: CiteOptions
  onDone: (id: string) => void
  onCancel: () => void
}

const LABELS: Record<Exclude<keyof SourceFields, 'type'>, string> = {
  author: 'Autor(es)', title: 'Título', translator: 'Traductor(es)', editor: 'Editor(es)', containerTitle: 'Publicado en', year: 'Año',
  volume: 'Volumen', issue: 'Número', page: 'Páginas', edition: 'Edición', publisher: 'Editorial', publisherPlace: 'Lugar', DOI: 'DOI', ISBN: 'ISBN', URL: 'URL',
}
const CONTAINER: Record<string, string> = { 'article-journal': 'Revista', chapter: 'Libro que lo contiene', 'entry-encyclopedia': 'Enciclopedia', 'paper-conference': 'Actas', webpage: 'Sitio web' }
const ORDER: Exclude<keyof SourceFields, 'type'>[] = ['author', 'title', 'containerTitle', 'editor', 'translator', 'year', 'volume', 'issue', 'page', 'edition', 'publisher', 'publisherPlace', 'DOI', 'ISBN', 'URL']
const PEOPLE = new Set(['author', 'editor', 'translator'])
const SHORT = new Set(['year', 'volume', 'issue', 'page', 'edition'])

export function SourceForm({ source, sources, cite, onDone, onCancel }: Props) {
  // `base` guarda los campos CSL que el formulario no muestra, para no perderlos.
  const [base, setBase] = useState<Record<string, any>>(() => { const { id: _id, ...rest } = source?.csl ?? { id: '' }; return rest })
  const [f, setF] = useState<SourceFields>(() => (source ? fieldsFromCsl(source.csl) : EMPTY_FIELDS))
  const [identifier, setIdentifier] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<SourceFields>) => setF((prev) => ({ ...prev, ...patch }))

  const shown = fieldsFor(f.type)
  const csl = useMemo(() => applyFields(base, f), [base, f])
  const duplicate = useMemo(() => findDuplicate(csl, sources, source?.id), [csl, sources, source])
  const preview = useMemo(() => (f.title.trim() ? formatBibliographyEntry({ ...csl, id: source?.id ?? '__nueva__' }, cite) : ''), [csl, f.title, cite, source])

  const search = async () => {
    const id = parseIdentifier(identifier)
    setFound('')
    if (!id) return setError('Eso no parece un DOI (10.xxxx/…) ni un ISBN (10 o 13 dígitos).')
    setError('')
    setSearching(true)
    try {
      const result = await lookup(id)
      setBase(result)
      setF(fieldsFromCsl(result))
      setFound(`Datos encontrados por ${id.kind === 'doi' ? 'DOI' : 'ISBN'}. Revísalos antes de guardar: los catálogos tienen errores.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }

  const submit = async () => {
    if (!f.title.trim()) return setError('Falta el título.')
    setSaving(true)
    try {
      onDone(await saveSource(csl, source?.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal source-form" role="dialog" aria-label="Fuente" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <h2>{source ? 'Editar fuente' : 'Añadir fuente'}</h2>

        <section className="lookup-box">
          <h3>Rellenar con un DOI o un ISBN</h3>
          <div className="page-row">
            <input
              value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="10.1017/… o 978-0-521-63563-9" data-testid="source-identifier"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }}
            />
            <button type="button" onClick={() => void search()} disabled={searching || !identifier.trim()} data-testid="source-lookup">{searching ? 'Buscando…' : 'Buscar'}</button>
          </div>
          <p className="muted">Consulta doi.org u Open Library; solo se envía ese identificador.</p>
          {found && <p className="found">{found}</p>}
        </section>

        <label>
          Tipo
          <select value={f.type} onChange={(e) => set({ type: e.target.value })} data-testid="source-type">
            {Object.entries(SOURCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <div className="source-fields">
          {ORDER.filter((k) => shown.has(k)).map((k) => (
            <label key={k} className={PEOPLE.has(k) || k === 'title' || k === 'containerTitle' || k === 'URL' ? 'wide' : SHORT.has(k) ? 'short' : ''}>
              {k === 'containerTitle' ? (CONTAINER[f.type] ?? LABELS[k]) : LABELS[k]}
              {PEOPLE.has(k) ? (
                <textarea rows={Math.max(1, f[k].split('\n').length)} value={f[k]} onChange={(e) => set({ [k]: e.target.value })} placeholder={k === 'author' ? 'Apellido, Nombre (una persona por línea)' : ''} data-testid={`source-${k}`} />
              ) : (
                <input value={f[k]} onChange={(e) => set({ [k]: e.target.value })} data-testid={`source-${k}`} />
              )}
            </label>
          ))}
        </div>

        {preview && (
          <section>
            <h3>Así aparecerá en la bibliografía</h3>
            <div className="citation-preview bordered" dangerouslySetInnerHTML={{ __html: preview }} data-testid="source-preview" />
          </section>
        )}

        {duplicate && (
          <div className="banner warn" data-testid="source-duplicate">
            <span>
              Esta fuente parece estar ya en la biblioteca: <span dangerouslySetInnerHTML={{ __html: formatBibliographyEntry(duplicate.csl, cite) }} />
            </span>
          </div>
        )}
        {error && <div className="banner error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving} data-testid="source-save">{source ? 'Guardar cambios' : duplicate ? 'Añadirla de todos modos' : 'Añadir fuente'}</button>
          <button type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}
