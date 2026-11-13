import { useCallback, useState, type ReactNode } from 'react'

const KEY = 'organon.anchoPanel'
const MIN = 340
const DEFAULT = 480
const maxWidth = () => Math.max(MIN, Math.round(window.innerWidth * 0.7))

function stored(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    if (n >= MIN) return n
  } catch { /* sin almacenamiento: se usa el ancho por defecto */ }
  return DEFAULT
}

/** Panel lateral derecho (editor de ficha, paginación…) con el borde izquierdo arrastrable. */
export function SidePanel({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(stored)
  const [dragging, setDragging] = useState(false)

  const start = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    let last = 0
    const move = (ev: PointerEvent) => {
      last = Math.min(maxWidth(), Math.max(MIN, window.innerWidth - ev.clientX))
      setWidth(last)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      setDragging(false)
      if (last) try { localStorage.setItem(KEY, String(last)) } catch { /* no pasa nada */ }
      window.dispatchEvent(new Event('resize')) // el visor de PDF se reajusta al nuevo ancho
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }, [])

  return (
    <aside className={dragging ? 'side-panel dragging' : 'side-panel'} style={{ width: Math.min(width, maxWidth()) }}>
      <div
        className="panel-resizer" role="separator" aria-orientation="vertical" aria-label="Cambiar el ancho del panel" title="Arrastra para cambiar el ancho. Doble clic: ancho normal."
        onPointerDown={start}
        onDoubleClick={() => { setWidth(DEFAULT); try { localStorage.removeItem(KEY) } catch { /* nada */ } window.dispatchEvent(new Event('resize')) }}
      />
      <div className="side-panel-scroll">{children}</div>
    </aside>
  )
}
