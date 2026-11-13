import { useMemo, useState } from 'react'
import { authorsLabel, yearLabel } from '../citations'
import { FIELD_NAMES, guessColumns, rowsToFichas, type ParsedCsv } from '../fichero-io'
import { createFichero, importFichas, updateFichero } from '../store'
import type { Column, Ficha, Fichero, FieldKey, Source } from '../types'

interface Props {
  csv: ParsedCsv
  fileName: string
  ficheros: Fichero[]
  /** Todas las fichas del proyecto, para saber cuáles se actualizarían. */
  fichas: Ficha[]
  sources: Source[]
  onDone: (ficheroId: string, message: string) => void
  onCancel: () => void
}

export function ImportDialog({ csv, fileName, ficheros, fichas, sources, onDone, onCancel }: Props) {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/^.* - /, '') // «Fichero - Escoto.csv» → «Escoto»
  const sameName = ficheros.find((f) => f.name.toLowerCase() === baseName.toLowerCase())
  const [target, setTarget] = useState(sameName?.id ?? 'new')
  const [name, setName] = useState(baseName)
  const [columns, setColumns] = useState<Column[]>(() => guessColumns(csv.headers))
  const [defaultSource, setDefaultSource] = useState('')
  const [update, setUpdate] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const hasSourceColumn = columns.some((c) => c.field === 'autor' || c.field === 'fuente')
  const rows = useMemo(() => rowsToFichas(csv, columns, sources, hasSourceColumn ? null : defaultSource || null), [csv, columns, sources, defaultSource, hasSourceColumn])

  const authorHeader = columns.find((c) => c.field === 'autor')?.header
  const titleHeader = columns.find((c) => c.field === 'fuente')?.header
  const unmatched = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      if (r.sourceId) continue
      const label = [authorHeader && r.extra[authorHeader], titleHeader && r.extra[titleHeader]].filter(Boolean).join(' — ') || '(sin autor ni título)'
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [rows, authorHeader, titleHeader])

  const existingNums = useMemo(() => new Set(fichas.filter((f) => f.ficheroId === target).map((f) => f.num)), [fichas, target])
  const wouldUpdate = target === 'new' ? 0 : rows.filter((r) => r.num !== null && existingNums.has(r.num)).length
  const sample = (i: number) => csv.rows.find((r) => (r[i] ?? '').trim() !== '')?.[i] ?? ''

  const setField = (i: number, field: FieldKey) =>
    // Cada campo va en una sola columna: si ya estaba en otra, esa pasa a «otra columna».
    setColumns((cols) => cols.map((c, k) => (k === i ? { ...c, field } : field !== 'extra' && c.field === field ? { ...c, field: 'extra' } : c)))

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      let id = target
      if (target === 'new') id = await createFichero(name.trim() || baseName || 'Fichero', columns)
      else {
        // Al reimportar se conservan los anchos de columna que ya tenía el fichero.
        const old = ficheros.find((f) => f.id === target)?.columns ?? []
        await updateFichero(target, { columns: columns.map((c) => ({ ...c, width: old.find((o) => o.header === c.header)?.width })) })
      }
      const { added, updated } = await importFichas(id, rows, target !== 'new' && update)
      const linked = rows.filter((r) => r.sourceId).length
      onDone(id, `${added} ficha(s) añadida(s)${updated ? `, ${updated} actualizada(s)` : ''}. ${linked} de ${rows.length} con fuente reconocida.`)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label="Importar CSV">
        <h2>Importar «{fileName}»</h2>
        <p className="muted">{csv.rows.length} filas, {csv.headers.length} columnas.</p>

        <section>
          <h3>Destino</h3>
          <div className="page-row">
            <select value={target} onChange={(e) => setTarget(e.target.value)} data-testid="import-target">
              <option value="new">Fichero nuevo</option>
              {ficheros.map((f) => <option key={f.id} value={f.id}>Añadir a «{f.name}»</option>)}
            </select>
            {target === 'new' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del fichero" />}
          </div>
          {target !== 'new' && (
            <label className="check">
              <input type="checkbox" checked={update} onChange={(e) => setUpdate(e.target.checked)} />
              Actualizar las fichas que ya existen con el mismo ID ({wouldUpdate}). Conservan su pasaje marcado en el PDF.
            </label>
          )}
          {target !== 'new' && !update && wouldUpdate > 0 && <p className="page-warning">{wouldUpdate} fila(s) tienen un ID que ya existe: se añadirán como fichas nuevas con otro ID.</p>}
        </section>

        <section>
          <h3>Columnas</h3>
          <table className="mapping">
            <thead><tr><th>En tu hoja</th><th>Ejemplo</th><th>En Organon</th></tr></thead>
            <tbody>
              {columns.map((c, i) => (
                <tr key={i}>
                  <td><strong>{c.header}</strong></td>
                  <td className="muted sample-cell">{sample(i)}</td>
                  <td>
                    <select value={c.field} onChange={(e) => setField(i, e.target.value as FieldKey)}>
                      {Object.entries(FIELD_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Las columnas se guardan con su nombre y su orden, y se exportan igual.</p>
        </section>

        <section>
          <h3>Fuentes</h3>
          {hasSourceColumn ? (
            <>
              <p>{rows.length - unmatched.reduce((n, [, c]) => n + c, 0)} de {rows.length} fichas tienen su fuente en la biblioteca.</p>
              {unmatched.length > 0 && (
                <>
                  <p className="muted">Sin fuente en la biblioteca (se importan igual y se vinculan solas cuando importes la fuente desde Zotero):</p>
                  <ul className="unmatched">{unmatched.map(([label, n]) => <li key={label}>{label} <span className="muted">· {n}</span></li>)}</ul>
                </>
              )}
            </>
          ) : (
            <label className="stack">
              La hoja no indica la fuente. Fuente de todas las fichas:
              <select value={defaultSource} onChange={(e) => setDefaultSource(e.target.value)}>
                <option value="">— Sin fuente —</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{[authorsLabel(s.csl), yearLabel(s.csl)].filter(Boolean).join(' ')} · {String(s.csl.title ?? s.citekey)}</option>)}
              </select>
            </label>
          )}
        </section>

        {error && <div className="banner error">{error}</div>}
        <div className="form-actions">
          <button className="primary" disabled={busy} onClick={() => void run()} data-testid="import-run">Importar {rows.length} fichas</button>
          <button onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
