import { useEffect, useRef, useState } from 'react'
import { useEscape } from '../useEscape'

/** Lo que el buscador de pdf.js informa: resultado actual y total (`current` 0 = ninguno elegido). */
export interface FindStatus {
  current: number
  total: number
  /** Se terminó de buscar y no hay nada. */
  notFound: boolean
}

interface Props {
  status: FindStatus
  /** Pide ir al siguiente (o al anterior) resultado; con `again` = false es una búsqueda nueva. */
  onFind: (query: string, opts: { previous: boolean; again: boolean }) => void
  onClose: () => void
  /** Cambia cada vez que se pulsa ⌘F, para volver a poner el foco aunque la barra ya estuviera abierta. */
  focusKey: number
}

export function FindBar({ status, onFind, onClose, focusKey }: Props) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEscape(onClose)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [focusKey])

  const go = (previous: boolean) => query.trim() && onFind(query, { previous, again: true })

  return (
    <div className="find-bar" role="search" data-testid="find-bar">
      <input
        ref={input} value={query} placeholder="Buscar en el PDF" aria-label="Buscar en el PDF" data-testid="find-input"
        className={status.notFound && query.trim() ? 'not-found' : ''}
        onChange={(e) => { setQuery(e.target.value); onFind(e.target.value, { previous: false, again: false }) }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey) } }}
      />
      <span className="find-count" data-testid="find-count">
        {!query.trim() ? '' : status.total ? `${status.current || '–'} de ${status.total}` : status.notFound ? 'Sin resultados' : '…'}
      </span>
      <button type="button" onClick={() => go(true)} disabled={!status.total} aria-label="Resultado anterior" title="Anterior (⇧Intro)">↑</button>
      <button type="button" onClick={() => go(false)} disabled={!status.total} aria-label="Resultado siguiente" title="Siguiente (Intro)">↓</button>
      <button type="button" className="link subtle" onClick={onClose} aria-label="Cerrar la búsqueda" title="Cerrar (Esc)">✕</button>
    </div>
  )
}
