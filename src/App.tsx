import { useCallback, useEffect, useState } from 'react'
import { backend, type ProjectInfo } from './backend'
import { DEFAULT_LOCALE, DEFAULT_STYLE, LOCALES, STYLES, type CiteOptions, type LocaleId, type StyleId } from './citations'
import { FicheroView } from './components/FicheroView'
import { Library } from './components/Library'
import { ProjectPicker } from './components/ProjectPicker'
import { Reader } from './components/Reader'
import { getSettings, loadProject, setSettings, unloadProject } from './store'

type View =
  | { name: 'library' }
  | { name: 'fichero' }
  | { name: 'reader'; sourceId: string; from: 'library' | 'fichero'; focusFichaId?: string; linkFichaId?: string }

function viewFromHash(): View {
  const m = /^#\/fuente\/([\w-]+)$/.exec(location.hash)
  if (m) return { name: 'reader', sourceId: m[1], from: 'library' }
  return location.hash === '#/fichero' ? { name: 'fichero' } : { name: 'library' }
}

export function App() {
  const [ready, setReady] = useState(false)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setViewState] = useState<View>(viewFromHash)
  const [cite, setCite] = useState<CiteOptions>({ style: DEFAULT_STYLE, locale: DEFAULT_LOCALE })

  // La vista se refleja en la dirección para que sobreviva a una recarga.
  const setView = useCallback((v: View) => {
    history.replaceState(null, '', v.name === 'reader' ? `#/fuente/${v.sourceId}` : v.name === 'fichero' ? '#/fichero' : '#/')
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

  const changeCite = useCallback((next: CiteOptions) => {
    setCite(next)
    void setSettings({ style: next.style, locale: next.locale })
  }, [])

  if (!ready) return null
  if (!project) return <ProjectPicker error={error} onOpen={(path) => void openProject(path)} />
  if (view.name === 'reader') {
    return (
      <Reader
        key={`${view.sourceId}:${view.linkFichaId ?? view.focusFichaId ?? ''}`} sourceId={view.sourceId} cite={cite}
        focusFichaId={view.focusFichaId} linkFichaId={view.linkFichaId}
        backLabel={view.from === 'fichero' ? 'Fichero' : 'Biblioteca'} onBack={() => setView({ name: view.from })}
      />
    )
  }
  if (view.name === 'fichero') {
    return (
      <FicheroView
        key={project.path} project={project} cite={cite} onSection={(name) => setView({ name })} onSwitchProject={() => void closeProject()}
        onOpenPdf={(sourceId, ficha) => setView({ name: 'reader', sourceId, from: 'fichero', ...ficha })}
      />
    )
  }
  return (
    <Library
      key={project.path} project={project} cite={cite} onCiteChange={changeCite} onSection={(name) => setView({ name })}
      onOpen={(sourceId) => setView({ name: 'reader', sourceId, from: 'library' })} onSwitchProject={() => void closeProject()}
    />
  )
}
