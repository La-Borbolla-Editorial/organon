import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { appSettings, loadThemes, saveAppSettings, type ThemeEntry } from '../appearance'
import { backend, isNative, type ProjectInfo } from '../backend'
import { LOCALES, STYLES, type CiteOptions, type LocaleId, type StyleId } from '../citations'
import { applyTheme, COLOR_TOKENS, FONT_PRESETS, ORGANON, themeFileName, themeToJson, TYPE_TOKENS, type Theme } from '../theme'

/** Abre la ventana de Ajustes desde cualquier pantalla. */
export const SettingsContext = createContext<() => void>(() => {})
export const useOpenSettings = () => useContext(SettingsContext)

interface Props {
  project: ProjectInfo | null
  cite: CiteOptions
  onCiteChange: (c: CiteOptions) => void
  onClose: () => void
}

type Tab = 'apariencia' | 'proyecto'

const GROUPS = [...new Set(COLOR_TOKENS.map((t) => t.group))]
const HEX = /^#[0-9a-f]{6}$/i
const clone = (t: Theme): Theme => JSON.parse(JSON.stringify(t))

export function Settings({ project, cite, onCiteChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('apariencia')
  const [themes, setThemes] = useState<ThemeEntry[]>([])
  const [broken, setBroken] = useState<string[]>([])
  const [selected, setSelected] = useState(appSettings().tema)
  // Tema en edición (se ve aplicado mientras se edita) y de cuál salió.
  const [draft, setDraft] = useState<{ from: ThemeEntry; theme: Theme } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    const r = await loadThemes()
    setThemes(r.themes)
    setBroken(r.broken)
    return r.themes
  }
  useEffect(() => { void reload() }, [])

  const current = themes.find((t) => t.id === selected) ?? themes[0]

  // Esc cierra; con cambios sin guardar, primero los descarta.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  })

  const choose = async (entry: ThemeEntry) => {
    setDraft(null)
    setConfirmDelete(false)
    setSelected(entry.id)
    applyTheme(entry.theme)
    await saveAppSettings({ tema: entry.id }).catch((e) => setError(`No se pudo guardar el ajuste: ${e}`))
  }

  const edit = (patch: (t: Theme) => void) => {
    if (!draft) return
    const theme = clone(draft.theme)
    patch(theme)
    setDraft({ ...draft, theme })
    applyTheme(theme)
  }

  const discard = () => {
    setDraft(null)
    if (current) applyTheme(current.theme)
  }

  const close = () => {
    if (draft) discard()
    onClose()
  }

  /** Guarda el tema en edición: encima del propio, o como archivo nuevo. */
  const save = async (asNew: boolean) => {
    if (!draft) return
    setError('')
    try {
      const taken = themes.filter((t) => t.file).map((t) => t.file!)
      const file = !asNew && draft.from.file ? draft.from.file : themeFileName(draft.theme.nombre, taken)
      await backend.writeTheme(file, themeToJson(draft.theme))
      const list = await reload()
      const entry = list.find((t) => t.file === file)
      if (entry) await choose(entry)
    } catch (e) {
      setError(`No se pudo guardar el tema: ${e instanceof Error ? e.message : e}`)
    }
  }

  const remove = async () => {
    if (!current?.file) return
    try {
      await backend.deleteTheme(current.file)
      const list = await reload()
      await choose(list[0])
    } catch (e) {
      setError(`No se pudo eliminar el tema: ${e instanceof Error ? e.message : e}`)
    }
  }

  const startEditing = () => {
    if (!current) return
    const theme = clone(current.theme)
    // Un tema incluido no se sobrescribe: lo editado será un tema tuyo.
    if (!current.file) theme.nombre = `${theme.nombre} (mío)`
    setDraft({ from: current, theme })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal settings" role="dialog" aria-label="Ajustes" data-testid="settings">
        <header className="settings-head">
          <h2>Ajustes</h2>
          <div className="panel-tabs">
            <button className={tab === 'apariencia' ? 'current' : ''} onClick={() => setTab('apariencia')}>Apariencia</button>
            <button className={tab === 'proyecto' ? 'current' : ''} onClick={() => setTab('proyecto')} disabled={!project} data-testid="settings-project">Este proyecto</button>
          </div>
          <div className="spacer" />
          <button onClick={close} data-testid="settings-close">Cerrar</button>
        </header>

        {error && <div className="banner error">{error}</div>}

        {tab === 'apariencia' ? (
          <div className="settings-body">
            <p className="muted small">La apariencia es de Organon, no del proyecto: se mantiene al cambiar de proyecto.</p>
            <div className="theme-grid">
              {themes.map((t) => (
                <ThemeCard key={t.id} entry={t} active={t.id === selected} onClick={() => void choose(t)} />
              ))}
            </div>
            {broken.length > 0 && <p className="banner warn">No se pudieron leer estos temas (¿JSON mal formado?): {broken.join(', ')}</p>}

            {!draft ? (
              <div className="page-row">
                <button className="primary" onClick={startEditing} disabled={!current} data-testid="theme-customize">Personalizar «{current?.theme.nombre}»…</button>
                {current?.file && (confirmDelete ? (
                  <>
                    <span className="muted">¿Eliminar el tema «{current.theme.nombre}»? No se puede deshacer.</span>
                    <button className="danger" onClick={() => void remove()}>Eliminar</button>
                    <button onClick={() => setConfirmDelete(false)}>No</button>
                  </>
                ) : <button className="link subtle" onClick={() => setConfirmDelete(true)}>Eliminar este tema</button>)}
                <div className="spacer" />
                {isNative && <button className="link subtle" onClick={() => void backend.revealThemesFolder()} title="Cada tema es un archivo .json: puedes copiarlo, compartirlo o editarlo a mano.">Abrir la carpeta de temas</button>}
              </div>
            ) : (
              <ThemeEditor
                theme={draft.theme} builtin={!draft.from.file} onEdit={edit}
                onSave={() => void save(false)} onSaveAsNew={() => void save(true)} onDiscard={discard}
              />
            )}
          </div>
        ) : (
          <div className="settings-body">
            <p className="muted small">Se guarda en el proyecto ({project?.name}): cada proyecto puede citar con su estilo.</p>
            <label className="field">
              Estilo de cita
              <select value={cite.style} onChange={(e) => onCiteChange({ ...cite, style: e.target.value as StyleId })} data-testid="settings-style">
                {Object.entries(STYLES).map(([id, s]) => <option key={id} value={id}>{s.name}</option>)}
              </select>
            </label>
            <label className="field">
              Idioma de las citas
              <select value={cite.locale} onChange={(e) => onCiteChange({ ...cite, locale: e.target.value as LocaleId })} data-testid="settings-locale">
                {Object.entries(LOCALES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

/** Muestra de un tema: sus colores y tipografías, como una ventanita. */
function ThemeCard({ entry, active, onClick }: { entry: ThemeEntry; active: boolean; onClick: () => void }) {
  const { colores: c, tipografia: f } = entry.theme
  return (
    <button className={`theme-card${active ? ' active' : ''}`} onClick={onClick} data-testid={`theme-${entry.id}`} aria-pressed={active}>
      <div className="theme-sample" style={{ background: c.fondo, borderColor: c.lineas }}>
        <div className="theme-sample-panel" style={{ background: c.papel, color: c.texto, fontFamily: String(f.editor), borderColor: c.lineas }}>
          <span style={{ fontSize: 17 }}>Aa</span>
          <span style={{ background: c.notaFondo, color: c.notaTexto }} className="theme-sample-ref">f. 1</span>
        </div>
        <span className="theme-sample-accent" style={{ background: c.acento }} />
      </div>
      <span className="theme-name">{entry.theme.nombre}</span>
      <span className="muted small">{entry.file ? 'Tuyo' : 'Incluido'}{entry.theme.esquema === 'oscuro' ? ' · oscuro' : ''}</span>
    </button>
  )
}

interface EditorProps {
  theme: Theme
  builtin: boolean
  onEdit: (patch: (t: Theme) => void) => void
  onSave: () => void
  onSaveAsNew: () => void
  onDiscard: () => void
}

function ThemeEditor({ theme, builtin, onEdit, onSave, onSaveAsNew, onDiscard }: EditorProps) {
  const fontOptions = useMemo(() => FONT_PRESETS, [])
  return (
    <div className="theme-editor" data-testid="theme-editor">
      <div className="page-row">
        <label className="field grow">
          Nombre
          <input value={theme.nombre} onChange={(e) => onEdit((t) => { t.nombre = e.target.value })} data-testid="theme-name" />
        </label>
        <label className="field">
          Esquema
          <select value={theme.esquema} onChange={(e) => onEdit((t) => { t.esquema = e.target.value as Theme['esquema'] })}>
            <option value="claro">Claro</option>
            <option value="oscuro">Oscuro</option>
          </select>
        </label>
      </div>
      <p className="muted small">Los cambios se ven al momento en toda la ventana. {builtin ? 'Se guardarán como un tema tuyo; el incluido no cambia.' : ''}</p>

      <h3>Tipografía</h3>
      <div className="token-grid">
        {TYPE_TOKENS.map((t) => (
          <label key={t.key} className="token">
            <span>{t.label}</span>
            {t.kind === 'size' ? (
              <span className="page-row">
                <input type="number" min={9} max={32} value={Number(theme.tipografia[t.key])} onChange={(e) => onEdit((th) => { th.tipografia[t.key] = Math.max(9, Math.min(32, Number(e.target.value) || 14)) })} />
                <span className="muted small">px</span>
              </span>
            ) : (
              <span className="font-pick">
                <select
                  value={fontOptions.find((o) => o.value === theme.tipografia[t.key])?.value ?? ''}
                  onChange={(e) => e.target.value && onEdit((th) => { th.tipografia[t.key] = e.target.value })}
                >
                  <option value="">Otra…</option>
                  {fontOptions.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  value={String(theme.tipografia[t.key])} title="Cualquier tipografía instalada, como en CSS: 'Nombre', respaldo"
                  onChange={(e) => onEdit((th) => { th.tipografia[t.key] = e.target.value })} style={{ fontFamily: String(theme.tipografia[t.key]) }}
                />
              </span>
            )}
          </label>
        ))}
      </div>

      {GROUPS.map((g) => (
        <section key={g}>
          <h3>{g}</h3>
          <div className="token-grid">
            {COLOR_TOKENS.filter((t) => t.group === g).map((t) => {
              const value = theme.colores[t.key] ?? ORGANON.colores[t.key]
              return (
                <label key={t.key} className="token">
                  <span>{t.label}</span>
                  <span className="color-pick">
                    {HEX.test(value)
                      ? <input type="color" value={value} onChange={(e) => onEdit((th) => { th.colores[t.key] = e.target.value })} aria-label={t.label} />
                      : <span className="color-swatch" style={{ background: value }} />}
                    <input value={value} onChange={(e) => onEdit((th) => { th.colores[t.key] = e.target.value })} spellCheck={false} />
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      ))}

      <div className="page-row theme-editor-actions">
        <button className="primary" onClick={onSave} disabled={!theme.nombre.trim()} data-testid="theme-save">{builtin ? 'Guardar como tema mío' : 'Guardar'}</button>
        {!builtin && <button onClick={onSaveAsNew} disabled={!theme.nombre.trim()}>Guardar como tema nuevo</button>}
        <button onClick={onDiscard} data-testid="theme-discard">Descartar cambios</button>
      </div>
    </div>
  )
}
