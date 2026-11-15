import { useMemo, useState } from 'react'
import { authorsLabel, formatCitation, yearLabel, type CiteOptions } from '../citations'
import { canonicalRef } from '../draft'
import { citedPages } from '../pagination'
import type { FichaDraft } from '../store'
import type { Fichero, Source } from '../types'

interface Props {
  draft: FichaDraft
  /** Número visible si la ficha ya existe. */
  num: number | null
  sources: Source[]
  ficheros: Fichero[]
  /** En el lector la fuente es la del PDF abierto y no se puede cambiar. */
  lockSource?: boolean
  cite: CiteOptions
  knownTags: string[]
  onSave: (d: FichaDraft) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  onVerifyPagination?: () => void
  /** Abrir el PDF: en el pasaje de la ficha o, si aún no tiene, para marcarlo. */
  onOpenPdf?: (d: FichaDraft) => void
}

export function FichaForm({ draft, num, sources, ficheros, lockSource, cite, knownTags, onSave, onCancel, onDelete, onVerifyPagination, onOpenPdf }: Props) {
  const [d, setD] = useState(draft)
  const [tagText, setTagText] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (patch: Partial<FichaDraft>) => setD((prev) => ({ ...prev, ...patch }))

  const source = sources.find((s) => s.id === d.sourceId) ?? null
  // La página que da la paginación actual de la fuente para este punto del PDF.
  const computed = d.anchor && source ? citedPages(source.pagination, d.anchor.start, d.anchor.end) : ''
  // En una obra canónica, la cita es la referencia canónica de la ficha (si la tiene).
  const canonical = canonicalRef(source, d)
  const citation = useMemo(() => (source ? formatCitation(source.csl, d.pageLabel, cite, canonical) : ''), [source, d.pageLabel, cite, canonical])
  const pdfPages = d.anchor ? (d.anchor.start.page === d.anchor.end.page ? `hoja ${d.anchor.start.page} del PDF` : `hojas ${d.anchor.start.page}–${d.anchor.end.page} del PDF`) : 'sin posición en el PDF'
  const unverified = !!source && !!d.anchor && !source.paginationVerified && !d.pageManual
  const missingPage = !d.pageLabel.trim() && !!source

  const addTags = (text: string) => {
    const next = text.split(',').map((t) => t.trim()).filter(Boolean)
    if (next.length) set({ tags: [...d.tags, ...next.filter((t) => !d.tags.includes(t))] })
    setTagText('')
  }

  const submit = async () => {
    setSaving(true)
    const pending = tagText.split(',').map((t) => t.trim()).filter((t) => t && !d.tags.includes(t))
    try {
      await onSave({ ...d, tags: [...d.tags, ...pending], pageLabel: d.pageLabel.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="ficha-form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
      <h2>{num ? `Ficha ${num}` : 'Nueva ficha'}</h2>

      <label>
        Nota permanente
        <input autoFocus value={d.notaPermanente} onChange={(e) => set({ notaPermanente: e.target.value })} placeholder="La idea, con tus palabras" data-testid="nota-permanente" />
      </label>

      <label>
        Cita
        <textarea className="quote" rows={7} value={d.cita} onChange={(e) => set({ cita: e.target.value })} />
      </label>

      {!lockSource && (
        <label>
          Fuente
          <select value={d.sourceId ?? ''} onChange={(e) => set({ sourceId: e.target.value || null, anchor: e.target.value === (draft.sourceId ?? '') ? draft.anchor : null })} data-testid="ficha-source">
            <option value="">— Sin fuente —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{[authorsLabel(s.csl), yearLabel(s.csl)].filter(Boolean).join(' ')} · {String(s.csl.title ?? s.citekey)}</option>
            ))}
          </select>
        </label>
      )}

      <fieldset className={`page-box ${missingPage ? 'bad' : unverified ? 'warn' : ''}`}>
        <legend>Página que se citará</legend>
        <div className="page-row">
          <span className="page-prefix">p.</span>
          <input
            className="page-input" value={d.pageLabel} data-testid="page-label"
            onChange={(e) => set({ pageLabel: e.target.value, pageManual: e.target.value.trim() !== computed })}
          />
          <span className="muted">
            {pdfPages}
            {d.pageManual && d.anchor ? ' · escrita a mano' : ''}
          </span>
        </div>
        {d.pageManual && computed && computed !== d.pageLabel.trim() && (
          <button type="button" className="link" onClick={() => set({ pageLabel: computed, pageManual: false })}>
            Según la paginación sería p. {computed}: usar esa
          </button>
        )}
        {missingPage ? (
          <p className="page-warning">
            {d.anchor ? 'Esta hoja no tiene número según la paginación de la fuente. Escribe la página impresa a mano o corrige la paginación.' : 'Falta la página: sin ella la cita queda incompleta.'}
          </p>
        ) : unverified ? (
          <p className="page-warning">
            La paginación de esta fuente no está verificada. Comprueba que <strong>{d.pageLabel}</strong> es el número impreso en la página.{' '}
            {onVerifyPagination && <button type="button" className="link" onClick={onVerifyPagination}>Verificar paginación</button>}
          </p>
        ) : null}
        {source ? (
          <div className="citation-preview" dangerouslySetInnerHTML={{ __html: citation }} data-testid="citation-preview" />
        ) : (
          <p className="muted">Sin fuente vinculada: no se puede componer la cita.</p>
        )}
        {onOpenPdf && source?.pdfFile && (
          <button type="button" className="link" onClick={() => onOpenPdf(d)} data-testid="open-pdf">
            {d.anchor ? 'Ver el pasaje en el PDF' : 'Marcar el pasaje en el PDF…'}
          </button>
        )}
      </fieldset>

      <label>
        Tags
        <div className="tag-editor">
          {d.tags.map((t) => (
            <span key={t} className="tag">
              {t}
              <button type="button" aria-label={`Quitar ${t}`} onClick={() => set({ tags: d.tags.filter((x) => x !== t) })}>×</button>
            </span>
          ))}
          <input
            list="known-tags" value={tagText} placeholder={d.tags.length ? '' : 'Separa con comas o Intro'} data-testid="tags"
            onChange={(e) => (e.target.value.includes(',') ? addTags(e.target.value) : setTagText(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagText.trim()) { e.preventDefault(); addTags(tagText) }
              if (e.key === 'Backspace' && !tagText && d.tags.length) set({ tags: d.tags.slice(0, -1) })
            }}
            onBlur={() => addTags(tagText)}
          />
          <datalist id="known-tags">
            {knownTags.filter((t) => !d.tags.includes(t)).map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
      </label>

      <label>
        <span>Obra canónica / referencias {source?.canonical ? <span className="muted">(obra canónica: la primera línea es lo que se cita)</span> : <span className="muted">(opcional)</span>}</span>
        <textarea rows={2} value={d.referencia} onChange={(e) => set({ referencia: e.target.value })} placeholder="Ordinatio II, d. 3, p. 1, q. 2, n. 48" />
      </label>

      <label>
        Notas
        <textarea rows={4} value={d.notas} onChange={(e) => set({ notas: e.target.value })} />
      </label>

      {Object.keys(d.extra).length > 0 && (
        <details className="extra-columns">
          <summary>Otras columnas de la hoja</summary>
          {Object.entries(d.extra).map(([k, v]) => (
            <label key={k}>
              {k}
              <input value={v} onChange={(e) => set({ extra: { ...d.extra, [k]: e.target.value } })} />
            </label>
          ))}
        </details>
      )}

      {ficheros.length > 1 && (
        <label>
          Fichero
          <select value={d.ficheroId} onChange={(e) => set({ ficheroId: e.target.value })}>
            {ficheros.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      )}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving} data-testid="save-ficha">Guardar ficha</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
        <div className="spacer" />
        {onDelete && (confirmDelete ? (
          <>
            <button type="button" className="danger" onClick={() => void onDelete()}>Sí, eliminar</button>
            <button type="button" onClick={() => setConfirmDelete(false)}>No</button>
          </>
        ) : (
          <button type="button" className="link subtle" onClick={() => setConfirmDelete(true)}>Eliminar</button>
        ))}
      </div>
    </form>
  )
}
