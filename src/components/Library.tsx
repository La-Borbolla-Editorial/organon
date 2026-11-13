import { useEffect, useRef, useState } from 'react'
import { backend, type ProjectInfo } from '../backend'
import { authorsLabel, firstPageFromCsl, formatBibliographyEntry, LOCALES, parseZoteroExport, STYLES, yearLabel, type CiteOptions, type LocaleId, type StyleId } from '../citations'
import { countFichasBySource, deleteSource, linkOrphanFichas, listSources, setSourcePdf, upsertSources } from '../store'
import { SourceForm } from './SourceForm'
import { TopNav, type Section } from './TopNav'
import { guessPagination } from '../pdf/guess'
import { openPdf } from '../pdf/pdfjs'
import type { Source } from '../types'

interface Props {
  project: ProjectInfo
  onSwitchProject: () => void
  onSection: (s: Section) => void
  cite: CiteOptions
  onCiteChange: (c: CiteOptions) => void
  onOpen: (sourceId: string) => void
}

const slug = (s: string) => s.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() || 'fuente'

export function Library({ project, onSwitchProject, onSection, cite, onCiteChange, onOpen }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ source?: Source } | null>(null)
  const zoteroInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const pdfTarget = useRef<Source | null>(null)

  const reload = async () => {
    setSources(await listSources())
    setCounts(await countFichasBySource())
  }
  useEffect(() => {
    void reload()
  }, [])

  const importZotero = async (file: File) => {
    try {
      const items = await parseZoteroExport(await file.text())
      if (!items.length) throw new Error('El archivo no contiene referencias.')
      const { added, updated } = await upsertSources(items)
      const linked = await linkOrphanFichas()
      setMessage({ kind: 'ok', text: `${added} fuente(s) nueva(s), ${updated} actualizada(s).${linked ? ` ${linked} ficha(s) importada(s) quedaron vinculadas a su fuente.` : ''}` })
      await reload()
    } catch (e) {
      setMessage({ kind: 'error', text: `No se pudo importar «${file.name}»: ${e instanceof Error ? e.message : e}` })
    }
  }

  const attachPdf = async (source: Source, file: File) => {
    setBusy(source.id)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const doc = await openPdf(bytes.slice()) // PDF.js se queda con el búfer: se le da una copia
      const guess = await guessPagination(doc, firstPageFromCsl(source.csl))
      const pages = doc.numPages
      await doc.loadingTask.destroy()
      const name = source.pdfFile ?? `${slug(source.citekey)}-${source.id.slice(0, 8)}.pdf`
      await backend.savePdf(name, bytes)
      await setSourcePdf(source.id, name, pages, guess.ranges, guess.note)
      onOpen(source.id)
    } catch (e) {
      setMessage({ kind: 'error', text: `No se pudo adjuntar «${file.name}»: ${e instanceof Error ? e.message : e}` })
      setBusy(null)
    }
  }

  const q = query.trim().toLowerCase()
  const shown = q ? sources.filter((s) => `${authorsLabel(s.csl)} ${s.csl.title ?? ''} ${yearLabel(s.csl)} ${s.citekey}`.toLowerCase().includes(q)) : sources

  return (
    <div className="library">
      <TopNav project={project} section="library" onSection={onSection} onSwitchProject={onSwitchProject}>
        <label className="inline-field">
          Estilo
          <select value={cite.style} onChange={(e) => onCiteChange({ ...cite, style: e.target.value as StyleId })}>
            {Object.entries(STYLES).map(([id, s]) => (
              <option key={id} value={id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          Idioma de las citas
          <select value={cite.locale} onChange={(e) => onCiteChange({ ...cite, locale: e.target.value as LocaleId })}>
            {Object.entries(LOCALES).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <button onClick={() => zoteroInput.current?.click()}>Importar de Zotero…</button>
        <button className="primary" onClick={() => setForm({})} data-testid="add-source">+ Añadir fuente</button>
      </TopNav>

      <input
        ref={zoteroInput} type="file" accept=".bib,.bibtex,.json,.txt" hidden data-testid="zotero-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void importZotero(f)
        }}
      />
      <input
        ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden data-testid="pdf-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f && pdfTarget.current) void attachPdf(pdfTarget.current, f)
        }}
      />

      <main className="library-main">
        {message && (
          <div className={`banner ${message.kind}`}>
            {message.text}
            <button className="link" onClick={() => setMessage(null)}>Cerrar</button>
          </div>
        )}

        {sources.length === 0 ? (
          <div className="empty">
            <h2>Tu biblioteca está vacía</h2>
            <p>Añade una fuente a mano, o deja que Organon la rellene a partir de su DOI o su ISBN.</p>
            <button className="primary" onClick={() => setForm({})}>+ Añadir fuente</button>
            <p>
              Si usas Zotero, selecciona allí las referencias y elige <em>Archivo → Exportar elementos…</em> con formato <strong>BibTeX</strong>,{' '}
              <strong>BibLaTeX</strong> o <strong>CSL JSON</strong>. Después importa aquí ese archivo.
            </p>
            <button onClick={() => zoteroInput.current?.click()}>Importar de Zotero…</button>
          </div>
        ) : (
          <>
            <input className="search" placeholder="Buscar por autor, título o clave…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="source-list">
              {shown.map((s) => (
                <li key={s.id} className="source-row">
                  <div className="source-info">
                    <div className="source-bib" dangerouslySetInnerHTML={{ __html: formatBibliographyEntry(s.csl, cite) }} />
                    <div className="source-meta">
                      <code>{s.citekey}</code>
                      {s.pdfFile ? (
                        <>
                          <span>{s.pdfPages} hojas</span>
                          <span className={s.paginationVerified ? 'badge ok' : 'badge warn'}>
                            {s.paginationVerified ? 'Paginación verificada' : 'Paginación sin verificar'}
                          </span>
                        </>
                      ) : (
                        <span className="badge muted">Sin PDF</span>
                      )}
                      {counts[s.id] ? <span>{counts[s.id]} ficha(s)</span> : null}
                    </div>
                  </div>
                  <div className="source-actions">
                    {busy === s.id ? (
                      <span className="muted">Analizando el PDF…</span>
                    ) : confirmDelete === s.id ? (
                      <>
                        <span className="muted">¿Eliminar la fuente?{counts[s.id] ? ' Sus fichas se conservan sin fuente.' : ''}</span>
                        <button className="danger" onClick={async () => { await deleteSource(s.id); setConfirmDelete(null); await reload() }}>Eliminar</button>
                        <button onClick={() => setConfirmDelete(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        {s.pdfFile && <button className="primary" onClick={() => onOpen(s.id)}>Abrir</button>}
                        <button onClick={() => { pdfTarget.current = s; pdfInput.current?.click() }} data-testid={`attach-${s.citekey}`}>
                          {s.pdfFile ? 'Cambiar PDF…' : 'Adjuntar PDF…'}
                        </button>
                        <button className="link subtle" onClick={() => setForm({ source: s })} data-testid={`edit-${s.citekey}`}>Editar</button>
                        <button className="link subtle" onClick={() => setConfirmDelete(s.id)}>Eliminar</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      {form && (
        <SourceForm
          source={form.source} cite={cite} onCancel={() => setForm(null)}
          onDone={async () => {
            const linked = form.source ? 0 : await linkOrphanFichas()
            setMessage({ kind: 'ok', text: form.source ? 'Fuente actualizada.' : `Fuente añadida.${linked ? ` ${linked} ficha(s) importada(s) quedaron vinculadas a ella.` : ''}` })
            setForm(null)
            await reload()
          }}
        />
      )}
      <footer className="library-footer">Proyecto en <code>{project.path}</code>: <code>fuentes.json</code>, <code>fichas.json</code> y la carpeta <code>pdfs/</code>.</footer>
    </div>
  )
}
