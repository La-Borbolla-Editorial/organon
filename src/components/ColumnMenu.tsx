import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useEscape } from '../useEscape'
import { filterActive, filterKind, fold, type ColumnFilter } from '../fichero-table'
import type { Column } from '../types'

export interface ValueCount {
  value: string
  label: string
  count: number
}

interface Props {
  column: Column
  /** Rectángulo del encabezado: el menú se abre debajo. */
  anchor: DOMRect
  filter: ColumnFilter | undefined
  /** null: no se ordena por esta columna. */
  sort: 'asc' | 'desc' | null
  /** Valores distintos de la columna (solo en las que se filtran por valores). */
  values: () => ValueCount[]
  onFilter: (f: ColumnFilter | undefined) => void
  onSort: (dir: 'asc' | 'desc' | null) => void
  onClose: () => void
}

const SORT_LABELS = {
  texto: ['A → Z', 'Z → A'],
  valores: ['A → Z', 'Z → A'],
  numero: ['1 → 9', '9 → 1'],
  fecha: ['Antiguas primero', 'Recientes primero'],
} as const

/** Menú de un encabezado del fichero: ordenar y filtrar por esa columna, como en una hoja de cálculo. */
export function ColumnMenu({ column: c, anchor, filter, sort, values, onFilter, onSort, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const kind = filterKind(c)
  const f = filter ?? {}
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 2 })
  const [search, setSearch] = useState('')
  const [all] = useState(() => (kind === 'valores' ? values() : []))

  // Dentro de la ventana aunque la columna esté pegada al borde derecho.
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 280
    setPos({ left: Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8)), top: anchor.bottom + 2 })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  useEscape(onClose)

  const update = (patch: Partial<ColumnFilter>) => {
    const next: ColumnFilter = { ...f, ...patch }
    for (const k of Object.keys(next) as (keyof ColumnFilter)[]) if (next[k] === undefined || next[k] === '') delete next[k]
    onFilter(filterActive(next) ? next : undefined)
  }

  // Se guardan los valores ocultos: un tag o una opción que aparezca después se verá.
  // (Un filtro guardado por 0.6.0 trae los mostrados, `values`: se convierte al tocarlo.)
  const selected = f.values ? new Set(f.values) : new Set(all.map((v) => v.value).filter((v) => !f.hidden?.includes(v)))
  const setShown = (shown: Set<string>) => {
    const hidden = all.map((v) => v.value).filter((v) => !shown.has(v))
    update({ values: undefined, hidden: hidden.length ? hidden : undefined })
  }
  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setShown(next)
  }
  const visibleValues = search.trim() ? all.filter((v) => fold(v.label).includes(fold(search.trim()))) : all
  const [ascLabel, descLabel] = SORT_LABELS[kind]

  return (
    <div ref={ref} className="column-menu" style={pos} role="dialog" aria-label={`Ordenar y filtrar ${c.header}`} data-testid="column-menu">
      <div className="column-menu-section">
        <span className="column-menu-title">Ordenar</span>
        <div className="column-menu-row">
          <button type="button" className={sort === 'asc' ? 'on' : ''} onClick={() => onSort(sort === 'asc' ? null : 'asc')} data-testid="sort-asc">{ascLabel}</button>
          <button type="button" className={sort === 'desc' ? 'on' : ''} onClick={() => onSort(sort === 'desc' ? null : 'desc')} data-testid="sort-desc">{descLabel}</button>
          {sort && <button type="button" className="link" onClick={() => onSort(null)} data-testid="sort-none">Orden manual</button>}
        </div>
      </div>

      <div className="column-menu-section">
        <span className="column-menu-title">Filtrar</span>

        {kind === 'texto' && (
          <input autoFocus placeholder="Contiene…" value={f.q ?? ''} onChange={(e) => update({ q: e.target.value })} data-testid="filter-text" />
        )}

        {(kind === 'numero' || kind === 'fecha') && (
          <div className="column-menu-row">
            <label>Desde <input type={kind === 'fecha' ? 'date' : 'text'} inputMode={kind === 'numero' ? 'decimal' : undefined} value={f.min ?? ''} onChange={(e) => update({ min: e.target.value })} data-testid="filter-min" /></label>
            <label>Hasta <input type={kind === 'fecha' ? 'date' : 'text'} inputMode={kind === 'numero' ? 'decimal' : undefined} value={f.max ?? ''} onChange={(e) => update({ max: e.target.value })} data-testid="filter-max" /></label>
          </div>
        )}

        {kind !== 'valores' && (
          <div className="column-menu-row">
            {(c.field === 'usos'
              ? ([['', 'Todas'], ['vacia', 'Sin usar'], ['llena', 'Usadas']] as const)
              : ([['', 'Todas'], ['vacia', 'Vacías'], ['llena', 'Con algo']] as const)).map(([v, label]) => (
              <label key={v} className="radio">
                <input type="radio" name="empty" checked={(f.empty ?? '') === v} onChange={() => update({ empty: v || undefined })} />
                {label}
              </label>
            ))}
          </div>
        )}

        {kind === 'valores' && (
          <>
            {all.length > 8 && <input autoFocus placeholder="Buscar un valor…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="filter-values-search" />}
            <div className="column-menu-row">
              <button type="button" className="link" onClick={() => setShown(new Set(all.map((v) => v.value)))}>Todos</button>
              <button type="button" className="link" onClick={() => setShown(new Set())}>Ninguno</button>
            </div>
            <div className="value-list">
              {visibleValues.map((v) => (
                <label key={v.value} className={v.count ? '' : 'muted'} data-testid="filter-value">
                  <input type="checkbox" checked={selected.has(v.value)} onChange={() => toggle(v.value)} />
                  <span className="value-label">{v.label}</span>
                  <span className="muted small">{v.count}</span>
                </label>
              ))}
              {visibleValues.length === 0 && <span className="muted small">Ningún valor coincide.</span>}
            </div>
          </>
        )}

        {filterActive(filter) && <button type="button" className="link" onClick={() => onFilter(undefined)} data-testid="filter-clear">Quitar este filtro</button>}
      </div>
    </div>
  )
}
