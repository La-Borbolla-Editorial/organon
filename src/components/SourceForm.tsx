import { useMemo, useRef, useState } from 'react'
import { formatBibliographyEntry, type CiteOptions } from '../citations'
import { lookup, parseIdentifier } from '../lookup'
import { applyFields, EMPTY_FIELDS, fieldsFor, fieldsFromCsl, findDuplicate, SOURCE_TYPES, type SourceFields } from '../source-form'
import { attachPdf } from '../pdf/attach'
import { deleteSource, getSource, saveSource } from '../store'
import type { Source } from '../types'

interface Props {
  /** Fuente que se edita; sin ella, se crea una nueva. */
  source?: Source
  /** Fuentes de la biblioteca, para avisar si esta ya está. */
  sources: Source[]
  /** Fichas que citan esta fuente (para avisar antes de cambiar el PDF o eliminarla). */
  fichaCount: number
  cite: CiteOptions
  /** `pdf`: se guardó y se adjuntó un PDF nuevo. */
  onDone: (id: string, result: 'added' | 'updated' | 'deleted' | 'pdf') => void
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

export function SourceForm({ source, sources, fichaCount, cite, onDone, onCancel }: Props) {
  // `base` guarda los campos CSL que el formulario no muestra, para no perderlos.
  const [base, setBase] = useState<Record<string, any>>(() => { const { id: _id, ...rest } = source?.csl ?? { id: '' }; return rest })
  const [f, setF] = useState<SourceFields>(() => (source ? fieldsFromCsl(source.csl) : EMPTY_FIELDS))
  const [identifier, setIdentifier] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // PDF elegido en el formulario: se adjunta al guardar.
  const [pdf, setPdf] = useState<File | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pdfInput = useRef<HTMLInputElement>(null)
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
      const id = await saveSource(csl, source?.id)
      if (pdf) {
        const saved = await getSource(id)
        try {
          await attachPdf(saved!, pdf)
        } catch (e) {
          throw new Error(`Los datos se guardaron, pero no se pudo adjuntar «${pdf.name}»: ${e instanceof Error ? e.message : e}`)
        }
      }
      onDone(id, pdf ? 'pdf' : source ? 'updated' : 'added')
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

        <section className="pdf-box">
          <h3>PDF</h3>
          <div className="page-row">
            <span data-testid="source-pdf-state">
              {pdf ? <>Se adjuntará <strong>{pdf.name}</strong> al guardar.</> : source?.pdfFile ? `${source.pdfPages} hojas · paginación ${source.paginationVerified ? 'verificada' : 'sin verificar'}` : 'Sin PDF adjunto.'}
            </span>
            <div className="spacer" />
            {pdf && <button type="button" className="link" onClick={() => setPdf(null)}>Quitar</button>}
            <button type="button" onClick={() => pdfInput.current?.click()} data-testid="source-pdf-button">{source?.pdfFile || pdf ? 'Cambiar PDF…' : 'Adjuntar PDF…'}</button>
          </div>
          {pdf && source?.pdfFile && (
            <p className="page-warning">
              Sustituirá al PDF actual y habrá que verificar otra vez la paginación.
              {fichaCount > 0 && ' Las fichas marcadas conservan su posición: hazlo solo si es el mismo documento (por ejemplo, con OCR añadido).'}
            </p>
          )}
          <input
            ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden data-testid="pdf-input"
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) setPdf(file) }}
          />
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
          {saving && pdf && <span className="muted">Analizando el PDF…</span>}
          <div className="spacer" />
          {source && (confirmDelete ? (
            <>
              <span className="muted">¿Eliminar la fuente?{fichaCount ? ` Sus ${fichaCount} ficha(s) se conservan, sin fuente.` : ''}</span>
              <button type="button" className="danger" onClick={async () => { await deleteSource(source.id); onDone(source.id, 'deleted') }} data-testid="source-delete-confirm">Eliminar</button>
              <button type="button" onClick={() => setConfirmDelete(false)}>No</button>
            </>
          ) : (
            <button type="button" className="link subtle" onClick={() => setConfirmDelete(true)} data-testid="source-delete">Eliminar fuente</button>
          ))}
        </div>
      </form>
    </div>
  )
}
