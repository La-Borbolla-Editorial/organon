import { useEffect, useRef } from 'react'

/**
 * Un atajo ⌘ + tecla (Ctrl en Windows), sin ⇧ ni ⌥: p. ej. ⌘N. Se compara `code`
 * («KeyN») para que valga igual con cualquier distribución de teclado.
 */
export function useCommandKey(code: string, onPress: () => void, active = true) {
  const handler = useRef(onPress)
  handler.current = onPress
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.code !== code || e.repeat) return
      e.preventDefault()
      handler.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [code, active])
}
