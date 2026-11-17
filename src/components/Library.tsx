import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectInfo } from '../backend'
import { authorsLabel, formatBibliographyEntry, parseZoteroExport, yearLabel, type CiteOptions } from '../citations'
import { countFichasBySource, linkOrphanFichas, listSources, upsertSources } from '../store'
import { SourceForm } from './SourceForm'
import { TopNav, type Section } from './TopNav'
import { useGrowing } from '../useGrowing'
import type { Source } from '../types'

interface Props {
  project: ProjectInfo
  onSwitchProject: () => void
  onSection: (s: Section) => void
  cite: CiteOptions
  onOpen: (sourceId: string) => void
}

export function Library({ project, onSwitchProject, onSection, cite, onOpen }: Props) {
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
  const haystack = useMemo(() => new Map(sources.map((s) => [s.id, `${authorsLabel(s.csl)} ${s.csl.title ?? ''} ${yearLabel(s.csl)} ${s.citekey}`.toLowerCase()])), [sources])
  const shown = useMemo(() => (q ? sources.filter((s) => haystack.get(s.id)!.includes(q)) : sources), [sources, haystack, q])
  const { limit, sentinel } = useGrowing(shown.length, q, 40)
  // Mientras no se hace nada, se van formateando las entradas que aún no se ven: al bajar ya están listas.
  useEffect(() => {
    let i = 0
    let timer = 0
    const step = () => {
      const until = performance.now() + 8
      while (i < sources.length && performance.now() < until) formatBibliographyEntry(sources[i++].csl, cite)
      if (i < sources.length) timer = window.setTimeout(step, 30)
    }
    timer = window.setTimeout(step, 300)
    return () => clearTimeout(timer)
  }, [sources, cite])
  const editSource = useCallback((source: Source) => setForm({ source }), [])

  return (
    <div className="library">
      <TopNav project={project} section="library" onSection={onSection} onSwitchProject={onSwitchProject}>
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
              {shown.slice(0, limit).map((s) => (
                <SourceRow key={s.id} source={s} cite={cite} count={counts[s.id] ?? 0} onOpen={onOpen} onEdit={editSource} />
              ))}
            </ul>
            {limit < shown.length && <div ref={sentinel} className="list-more muted small">…</div>}
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

interface RowProps {
  source: Source
  cite: CiteOptions
  count: number
  onOpen: (sourceId: string) => void
  onEdit: (source: Source) => void
}

// Una fila solo se vuelve a pintar si cambia su fuente o su número de fichas.
const SourceRow = memo(function SourceRow({ source: s, cite, count, onOpen, onEdit }: RowProps) {
  return (
    <li className="source-row">
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
          {s.canonical && <span className="badge" title="Sus fichas se citan por su referencia canónica, no por la página.">Obra canónica</span>}
          {count ? <span>{count} ficha(s)</span> : null}
        </div>
      </div>
      <div className="source-actions">
        {s.pdfFile && <button className="primary" onClick={() => onOpen(s.id)}>Abrir</button>}
        <button onClick={() => onEdit(s)} data-testid={`edit-${s.citekey}`}>Editar</button>
      </div>
    </li>
  )
})
