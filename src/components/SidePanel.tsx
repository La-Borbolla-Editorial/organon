import { useCallback, useEffect, useState, type ReactNode } from 'react'

const KEY = 'organon.anchoPanel'
const HIDDEN_KEY = 'organon.panelOculto'
const MIN = 300
const DEFAULT = 480
// El panel nunca ocupa más del 70 % de la ventana ni deja al resto menos de lo que necesita.
const maxWidthFor = (reserve: number) => Math.max(220, Math.min(Math.round(window.innerWidth * 0.7), window.innerWidth - reserve))

function read<T>(key: string, parse: (raw: string | null) => T): T {
  try {
    return parse(localStorage.getItem(key))
  } catch {
    return parse(null) // sin almacenamiento: valores por defecto
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* la preferencia no se guarda, nada más */ }
}

interface Props {
  children: ReactNode
  /** Cuando cambia (p. ej. se abre otra ficha), el panel se muestra si estaba oculto. */
  revealKey?: unknown
  /** Ancho mínimo (px) que debe quedarle al resto de la pantalla. */
  reserve?: number
}

/** Panel lateral derecho (editor de ficha, vista final…): se puede ensanchar arrastrando su borde, y ocultar. */
export function SidePanel({ children, revealKey, reserve = 260 }: Props) {
  const maxWidth = useCallback(() => maxWidthFor(reserve), [reserve])
  const [width, setWidth] = useState(() => read(KEY, (raw) => (Number(raw) >= MIN ? Number(raw) : DEFAULT)))
  const [hidden, setHiddenState] = useState(() => read(HIDDEN_KEY, (raw) => raw === '1'))
  const [dragging, setDragging] = useState(false)
  // Al cambiar el tamaño de la ventana hay que volver a calcular el ancho máximo.
  const [, setTick] = useState(0)
  useEffect(() => {
    const onResize = () => setTick((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // El resto de la pantalla (el visor de PDF) se reajusta al nuevo ancho.
  const refit = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
  const setHidden = useCallback((value: boolean) => {
    setHiddenState(value)
    write(HIDDEN_KEY, value ? '1' : null)
    refit()
  }, [])

  useEffect(() => {
    if (revealKey !== undefined && revealKey !== null) setHiddenState((was) => { if (was) refit(); return false })
  }, [revealKey])

  const start = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    let last = 0
    const move = (ev: PointerEvent) => {
      last = Math.min(maxWidth(), Math.max(Math.min(MIN, maxWidth()), window.innerWidth - ev.clientX))
      setWidth(last)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      setDragging(false)
      if (last) write(KEY, String(last))
      refit()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }, [maxWidth])

  if (hidden) {
    return (
      <aside className="side-panel collapsed">
        <button className="panel-toggle" onClick={() => setHidden(false)} title="Mostrar el panel" aria-label="Mostrar el panel" data-testid="panel-show">‹</button>
      </aside>
    )
  }

  return (
    <aside className={dragging ? 'side-panel dragging' : 'side-panel'} style={{ width: Math.min(width, maxWidth()), maxWidth: maxWidth() }}>
      <div
        className="panel-resizer" role="separator" aria-orientation="vertical" aria-label="Cambiar el ancho del panel" title="Arrastra para cambiar el ancho. Doble clic: ancho normal."
        onPointerDown={start}
        onDoubleClick={() => { setWidth(DEFAULT); write(KEY, null); refit() }}
      />
      <button className="panel-toggle" onClick={() => setHidden(true)} title="Ocultar el panel" aria-label="Ocultar el panel" data-testid="panel-hide">›</button>
      <div className="side-panel-scroll">{children}</div>
    </aside>
  )
}
