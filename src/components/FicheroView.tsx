import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { backend, type ProjectInfo } from '../backend'
import type { CiteOptions } from '../citations'
import { markerProblem, suggestMarker } from '../draft'
import { byManualOrder, cellText, fichasToCsv, readCsv, setUsage, usesOf, type ParsedCsv } from '../fichero-io'
import { readAllDrafts, usageOf } from '../usage'
import { distinctValues, EMPTY_VIEW, filterActive, fold, isChecked, matchFilter, readView, sortByColumn, type ColumnFilter, type TableView } from '../fichero-table'
import { createFichero, deleteFicha, deleteFichero, getSettings, listFichas, listFicheros, listSources, listTags, moveFicha, saveFicha, saveFicheroColumns, setSettings, updateFichero, type FichaDraft } from '../store'
import type { Column, Ficha, Fichero, FieldKey, Source } from '../types'
import { ColumnMenu } from './ColumnMenu'
import { ColumnsDialog } from './ColumnsDialog'
import { FichaForm } from './FichaForm'
import { SidePanel } from './SidePanel'
import { ImportDialog } from './ImportDialog'
import { TopNav, type Section } from './TopNav'
import { useGrowing } from '../useGrowing'

interface Props {
  project: ProjectInfo
  cite: CiteOptions
  onSection: (s: Section) => void
  onSwitchProject: () => void
  onOpenPdf: (sourceId: string, ficha: { focusFichaId?: string; linkFichaId?: string }) => void
  /** Ficha que se abre al entrar (p. ej. desde Escritura). */
  focusFichaId?: string
}

const MIN_COLUMN = 48
const DEFAULT_WIDTH: Record<FieldKey, number> = { num: 64, notaPermanente: 230, cita: 400, tags: 150, autor: 120, fuente: 190, pageLabel: 84, referencia: 190, notas: 240, usos: 90, extra: 150 }
const viewKey = (ficheroId: string) => `vista:${ficheroId}`

/** Dónde se soltaría la fila que se arrastra: delante o detrás de otra. */
interface Drop { id: string; after: boolean }

export function FicheroView({ project, cite, onSection, onSwitchProject, onOpenPdf, focusFichaId }: Props) {
  const [ficheros, setFicheros] = useState<Fichero[]>([])
  const [currentId, setCurrentId] = useState('')
  const [all, setAll] = useState<Ficha[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [query, setQuery] = useState('')
  // Orden por columna y filtros del fichero abierto (se recuerdan por fichero).
  const [view, setView] = useState<TableView>(EMPTY_VIEW)
  const [menu, setMenu] = useState<{ index: number; anchor: DOMRect } | null>(null)
  const [editingColumns, setEditingColumns] = useState(false)
  const [drag, setDrag] = useState<{ id: string; drop: Drop | null } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState<{ draft: FichaDraft; num: number | null } | null>(null)
  const [importing, setImporting] = useState<{ csv: ParsedCsv; fileName: string } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; clearFilters?: boolean } | null>(null)
  const [naming, setNaming] = useState<{ mode: 'new' | 'rename'; value: string; marker: string; error?: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // Columna que se está arrastrando: su ancho provisional hasta soltar.
  const [resizing, setResizing] = useState<{ index: number; width: number } | null>(null)

  // Cambia cuando se recuentan las veces que Escritura usa cada ficha (columna «Veces usada»).
  const [usageVersion, setUsageVersion] = useState(0)

  const reload = useCallback(async () => {
    const fs = await listFicheros()
    const fichasAll = await listFichas()
    const srcs = await listSources()
    setFicheros(fs)
    setAll(fichasAll)
    setSources(srcs)
    setKnownTags(await listTags())
    // Los textos se leen aparte: la tabla no espera por ellos.
    void readAllDrafts().then((drafts) => {
      setUsage(usageOf(drafts, { fichas: fichasAll, ficheros: fs, sources: srcs }).total)
      setUsageVersion((v) => v + 1)
    }).catch(() => {})
    return fs
  }, [])

  useEffect(() => {
    void (async () => {
      const fs = await reload()
      const settings = await getSettings()
      const open = (id: string) => {
        setCurrentId(id)
        setView(readView(settings[viewKey(id)], fs.find((f) => f.id === id)?.columns ?? []))
      }
      const focus = focusFichaId ? (await listFichas()).find((f) => f.id === focusFichaId) : undefined
      if (focus) {
        // Se abre en su fichero, con la ficha en el editor.
        open(focus.ficheroId)
        void setSettings({ lastFichero: focus.ficheroId })
        edit(focus)
        return
      }
      const last = settings.lastFichero
      open(fs.some((f) => f.id === last) ? last : fs[0].id)
    })()
  }, [reload])

  const viewRequest = useRef(0)
  const select = (id: string, fs = ficheros) => {
    setCurrentId(id)
    setEditing(null)
    setMenu(null)
    setConfirmDelete(false)
    // Si se cambia de fichero antes de que llegue, la vista de este ya no se aplica.
    const req = ++viewRequest.current
    void getSettings().then((settings) => {
      if (req === viewRequest.current) setView(readView(settings[viewKey(id)], fs.find((f) => f.id === id)?.columns ?? []))
    })
    void setSettings({ lastFichero: id })
  }

  // La vista se guarda en el proyecto un momento después del último cambio (no en cada tecla de un filtro).
  const viewTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const changeView = (id: string, next: TableView) => {
    setView(next)
    clearTimeout(viewTimer.current)
    viewTimer.current = setTimeout(() => {
      const empty = !next.sort && !Object.keys(next.filters).length
      void setSettings({ [viewKey(id)]: empty ? '' : JSON.stringify(next) })
    }, 400)
  }
  const setFilter = (header: string, filter: ColumnFilter | undefined) => {
    const filters = { ...view.filters }
    if (filter) filters[header] = filter
    else delete filters[header]
    changeView(currentId, { ...view, filters })
  }
  const setSort = (header: string, dir: 'asc' | 'desc' | null) =>
    changeView(currentId, { ...view, sort: dir ? { header, desc: dir === 'desc' } : undefined })

  const fichero = ficheros.find((f) => f.id === currentId)
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const sourceOf = useCallback((f: Ficha) => (f.sourceId ? sourceById.get(f.sourceId) : undefined), [sourceById])
  // En su orden manual: el que se cambia arrastrando las filas.
  const fichas = useMemo(() => all.filter((f) => f.ficheroId === currentId).sort(byManualOrder), [all, currentId])

  const countByFichero = useMemo(() => {
    const n = new Map<string, number>()
    for (const f of all) n.set(f.ficheroId, (n.get(f.ficheroId) ?? 0) + 1)
    return n
  }, [all])

  const columns: Column[] = useMemo(() => fichero?.columns ?? [], [fichero])
  // Las columnas que se ven, con su posición en la lista completa (la que usan los anchos).
  const visible = useMemo(() => columns.flatMap((c, i) => (c.hidden ? [] : [{ c, i }])), [columns])
  // Como la búsqueda, la tabla va un paso por detrás de los filtros: el menú responde al instante.
  const tableView = useDeferredValue(view)
  const activeFilters = useMemo(
    () => visible.flatMap(({ c }) => (filterActive(tableView.filters[c.header]) ? [{ c, filter: tableView.filters[c.header] }] : [])),
    [visible, tableView.filters],
  )
  const sortColumn = tableView.sort && visible.find(({ c }) => c.header === tableView.sort!.header)?.c
  // El texto en que se busca, ya normalizado, se prepara una vez por ficha y no en cada tecla.
  // (A la primera búsqueda, no al abrir el fichero.)
  const searchText = useMemo(() => {
    const m = new WeakMap<Ficha, string>() // una ficha editada es otro objeto: nunca queda texto viejo
    return (f: Ficha) => {
      let t = m.get(f)
      if (t === undefined) m.set(f, (t = fold(visible.map(({ c }) => cellText(f, c, sourceOf(f))).join(' \n '))))
      return t
    }
  }, [visible, sourceOf, usageVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  // La búsqueda va un paso por detrás de lo que se escribe: el campo nunca se traba.
  const q = fold(useDeferredValue(query).trim())
  const passes = useCallback((f: Ficha) => {
    if (q && !searchText(f).includes(q)) return false
    return activeFilters.every(({ c, filter }) => matchFilter(f, c, filter, sourceOf(f), cellText(f, c, sourceOf(f))))
  }, [q, searchText, activeFilters, sourceOf, usageVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const kept = fichas.filter(passes)
    return sortColumn ? sortByColumn(kept, sortColumn, !!tableView.sort?.desc, sourceOf) : kept
  }, [fichas, passes, sortColumn, tableView.sort?.desc, sourceOf, usageVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const viewSignature = useMemo(() => JSON.stringify(tableView), [tableView])
  const { limit, sentinel, reveal } = useGrowing(shown.length, `${currentId}|${q}|${viewSignature}`)
  const filtering = !!q || activeFilters.length > 0

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

  // El editor se cierra con Esc y la fila que se edita queda siempre a la vista (pintándola si aún no lo estaba).
  const editingId = editing?.draft.id
  const editingIndex = editingId ? shown.findIndex((f) => f.id === editingId) : -1
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])
  useEffect(() => {
    if (editingIndex >= limit) reveal(editingIndex)
    else document.querySelector('table.fichas tr.current')?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, editingIndex >= limit])

  const edit = useCallback((f: Ficha) => {
    const { num, createdAt: _c, updatedAt: _u, ...draft } = f
    setEditing({ draft, num })
  }, [])

  // ---- Arrastrar filas (orden manual) ----
  // Mientras se ordena por una columna no se puede: el orden que se ve no es el manual.
  const canDrag = !sortColumn
  const dragged = useRef(false)
  const openRow = useCallback((f: Ficha) => { if (!dragged.current) edit(f) }, [edit])
  const fichasRef = useRef(fichas)
  fichasRef.current = fichas

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const wrap = wrapRef.current
    let drop: Drop | null = null
    let y = e.clientY
    let raf = 0
    setDrag({ id, drop: null })
    const target = () => {
      const row = document.elementFromPoint(e.clientX, y)?.closest<HTMLElement>('tr[data-id]')
      const next = row && row.dataset.id !== id
        ? { id: row.dataset.id!, after: y > row.getBoundingClientRect().top + row.offsetHeight / 2 }
        : null
      if (next?.id !== drop?.id || next?.after !== drop?.after) {
        drop = next
        setDrag({ id, drop })
      }
    }
    // Cerca del borde de la tabla, la tabla se desplaza sola.
    const scroll = () => {
      if (wrap) {
        const r = wrap.getBoundingClientRect()
        const by = y < r.top + 70 ? -14 : y > r.bottom - 50 ? 14 : 0
        if (by) { wrap.scrollTop += by; target() }
      }
      raf = requestAnimationFrame(scroll)
    }
    raf = requestAnimationFrame(scroll)
    const move = (ev: PointerEvent) => { y = ev.clientY; target() }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      cancelAnimationFrame(raf)
      setDrag(null)
      if (!drop) return
      dragged.current = true
      setTimeout(() => { dragged.current = false }, 0)
      // Detrás de una fila = delante de la que le sigue en el orden completo (puede estar oculta por un filtro).
      const list = fichasRef.current
      const i = list.findIndex((f) => f.id === drop!.id)
      let beforeId: string | null = drop.after ? list[i + 1]?.id ?? null : drop.id
      if (beforeId === id) beforeId = list[i + 2]?.id ?? null
      void moveFicha(id, beforeId).then(async () => setAll(await listFichas()))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }, [])

  // Con el teclado: Alt+↑ / Alt+↓ sobre una fila la sube o la baja un puesto entre las que se ven.
  const shownRef = useRef(shown)
  shownRef.current = shown
  const moveByKey = useCallback((id: string, dir: -1 | 1) => {
    const list = shownRef.current
    const i = list.findIndex((f) => f.id === id)
    const neighbor = list[i + dir]
    if (i === -1 || !neighbor) return
    let beforeId: string | null = neighbor.id
    if (dir === 1) {
      // Detrás de la siguiente = delante de la que le sigue en el orden completo.
      const all = fichasRef.current
      const j = all.findIndex((f) => f.id === neighbor.id)
      beforeId = all[j + 1]?.id ?? null
      if (beforeId === id) beforeId = all[j + 2]?.id ?? null
    }
    void moveFicha(id, beforeId).then(async () => {
      setAll(await listFichas())
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`tr[data-id="${id}"]`)?.focus())
    })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])
  const clearFilters = () => { setQuery(''); changeView(currentId, { ...view, filters: {} }) }

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
    const name = naming.value.trim()
    // En un fichero nuevo, sin marcador escrito se propone uno libre.
    const marker = naming.marker.trim() || (naming.mode === 'new' ? suggestMarker(name, ficheros) : '')
    const problem = markerProblem(marker)
    if (problem) return setNaming({ ...naming, error: problem })
    if (naming.mode === 'new') {
      const id = await createFichero(name, undefined, marker)
      select(id, await reload())
    } else if (fichero) {
      await updateFichero(fichero.id, { name, marker })
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
            {f.name} <span className="muted">{countByFichero.get(f.id) ?? 0}</span> <code title="Marcador de este fichero al escribir">{f.marker}</code>
          </button>
        ))}
        {naming ? (
          <form className="page-row" onSubmit={(e) => { e.preventDefault(); void submitName() }}>
            <input autoFocus value={naming.value} onChange={(e) => setNaming({ ...naming, value: e.target.value })} placeholder="Nombre del fichero" onKeyDown={(e) => e.key === 'Escape' && setNaming(null)} data-testid="fichero-name" />
            <label className="inline-field" title="Cómo se nombran las fichas de este fichero al escribir: con «e.» escribes {e. 51}.">
              Marcador
              <input
                className="marker-input" value={naming.marker} placeholder={naming.mode === 'new' ? suggestMarker(naming.value, ficheros) : 'f.'} data-testid="fichero-marker"
                onChange={(e) => setNaming({ ...naming, marker: e.target.value, error: undefined })} onKeyDown={(e) => e.key === 'Escape' && setNaming(null)}
              />
            </label>
            <button type="submit" className="primary" data-testid="fichero-save">{naming.mode === 'new' ? 'Crear' : 'Guardar'}</button>
            <button type="button" onClick={() => setNaming(null)}>Cancelar</button>
            {naming.error && <span className="page-warning">{naming.error}</span>}
            {naming.mode === 'rename' && fichero && naming.marker.trim() && naming.marker.trim() !== fichero.marker && (
              <span className="muted small">Los textos que ya usan «{fichero.marker}» para este fichero habrá que cambiarlos a mano.</span>
            )}
          </form>
        ) : (
          <>
            <button className="link" onClick={() => setNaming({ mode: 'new', value: '', marker: '' })}>+ Nuevo fichero</button>
            <div className="spacer" />
            {fichero && <button className="link subtle" onClick={() => setNaming({ mode: 'rename', value: fichero.name, marker: fichero.marker })} data-testid="fichero-settings">Nombre y marcador</button>}
            {fichero && ficheros.length > 1 && (confirmDelete ? (
              <>
                <span className="muted">¿Eliminar «{fichero.name}» y sus {fichas.length} fichas?</span>
                <button className="danger" onClick={async () => { await deleteFichero(fichero.id); const fs = await reload(); select(fs[0].id, fs) }}>Eliminar</button>
                <button onClick={() => setConfirmDelete(false)}>No</button>
              </>
            ) : (
              <button className="link subtle" onClick={() => setConfirmDelete(true)}>Eliminar fichero</button>
            ))}
          </>
        )}
      </div>

      <div className="fichero-filters">
        <input className="search" placeholder="Buscar en las columnas visibles…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="fichero-search" />
        {(activeFilters.length > 0 || sortColumn) && (
          <span className="view-chips">
            {activeFilters.map(({ c }) => (
              <button key={c.header} className="chip" title="Quitar este filtro" onClick={() => setFilter(c.header, undefined)} data-testid="filter-chip">
                {c.header} <span aria-hidden>×</span>
              </button>
            ))}
            {sortColumn && (
              <button className="chip" title="Volver al orden manual" onClick={() => setSort(sortColumn.header, null)} data-testid="sort-chip">
                Ordenado por {sortColumn.header} {tableView.sort?.desc ? '↓' : '↑'} <span aria-hidden>×</span>
              </button>
            )}
            {activeFilters.length > 1 && <button className="link" onClick={() => changeView(currentId, { ...view, filters: {} })}>Quitar filtros</button>}
          </span>
        )}
        <span className="muted" data-testid="fichero-count">{shown.length === fichas.length ? `${fichas.length} fichas` : `${shown.length} de ${fichas.length}`}</span>
        <button onClick={() => setEditingColumns(true)} disabled={!fichero} data-testid="edit-columns">Columnas…</button>
        <button className="primary" onClick={() => setEditing({ num: null, draft: { ficheroId: currentId, notaPermanente: '', cita: '', sourceId: null, pageLabel: '', pageManual: true, anchor: null, tags: [], referencia: '', notas: '', extra: {} } })}>
          + Ficha
        </button>
      </div>

      {message && (
        <div className={`banner ${message.kind}`}>
          {message.text}
          {message.clearFilters && (
            <button className="link" onClick={() => { clearFilters(); setMessage(null) }} data-testid="notice-clear-filters">Quitar búsqueda y filtros</button>
          )}
          <button className="link" onClick={() => setMessage(null)}>Cerrar</button>
        </div>
      )}

      <div className="fichero-body">
        <div className="table-wrap" ref={wrapRef} onScroll={() => menu && setMenu(null)}>
          {fichas.length === 0 ? (
            <div className="empty">
              <h2>Este fichero está vacío</h2>
              <p>Importa tu hoja de cálculo (en Sheets: <em>Archivo → Descargar → CSV</em>, una vez por pestaña) o crea fichas marcando pasajes en un PDF de la biblioteca.</p>
              <button className="primary" onClick={() => fileInput.current?.click()}>Importar CSV…</button>
            </div>
          ) : (
            <table
              className={['fichas', resizing && 'resizing', drag && 'dragging'].filter(Boolean).join(' ')}
              style={{ width: visible.reduce((sum, { c, i }) => sum + widthOf(c, i), 0) }}
            >
              <colgroup>{visible.map(({ c, i }) => <col key={i} style={{ width: widthOf(c, i) }} />)}</colgroup>
              <thead>
                <tr>
                  {visible.map(({ c, i }) => (
                    <th key={i} className={`col-${c.field}${menu?.index === i ? ' menu-open' : ''}`}>
                      <button
                        type="button" className="th-label" title="Ordenar y filtrar" data-testid={`column-${c.header}`}
                        onClick={(e) => setMenu(menu?.index === i ? null : { index: i, anchor: e.currentTarget.closest('th')!.getBoundingClientRect() })}
                      >
                        <span className="th-text">{c.header}</span>
                        {sortColumn === c && <span className="th-mark">{tableView.sort?.desc ? '↓' : '↑'}</span>}
                        {filterActive(view.filters[c.header]) && <span className="th-mark filter" title="Filtrada">●</span>}
                      </button>
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
                {shown.slice(0, limit).map((f) => (
                  <FichaRow
                    key={f.id} ficha={f} columns={visible} source={sourceOf(f)} uses={usesOf(f.id)} current={editingId === f.id} onEdit={openRow}
                    onGrip={canDrag ? startDrag : undefined} onKeyMove={canDrag ? moveByKey : undefined} dragging={drag?.id === f.id} drop={drag?.drop?.id === f.id ? (drag.drop.after ? 'after' : 'before') : null}
                  />
                ))}
              </tbody>
            </table>
          )}
          {limit < shown.length && <div ref={sentinel} className="list-more muted small">…</div>}
          {fichas.length > 0 && shown.length === 0 && (
            <p className="empty-filter muted">
              Ninguna ficha pasa {filtering ? 'la búsqueda y los filtros' : 'los filtros'}.{' '}
              <button className="link" onClick={clearFilters}>Quitarlos</button>
            </p>
          )}
        </div>

        {editing && (
          <SidePanel revealKey={editing.draft.id ?? 'nueva'}>
            <FichaForm
              key={editing.draft.id ?? 'new'} draft={editing.draft} num={editing.num} sources={sources} ficheros={ficheros} cite={cite} knownTags={knownTags}
              onCancel={() => setEditing(null)}
              onSave={async (d) => {
                const id = await saveFicha(d)
                await reload()
                setEditing(null)
                // Guardada, pero quizá fuera de la vista: se avisa en vez de dejar que «desaparezca».
                const saved = (await listFichas()).find((f) => f.id === id)
                const moved = ficheros.find((f) => f.id === saved?.ficheroId && f.id !== currentId)
                if (moved) setMessage({ kind: 'ok', text: `La ficha ${saved!.num} está ahora en «${moved.name}».` })
                else if (saved && !passes(saved)) setMessage({ kind: 'ok', text: `Ficha ${saved.num} guardada. No se ve porque la búsqueda o los filtros la ocultan.`, clearFilters: true })
              }}
              onDelete={editing.draft.id ? async () => { await deleteFicha(editing.draft.id!); await reload(); setEditing(null) } : undefined}
              onOpenPdf={editing.draft.id ? (d) => d.sourceId && onOpenPdf(d.sourceId, d.anchor ? { focusFichaId: d.id } : { linkFichaId: d.id }) : undefined}
            />
          </SidePanel>
        )}
      </div>

      {menu && columns[menu.index] && (() => {
        const c = columns[menu.index]
        return (
          <ColumnMenu
            key={c.header} column={c} anchor={menu.anchor} filter={view.filters[c.header]}
            sort={view.sort?.header === c.header ? (view.sort.desc ? 'desc' : 'asc') : null}
            values={() => distinctValues(fichas, c, sourceOf, sourceById)}
            onFilter={(f) => setFilter(c.header, f)} onSort={(dir) => setSort(c.header, dir)} onClose={closeMenu}
          />
        )
      })()}

      {editingColumns && fichero && (
        <ColumnsDialog
          fichero={fichero} fichas={fichas} onCancel={() => setEditingColumns(false)}
          onSave={async (drafts) => {
            await saveFicheroColumns(fichero.id, drafts)
            const fs = await reload()
            // Una columna renombrada conserva su filtro y su orden; los de las que ya no existen
            // o se ocultaron dejan de aplicarse.
            const renamed = new Map(drafts.flatMap((d) => (d.orig !== undefined ? [[d.orig, d.header.trim()] as const] : [])))
            const moved: TableView = {
              sort: view.sort && renamed.has(view.sort.header) ? { ...view.sort, header: renamed.get(view.sort.header)! } : undefined,
              filters: Object.fromEntries(Object.entries(view.filters).flatMap(([h, f]) => (renamed.has(h) ? [[renamed.get(h)!, f]] : []))),
            }
            changeView(fichero.id, readView(JSON.stringify(moved), fs.find((f) => f.id === fichero.id)?.columns.filter((c) => !c.hidden) ?? []))
            setEditingColumns(false)
          }}
        />
      )}

      {importing && (
        <ImportDialog
          csv={importing.csv} fileName={importing.fileName} ficheros={ficheros} fichas={all} sources={sources}
          onCancel={() => setImporting(null)}
          onDone={async (id, text) => { setImporting(null); select(id, await reload()); setMessage({ kind: 'ok', text }) }}
        />
      )}
    </div>
  )
}

interface RowProps {
  ficha: Ficha
  /** Las columnas visibles, con su posición en la lista completa. */
  columns: { c: Column; i: number }[]
  source: Source | undefined
  /** Veces que la usa Escritura: con él cambia la fila cuando se recuentan. */
  uses: number
  current: boolean
  onEdit: (f: Ficha) => void
  /** Sin él, la fila no se puede arrastrar (p. ej. mientras se ordena por una columna). */
  onGrip?: (id: string, e: React.PointerEvent) => void
  onKeyMove?: (id: string, dir: -1 | 1) => void
  dragging: boolean
  /** La fila que se arrastra caería delante o detrás de esta. */
  drop: 'before' | 'after' | null
}

// Con miles de fichas, abrir una o cambiar un ancho no vuelve a pintar las demás filas.
const FichaRow = memo(function FichaRow({ ficha: f, columns, source, current, onEdit, onGrip, onKeyMove, dragging, drop }: RowProps) {
  const cls = [current && 'current', dragging && 'drag-source', drop && `drop-${drop}`].filter(Boolean).join(' ')
  return (
    <tr
      className={cls} onClick={() => onEdit(f)} data-id={f.id} data-testid="ficha-row" tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter') { e.preventDefault(); onEdit(f) }
        else if (e.altKey && onKeyMove && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); onKeyMove(f.id, e.key === 'ArrowUp' ? -1 : 1) }
      }}
    >
      {columns.map(({ c, i }, k) => (
        <td key={i} className={`col-${c.field}${c.kind ? ` kind-${c.kind}` : ''}`}>
          {k === 0 && onGrip && (
            <span
              className="row-grip" title="Arrastra para mover la ficha (o, con la fila seleccionada, Alt+↑ / Alt+↓)" aria-label={`Mover la ficha ${f.num}`} data-testid="row-grip"
              onPointerDown={(e) => onGrip(f.id, e)} onClick={(e) => e.stopPropagation()}
            >⠿</span>
          )}
          {c.field === 'tags' ? (
            <div className="tags">{f.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
          ) : c.field === 'num' ? (
            <>
              {cellText(f, c, source)}
              {f.anchor ? <span className="dot linked" title="Pasaje marcado en el PDF" /> : !f.sourceId ? <span className="dot orphan" title="Sin fuente vinculada" /> : null}
            </>
          ) : c.kind === 'casilla' ? (
            isChecked(f.extra[c.header]) ? <span className="check" aria-label="Sí">✓</span> : null
          ) : (
            <div className="clamp">{cellText(f, c, source)}</div>
          )}
        </td>
      ))}
    </tr>
  )
})
