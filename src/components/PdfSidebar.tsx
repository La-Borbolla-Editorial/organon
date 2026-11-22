import { memo, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../pdf/pdfjs'

/** Una entrada del índice del PDF (sus marcadores), con sus subentradas. */
export interface OutlineItem {
  title: string
  dest: string | unknown[] | null
  items: OutlineItem[]
}

interface Props {
  doc: PDFDocumentProxy
  page: number
  /** Etiqueta de la página impresa de una hoja («68», «xii»), o vacía. */
  pageLabel: (n: number) => string
  onPage: (n: number) => void
  onDest: (dest: string | unknown[]) => void
}

type Tab = 'indice' | 'hojas'

export function PdfSidebar({ doc, page, pageLabel, onPage, onDest }: Props) {
  const [outline, setOutline] = useState<OutlineItem[] | null>(null)
  const [tab, setTab] = useState<Tab>('hojas')

  useEffect(() => {
    let alive = true
    setOutline(null)
    void doc.getOutline().then((o) => {
      if (!alive) return
      const items = (o ?? []) as OutlineItem[]
      setOutline(items)
      // Con índice, se abre en el índice; sin él, en las hojas.
      setTab(items.length ? 'indice' : 'hojas')
    })
    return () => { alive = false }
  }, [doc])

  return (
    <aside className="pdf-sidebar" data-testid="pdf-sidebar">
      <div className="pdf-sidebar-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'indice'} className={tab === 'indice' ? 'on' : ''} onClick={() => setTab('indice')}>Índice</button>
        <button role="tab" aria-selected={tab === 'hojas'} className={tab === 'hojas' ? 'on' : ''} onClick={() => setTab('hojas')}>Hojas</button>
      </div>
      {tab === 'indice' ? (
        <div className="pdf-outline" data-testid="pdf-outline">
          {outline === null ? null : outline.length ? (
            <OutlineList items={outline} onDest={onDest} />
          ) : (
            <p className="muted">Este PDF no trae índice. Puedes moverte por las hojas.</p>
          )}
        </div>
      ) : (
        <Thumbnails doc={doc} page={page} pageLabel={pageLabel} onPage={onPage} />
      )}
    </aside>
  )
}

function OutlineList({ items, onDest }: { items: OutlineItem[]; onDest: (dest: string | unknown[]) => void }) {
  return (
    <ul>
      {items.map((it, i) => (
        <OutlineEntry key={i} item={it} onDest={onDest} />
      ))}
    </ul>
  )
}

function OutlineEntry({ item, onDest }: { item: OutlineItem; onDest: (dest: string | unknown[]) => void }) {
  const [open, setOpen] = useState(false)
  const has = item.items.length > 0
  return (
    <li>
      <div className="outline-row">
        {has ? <button className="outline-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Plegar' : 'Desplegar'}>{open ? '▾' : '▸'}</button> : <span className="outline-toggle" />}
        <button className="outline-title" disabled={!item.dest} onClick={() => item.dest && onDest(item.dest)} title={item.title}>{item.title}</button>
      </div>
      {has && open && <OutlineList items={item.items} onDest={onDest} />}
    </li>
  )
}

// ---- Miniaturas ----
// Se dibujan solo las que se ven (y alguna más), a un tamaño fijo, y se guardan como imagen.

const THUMB_WIDTH = 110

function Thumbnails({ doc, page, pageLabel, onPage }: { doc: PDFDocumentProxy; page: number; pageLabel: (n: number) => string; onPage: (n: number) => void }) {
  const list = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5, 6]))
  const [ratio, setRatio] = useState(1.3)

  useEffect(() => {
    void doc.getPage(1).then((p) => { const v = p.getViewport({ scale: 1 }); setRatio(v.height / v.width) })
  }, [doc])

  useEffect(() => {
    const root = list.current
    if (!root) return
    const io = new IntersectionObserver((entries) => {
      const add = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.n))
      if (add.length) setVisible((v) => (add.every((n) => v.has(n)) ? v : new Set([...v, ...add])))
    }, { root, rootMargin: '300px 0px' })
    root.querySelectorAll('[data-n]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [doc])

  // La hoja actual, a la vista dentro de la lista.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-n="${page}"]`)
    const root = list.current
    if (!el || !root) return
    if (el.offsetTop < root.scrollTop || el.offsetTop + el.offsetHeight > root.scrollTop + root.clientHeight) {
      root.scrollTop = el.offsetTop - root.clientHeight / 3
    }
  }, [page])

  return (
    <div className="pdf-thumbs" ref={list} data-testid="pdf-thumbs">
      {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
        <button key={n} data-n={n} className={`thumb ${n === page ? 'on' : ''}`} onClick={() => onPage(n)} aria-label={`Hoja ${n}`} aria-current={n === page ? 'page' : undefined}>
          <div className="thumb-img" style={{ width: THUMB_WIDTH, height: Math.round(THUMB_WIDTH * ratio) }}>
            {visible.has(n) && <Thumb doc={doc} n={n} />}
          </div>
          <span className="thumb-label">{n}{pageLabel(n) ? ` · p. ${pageLabel(n)}` : ''}</span>
        </button>
      ))}
    </div>
  )
}

const thumbCache = new WeakMap<PDFDocumentProxy, Map<number, string>>()

const Thumb = memo(function Thumb({ doc, n }: { doc: PDFDocumentProxy; n: number }) {
  const cache = thumbCache.get(doc) ?? new Map<number, string>()
  thumbCache.set(doc, cache)
  const [src, setSrc] = useState(() => cache.get(n) ?? '')

  useEffect(() => {
    if (src) return
    let alive = true
    let task: { cancel: () => void } | null = null
    void doc.getPage(n).then(async (p) => {
      if (!alive) return
      const base = p.getViewport({ scale: 1 })
      const vp = p.getViewport({ scale: (THUMB_WIDTH * 2) / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(vp.width)
      canvas.height = Math.round(vp.height)
      const render = p.render({ canvas, viewport: vp })
      task = render
      try {
        await render.promise
      } catch {
        return
      }
      const url = canvas.toDataURL('image/jpeg', 0.7)
      cache.set(n, url)
      if (alive) setSrc(url)
    })
    return () => { alive = false; task?.cancel() }
  }, [doc, n, src, cache])

  return src ? <img src={src} alt="" draggable={false} /> : null
})
