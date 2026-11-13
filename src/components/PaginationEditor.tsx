import { useMemo, useState } from 'react'
import { anchorPage, citedPages, normalize, sheetLabel, type NumStyle, type PageRange } from '../pagination'
import type { Ficha, Source } from '../types'

interface Props {
  source: Source
  /** Tramos en edición (los controla el lector para mostrar la vista previa). */
  ranges: PageRange[]
  onChange: (r: PageRange[]) => void
  currentPage: number
  numPages: number
  fichas: Ficha[]
  onGoToPage: (p: number) => void
  onSave: (ranges: PageRange[], verified: boolean, relabel: { fichaId: string; pageLabel: string }[]) => Promise<void>
  onCancel: () => void
}

// Varias fichas pueden compartir número (una por fichero): el título las distingue.
const title = (f: Ficha) => { const t = f.notaPermanente || f.cita; return t.length > 46 ? `${t.slice(0, 45)}…` : t }

const STYLE_NAMES: Record<NumStyle, string> = { arabic: '1, 2, 3…', roman: 'i, ii, iii…', ROMAN: 'I, II, III…', none: 'sin número' }

export function PaginationEditor({ source, ranges, onChange, currentPage, numPages, fichas, onGoToPage, onSave, onCancel }: Props) {
  const [printed, setPrinted] = useState('')
  const [fromHere, setFromHere] = useState(false)
  const [error, setError] = useState('')
  const [skip, setSkip] = useState<Set<string>>(new Set())

  const sorted = normalize(ranges)
  const current = sheetLabel(sorted, currentPage)

  const fix = () => {
    const next = anchorPage(sorted, currentPage, printed, fromHere)
    if (!next) return setError('Escribe un número de página (12) o un número romano (xii).')
    setError('')
    setPrinted('')
    setFromHere(false)
    onChange(next)
  }

  const update = (i: number, patch: Partial<PageRange>) => onChange(sorted.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  // Hojas de muestra para comparar con lo impreso: inicio de cada tramo, mitad y final.
  const samples = useMemo(() => {
    const s = new Set<number>([1, numPages, Math.ceil(numPages / 2)])
    for (const r of sorted) if (r.pdfStart <= numPages) s.add(r.pdfStart)
    return [...s].filter((p) => p >= 1 && p <= numPages).sort((a, b) => a - b)
  }, [sorted, numPages])

  // Fichas cuya página cambiaría con estos tramos.
  const changes = useMemo(
    () =>
      fichas.flatMap((f) => {
        if (!f.anchor) return []
        const next = citedPages(sorted, f.anchor.start, f.anchor.end)
        return next !== f.pageLabel ? [{ ficha: f, next }] : []
      }),
    [fichas, sorted],
  )
  const relabel = changes.filter((c) => !c.ficha.pageManual && !skip.has(c.ficha.id) && c.next).map((c) => ({ fichaId: c.ficha.id, pageLabel: c.next }))

  return (
    <div className="pagination-editor">
      <h2>Paginación</h2>
      <p className="muted">
        Qué página <strong>impresa</strong> corresponde a cada hoja del PDF. Es lo que se cita. {source.paginationNote}
      </p>

      <section className="check-box">
        <h3>Comprobar con la hoja que estás viendo</h3>
        <p>
          Hoja <strong>{currentPage}</strong> del PDF → se citará como{' '}
          <strong className="big-page" data-testid="pagination-current">{current ? `p. ${current}` : 'sin número'}</strong>
        </p>
        <p className="muted">Mira el número impreso en la página. Si no coincide, escríbelo:</p>
        <div className="page-row">
          <input
            className="page-input" value={printed} placeholder="n.º impreso" data-testid="pagination-printed"
            onChange={(e) => setPrinted(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fix() } }}
          />
          <button onClick={fix} disabled={!printed.trim()} data-testid="pagination-fix">Corregir</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={fromHere} onChange={(e) => setFromHere(e.target.checked)} />
          La numeración cambia a partir de esta hoja (las anteriores se quedan como están)
        </label>
        {error && <p className="page-warning">{error}</p>}
      </section>

      <section>
        <h3>Tramos</h3>
        <table className="ranges">
          <thead>
            <tr><th>Desde la hoja</th><th>Página impresa</th><th>Numeración</th><th>Págs. por hoja</th><th /></tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                <td><input type="number" min={1} max={numPages} value={r.pdfStart} onChange={(e) => update(i, { pdfStart: Math.max(1, Number(e.target.value) || 1) })} /></td>
                <td><input type="number" min={1} value={r.first} disabled={r.style === 'none'} onChange={(e) => update(i, { first: Math.max(1, Number(e.target.value) || 1) })} /></td>
                <td>
                  <select value={r.style} onChange={(e) => update(i, { style: e.target.value as NumStyle })}>
                    {Object.entries(STYLE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td>
                  <select value={r.perPage} onChange={(e) => update(i, { perPage: Number(e.target.value) as 1 | 2 })}>
                    <option value={1}>1</option>
                    <option value={2}>2 (hoja doble)</option>
                  </select>
                </td>
                <td>{sorted.length > 1 && <button className="link subtle" aria-label="Quitar tramo" onClick={() => onChange(sorted.filter((_, k) => k !== i))}>×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="link"
          onClick={() => onChange([...sorted.filter((r) => r.pdfStart !== currentPage), { pdfStart: currentPage, first: 1, style: 'arabic', perPage: 1 }])}
        >
          + Añadir un tramo desde la hoja {currentPage}
        </button>
      </section>

      <section>
        <h3>Muestras</h3>
        <p className="muted">Pulsa una hoja para verla y comparar con el número impreso.</p>
        <ul className="samples">
          {samples.map((p) => (
            <li key={p}>
              <button className={p === currentPage ? 'sample current' : 'sample'} onClick={() => onGoToPage(p)}>
                Hoja {p} → {sheetLabel(sorted, p) ? `p. ${sheetLabel(sorted, p)}` : 'sin número'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {changes.length > 0 && (
        <section>
          <h3>Fichas afectadas</h3>
          <ul className="changes">
            {changes.map(({ ficha, next }) => (
              <li key={ficha.id}>
                {ficha.pageManual ? (
                  <span className="muted">Ficha {ficha.num} <em>{title(ficha)}</em>: p. {ficha.pageLabel} (escrita a mano, no se toca)</span>
                ) : (
                  <label className="check">
                    <input
                      type="checkbox" checked={!skip.has(ficha.id) && !!next} disabled={!next}
                      onChange={(e) => setSkip((s) => { const n = new Set(s); if (e.target.checked) n.delete(ficha.id); else n.add(ficha.id); return n })}
                    />
                    <span>Ficha {ficha.num} <em>{title(ficha)}</em>: p. {ficha.pageLabel || '—'} → <strong>{next ? `p. ${next}` : 'sin número (se deja como está)'}</strong></span>
                  </label>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="form-actions column">
        <button className="primary" onClick={() => void onSave(sorted, true, relabel)} data-testid="pagination-confirm">
          Los números coinciden: confirmar paginación
        </button>
        <button onClick={() => void onSave(sorted, false, relabel)}>Guardar sin verificar</button>
        <button className="link" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
