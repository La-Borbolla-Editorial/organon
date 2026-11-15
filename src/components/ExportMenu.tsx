import { useEffect, useRef, useState } from 'react'

export type ExportKind = 'docx' | 'pdf' | 'fichas' | 'md'

const OPTIONS: { kind: ExportKind; label: string; detail: string }[] = [
  { kind: 'docx', label: 'Word (.docx)', detail: 'Con notas al pie de verdad, para entregar.' },
  { kind: 'pdf', label: 'PDF…', detail: 'El texto final; las notas van al final. Abre el diálogo de impresión.' },
  { kind: 'fichas', label: 'PDF con fichas…', detail: 'Tu texto tal cual, con cada ficha citada desplegada debajo. Para trabajar.' },
  { kind: 'md', label: 'Markdown', detail: 'El texto con las citas ya resueltas, notas y bibliografía.' },
]

interface Props {
  disabled: boolean
  /** Lo que se está exportando ahora, si algo. */
  busy: ExportKind | ''
  onExport: (kind: ExportKind) => void
}

/** Un solo botón «Exportar» que despliega las opciones. */
export function ExportMenu({ disabled, busy, onExport }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc) }
  }, [open])

  const label = busy ? 'Exportando…' : 'Exportar'
  return (
    <div className="export-menu" ref={root}>
      <button onClick={() => setOpen((o) => !o)} disabled={disabled || !!busy} aria-haspopup="menu" aria-expanded={open} data-testid="export-menu">
        {label} ▾
      </button>
      {open && (
        <div className="export-pop" role="menu">
          {OPTIONS.map((o) => (
            <button key={o.kind} role="menuitem" className="export-item" data-testid={`export-${o.kind}`} onClick={() => { setOpen(false); onExport(o.kind) }}>
              <strong>{o.label}</strong>
              <span>{o.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
