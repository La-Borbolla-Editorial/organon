import { useMemo, useState } from 'react'
import { FIELD_NAMES } from '../fichero-io'
import { columnsProblem, filledCount, KEEPS_CSV_TEXT, type ColumnDraft } from '../fichero-table'
import { useEscape } from '../useEscape'
import { COLUMN_KINDS, type ColumnKind, type Ficha, type FieldKey, type Fichero } from '../types'

interface Props {
  fichero: Fichero
  /** Las fichas de este fichero (para avisar de lo que se pierde al eliminar una columna). */
  fichas: Ficha[]
  onSave: (drafts: ColumnDraft[]) => Promise<void>
  onCancel: () => void
}

interface Row extends ColumnDraft {
  /** Clave estable para React (el nombre puede cambiar). */
  key: number
  removed?: boolean
  /** Opciones de una lista, tal como se escriben (una por línea). */
  optionsText?: string
}

let nextKey = 1

/** Columnas de un fichero: nombre, tipo, orden, ocultas, nuevas y eliminadas. */
export function ColumnsDialog({ fichero, fichas, onSave, onCancel }: Props) {
  const [rows, setRows] = useState<Row[]>(() => fichero.columns.map((c) => ({ ...c, orig: c.header, key: nextKey++, optionsText: (c.options ?? []).join('\n') })))
  const [focusKey, setFocusKey] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Los avisos (nombre vacío, repetido…) se muestran al intentar guardar, no mientras se escribe.
  const [tried, setTried] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [initial] = useState(() => JSON.stringify(rows))
  const dirty = JSON.stringify(rows) !== initial
  // Esc, Cancelar o clic fuera: con cambios, primero se pregunta.
  const cancel = () => (dirty && !confirmDiscard ? setConfirmDiscard(true) : onCancel())
  useEscape(() => (confirmDiscard ? setConfirmDiscard(false) : cancel()))

  const kept = rows.filter((r) => !r.removed)
  const drafts: ColumnDraft[] = kept.map(({ key: _k, removed: _r, optionsText, ...c }) => ({ ...c, options: c.kind === 'lista' ? (optionsText ?? '').split('\n') : undefined }))
  const problem = columnsProblem(drafts)
  // Los campos de Organon que este fichero no tiene como columna.
  const missingFields = (Object.keys(FIELD_NAMES) as FieldKey[]).filter((k) => k !== 'extra' && !kept.some((r) => r.field === k))
  const filled = useMemo(() => new Map(fichero.columns.map((c) => [c.header, filledCount(fichas, c.header)])), [fichero, fichas])

  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const move = (i: number, by: number) => setRows((rs) => {
    const next = [...rs]
    const j = i + by
    if (j < 0 || j >= next.length) return rs
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const add = (row: Omit<Row, 'key'>) => {
    const key = nextKey++
    setRows((rs) => [...rs, { ...row, key }])
    setFocusKey(key)
  }

  const save = async () => {
    setTried(true)
    if (problem) return
    setBusy(true)
    try {
      await onSave(drafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
      <form className="modal columns-dialog" onSubmit={(e) => { e.preventDefault(); void save() }} data-testid="columns-dialog">
        <h2>Columnas de «{fichero.name}»</h2>
        <p className="muted small">
          Las columnas propias guardan en cada ficha lo que quieras: un estado, una fecha, una casilla de «revisada»… Se exportan al CSV como cualquier otra.
          Ocultar una columna solo la quita de la tabla.
        </p>

        <ol className="column-list">
          {rows.map((r, i) => {
            const own = r.field === 'extra'
            const lost = r.orig !== undefined ? filled.get(r.orig) ?? 0 : 0
            return (
              <li key={r.key} className={r.removed ? 'removed' : ''} data-testid="column-row">
                <div className="column-row">
                  <span className="column-move">
                    <button type="button" className="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${r.header}`}>↑</button>
                    <button type="button" className="icon" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar ${r.header}`}>↓</button>
                  </span>
                  <input
                    className="column-name" value={r.header} placeholder="Nombre de la columna" disabled={r.removed} autoFocus={focusKey === r.key}
                    onChange={(e) => set(r.key, { header: e.target.value })} data-testid="column-name"
                  />
                  {own ? (
                    <select value={r.kind ?? 'texto'} disabled={r.removed} onChange={(e) => set(r.key, { kind: e.target.value as ColumnKind })} data-testid="column-kind">
                      {(Object.keys(COLUMN_KINDS) as ColumnKind[]).map((k) => <option key={k} value={k}>{COLUMN_KINDS[k]}</option>)}
                    </select>
                  ) : (
                    <span className="column-field muted small" title="Campo de la ficha que muestra esta columna">{FIELD_NAMES[r.field]}</span>
                  )}
                  <label className="column-visible">
                    <input type="checkbox" checked={!r.hidden} disabled={r.removed} onChange={(e) => set(r.key, { hidden: !e.target.checked })} data-testid="column-visible" />
                    Visible
                  </label>
                  {r.removed ? (
                    <button type="button" className="link" onClick={() => set(r.key, { removed: false })}>Deshacer</button>
                  ) : KEEPS_CSV_TEXT.has(r.field) && r.orig !== undefined ? (
                    <span className="muted small column-fixed" title="Esta columna guarda lo que traía el CSV (lo que identifica a una ficha sin fuente). Se puede ocultar, no quitar.">Solo se oculta</span>
                  ) : (
                    <button type="button" className="link subtle" onClick={() => set(r.key, { removed: true })} data-testid="column-remove">
                      {own ? 'Eliminar' : 'Quitar'}
                    </button>
                  )}
                </div>
                {own && r.kind === 'lista' && !r.removed && (
                  <label className="column-options">
                    Opciones, una por línea
                    <textarea rows={3} value={r.optionsText ?? ''} onChange={(e) => set(r.key, { optionsText: e.target.value })} placeholder={'Pendiente\nEn curso\nLista'} data-testid="column-options" />
                  </label>
                )}
                {r.removed && (
                  <p className="page-warning small">
                    {own
                      ? lost ? `Se borrará lo que tiene escrito en ${lost} ficha(s).` : 'Ninguna ficha tiene nada en esta columna.'
                      : 'Solo deja de verse en la tabla y en el CSV: el campo sigue en cada ficha.'}
                  </p>
                )}
              </li>
            )
          })}
        </ol>

        <div className="page-row">
          <button type="button" onClick={() => add({ header: '', field: 'extra', kind: 'texto' })} data-testid="column-add">+ Columna propia</button>
          {missingFields.length > 0 && (
            <select value="" onChange={(e) => { const field = e.target.value as FieldKey; if (field) add({ header: FIELD_NAMES[field], field }) }} data-testid="column-add-field">
              <option value="">Añadir un campo de Organon…</option>
              {missingFields.map((k) => <option key={k} value={k}>{FIELD_NAMES[k]}</option>)}
            </select>
          )}
        </div>

        <p className="muted small">
          También se pueden escribir a mano en <code>organon.json</code>, en la lista <code>columns</code> de cada fichero (el README explica el formato).
        </p>

        <div className="form-actions">
          {confirmDiscard ? (
            <>
              <span className="page-warning">¿Descartar los cambios en las columnas?</span>
              <div className="spacer" />
              <button type="button" className="danger" onClick={onCancel} data-testid="columns-discard">Descartar</button>
              <button type="button" onClick={() => setConfirmDiscard(false)}>Seguir editando</button>
            </>
          ) : (
            <>
              {(error || (tried && problem)) && <span className="page-warning">{error || problem}</span>}
              <div className="spacer" />
              <button type="button" onClick={cancel}>Cancelar</button>
              <button type="submit" className="primary" disabled={busy || (tried && !!problem)} data-testid="columns-save">Guardar columnas</button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
