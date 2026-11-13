import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { backend, type ProjectInfo } from '../backend'
import type { CiteOptions } from '../citations'
import { cellText, fichasToCsv, readCsv, type ParsedCsv } from '../fichero-io'
import { createFichero, deleteFicha, deleteFichero, getSettings, listFichas, listFicheros, listSources, listTags, saveFicha, setSettings, updateFichero, type FichaDraft } from '../store'
import type { Column, Ficha, Fichero, FieldKey, Source } from '../types'
import { FichaForm } from './FichaForm'
import { SidePanel } from './SidePanel'
import { ImportDialog } from './ImportDialog'
import { TopNav, type Section } from './TopNav'

interface Props {
  project: ProjectInfo
  cite: CiteOptions
  onSection: (s: Section) => void
  onSwitchProject: () => void
  onOpenPdf: (sourceId: string, ficha: { focusFichaId?: string; linkFichaId?: string }) => void
}

const NO_SOURCE = '__none__'
const MIN_COLUMN = 48
const DEFAULT_WIDTH: Record<FieldKey, number> = { num: 64, notaPermanente: 230, cita: 400, tags: 150, autor: 120, fuente: 190, pageLabel: 84, referencia: 190, notas: 240, extra: 150 }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function FicheroView({ project, cite, onSection, onSwitchProject, onOpenPdf }: Props) {
  const [ficheros, setFicheros] = useState<Fichero[]>([])
  const [currentId, setCurrentId] = useState('')
  const [all, setAll] = useState<Ficha[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [editing, setEditing] = useState<{ draft: FichaDraft; num: number | null } | null>(null)
  const [importing, setImporting] = useState<{ csv: ParsedCsv; fileName: string } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [naming, setNaming] = useState<{ mode: 'new' | 'rename'; value: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // Columna que se está arrastrando: su ancho provisional hasta soltar.
  const [resizing, setResizing] = useState<{ index: number; width: number } | null>(null)

  const reload = useCallback(async () => {
    const fs = await listFicheros()
    setFicheros(fs)
    setAll(await listFichas())
    setSources(await listSources())
    setKnownTags(await listTags())
    return fs
  }, [])

  useEffect(() => {
    void (async () => {
      const fs = await reload()
      const last = (await getSettings()).lastFichero
      setCurrentId(fs.some((f) => f.id === last) ? last : fs[0].id)
    })()
  }, [reload])

  const select = (id: string) => {
    setCurrentId(id)
    setEditing(null)
    setTag('')
    setSourceFilter('')
    setConfirmDelete(false)
    void setSettings({ lastFichero: id })
  }

  const fichero = ficheros.find((f) => f.id === currentId)
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const fichas = useMemo(() => all.filter((f) => f.ficheroId === currentId).sort((a, b) => a.num - b.num), [all, currentId])
  const tagsHere = useMemo(() => [...new Set(fichas.flatMap((f) => f.tags))].sort((a, b) => a.localeCompare(b, 'es')), [fichas])
  const sourcesHere = useMemo(() => sources.filter((s) => fichas.some((f) => f.sourceId === s.id)), [sources, fichas])

  const columns: Column[] = fichero?.columns ?? []
  const shown = useMemo(() => {
    const q = fold(query.trim())
    return fichas.filter((f) => {
      if (tag && !f.tags.includes(tag)) return false
      if (sourceFilter === NO_SOURCE ? f.sourceId : sourceFilter && f.sourceId !== sourceFilter) return false
      if (!q) return true
      const source = f.sourceId ? sourceById.get(f.sourceId) : undefined
      return fold(columns.map((c) => cellText(f, c, source)).join(' \n ')).includes(q)
    })
  }, [fichas, query, tag, sourceFilter, columns, sourceById])

  const widthOf = (c: Column, i: number) => (resizing?.index === i ? resizing.width : (c.width ?? DEFAULT_WIDTH[c.field]))

  const saveWidth = async (index: number, width: number | undefined) => {
    if (!fichero) return
    const next = fichero.columns.map((c, i) => (i === index ? { ...c, width } : c))
    setFicheros((fs) => fs.map((f) => (f.id === fichero.id ? { ...f, columns: next } : f)))
    await updateFichero(fichero.id, { columns: next })
  }

  const startResize = (index: number, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = widthOf(columns[index], index)
    let width = startWidth
    const move = (ev: PointerEvent) => {
      width = Math.max(MIN_COLUMN, Math.round(startWidth + ev.clientX - startX))
      setResizing({ index, width })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      setResizing(null)
      if (width !== startWidth) void saveWidth(index, width)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  // El editor se cierra con Esc y la fila que se edita queda siempre a la vista.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(null) }
    window.addEventListener('keydown', onKey)
    document.querySelector('table.fichas tr.current')?.scrollIntoView({ block: 'nearest' })
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const edit = (f: Ficha) => {
    const { num, createdAt: _c, updatedAt: _u, ...draft } = f
    setEditing({ draft, num })
  }

  const exportCsv = async () => {
    if (!fichero) return
    try {
      const saved = await backend.saveTextFile(`${fichero.name}.csv`, fichasToCsv(fichas, fichero.columns, sources))
      if (saved) setMessage({ kind: 'ok', text: `«${fichero.name}» exportado: ${fichas.length} fichas.` })
    } catch (e) {
      setMessage({ kind: 'error', text: `No se pudo exportar: ${e instanceof Error ? e.message : e}` })
    }
  }

  const submitName = async () => {
    if (!naming || !naming.value.trim()) return setNaming(null)
    if (naming.mode === 'new') {
      const id = await createFichero(naming.value.trim())
      await reload()
      select(id)
    } else if (fichero) {
      await updateFichero(fichero.id, { name: naming.value.trim() })
      await reload()
    }
    setNaming(null)
  }

  return (
    <div className="fichero">
      <TopNav project={project} section="fichero" onSection={onSection} onSwitchProject={onSwitchProject}>
        <button onClick={() => fileInput.current?.click()}>Importar CSV…</button>
        <button onClick={() => void exportCsv()} disabled={!fichero} data-testid="export-csv">Exportar CSV</button>
      </TopNav>
      <input
        ref={fileInput} type="file" accept=".csv,text/csv" hidden data-testid="csv-input"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const csv = readCsv(await f.text())
          if (!csv.headers.length || !csv.rows.length) return setMessage({ kind: 'error', text: `«${f.name}» no tiene filas que importar.` })
          setImporting({ csv, fileName: f.name })
        }}
      />

      <div className="fichero-tabs">
        {ficheros.map((f) => (
          <button key={f.id} className={f.id === currentId ? 'tab current' : 'tab'} onClick={() => select(f.id)}>
            {f.name} <span className="muted">{all.filter((x) => x.ficheroId === f.id).length}</span>
          </button>
        ))}
        {naming ? (
          <form className="page-row" onSubmit={(e) => { e.preventDefault(); void submitName() }}>
            <input autoFocus value={naming.value} onChange={(e) => setNaming({ ...naming, value: e.target.value })} placeholder="Nombre del fichero" onKeyDown={(e) => e.key === 'Escape' && setNaming(null)} />
            <button type="submit" className="primary">{naming.mode === 'new' ? 'Crear' : 'Renombrar'}</button>
            <button type="button" onClick={() => setNaming(null)}>Cancelar</button>
          </form>
        ) : (
          <>
            <button className="link" onClick={() => setNaming({ mode: 'new', value: '' })}>+ Nuevo fichero</button>
            <div className="spacer" />
            {fichero && <button className="link subtle" onClick={() => setNaming({ mode: 'rename', value: fichero.name })}>Renombrar</button>}
            {fichero && ficheros.length > 1 && (confirmDelete ? (
              <>
                <span className="muted">¿Eliminar «{fichero.name}» y sus {fichas.length} fichas?</span>
                <button className="danger" onClick={async () => { await deleteFichero(fichero.id); const fs = await reload(); select(fs[0].id) }}>Eliminar</button>
                <button onClick={() => setConfirmDelete(false)}>No</button>
              </>
            ) : (
              <button className="link subtle" onClick={() => setConfirmDelete(true)}>Eliminar fichero</button>
            ))}
          </>
        )}
      </div>

      <div className="fichero-filters">
        <input className="search" placeholder="Buscar en todas las columnas…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="fichero-search" />
        <select value={tag} onChange={(e) => setTag(e.target.value)} data-testid="fichero-tag">
          <option value="">Todos los tags</option>
          {tagsHere.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} data-testid="fichero-source">
          <option value="">Todas las fuentes</option>
          {sourcesHere.map((s) => <option key={s.id} value={s.id}>{String(s.csl.title ?? s.citekey)}</option>)}
          <option value={NO_SOURCE}>Sin fuente vinculada</option>
        </select>
        <span className="muted" data-testid="fichero-count">{shown.length === fichas.length ? `${fichas.length} fichas` : `${shown.length} de ${fichas.length}`}</span>
        <button className="primary" onClick={() => setEditing({ num: null, draft: { ficheroId: currentId, notaPermanente: '', cita: '', sourceId: null, pageLabel: '', pageManual: true, anchor: null, tags: [], referencia: '', notas: '', extra: {} } })}>
          + Ficha
        </button>
      </div>

      {message && (
        <div className={`banner ${message.kind}`}>
          {message.text}
          <button className="link" onClick={() => setMessage(null)}>Cerrar</button>
        </div>
      )}

      <div className="fichero-body">
        <div className="table-wrap">
          {fichas.length === 0 ? (
            <div className="empty">
              <h2>Este fichero está vacío</h2>
              <p>Importa tu hoja de cálculo (en Sheets: <em>Archivo → Descargar → CSV</em>, una vez por pestaña) o crea fichas marcando pasajes en un PDF de la biblioteca.</p>
              <button className="primary" onClick={() => fileInput.current?.click()}>Importar CSV…</button>
            </div>
          ) : (
            <table className={resizing ? 'fichas resizing' : 'fichas'} style={{ width: columns.reduce((sum, c, i) => sum + widthOf(c, i), 0) }}>
              <colgroup>{columns.map((c, i) => <col key={i} style={{ width: widthOf(c, i) }} />)}</colgroup>
              <thead>
                <tr>
                  {columns.map((c, i) => (
                    <th key={i} className={`col-${c.field}`}>
                      <span className="th-label">{c.header}</span>
                      <span
                        className="col-resizer" role="separator" aria-orientation="vertical" aria-label={`Cambiar el ancho de ${c.header}`}
                        title="Arrastra para cambiar el ancho. Doble clic: ancho normal." data-testid={`resize-${i}`}
                        onPointerDown={(e) => startResize(i, e)} onDoubleClick={() => void saveWidth(i, undefined)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => {
                  const source = f.sourceId ? sourceById.get(f.sourceId) : undefined
                  return (
                    <tr key={f.id} className={editing?.draft.id === f.id ? 'current' : ''} onClick={() => edit(f)} data-testid="ficha-row">
                      {columns.map((c, i) => (
                        <td key={i} className={`col-${c.field}`}>
                          {c.field === 'tags' ? (
                            <div className="tags">{f.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
                          ) : c.field === 'num' ? (
                            <>
                              {cellText(f, c, source)}
                              {f.anchor ? <span className="dot linked" title="Pasaje marcado en el PDF" /> : !f.sourceId ? <span className="dot orphan" title="Sin fuente vinculada" /> : null}
                            </>
                          ) : (
                            <div className="clamp">{cellText(f, c, source)}</div>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {editing && (
          <SidePanel>
            <FichaForm
              key={editing.draft.id ?? 'new'} draft={editing.draft} num={editing.num} sources={sources} ficheros={ficheros} cite={cite} knownTags={knownTags}
              onCancel={() => setEditing(null)}
              onSave={async (d) => { await saveFicha(d); await reload(); setEditing(null) }}
              onDelete={editing.draft.id ? async () => { await deleteFicha(editing.draft.id!); await reload(); setEditing(null) } : undefined}
              onOpenPdf={editing.draft.id ? (d) => d.sourceId && onOpenPdf(d.sourceId, d.anchor ? { focusFichaId: d.id } : { linkFichaId: d.id }) : undefined}
            />
          </SidePanel>
        )}
      </div>

      {importing && (
        <ImportDialog
          csv={importing.csv} fileName={importing.fileName} ficheros={ficheros} fichas={all} sources={sources}
          onCancel={() => setImporting(null)}
          onDone={async (id, text) => { setImporting(null); await reload(); select(id); setMessage({ kind: 'ok', text }) }}
        />
      )}
    </div>
  )
}
