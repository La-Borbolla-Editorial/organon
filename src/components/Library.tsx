import { useEffect, useRef, useState } from 'react'
import type { ProjectInfo } from '../backend'
import { authorsLabel, formatBibliographyEntry, LOCALES, parseZoteroExport, STYLES, yearLabel, type CiteOptions, type LocaleId, type StyleId } from '../citations'
import { countFichasBySource, linkOrphanFichas, listSources, upsertSources } from '../store'
import { SourceForm } from './SourceForm'
import { TopNav, type Section } from './TopNav'
import type { Source } from '../types'

interface Props {
  project: ProjectInfo
  onSwitchProject: () => void
  onSection: (s: Section) => void
  cite: CiteOptions
  onCiteChange: (c: CiteOptions) => void
  onOpen: (sourceId: string) => void
}

export function Library({ project, onSwitchProject, onSection, cite, onCiteChange, onOpen }: Props) {
  const [sources, setSources] = useState<Source[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ source?: Source } | null>(null)
  const zoteroInput = useRef<HTMLInputElement>(null)

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
                    {s.pdfFile && <button className="primary" onClick={() => onOpen(s.id)}>Abrir</button>}
                    <button onClick={() => setForm({ source: s })} data-testid={`edit-${s.citekey}`}>Editar</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      {form && (
        <SourceForm
          source={form.source} sources={sources} cite={cite} onCancel={() => setForm(null)}
          fichaCount={form.source ? (counts[form.source.id] ?? 0) : 0}
          onDone={async (id, result) => {
            // Con un PDF recién adjuntado se abre el lector, que pide verificar la paginación.
            if (result === 'pdf') return onOpen(id)
            const linked = result === 'added' ? await linkOrphanFichas() : 0
            const text = { added: `Fuente añadida.${linked ? ` ${linked} ficha(s) importada(s) quedaron vinculadas a ella.` : ''}`, updated: 'Fuente actualizada.', deleted: 'Fuente eliminada.' }[result]
            setMessage({ kind: 'ok', text })
            setForm(null)
            await reload()
          }}
        />
      )}
      <footer className="library-footer">Proyecto en <code>{project.path}</code>: <code>fuentes.json</code>, <code>fichas.json</code> y la carpeta <code>pdfs/</code>.</footer>
    </div>
  )
}
