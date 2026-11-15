import { useOpenSettings } from './Settings'
import { useEffect, useState } from 'react'
import { backend, isNative, type ProjectInfo } from '../backend'

interface Props {
  error: string | null
  onOpen: (path: string) => void
}

export function ProjectPicker({ error, onOpen }: Props) {
  const openSettings = useOpenSettings()
  const [recents, setRecents] = useState<ProjectInfo[]>([])
  const [path, setPath] = useState('')

  const reload = () => void backend.recentProjects().then(setRecents)
  useEffect(reload, [])

  const pick = async () => {
    const folder = await backend.pickFolder()
    if (folder) onOpen(folder)
  }

  return (
    <div className="picker">
      <button className="settings-button picker-settings" onClick={openSettings} title="Ajustes: apariencia" aria-label="Ajustes" data-testid="open-settings">⚙︎</button>
      <div className="picker-card">
        <h1>Organon</h1>
        <p className="muted">
          Un proyecto es una carpeta tuya (la de la tesis, la de un trabajo final…). Organon guarda dentro sus fuentes, PDF y fichas, en archivos
          legibles.
        </p>

        {error && <div className="banner error">{error}</div>}

        {isNative ? (
          <button className="primary" onClick={() => void pick()}>Abrir o crear un proyecto en una carpeta…</button>
        ) : (
          <form className="picker-path" onSubmit={(e) => { e.preventDefault(); if (path.trim()) onOpen(path.trim()) }}>
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/ruta/absoluta/a/la/carpeta" data-testid="project-path" />
            <button className="primary" type="submit" data-testid="project-open">Abrir</button>
          </form>
        )}

        {recents.length > 0 && (
          <>
            <h2>Proyectos recientes</h2>
            <ul className="recents">
              {recents.map((p) => (
                <li key={p.path}>
                  <button className="recent" disabled={!p.exists} onClick={() => onOpen(p.path)}>
                    <strong>{p.name}</strong>
                    <span>{p.exists ? p.path : `${p.path} — no se encuentra la carpeta`}</span>
                  </button>
                  <button className="link subtle" title="Quita el proyecto de esta lista. No borra nada de la carpeta." onClick={async () => { await backend.forgetProject(p.path); reload() }}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
