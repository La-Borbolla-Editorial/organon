import { useCallback, useEffect, useState } from 'react'
import { backend, type ProjectInfo } from './backend'
import { DEFAULT_LOCALE, DEFAULT_STYLE, LOCALES, STYLES, type CiteOptions, type LocaleId, type StyleId } from './citations'
import { DraftsView } from './components/DraftsView'
import { FicheroView } from './components/FicheroView'
import { Library } from './components/Library'
import { ProjectPicker } from './components/ProjectPicker'
import { Reader } from './components/Reader'
import { Settings, SettingsContext } from './components/Settings'
import { changedOnDisk, getSettings, loadProject, setConflictHandler, setSettings, unloadProject } from './store'

type View =
  | { name: 'library' }
  | { name: 'fichero'; focusFichaId?: string }
  | { name: 'drafts' }
  | { name: 'reader'; sourceId: string; from: 'library' | 'fichero'; focusFichaId?: string; linkFichaId?: string }

function viewFromHash(): View {
  const m = /^#\/fuente\/([\w-]+)$/.exec(location.hash)
  if (m) return { name: 'reader', sourceId: m[1], from: 'library' }
  return location.hash === '#/fichero' ? { name: 'fichero' } : location.hash === '#/escritura' ? { name: 'drafts' } : { name: 'library' }
}

export function App() {
  const [ready, setReady] = useState(false)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setViewState] = useState<View>(viewFromHash)
  const [cite, setCite] = useState<CiteOptions>({ style: DEFAULT_STYLE, locale: DEFAULT_LOCALE })
  // Los archivos del proyecto cambiaron fuera de Organon: 'changed' al volver a la ventana, 'conflict' si se rechazó un guardado.
  const [stale, setStale] = useState<'changed' | 'conflict' | null>(null)
  const [epoch, setEpoch] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => setSettingsOpen(true), [])

  // La vista se refleja en la dirección para que sobreviva a una recarga.
  const setView = useCallback((v: View) => {
    history.replaceState(null, '', v.name === 'reader' ? `#/fuente/${v.sourceId}` : v.name === 'fichero' ? '#/fichero' : v.name === 'drafts' ? '#/escritura' : '#/')
    setViewState(v)
  }, [])

  /** Carga los datos del proyecto que el núcleo ya tiene abierto. */
  const enter = useCallback(async (info: ProjectInfo) => {
    await loadProject()
    const s = await getSettings()
    setCite({
      style: s.style in STYLES ? (s.style as StyleId) : DEFAULT_STYLE,
      locale: s.locale in LOCALES ? (s.locale as LocaleId) : DEFAULT_LOCALE,
    })
    setProject(info)
  }, [])

  const openProject = useCallback(async (path: string) => {
    setError(null)
    setStale(null)
    try {
      setView({ name: 'library' })
      await enter(await backend.openProject(path))
    } catch (e) {
      await backend.closeProject().catch(() => {})
      setError(`No se pudo abrir el proyecto: ${e instanceof Error ? e.message : e}`)
    }
  }, [enter, setView])

  const closeProject = useCallback(async () => {
    await backend.closeProject()
    unloadProject()
    setStale(null)
    setProject(null)
    setView({ name: 'library' })
  }, [setView])

  // Al arrancar: el proyecto que siga abierto (recarga) o, si no, el último usado.
  useEffect(() => {
    ;(async () => {
      const current = await backend.currentProject()
      if (current) await enter(current)
      else {
        setView({ name: 'library' })
        const last = (await backend.recentProjects())[0]
        if (last?.exists) await enter(await backend.openProject(last.path))
      }
    })()
      .catch((e) => {
        void backend.closeProject().catch(() => {})
        setError(`No se pudo abrir el último proyecto: ${e instanceof Error ? e.message : e}`)
      })
      .finally(() => setReady(true))
  }, [enter, setView])

  useEffect(() => {
    setConflictHandler(() => setStale('conflict'))
    const check = () => {
      if (document.visibilityState === 'visible') void changedOnDisk().then((changed) => changed && setStale((s) => s ?? 'changed')).catch(() => {})
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  // Atajos (⌘ en macOS, Ctrl en Windows): ⌘, abre los Ajustes; ⌘⇧1/2/3, Biblioteca, Fichero y Escritura.
  // Se mira `code` y no `key`, porque con ⇧ el «1» es «!» (y en otros teclados, otra cosa).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      if (e.key === ',' && !e.shiftKey) {
        setSettingsOpen(true)
      } else if (e.shiftKey && project && !settingsOpen) {
        const name = ({ Digit1: 'library', Digit2: 'fichero', Digit3: 'drafts' } as const)[e.code as 'Digit1']
        if (!name) return
        setView({ name })
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, settingsOpen, setView])

  const reloadProject = useCallback(async () => {
    if (!project) return
    try {
      await enter(project)
      setStale(null)
      setEpoch((n) => n + 1) // vuelve a montar las vistas con los datos recién leídos
    } catch (e) {
      setError(`No se pudo recargar el proyecto: ${e instanceof Error ? e.message : e}`)
      await closeProject()
    }
  }, [project, enter, closeProject])

  const changeCite = useCallback((next: CiteOptions) => {
    setCite(next)
    void setSettings({ style: next.style, locale: next.locale })
  }, [])

  if (!ready) return null
  const settings = settingsOpen && <Settings project={project} cite={cite} onCiteChange={changeCite} onClose={() => setSettingsOpen(false)} />
  if (!project) {
    return (
      <SettingsContext.Provider value={openSettings}>
        <ProjectPicker error={error} onOpen={(path) => void openProject(path)} />
        {settings}
      </SettingsContext.Provider>
    )
  }
  let content
  if (view.name === 'reader') {
    content = (
      <Reader
        key={`${epoch}:${view.sourceId}:${view.linkFichaId ?? view.focusFichaId ?? ''}`} sourceId={view.sourceId} cite={cite}
        focusFichaId={view.focusFichaId} linkFichaId={view.linkFichaId}
        backLabel={view.from === 'fichero' ? 'Fichero' : 'Biblioteca'} onBack={() => setView({ name: view.from })}
      />
    )
  } else if (view.name === 'fichero') {
    content = (
      <FicheroView
        key={`${project.path}:${epoch}:${view.focusFichaId ?? ''}`} project={project} cite={cite} onSection={(name) => setView({ name })} onSwitchProject={() => void closeProject()}
        focusFichaId={view.focusFichaId}
        onOpenPdf={(sourceId, ficha) => setView({ name: 'reader', sourceId, from: 'fichero', ...ficha })}
      />
    )
  } else if (view.name === 'drafts') {
    content = (
      <DraftsView
        key={`${project.path}:${epoch}`} project={project} cite={cite} onSection={(name) => setView({ name })} onSwitchProject={() => void closeProject()}
        onOpenFicha={(id) => setView({ name: 'fichero', focusFichaId: id })}
      />
    )
  } else {
    content = (
      <Library
        key={`${project.path}:${epoch}`} project={project} cite={cite} onSection={(name) => setView({ name })}
        onOpen={(sourceId) => setView({ name: 'reader', sourceId, from: 'library' })} onSwitchProject={() => void closeProject()}
      />
    )
  }
  return (
    <SettingsContext.Provider value={openSettings}>
      {stale && (
        <div className="stale-bar" role="alert">
          <span>
            {stale === 'conflict'
              ? 'Los archivos del proyecto cambiaron fuera de Organon y tu último cambio no se ha guardado.'
              : 'Los archivos del proyecto cambiaron fuera de Organon (una sincronización o una edición a mano).'}{' '}
            Recarga para ver la versión del disco; hasta entonces no se puede guardar.
          </span>
          <button className="primary" onClick={() => void reloadProject()} data-testid="reload-project">Recargar el proyecto</button>
        </div>
      )}
      {content}
      {settings}
    </SettingsContext.Provider>
  )
}
