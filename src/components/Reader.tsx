import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { backend } from '../backend'
import { authorsLabel, formatCitation, yearLabel, type CiteOptions } from '../citations'
import { canonicalRef } from '../draft'
import { deleteFicha, getFicha, getSettings, getSource, listFichas, listFicheros, listTags, saveFicha, savePagination, setSettings, type FichaDraft } from '../store'
import { citedPages, sheetLabel, type PageRange } from '../pagination'
import { EventBus, FindState, lacksTextLayer, openPdf, PDFFindController, PDFLinkService, PDFViewer, type PDFDocumentProxy } from '../pdf/pdfjs'
import { captureSelection, type Capture } from '../pdf/selection'
import { clampScale, readerStateKey, readReaderState, wheelZoomFactor, type ReaderState } from '../pdf/view-state'
import type { Anchor, Ficha, Fichero, Source } from '../types'
import { FichaForm } from './FichaForm'
import { FindBar, type FindStatus } from './FindBar'
import { PdfSidebar } from './PdfSidebar'
import { SidePanel } from './SidePanel'
import { PaginationEditor } from './PaginationEditor'
import { useGrowing } from '../useGrowing'

const OCR_URL = 'https://www.ilovepdf.com/ocr-pdf'

interface Props {
  sourceId: string
  cite: CiteOptions
  /** Ficha que se muestra al abrir (se salta a su pasaje). */
  focusFichaId?: string
  /** Ficha ya existente a la que se le va a marcar su pasaje en el PDF. */
  linkFichaId?: string
  backLabel: string
  onBack: () => void
}

// `seq` distingue cada apertura del formulario: una selección nueva trae una cita nueva, aunque
// el formulario ya estuviera abierto con otra.
type Panel = { kind: 'list' } | { kind: 'form'; draft: FichaDraft; num: number | null; notice?: string; seq?: number } | { kind: 'pagination' }
let formSeq = 0

export function Reader({ sourceId, cite, focusFichaId, linkFichaId, backLabel, onBack }: Props) {
  const [source, setSource] = useState<Source | null>(null)
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [ficheros, setFicheros] = useState<Fichero[]>([])
  const [defaultFichero, setDefaultFichero] = useState('')
  const [linking, setLinking] = useState<Ficha | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noText, setNoText] = useState(false)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [panel, setPanel] = useState<Panel>({ kind: 'list' })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<Capture | null>(null)
  const [draftRanges, setDraftRanges] = useState<PageRange[] | null>(null)
  const [zoom, setZoom] = useState<number | null>(null)
  // Búsqueda (⌘F). `findKey` cambia con cada ⌘F para devolver el foco a la barra.
  const [findOpen, setFindOpen] = useState(false)
  const [findKey, setFindKey] = useState(0)
  const [findStatus, setFindStatus] = useState<FindStatus>({ current: 0, total: 0, notFound: false })
  const eventBusRef = useRef<InstanceType<typeof EventBus> | null>(null)
  const linkRef = useRef<InstanceType<typeof PDFLinkService> | null>(null)
  // Panel de índice y miniaturas: se recuerda abierto o cerrado (para todas las fuentes).
  const [sidebar, setSidebar] = useState(false)
  /** Zoom y hoja guardados la última vez que se leyó esta fuente (JSON en los ajustes del proyecto). */
  const savedView = useRef<string | undefined>(undefined)

  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const pdfViewer = useRef<InstanceType<typeof PDFViewer> | null>(null)

  const reloadFichas = useCallback(async () => {
    setFichas(await listFichas({ sourceId }))
    setKnownTags(await listTags())
  }, [sourceId])

  // ---- Carga ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    let opened: PDFDocumentProxy | null = null
    ;(async () => {
      const s = await getSource(sourceId)
      if (!s?.pdfFile) throw new Error('La fuente no tiene PDF.')
      const all = await listFichas({ sourceId })
      opened = await openPdf(await backend.readPdf(s.pdfFile))
      if (cancelled) return void opened.loadingTask.destroy()
      setSource(s)
      setFichas(all)
      setKnownTags(await listTags())
      const fs = await listFicheros()
      const settings = await getSettings()
      const last = settings.lastFichero
      savedView.current = settings[readerStateKey(sourceId)]
      setSidebar(settings.lectorIndice === '1')
      setFicheros(fs)
      setDefaultFichero(fs.some((f) => f.id === last) ? last : fs[0].id)
      if (linkFichaId) setLinking(await getFicha(linkFichaId))
      if (focusFichaId) setActiveId(focusFichaId)
      setDoc(opened)
      setNoText(await lacksTextLayer(opened))
      // Una fuente recién adjuntada se abre pidiendo verificar la paginación.
      if (!s.paginationVerified && !all.some((f) => f.anchor)) {
        setDraftRanges(s.pagination)
        setPanel({ kind: 'pagination' })
      }
    })().catch((e) => !cancelled && setError(String(e?.message ?? e)))
    return () => {
      cancelled = true
      void opened?.loadingTask.destroy()
    }
  }, [sourceId])

  // ---- Resaltados ------------------------------------------------------------
  // Lo que hay que pintar se guarda en una ref para que los eventos de PDF.js vean siempre lo último.
  const paintState = useRef<{ fichas: Ficha[]; activeId: string | null; draft: Anchor | null }>({ fichas: [], activeId: null, draft: null })
  const draftAnchor = panel.kind === 'form' && !panel.draft.id ? panel.draft.anchor : null

  const paintPage = useCallback((pageDiv: HTMLElement) => {
    const n = Number(pageDiv.dataset.pageNumber)
    pageDiv.querySelector(':scope > .og-hl-layer')?.remove()
    const layer = document.createElement('div')
    layer.className = 'og-hl-layer'
    const add = (anchor: Anchor, cls: string) => {
      for (const group of anchor.rects) {
        if (group.page !== n) continue
        for (const [x, y, w, h] of group.r) {
          const el = document.createElement('div')
          el.className = `og-hl ${cls}`
          el.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%`
          layer.appendChild(el)
        }
      }
    }
    const st = paintState.current
    for (const f of st.fichas) if (f.anchor) add(f.anchor, f.id === st.activeId ? 'active' : '')
    if (st.draft) add(st.draft, 'draft')
    if (layer.childElementCount) pageDiv.appendChild(layer)
  }, [])

  useEffect(() => {
    paintState.current = { fichas, activeId, draft: draftAnchor }
    viewerRef.current?.querySelectorAll<HTMLElement>('.page').forEach(paintPage)
  }, [fichas, activeId, draftAnchor, paintPage])

  // ---- Visor -----------------------------------------------------------------
  useEffect(() => {
    if (!doc || !containerRef.current || !viewerRef.current) return
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    // El buscador de pdf.js: no distingue acentos ni mayúsculas y une las palabras cortadas con guion.
    const findController = new PDFFindController({ eventBus, linkService })
    const viewer = new PDFViewer({ container: containerRef.current, viewer: viewerRef.current, eventBus, linkService, findController, textLayerMode: 1, annotationMode: 0 })
    linkService.setViewer(viewer)
    pdfViewer.current = viewer
    eventBusRef.current = eventBus
    linkRef.current = linkService
    eventBus.on('updatefindmatchescount', (e: { matchesCount: { current: number; total: number } }) => {
      setFindStatus((st) => ({ ...st, ...e.matchesCount, notFound: false }))
    })
    eventBus.on('updatefindcontrolstate', (e: { state: number; matchesCount: { current: number; total: number } }) => {
      if (e.state === FindState.PENDING) return
      setFindStatus({ ...e.matchesCount, notFound: e.state === FindState.NOT_FOUND })
    })
    // Se vuelve al zoom y a la hoja de la última vez, salvo si se abrió para ir a una ficha.
    let restored = false
    eventBus.on('pagesinit', () => {
      const saved = readReaderState(savedView.current, doc.numPages)
      viewer.currentScaleValue = saved && saved.scale !== 'page-width' ? String(saved.scale) : 'page-width'
      const focus = paintState.current.fichas.find((f) => f.id === focusFichaId)
      if (focus) setTimeout(() => jumpRef.current(focus), 150)
      else if (saved && saved.page > 1 && !linkFichaId) viewer.currentPageNumber = saved.page
      restored = true
    })
    let saveTimer = 0
    const save = () => {
      if (!restored) return
      clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        const state: ReaderState = { scale: viewer.currentScaleValue === 'page-width' ? 'page-width' : viewer.currentScale, page: viewer.currentPageNumber }
        const json = JSON.stringify(state)
        if (json !== savedView.current) { savedView.current = json; void setSettings({ [readerStateKey(sourceId)]: json }) }
      }, 600)
    }
    eventBus.on('pagechanging', (e: { pageNumber: number }) => { setPage(e.pageNumber); setPageInput(String(e.pageNumber)); save() })
    eventBus.on('scalechanging', (e: { scale: number }) => { setZoom(e.scale); save() })
    eventBus.on('pagerendered', (e: { source: { div: HTMLElement } }) => paintPage(e.source.div))
    viewer.setDocument(doc)
    linkService.setDocument(doc, null)
    findController.setDocument(doc)
    const onResize = () => { if (viewer.currentScaleValue === 'page-width') viewer.currentScaleValue = 'page-width' }
    window.addEventListener('resize', onResize)

    // ---- Pellizco del trackpad ----
    // Se amplía alrededor de los dedos (`origin`), no del centro. `drawingDelay` deja que la
    // página se estire al momento y se redibuje nítida cuando el gesto se detiene.
    const container = containerRef.current
    const zoomTo = (target: number, x: number, y: number) => {
      const factor = clampScale(target) / viewer.currentScale
      if (Math.abs(factor - 1) < 0.005) return
      viewer.updateScale({ scaleFactor: factor, origin: [x, y], drawingDelay: 400 })
    }
    // WebKit (la app en macOS) envía el pellizco como gesturestart/change/end, con la escala acumulada.
    let gestureBase = 0
    const onGestureStart = (e: Event) => { e.preventDefault(); gestureBase = viewer.currentScale }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const g = e as Event & { scale: number; clientX: number; clientY: number }
      if (gestureBase) zoomTo(gestureBase * g.scale, g.clientX, g.clientY)
    }
    const onGestureEnd = (e: Event) => { e.preventDefault(); gestureBase = 0 }
    // Chrome, Firefox y Windows lo envían como `wheel` con ctrlKey, en pasos pequeños: la escala
    // deseada se acumula aparte porque pdf.js redondea a centésimas y los pasos se perderían.
    let wanted = 0
    let lastWheel = 0
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      if (gestureBase) return
      const t = performance.now()
      if (t - lastWheel > 300) wanted = viewer.currentScale
      lastWheel = t
      wanted = clampScale(wanted * wheelZoomFactor(e.deltaY, e.deltaMode))
      zoomTo(wanted, e.clientX, e.clientY)
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('gesturestart', onGestureStart)
    container.addEventListener('gesturechange', onGestureChange)
    container.addEventListener('gestureend', onGestureEnd)
    return () => {
      clearTimeout(saveTimer)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('gesturestart', onGestureStart)
      container.removeEventListener('gesturechange', onGestureChange)
      container.removeEventListener('gestureend', onGestureEnd)
      window.removeEventListener('resize', onResize)
      viewer.setDocument(null as never)
      findController.setDocument(null as never)
      pdfViewer.current = null
      eventBusRef.current = null
      linkRef.current = null
    }
  }, [doc, paintPage])

  // ⌘+ / ⌘− / ⌘0 (Ctrl en Windows): ampliar, reducir y ajustar al ancho.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const v = pdfViewer.current
      if (!v) return
      if (e.key === 'f' || e.key === 'F') { setFindOpen(true); setFindKey((k) => k + 1) }
      else if (e.key === '+' || e.key === '=') v.increaseScale()
      else if (e.key === '-') v.decreaseScale()
      else if (e.key === '0') v.currentScaleValue = 'page-width'
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const find = useCallback((query: string, { previous, again }: { previous: boolean; again: boolean }) => {
    if (!query.trim()) setFindStatus({ current: 0, total: 0, notFound: false })
    eventBusRef.current?.dispatch('find', {
      // Sin acentos en la búsqueda, pdf.js encuentra la palabra con y sin ellos («individuación»
      // también halla «individuacion»); con acentos, solo la acentuada.
      source: null, type: again ? 'again' : '', query: query.normalize('NFD').replace(/\p{M}/gu, ''), caseSensitive: false, entireWord: false,
      highlightAll: true, findPrevious: previous, matchDiacritics: false,
    })
  }, [])

  const closeFind = useCallback(() => {
    eventBusRef.current?.dispatch('findbarclose', { source: null })
    setFindOpen(false)
    setFindStatus({ current: 0, total: 0, notFound: false })
  }, [])

  const toggleSidebar = () => {
    setSidebar((open) => { void setSettings({ lectorIndice: open ? '' : '1' }); return !open })
  }
  // El PDF cambia de ancho al abrir o cerrar el panel: si estaba ajustado al ancho, se reajusta.
  useEffect(() => {
    const v = pdfViewer.current
    if (v?.currentScaleValue === 'page-width') requestAnimationFrame(() => { v.currentScaleValue = 'page-width' })
  }, [sidebar])

  const goToPage = useCallback((p: number) => {
    const v = pdfViewer.current
    if (v && p >= 1 && p <= v.pagesCount) v.currentPageNumber = p
  }, [])

  const jumpTo = useCallback((f: Ficha) => {
    setActiveId(f.id)
    const first = f.anchor?.rects[0]
    const container = containerRef.current
    if (!first || !container) return
    goToPage(first.page)
    requestAnimationFrame(() => {
      const pageDiv = viewerRef.current?.querySelector<HTMLElement>(`.page[data-page-number="${first.page}"]`)
      if (pageDiv) container.scrollTop = pageDiv.offsetTop + first.r[0][1] * pageDiv.clientHeight - container.clientHeight * 0.3
    })
  }, [goToPage])

  const jumpRef = useRef(jumpTo)
  jumpRef.current = jumpTo

  // ---- Selección → ficha ---------------------------------------------------------
  useEffect(() => {
    const onChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) setPending(null)
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [])

  const onMouseUp = () => {
    // Se espera un instante: el navegador termina de fijar la selección tras el mouseup.
    setTimeout(() => setPending(viewerRef.current ? captureSelection(viewerRef.current) : null), 0)
  }

  const startFicha = () => {
    if (!pending || !source) return
    const { anchor } = pending
    // Si la cita cruza de página, se le quitaron el encabezado y el pie que quedaban en medio.
    const notice = pending.dropped.length ? `La cita cruza de página: se quitó ${pending.dropped.map((d) => `«${d}»`).join(' y ')}. Revisa el texto.` : undefined
    setPending(null)
    window.getSelection()?.removeAllRanges()
    if (linking) {
      // Se marca el pasaje de una ficha que ya existía: conserva su texto y su página.
      const { num, createdAt: _c, updatedAt: _u, ...draft } = linking
      const computed = citedPages(source.pagination, anchor.start, anchor.end)
      setActiveId(linking.id)
      setPanel({ kind: 'form', seq: ++formSeq, num, notice, draft: { ...draft, anchor, pageLabel: draft.pageLabel || computed, pageManual: (draft.pageLabel || computed) !== computed } })
      setLinking(null)
      return
    }
    setPanel({
      kind: 'form',
      seq: ++formSeq,
      num: null,
      notice,
      draft: {
        ficheroId: defaultFichero, notaPermanente: '', cita: anchor.exact, sourceId: source.id,
        pageLabel: citedPages(source.pagination, anchor.start, anchor.end), pageManual: false,
        anchor, tags: [], referencia: '', notas: '', extra: {},
      },
    })
    setActiveId(null)
  }

  const editFicha = useCallback((f: Ficha) => {
    setActiveId(f.id)
    const { num, createdAt: _c, updatedAt: _u, ...draft } = f
    setPanel({ kind: 'form', num, draft })
  }, [])

  // Clic sobre un resaltado: abre su ficha.
  const onClick = (e: React.MouseEvent) => {
    if (!window.getSelection()?.isCollapsed) return
    const pageDiv = (e.target as HTMLElement).closest<HTMLElement>('.page')
    if (!pageDiv) return
    const box = pageDiv.getBoundingClientRect()
    const x = (e.clientX - box.left - pageDiv.clientLeft) / pageDiv.clientWidth
    const y = (e.clientY - box.top - pageDiv.clientTop) / pageDiv.clientHeight
    const n = Number(pageDiv.dataset.pageNumber)
    const hit = fichas.find((f) => f.anchor?.rects.some((g) => g.page === n && g.r.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh)))
    if (hit && panel.kind !== 'form') editFicha(hit)
  }

  const openPagination = () => {
    if (!source) return
    setDraftRanges(source.pagination)
    setPanel({ kind: 'pagination' })
  }

  const ranges = (panel.kind === 'pagination' && draftRanges) || source?.pagination || []
  const pageLabel = sheetLabel(ranges, page)
  const title = useMemo(() => (source ? [authorsLabel(source.csl), yearLabel(source.csl)].filter(Boolean).join(' ') : ''), [source])

  if (error) {
    return (
      <div className="fatal">
        <p>No se pudo abrir el PDF: {error}</p>
        <button onClick={onBack}>Volver a la biblioteca</button>
      </div>
    )
  }

  return (
    <div className="reader">
      <header className="topbar">
        <button onClick={onBack}>← {backLabel}</button>
        <button className={`sidebar-toggle ${sidebar ? 'on' : ''}`} onClick={toggleSidebar} aria-pressed={sidebar} title="Índice y hojas" data-testid="sidebar-toggle">☰</button>
        <div className="reader-title">
          <strong>{title}</strong>
          <span>{source?.csl.title}</span>
        </div>
        <div className="spacer" />
        <form className="page-nav" onSubmit={(e) => { e.preventDefault(); goToPage(Number(pageInput)) }}>
          Hoja
          <input value={pageInput} onChange={(e) => setPageInput(e.target.value)} onBlur={() => setPageInput(String(page))} aria-label="Hoja del PDF" />
          de {doc?.numPages ?? '…'}
        </form>
        <button
          className={`cited-page ${source?.paginationVerified ? 'ok' : 'warn'}`} onClick={openPagination} data-testid="cited-page"
          title={source?.paginationVerified ? 'Paginación verificada. Pulsa para revisarla.' : 'Paginación sin verificar. Pulsa para comprobarla.'}
        >
          {pageLabel ? `Se cita: p. ${pageLabel}` : 'Hoja sin número'}
          <span>{source?.paginationVerified ? '✓' : '⚠ sin verificar'}</span>
        </button>
        <div className="zoom">
          <button onClick={() => pdfViewer.current?.decreaseScale()} aria-label="Reducir" title="Reducir (⌘−)">−</button>
          <span className="zoom-level" data-testid="zoom-level">{zoom ? `${Math.round(zoom * 100)} %` : ''}</span>
          <button onClick={() => { if (pdfViewer.current) pdfViewer.current.currentScaleValue = 'page-width' }} title="Ajustar al ancho (⌘0)" data-testid="zoom-fit">Ancho</button>
          <button onClick={() => pdfViewer.current?.increaseScale()} aria-label="Ampliar" title="Ampliar (⌘+)">+</button>
        </div>
      </header>

      {noText && (
        <div className="banner error">
          Este PDF no tiene capa de texto (está escaneado sin OCR), así que no se puede seleccionar nada. Añádele OCR y vuelve a adjuntarlo desde la biblioteca.
          <button className="link" onClick={() => void backend.openUrl(OCR_URL)}>Abrir iLovePDF OCR</button>
        </div>
      )}

      {linking && (
        <div className="banner ok">
          <span>Selecciona en el PDF el pasaje de la ficha {linking.num}: <em>«{linking.cita.slice(0, 110)}{linking.cita.length > 110 ? '…' : ''}»</em></span>
          <button className="link" onClick={() => setLinking(null)}>Cancelar</button>
        </div>
      )}

      <div className="reader-body">
        {sidebar && doc && (
          <PdfSidebar
            doc={doc} page={page} onPage={goToPage}
            pageLabel={(n) => sheetLabel(ranges, n) ?? ''}
            onDest={(dest) => void linkRef.current?.goToDestination(dest as never)}
          />
        )}
        <div className="pdf-pane">
          {findOpen && <FindBar status={findStatus} onFind={find} onClose={closeFind} focusKey={findKey} />}
          <div className="pdf-container" ref={containerRef} onMouseUp={onMouseUp} onClick={onClick}>
            <div className="pdfViewer" ref={viewerRef} />
          </div>
          {pending && panel.kind !== 'pagination' && (
            <button
              className="new-ficha-button primary" data-testid="new-ficha"
              style={{ left: Math.min(pending.client.x + 6, window.innerWidth - 480), top: pending.client.y + 6 }}
              onMouseDown={(e) => e.preventDefault()} onClick={startFicha}
            >
              {linking ? `Vincular a la ficha ${linking.num}` : '+ Ficha'} · p. {source ? citedPages(source.pagination, pending.anchor.start, pending.anchor.end) || '¿?' : ''}
            </button>
          )}
        </div>

        <SidePanel reserve={340} revealKey={panel.kind === 'list' ? null : panel.kind === 'form' ? (panel.draft.id ?? panel.draft.anchor?.exact ?? 'nueva') : 'paginacion'}>
          {source && panel.kind === 'form' && panel.notice && <div className="banner warn form-notice" data-testid="cross-page-notice">{panel.notice}</div>}
          {source && panel.kind === 'form' && (
            <FichaForm
              key={panel.seq ?? panel.draft.id ?? 'new'} draft={panel.draft} num={panel.num} sources={[source]} ficheros={ficheros} lockSource cite={cite} knownTags={knownTags}
              onCancel={() => setPanel({ kind: 'list' })}
              onVerifyPagination={openPagination}
              onSave={async (d) => {
                const id = await saveFicha(d)
                if (d.ficheroId !== defaultFichero) { setDefaultFichero(d.ficheroId); void setSettings({ lastFichero: d.ficheroId }) }
                await reloadFichas()
                setActiveId(id)
                setPanel({ kind: 'list' })
              }}
              onDelete={panel.draft.id ? async () => {
                await deleteFicha(panel.draft.id!)
                await reloadFichas()
                setActiveId(null)
                setPanel({ kind: 'list' })
              } : undefined}
            />
          )}

          {source && doc && panel.kind === 'pagination' && draftRanges && (
            <PaginationEditor
              source={source} ranges={draftRanges} onChange={setDraftRanges} currentPage={page} numPages={doc.numPages} fichas={fichas}
              onGoToPage={goToPage}
              onCancel={() => { setDraftRanges(null); setPanel({ kind: 'list' }) }}
              onSave={async (next, verified, relabel) => {
                const note = verified ? 'Verificada a mano.' : source.paginationNote
                await savePagination(source.id, next, verified, note, relabel)
                setSource(await getSource(source.id))
                await reloadFichas()
                setDraftRanges(null)
                setPanel({ kind: 'list' })
              }}
            />
          )}

          {source && panel.kind === 'list' && (
            <FichaList fichas={fichas} source={source} cite={cite} activeId={activeId} onJump={jumpTo} onEdit={editFicha} onLink={setLinking} />
          )}
        </SidePanel>
      </div>
    </div>
  )
}

interface ListProps {
  fichas: Ficha[]
  source: Source
  cite: CiteOptions
  activeId: string | null
  onJump: (f: Ficha) => void
  onEdit: (f: Ficha) => void
  onLink: (f: Ficha) => void
}

// La lista no se vuelve a pintar al pasar de hoja: solo cuando cambian sus fichas o la activa.
const FichaList = memo(function FichaList({ fichas, source, cite, activeId, onJump, onEdit, onLink }: ListProps) {
  const { limit, sentinel, reveal } = useGrowing(fichas.length, null, 40)
  // La ficha activa (p. ej. al pulsar su resaltado en el PDF) siempre está pintada.
  const activeIndex = activeId ? fichas.findIndex((f) => f.id === activeId) : -1
  useEffect(() => { if (activeIndex >= limit) reveal(activeIndex) }, [activeIndex, limit, reveal])
  return (
    <div className="ficha-list">
      <h2>Fichas de esta fuente <span className="muted">{fichas.length}</span></h2>
      {fichas.length === 0 && <p className="muted">Selecciona un pasaje en el PDF y pulsa <strong>+ Ficha</strong>.</p>}
      {fichas.slice(0, limit).map((f) => (
        <FichaCard key={f.id} ficha={f} source={source} cite={cite} active={f.id === activeId} onJump={onJump} onEdit={onEdit} onLink={onLink} />
      ))}
      {limit < fichas.length && <div ref={sentinel} className="list-more muted small">…</div>}
    </div>
  )
})

interface CardProps {
  ficha: Ficha
  source: Source
  cite: CiteOptions
  active: boolean
  onJump: (f: Ficha) => void
  onEdit: (f: Ficha) => void
  onLink: (f: Ficha) => void
}

const FichaCard = memo(function FichaCard({ ficha: f, source, cite, active, onJump, onEdit, onLink }: CardProps) {
  return (
    <article className={active ? 'ficha-card active' : 'ficha-card'} onClick={() => onJump(f)} data-testid="ficha-card">
      <header>
        <span className="ficha-num">{f.num}</span>
        <h3>{f.notaPermanente || <em className="muted">Sin nota permanente</em>}</h3>
        <button className="link" onClick={(e) => { e.stopPropagation(); onEdit(f) }}>Editar</button>
      </header>
      <blockquote>{f.cita}</blockquote>
      {!f.anchor && <button className="link" onClick={(e) => { e.stopPropagation(); onLink(f) }}>Sin marcar en el PDF: marcar el pasaje…</button>}
      <div className="ficha-citation" dangerouslySetInnerHTML={{ __html: formatCitation(source.csl, f.pageLabel, cite, canonicalRef(source, f)) }} />
      {f.tags.length > 0 && <div className="tags">{f.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
    </article>
  )
})
