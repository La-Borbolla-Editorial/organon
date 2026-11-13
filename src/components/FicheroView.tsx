import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { backend, type ProjectInfo } from '../backend'
import type { CiteOptions } from '../citations'
import { cellText, fichasToCsv, readCsv, type ParsedCsv } from '../fichero-io'
import { createFichero, deleteFicha, deleteFichero, getSettings, listFichas, listFicheros, listSources, listTags, saveFicha, setSettings, updateFichero, type FichaDraft } from '../store'
import type { Column, Ficha, Fichero, Source } from '../types'
import { FichaForm } from './FichaForm'
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
            <table className="fichas">
              <thead>
                <tr>{columns.map((c, i) => <th key={i} className={`col-${c.field}`}>{c.header}</th>)}</tr>
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
          <aside className="side-panel">
            <FichaForm
              key={editing.draft.id ?? 'new'} draft={editing.draft} num={editing.num} sources={sources} ficheros={ficheros} cite={cite} knownTags={knownTags}
              onCancel={() => setEditing(null)}
              onSave={async (d) => { await saveFicha(d); await reload(); setEditing(null) }}
              onDelete={editing.draft.id ? async () => { await deleteFicha(editing.draft.id!); await reload(); setEditing(null) } : undefined}
              onOpenPdf={editing.draft.id ? (d) => d.sourceId && onOpenPdf(d.sourceId, d.anchor ? { focusFichaId: d.id } : { linkFichaId: d.id }) : undefined}
            />
          </aside>
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
