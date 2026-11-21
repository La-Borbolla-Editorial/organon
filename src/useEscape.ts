import { useEffect, useRef } from 'react'

/**
 * Esc cierra solo lo que está encima (un menú, un diálogo): se atiende antes
 * que nadie y no sigue hacia abajo, así que no cierra también la ficha que se
 * está editando detrás.
 */
export function useEscape(onEscape: () => void, active = true) {
  const handler = useRef(onEscape)
  handler.current = onEscape
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      handler.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active])
}
