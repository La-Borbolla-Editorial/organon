import { useEffect, useMemo, useRef, useState } from 'react'
import { backend } from '../backend'
import { recorteUrl } from '../pdf/crop'
import { inDocumentOrder, startOf } from '../pdf/marks'
import { HL_COLORS, type Ficha, type HlColor, type Marca, type MarcaKind } from '../types'
import { useEscape } from '../useEscape'

const COLOR_NAMES: Record<HlColor, string> = { amarillo: 'Amarillo', verde: 'Verde', azul: 'Azul', rosa: 'Rosa', naranja: 'Naranja', morado: 'Morado' }

/** Fila de colores del resaltado. */
export function ColorDots({ value, onPick, label = 'Resaltar en' }: { value?: HlColor | null; onPick: (c: HlColor) => void; label?: string }) {
  return (
    <span className="color-dots" role="group" aria-label="Color del resaltado">
      {HL_COLORS.map((c) => (
        <button
          key={c} type="button" className={`color-dot c-${c} ${value === c ? 'on' : ''}`} onClick={() => onPick(c)}
          onMouseDown={(e) => e.preventDefault()} // no deshace la selección del PDF
          title={`${label} ${COLOR_NAMES[c].toLowerCase()}`} aria-label={`${label} ${COLOR_NAMES[c].toLowerCase()}`} aria-pressed={value === c}
          data-testid={`color-${c}`}
        />
      ))}
    </span>
  )
}

/** Imagen de un recorte guardado. */
export function RecorteImage({ name, className }: { name: string; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    void recorteUrl(name, backend.readRecorte).then((u) => alive && setSrc(u)).catch(() => {})
    return () => { alive = false }
  }, [name])
  return src ? <img className={className} src={src} alt="Recorte del PDF" draggable={false} /> : <span className={`${className ?? ''} muted`}>…</span>
}

// ---- Globo de una marca --------------------------------------------------------------

interface PopoverProps {
  marca: Marca
  /** Punto de la ventana junto al que se abre. */
  at: { x: number; y: number }
  onColor: (c: HlColor) => void
  onText: (texto: string) => void
  onFicha: () => void
  onDelete: () => void
  /** Al cerrar, con el texto final de la nota. */
  onClose: (texto: string) => void
}

export function MarkPopover({ marca, at, onColor, onText, onFicha, onDelete, onClose }: PopoverProps) {
  const box = useRef<HTMLDivElement>(null)
  const [texto, setTexto] = useState(marca.texto ?? '')
  const textoRef = useRef(texto)
  textoRef.current = texto
  // La nota se guarda al cerrar el globo (y al salir de la caja de texto).
  const close = () => onClose(textoRef.current)
  useEscape(close)
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) close() }
    // En el siguiente ciclo: el clic que abrió el globo no debe cerrarlo.
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    return () => { clearTimeout(t); window.removeEventListener('mousedown', onDown) }
  })
  const left = Math.max(8, Math.min(at.x + 8, window.innerWidth - 300))
  const top = Math.max(8, Math.min(at.y + 10, window.innerHeight - (marca.kind === 'resaltado' ? 120 : 260)))

  return (
    <div className="mark-popover" ref={box} style={{ left, top }} role="dialog" aria-label={marca.kind === 'nota' ? 'Nota' : marca.kind === 'recorte' ? 'Recorte' : 'Resaltado'} data-testid="mark-popover">
      {marca.kind === 'resaltado' && (
        <>
          <div className="mark-popover-row"><ColorDots value={marca.color ?? 'amarillo'} onPick={onColor} label="Cambiar a" /></div>
          <p className="mark-excerpt">«{trim(marca.anchor?.exact ?? '', 140)}»</p>
        </>
      )}
      {marca.kind === 'nota' && (
        <textarea
          autoFocus value={texto} rows={4} placeholder="Escribe la nota…" data-testid="note-text"
          onChange={(e) => setTexto(e.target.value)} onBlur={() => texto !== (marca.texto ?? '') && onText(texto)}
        />
      )}
      {marca.kind === 'recorte' && marca.imagen && <RecorteImage name={marca.imagen} className="mark-crop" />}
      <div className="mark-popover-row">
        {marca.kind !== 'nota' && <button type="button" className="primary" onClick={onFicha} data-testid="mark-to-ficha">Hacer ficha</button>}
        {marca.kind === 'nota' && <button type="button" className="primary" onClick={close}>Listo</button>}
        <div className="spacer" />
        <button type="button" className="link subtle" onClick={onDelete} data-testid="mark-delete">Eliminar</button>
      </div>
    </div>
  )
}

const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)

// ---- Panel de marcas -----------------------------------------------------------------

type Kind = MarcaKind | 'ficha'
const KIND_LABELS: Record<Kind, string> = { resaltado: 'Resaltados', nota: 'Notas', recorte: 'Recortes', ficha: 'Fichas' }

interface PanelProps {
  marcas: Marca[]
  fichas: Ficha[]
  activeId: string | null
  /** Etiqueta de la página impresa de una hoja. */
  pageLabel: (n: number) => string
  onMarca: (m: Marca) => void
  onFicha: (f: Ficha) => void
}

export function MarksPanel({ marcas, fichas, activeId, pageLabel, onMarca, onFicha }: PanelProps) {
  const [kinds, setKinds] = useState<Set<Kind>>(new Set())
  const [colors, setColors] = useState<Set<HlColor>>(new Set())
  const items = useMemo(() => inDocumentOrder<Marca | Ficha>([...marcas, ...fichas.filter((f) => f.anchor)]), [marcas, fichas])
  const kindOf = (it: Marca | Ficha): Kind => ('kind' in it ? it.kind : 'ficha')
  // Notas y recortes no tienen color: con un filtro de color solo quedan resaltados y fichas.
  const colorOf = (it: Marca | Ficha): HlColor | null => (kindOf(it) === 'resaltado' || (kindOf(it) === 'ficha' && !(it as Ficha).imagen) ? it.color ?? 'amarillo' : null)
  const shown = items.filter((it) => (!kinds.size || kinds.has(kindOf(it))) && (!colors.size || (colorOf(it) !== null && colors.has(colorOf(it)!))))
  const counts = items.reduce<Record<string, number>>((m, it) => ({ ...m, [kindOf(it)]: (m[kindOf(it)] ?? 0) + 1 }), {})
  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n }

  return (
    <div className="marks-panel" data-testid="marks-panel">
      <div className="marks-filters">
        {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
          <button key={k} type="button" className={`chip ${kinds.has(k) ? 'on' : ''}`} onClick={() => setKinds(toggle(kinds, k))} disabled={!counts[k]} aria-pressed={kinds.has(k)}>
            {KIND_LABELS[k]} <span className="muted">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="marks-filters">
        <span className="color-dots">
          {HL_COLORS.map((c) => (
            <button key={c} type="button" className={`color-dot c-${c} ${colors.has(c) ? 'on' : ''}`} onClick={() => setColors(toggle(colors, c))} aria-pressed={colors.has(c)} title={`Solo ${COLOR_NAMES[c].toLowerCase()}`} aria-label={`Solo ${COLOR_NAMES[c].toLowerCase()}`} />
          ))}
        </span>
        {(kinds.size > 0 || colors.size > 0) && <button type="button" className="link subtle" onClick={() => { setKinds(new Set()); setColors(new Set()) }}>Quitar filtros</button>}
      </div>
      {items.length === 0 && <p className="muted">Selecciona un pasaje en el PDF y elige un color para resaltarlo, o usa <strong>Nota</strong> y <strong>Recorte</strong> arriba.</p>}
      {items.length > 0 && shown.length === 0 && <p className="muted">Nada con esos filtros.</p>}
      <ul className="marks-list">
        {shown.map((it) => {
          const k = kindOf(it)
          const at = startOf(it)
          const label = at ? pageLabel(at.page) : ''
          const color = colorOf(it)
          return (
            <li key={it.id}>
              <button type="button" className={`mark-item ${it.id === activeId ? 'active' : ''}`} onClick={() => ('kind' in it ? onMarca(it) : onFicha(it))} data-testid="mark-item">
                <span className={`mark-icon k-${k} ${color ? `c-${color}` : ''} ${k === 'ficha' && !color ? 'k-recorte' : ''}`} aria-hidden>{k === 'nota' ? '✎' : k === 'recorte' ? '▭' : k === 'ficha' ? (it as Ficha).num : ''}</span>
                <span className="mark-body">
                  {k === 'nota' && (((it as Marca).texto ?? '').trim() ? trim((it as Marca).texto!, 160) : <em className="muted">Nota vacía</em>)}
                  {k === 'resaltado' && `«${trim((it as Marca).anchor?.exact ?? '', 160)}»`}
                  {k === 'recorte' && ((it as Marca).imagen ? <RecorteImage name={(it as Marca).imagen!} className="mark-thumb" /> : 'Recorte')}
                  {k === 'ficha' && ((it as Ficha).notaPermanente || `«${trim((it as Ficha).cita, 120)}»`)}
                </span>
                <span className="mark-page muted">{at ? (label ? `p. ${label}` : `h. ${at.page}`) : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
