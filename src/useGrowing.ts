import { useCallback, useEffect, useRef, useState } from 'react'

const scrollParent = (el: HTMLElement): HTMLElement | null => {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

/**
 * Listas largas (miles de fichas): se pintan las primeras `step` filas y, al
 * acercarse el final con el scroll, las siguientes. Así abrir, filtrar o
 * escribir no espera a pintar lo que no se ve. `reset` vuelve al principio
 * (p. ej. al cambiar el filtro).
 */
export function useGrowing(total: number, reset: unknown, step = 120) {
  const [limit, setLimit] = useState(step)
  const [node, setNode] = useState<HTMLElement | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    setLimit(step)
  }, [reset, step])

  useEffect(() => {
    if (!node || limit >= total) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setLimit((l) => l + step) },
      { root: scrollParent(node), rootMargin: '1500px 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [node, limit, total, step])

  /** Garantiza que la fila `index` esté pintada (p. ej. la ficha que se abre desde otra vista). */
  const reveal = useCallback((index: number) => setLimit((l) => Math.max(l, index + step)), [step])

  return { limit, sentinel: setNode, reveal }
}
