import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { backend, type ProjectInfo } from '../backend'
import { authorsLabel, yearLabel, type CiteOptions } from '../citations'
import { defaultFichero, lookupRef, resolveDraft, setFrontMatter, tokenText, type DraftContext, type Token } from '../draft'
import { getSettings, listFichas, listFicheros, listSources, setSettings } from '../store'
import type { Ficha, Fichero, Source } from '../types'
import { MarkdownEditor, type MarkdownEditorHandle, type TokenInfo } from './MarkdownEditor'
import { SidePanel } from './SidePanel'
import { TopNav, type Section } from './TopNav'

interface Props {
  project: ProjectInfo
  cite: CiteOptions
  onSection: (s: Section) => void
  onSwitchProject: () => void
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).use(footnote)
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
  const [preview, setPreview] = useState({ html: '', problems: [] as { message: string; from: number }[], citations: 0, sources: 0 })
  const [pickFichero, setPickFichero] = useState('')
  const [query, setQuery] = useState('')

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
        if (drafts.some((d) => d.toLowerCase() === name.toLowerCase())) throw new Error(`Ya existe un borrador llamado «${name}».`)
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
      title: `${token.kind === 'insert' ? 'Cita' : 'Referencia'}: ficha ${first.ficha.num} · ${sourceLabel(first.ficha)}${found.length > 1 ? ` (+${found.length - 1})` : ''}`,
      detail: missing ? 'Esta ficha no tiene fuente: no se puede citar.' : clip(first.ficha.notaPermanente || first.ficha.cita, 220),
    }
  }, [fallback, ctx, sourceLabel])

  const insertFicha = (kind: Token['kind'], f: Ficha) => {
    const unique = fichas.filter((x) => x.num === f.num).length === 1
    editor.current?.insert(tokenText(kind, f, ficheroById.get(f.ficheroId), fallback?.id ?? null, unique))
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
        setPreview({ html: md.render(r.markdown), problems: r.problems, citations: r.citations, sources: r.sources })
      } catch (e) {
        setPreview({ html: '', problems: [{ message: `No se pudo componer la vista: ${e instanceof Error ? e.message : e}`, from: 0 }], citations: 0, sources: 0 })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [text, ctx, current])

  const exportMarkdown = async () => {
    if (!current) return
    await backend.saveTextFile(`${current}.md`, resolveDraft(text, ctx).markdown)
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
        <button onClick={() => void exportMarkdown()} disabled={!current} data-testid="export-md">Exportar Markdown</button>
      </TopNav>

      <div className="drafts-body">
        <aside className="draft-list">
          <h3>Borradores</h3>
          <ul>
            {drafts.map((name) => (
              <li key={name}>
                <button className={name === current ? 'draft current' : 'draft'} onClick={() => void open(name)} data-testid="draft-item">{name}</button>
              </li>
            ))}
          </ul>
          {naming?.mode === 'new' ? (
            <form onSubmit={(e) => { e.preventDefault(); void submitName() }}>
              <input autoFocus value={naming.value} placeholder="Nombre del borrador" onChange={(e) => setNaming({ ...naming, value: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setNaming(null)} data-testid="draft-name" />
              <div className="page-row">
                <button type="submit" className="primary" data-testid="draft-create">Crear</button>
                <button type="button" onClick={() => setNaming(null)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="link" onClick={() => setNaming({ mode: 'new', value: '' })} data-testid="draft-new">+ Nuevo borrador</button>
          )}
          <p className="muted small">Cada borrador es un archivo Markdown en la carpeta <code>borradores/</code> del proyecto.</p>
        </aside>

        {!current || !loaded ? (
          <main className="draft-empty">
            <div className="empty">
              <h2>Escribe con tus fichas</h2>
              <p>
                Un borrador es texto en Markdown. Escribe <code>{'{f. 51}'}</code> para insertar la cita de la ficha 51 con su nota, o <code>[f. 51]</code> para
                dejar solo la referencia. Organon numera las notas y compone la bibliografía.
              </p>
              <button className="primary" onClick={() => setNaming({ mode: 'new', value: '' })}>+ Nuevo borrador</button>
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

              {save === 'conflict' && (
                <div className="banner warn">
                  <span>Este borrador cambió fuera de Organon desde que lo abriste.</span>
                  <button onClick={() => void reloadFromDisk()}>Cargar la versión del disco</button>
                  <button onClick={() => void flush(true)}>Guardar la mía encima</button>
                </div>
              )}
              {error && <div className="banner error">{error}<button className="link" onClick={() => setError('')}>Cerrar</button></div>}

              <MarkdownEditor
                key={loaded.version} ref={editor} initial={loaded.text}
                ficheroNames={ficheros.map((f) => f.name)} onChange={onChange} describe={describe} revision={ctx}
              />
              <div className="draft-status">
                {words} palabras · {preview.citations} cita(s) · {preview.sources} fuente(s)
                {preview.problems.length > 0 && <button className="link bad" onClick={() => setPanel('preview')}>{preview.problems.length} referencia(s) con problemas</button>}
              </div>
            </main>

            <SidePanel>
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
                  <p className="muted small">{picked.length} ficha(s). «Insertar» pone la cita con su nota; «Referenciar», solo la nota.</p>
                  {picked.slice(0, 200).map((f) => (
                    <article key={f.id} className="ficha-card pick" data-testid="picker-card">
                      <header>
                        <span className="ficha-num">{!pickId && ficheros.length > 1 ? `${ficheroById.get(f.ficheroId)?.name ?? ''} ` : ''}{f.num}</span>
                        <h3>{f.notaPermanente || <em className="muted">Sin nota permanente</em>}</h3>
                      </header>
                      {f.cita && <blockquote>{f.cita}</blockquote>}
                      <div className="pick-row">
                        <span className="ficha-citation">{sourceLabel(f)}</span>
                        <div className="spacer" />
                        <button onClick={() => insertFicha('insert', f)} disabled={!f.cita.trim()} data-testid="pick-insert">Insertar</button>
                        <button onClick={() => insertFicha('cite', f)} data-testid="pick-cite">Referenciar</button>
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
    </div>
  )
}
