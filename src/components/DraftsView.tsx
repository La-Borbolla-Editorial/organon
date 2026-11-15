import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { backend, type ProjectInfo } from '../backend'
import { authorsLabel, yearLabel, type CiteOptions } from '../citations'
import { bibliographyHeading, defaultFichero, lookupRef, resolveDraft, setFrontMatter, tokenText, type DraftContext, type RenderedToken, type Token } from '../draft'
import { getSettings, listFichas, listFicheros, listSources, setSettings } from '../store'
import type { Ficha, Fichero, Source } from '../types'
import { MarkdownEditor, type EditorMode, type Format, type MarkdownEditorHandle, type PeekItem, type TokenInfo } from './MarkdownEditor'
import { SidePanel } from './SidePanel'
import { TopNav, type Section } from './TopNav'

interface Props {
  project: ProjectInfo
  cite: CiteOptions
  onSection: (s: Section) => void
  onSwitchProject: () => void
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).use(footnote)
// Una línea sangrada es parte de un esquema, no un bloque de código (para código, ```).
md.disable('code')
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type SaveState = 'saved' | 'dirty' | 'saving' | 'conflict' | 'error'

export function DraftsView({ project, cite, onSection, onSwitchProject }: Props) {
  const [drafts, setDrafts] = useState<string[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  // Lo que se cargó del disco; `version` cambia en cada carga para montar un editor nuevo.
  const [loaded, setLoaded] = useState<{ name: string; text: string; version: number } | null>(null)
  const loads = useRef(0)
  const [text, setText] = useState('')
  const [save, setSave] = useState<SaveState>('saved')
  const [error, setError] = useState('')
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [ficheros, setFicheros] = useState<Fichero[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [panel, setPanel] = useState<'preview' | 'fichas'>('preview')
  const [naming, setNaming] = useState<{ mode: 'new' | 'rename'; value: string } | null>(null)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [preview, setPreview] = useState({ html: '', tokens: [] as RenderedToken[], problems: [] as { message: string; from: number }[], citations: 0, sources: 0 })
  const [pickFichero, setPickFichero] = useState('')
  const [query, setQuery] = useState('')
  const [fullInNote, setFullInNote] = useState(false)
  // Texto enriquecido o Markdown tal cual: es el mismo archivo, cambia solo cómo se ve.
  const [mode, setModeState] = useState<EditorMode>(() => { try { return localStorage.getItem('organon.modoEditor') === 'markdown' ? 'markdown' : 'rich' } catch { return 'rich' } })
  const setMode = (m: EditorMode) => { setModeState(m); try { localStorage.setItem('organon.modoEditor', m) } catch { /* preferencia no guardada */ } }
  const format = (f: Format) => editor.current?.format(f)
  // Asomar en el editor todas las fichas nombradas (se ven, pero no se añaden al texto).
  const [peekAll, setPeekAllState] = useState(() => { try { return localStorage.getItem('organon.asomarFichas') === '1' } catch { return false } })
  const setPeekAll = (on: boolean) => { setPeekAllState(on); try { localStorage.setItem('organon.asomarFichas', on ? '1' : '0') } catch { /* preferencia no guardada */ } }
  // Fichas desplegadas en el selector: se ven enteras, con sus notas.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  const editor = useRef<MarkdownEditorHandle>(null)
  // Estado del guardado, fuera de React para que los temporizadores vean lo último.
  const disk = useRef<{ name: string; stamp: string | null; text: string; timer: number | null }>({ name: '', stamp: null, text: '', timer: null })

  const ctx: DraftContext = useMemo(() => ({ fichas, ficheros, sources, cite }), [fichas, ficheros, sources, cite])

  // ---- Guardado automático --------------------------------------------------------
  const flush = useCallback(async (force = false) => {
    const d = disk.current
    if (d.timer) { clearTimeout(d.timer); d.timer = null }
    if (!d.name) return
    const { name, text: content } = d
    setSave('saving')
    try {
      const stamp = await backend.writeDraft(name, content, d.stamp, force)
      if (disk.current.name !== name) return
      disk.current.stamp = stamp
      setSave(disk.current.text === content ? 'saved' : 'dirty')
    } catch (e) {
      const message = String(e instanceof Error ? e.message : e)
      setSave(message.includes('CONFLICT') ? 'conflict' : 'error')
      if (!message.includes('CONFLICT')) setError(message)
    }
  }, [])

  const onChange = useCallback((next: string) => {
    setText(next)
    const d = disk.current
    d.text = next
    setSave((s) => (s === 'conflict' ? s : 'dirty'))
    if (d.timer) clearTimeout(d.timer)
    d.timer = window.setTimeout(() => { d.timer = null; if (disk.current === d) void flush() }, 700)
  }, [flush])

  // Al salir de la pantalla o cerrar la ventana se guarda lo pendiente.
  useEffect(() => {
    const onHide = () => { if (disk.current.timer) void flush() }
    window.addEventListener('blur', onHide)
    return () => { window.removeEventListener('blur', onHide); onHide() }
  }, [flush])

  // ---- Carga -----------------------------------------------------------------------
  const open = useCallback(async (name: string | null) => {
    if (disk.current.timer) await flush()
    setConfirmTrash(false)
    setError('')
    if (!name) {
      disk.current = { name: '', stamp: null, text: '', timer: null }
      setCurrent(null)
      setLoaded(null)
      return
    }
    try {
      const { content, stamp } = await backend.readDraft(name)
      disk.current = { name, stamp, text: content, timer: null }
      setCurrent(name)
      setText(content)
      setLoaded({ name, text: content, version: ++loads.current })
      setSave('saved')
      void setSettings({ lastDraft: name })
    } catch (e) {
      setError(`No se pudo abrir «${name}»: ${e instanceof Error ? e.message : e}`)
    }
  }, [flush])

  useEffect(() => {
    void (async () => {
      setFichas(await listFichas())
      setFicheros(await listFicheros())
      setSources(await listSources())
      const names = (await backend.listDrafts()).map((d) => d.name)
      setDrafts(names)
      const last = (await getSettings()).lastDraft
      if (names.length) await open(names.includes(last) ? last : names[0])
    })()
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadFromDisk = async () => {
    if (!current) return
    const { content, stamp } = await backend.readDraft(current)
    disk.current = { name: current, stamp, text: content, timer: null }
    setText(content)
    setLoaded({ name: current, text: content, version: ++loads.current }) // vuelve a montar el editor con lo del disco
    setSave('saved')
  }

  // ---- Lista de borradores ----------------------------------------------------------
  const submitName = async () => {
    const name = naming?.value.trim()
    if (!naming || !name) return setNaming(null)
    setError('')
    try {
      if (naming.mode === 'new') {
        if (drafts.some((d) => d.toLowerCase() === name.toLowerCase())) throw new Error(`Ya existe un texto llamado «${name}».`)
        await backend.writeDraft(name, `# ${name}\n\n`, null)
        setDrafts((await backend.listDrafts()).map((d) => d.name))
        await open(name)
      } else if (current && name !== current) {
        await flush()
        await backend.renameDraft(current, name)
        setDrafts((await backend.listDrafts()).map((d) => d.name))
        await open(name)
      }
      setNaming(null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    }
  }

  const trash = async () => {
    if (!current) return
    await flush()
    await backend.trashDraft(current)
    const names = (await backend.listDrafts()).map((d) => d.name)
    setDrafts(names)
    await open(names[0] ?? null)
  }

  // ---- Referencias a fichas ------------------------------------------------------------
  const fallback = useMemo(() => defaultFichero(text, ficheros), [text, ficheros])
  const ficheroById = useMemo(() => new Map(ficheros.map((f) => [f.id, f])), [ficheros])
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources])
  const sourceLabel = useCallback((f: Ficha) => {
    const s = f.sourceId ? sourceById.get(f.sourceId) : undefined
    return s ? `${[authorsLabel(s.csl), yearLabel(s.csl)].filter(Boolean).join(' ')}${f.pageLabel ? `, p. ${f.pageLabel}` : ''}` : 'sin fuente'
  }, [sourceById])

  const describe = useCallback((token: Token): TokenInfo => {
    const found = token.refs.map((r) => lookupRef(r, fallback, ctx))
    const bad = found.find((f) => 'error' in f)
    if (bad && 'error' in bad) return { ok: false, title: 'Referencia sin resolver', detail: bad.error }
    const first = found[0]
    if (!('ficha' in first)) return { ok: false, title: 'Referencia sin resolver', detail: '' }
    const missing = found.some((f) => 'ficha' in f && !f.source)
    return {
      ok: !missing,
      title: `${token.kind === 'insert' ? (token.refs[0].fragment ? 'Pedazo de la cita' : 'Cita') : 'Referencia'}: ${ficheroById.get(first.ficha.ficheroId)?.name ?? ''} ${first.ficha.num} · ${sourceLabel(first.ficha)}${found.length > 1 ? ` (+${found.length - 1})` : ''}${token.refs.some((r) => r.fullInNote) ? ' · cita completa en la nota' : ''}`,
      detail: missing ? 'Esta ficha no tiene fuente: no se puede citar.' : clip(first.ficha.notaPermanente || first.ficha.cita, 220),
    }
  }, [fallback, ctx, sourceLabel])

  const peek = useCallback((token: Token): PeekItem[] => token.refs.map((ref) => {
    const found = lookupRef(ref, fallback, ctx)
    const label = `${ref.marker} ${ref.num}`
    if ('error' in found) return { label, title: '', quote: '', meta: '', error: found.error }
    return { label, title: found.ficha.notaPermanente, quote: found.ficha.cita, meta: sourceLabel(found.ficha) }
  }), [fallback, ctx, sourceLabel])

  // Si hay un pedazo de la cita seleccionado en la tarjeta, se cita solo ese pedazo.
  const insertFicha = (kind: Token['kind'], f: Ficha, card: HTMLElement | null) => {
    const sel = window.getSelection()
    const quote = card?.querySelector('blockquote')
    const fragment = sel && !sel.isCollapsed && quote && quote.contains(sel.anchorNode) && quote.contains(sel.focusNode) ? sel.toString() : ''
    editor.current?.insert(tokenText(kind, f, ctx, fallback, { fragment, fullInNote }))
    sel?.removeAllRanges()
  }

  const setDefaultFichero = (name: string) => {
    const next = setFrontMatter(disk.current.text, 'fichero', name)
    editor.current?.setText(next)
  }

  // ---- Vista final --------------------------------------------------------------------
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => {
      try {
        const r = resolveDraft(text, ctx)
        setPreview({ html: md.render(r.markdown), tokens: r.tokens, problems: r.problems, citations: r.citations, sources: r.sources })
      } catch (e) {
        setPreview({ html: '', tokens: [], problems: [{ message: `No se pudo componer la vista: ${e instanceof Error ? e.message : e}`, from: 0 }], citations: 0, sources: 0 })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [text, ctx, current])

  // ---- Exportar ---------------------------------------------------------------------
  const [exporting, setExporting] = useState('')
  // Lo que se manda a imprimir: el texto compuesto, fuera de la interfaz.
  const [printHtml, setPrintHtml] = useState('')

  const exportAs = async (kind: 'docx' | 'pdf' | 'fichas' | 'md') => {
    if (!current) return
    setError('')
    setExporting(kind)
    try {
      if (disk.current.timer) await flush()
      const resolved = resolveDraft(disk.current.text, ctx)
      if (kind === 'md') await backend.saveTextFile(`${current}.md`, resolved.markdown)
      else if (kind === 'docx') {
        // La librería de Word es grande: se carga solo cuando hace falta.
        const { markdownToDocx } = await import('../export-docx')
        const bytes = await markdownToDocx(resolved.markdown, { title: current, bibliographyHeading: bibliographyHeading(cite.locale) })
        await backend.saveBinaryFile(`${current}.docx`, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      } else {
        if (kind === 'fichas') {
          const { composeWithFichas } = await import('../export-fichas')
          setPrintHtml(composeWithFichas(disk.current.text, md, fallback, ctx))
        } else setPrintHtml(md.render(resolved.markdown))
        // Se espera a que el texto esté en la página antes de abrir el diálogo.
        await new Promise((r) => setTimeout(r, 80))
        await backend.print()
      }
    } catch (e) {
      setError(`No se pudo exportar: ${e instanceof Error ? e.message : e}`)
    } finally {
      setExporting('')
    }
  }

  const pickId = pickFichero || fallback?.id || ''
  const picked = useMemo(() => {
    const q = fold(query.trim())
    return fichas
      .filter((f) => (!pickId || f.ficheroId === pickId) && (!q || fold(`${f.num} ${f.notaPermanente} ${f.cita} ${f.tags.join(' ')} ${sourceLabel(f)}`).includes(q)))
      .sort((a, b) => a.ficheroId.localeCompare(b.ficheroId) || a.num - b.num)
  }, [fichas, pickId, query, sourceLabel])

  const words = useMemo(() => (text.replace(/^---[\s\S]*?---/, '').match(/[\p{L}\p{N}]+/gu) ?? []).length, [text])

  return (
    <div className="drafts">
      <TopNav project={project} section="drafts" onSection={onSection} onSwitchProject={onSwitchProject}>
        <span className="muted small">Exportar:</span>
        <button onClick={() => void exportAs('docx')} disabled={!current || !!exporting} data-testid="export-docx" title="Documento de Word con notas al pie de verdad.">{exporting === 'docx' ? 'Generando…' : 'Word (.docx)'}</button>
        <button onClick={() => void exportAs('pdf')} disabled={!current || !!exporting} data-testid="export-pdf" title="Abre el diálogo de impresión: elige «Guardar como PDF». Las notas van al final del texto.">PDF…</button>
        <button onClick={() => void exportAs('fichas')} disabled={!current || !!exporting} data-testid="export-fichas" title="Documento de trabajo: el texto tal como lo escribes, con cada ficha nombrada desplegada debajo del punto que la nombra. Abre el diálogo de impresión.">PDF con fichas…</button>
        <button onClick={() => void exportAs('md')} disabled={!current || !!exporting} data-testid="export-md" title="Markdown corriente, con las citas ya resueltas, notas y bibliografía.">Markdown</button>
      </TopNav>

      <div className="drafts-body">
        <aside className="draft-list">
          <h3>Textos</h3>
          <ul>
            {drafts.map((name) => (
              <li key={name}>
                <button className={name === current ? 'draft current' : 'draft'} onClick={() => void open(name)} data-testid="draft-item">{name}</button>
              </li>
            ))}
          </ul>
          {naming?.mode === 'new' ? (
            <form onSubmit={(e) => { e.preventDefault(); void submitName() }}>
              <input autoFocus value={naming.value} placeholder="Nombre del texto" onChange={(e) => setNaming({ ...naming, value: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setNaming(null)} data-testid="draft-name" />
              <div className="page-row">
                <button type="submit" className="primary" data-testid="draft-create">Crear</button>
                <button type="button" onClick={() => setNaming(null)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="link" onClick={() => setNaming({ mode: 'new', value: '' })} data-testid="draft-new">+ Nuevo texto</button>
          )}
          <p className="muted small">Cada texto es un archivo Markdown en la carpeta <code>escritura/</code> del proyecto.</p>
        </aside>

        {!current || !loaded ? (
          <main className="draft-empty">
            <div className="empty">
              <h2>Escribe con tus fichas</h2>
              <p>
                Cada texto se escribe en Markdown. Escribe <code>{'{f. 51}'}</code> para insertar la cita de la ficha 51 con su nota, o <code>[f. 51]</code> para
                dejar solo la referencia. Con <code>{'{f. 51 «un pedazo»}'}</code> citas solo ese pedazo, y un <code>+</code> pone la cita completa en la nota.
                Organon numera las notas y compone la bibliografía.
              </p>
              <button className="primary" onClick={() => setNaming({ mode: 'new', value: '' })}>+ Nuevo texto</button>
              {error && <div className="banner error">{error}</div>}
            </div>
          </main>
        ) : (
          <>
            <main className="draft-main">
              <div className="draft-toolbar">
                {naming?.mode === 'rename' ? (
                  <form className="page-row" onSubmit={(e) => { e.preventDefault(); void submitName() }}>
                    <input autoFocus value={naming.value} onChange={(e) => setNaming({ ...naming, value: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setNaming(null)} />
                    <button type="submit" className="primary">Renombrar</button>
                    <button type="button" onClick={() => setNaming(null)}>Cancelar</button>
                  </form>
                ) : (
                  <>
                    <strong className="draft-title">{current}</strong>
                    <button className="link subtle" onClick={() => setNaming({ mode: 'rename', value: current })}>Renombrar</button>
                    {confirmTrash ? (
                      <>
                        <span className="muted">¿Mover a la papelera del proyecto?</span>
                        <button className="danger" onClick={() => void trash()}>Sí</button>
                        <button onClick={() => setConfirmTrash(false)}>No</button>
                      </>
                    ) : (
                      <button className="link subtle" onClick={() => setConfirmTrash(true)}>Eliminar</button>
                    )}
                  </>
                )}
                <div className="spacer" />
                <label className="check" title="Muestra cada ficha debajo de la línea que la nombra. Solo se ve en el editor: no se añade al texto.">
                  <input type="checkbox" checked={peekAll} onChange={(e) => setPeekAll(e.target.checked)} data-testid="peek-all" />
                  Ver las fichas en el texto
                </label>
                <label className="inline-field" title="Fichero al que se refieren {f. N} y [f. N] cuando no se nombra otro.">
                  Fichero por defecto
                  <select value={fallback?.name ?? ''} onChange={(e) => setDefaultFichero(e.target.value)} data-testid="draft-fichero">
                    <option value="">— Ninguno —</option>
                    {ficheros.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                </label>
                <span className={`save-state ${save}`} data-testid="save-state">
                  {{ saved: 'Guardado', dirty: 'Sin guardar…', saving: 'Guardando…', conflict: 'Conflicto', error: 'No se pudo guardar' }[save]}
                </span>
              </div>

              <div className="format-bar">
                <div className="segmented" role="group" aria-label="Modo del editor">
                  <button className={mode === 'rich' ? 'current' : ''} onClick={() => setMode('rich')} data-testid="mode-rich" title="Escribe viendo el resultado: títulos, cursivas, citas y números de nota.">Texto</button>
                  <button className={mode === 'markdown' ? 'current' : ''} onClick={() => setMode('markdown')} data-testid="mode-markdown" title="Ve el texto tal como se guarda, con su sintaxis.">Markdown</button>
                </div>
                <span className="bar-sep" />
                {([['bold', 'N', 'Negrita (⌘B)'], ['italic', 'C', 'Cursiva (⌘I)'], ['h1', 'T1', 'Título'], ['h2', 'T2', 'Apartado'], ['h3', 'T3', 'Subapartado'], ['list', '•', 'Lista (Tab anida un punto)'], ['numbered', '1.', 'Lista numerada'], ['quote', '”', 'Cita en bloque']] as [Format, string, string][]).map(([f, label, title]) => (
                  <button key={f} className={`fmt fmt-${f}`} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={() => format(f)} data-testid={`fmt-${f}`}>{label}</button>
                ))}
              </div>

              {save === 'conflict' && (
                <div className="banner warn">
                  <span>Este texto cambió fuera de Organon desde que lo abriste.</span>
                  <button onClick={() => void reloadFromDisk()}>Cargar la versión del disco</button>
                  <button onClick={() => void flush(true)}>Guardar la mía encima</button>
                </div>
              )}
              {error && <div className="banner error">{error}<button className="link" onClick={() => setError('')}>Cerrar</button></div>}

              <MarkdownEditor
                key={loaded.version} ref={editor} initial={loaded.text}
                ficheros={ficheros} onChange={onChange} describe={describe} peek={peek} peekAll={peekAll} mode={mode} rendered={preview.tokens} quotes={cite.locale === 'es-ES' ? ['«', '»'] : ['“', '”']} revision={ctx}
              />
              <div className="draft-status">
                {words} palabras · {preview.citations} cita(s) · {preview.sources} fuente(s)
                {preview.problems.length > 0 && <button className="link bad" onClick={() => setPanel('preview')}>{preview.problems.length} referencia(s) con problemas</button>}
              </div>
            </main>

            <SidePanel reserve={560}>
              <div className="panel-tabs">
                <button className={panel === 'preview' ? 'current' : ''} onClick={() => setPanel('preview')}>Vista final</button>
                <button className={panel === 'fichas' ? 'current' : ''} onClick={() => setPanel('fichas')} data-testid="tab-fichas">Fichas</button>
              </div>

              {panel === 'preview' ? (
                <>
                  {preview.problems.length > 0 && (
                    <ul className="problems" data-testid="problems">
                      {preview.problems.map((p, i) => (
                        <li key={i}><button className="link" onClick={() => editor.current?.goTo(p.from)}>{p.message}</button></li>
                      ))}
                    </ul>
                  )}
                  <article className="draft-preview" data-testid="draft-preview" dangerouslySetInnerHTML={{ __html: preview.html }} />
                </>
              ) : (
                <div className="ficha-picker">
                  <div className="page-row">
                    <select value={pickId} onChange={(e) => setPickFichero(e.target.value)}>
                      <option value="">Todos los ficheros</option>
                      {ficheros.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input className="search" placeholder="Buscar fichas…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="picker-search" />
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={fullInNote} onChange={(e) => setFullInNote(e.target.checked)} data-testid="pick-full-in-note" />
                    Poner la cita completa de la ficha en la nota (<code>+</code>)
                  </label>
                  <p className="muted small">
                    {picked.length} ficha(s). «Insertar» pone la cita en el texto, con su nota; «Referenciar», solo la nota. Para citar solo un pedazo, selecciónalo
                    en la tarjeta antes de pulsar.
                  </p>
                  {picked.slice(0, 200).map((f) => (
                    <article key={f.id} className={expanded.has(f.id) ? 'ficha-card pick open' : 'ficha-card pick'} data-testid="picker-card">
                      <header>
                        <span className="ficha-num">{ficheroById.get(f.ficheroId)?.marker} {f.num}</span>
                        <h3>{f.notaPermanente || <em className="muted">Sin nota permanente</em>}</h3>
                      </header>
                      {f.cita && <blockquote>{f.cita}</blockquote>}
                      {expanded.has(f.id) && (
                        <dl className="ficha-more">
                          {f.tags.length > 0 && <><dt>Tags</dt><dd><div className="tags">{f.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div></dd></>}
                          {f.referencia && <><dt>Obra canónica / referencias</dt><dd>{f.referencia}</dd></>}
                          {f.notas && <><dt>Notas</dt><dd>{f.notas}</dd></>}
                        </dl>
                      )}
                      <button className="link small" onClick={() => toggle(f.id)} data-testid="pick-toggle">{expanded.has(f.id) ? 'Plegar' : 'Ver la ficha completa'}</button>
                      <div className="pick-row">
                        <span className="ficha-citation">{sourceLabel(f)}</span>
                        <div className="spacer" />
                        <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => insertFicha('insert', f, e.currentTarget.closest('article'))} disabled={!f.cita.trim()} data-testid="pick-insert">Insertar</button>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => insertFicha('cite', f, e.currentTarget.closest('article'))} data-testid="pick-cite">Referenciar</button>
                      </div>
                    </article>
                  ))}
                  {picked.length > 200 && <p className="muted small">Se muestran las 200 primeras: afina la búsqueda.</p>}
                </div>
              )}
            </SidePanel>
          </>
        )}
      </div>
      {createPortal(<article className="print-doc draft-preview" dangerouslySetInnerHTML={{ __html: printHtml }} />, document.body)}
    </div>
  )
}
