import type { ReactNode } from 'react'
import type { ProjectInfo } from '../backend'
import { useOpenSettings } from './Settings'

export type Section = 'library' | 'fichero' | 'drafts'

interface Props {
  project: ProjectInfo
  section: Section
  onSection: (s: Section) => void
  onSwitchProject: () => void
  children?: ReactNode
}

export function TopNav({ project, section, onSection, onSwitchProject, children }: Props) {
  const openSettings = useOpenSettings()
  return (
    <header className="topbar">
      <h1>Organon</h1>
      <button className="project-switch" onClick={onSwitchProject} title="Cambiar de proyecto" data-testid="switch-project">
        <strong>{project.name}</strong> ▾
      </button>
      <nav className="sections">
        <button className={section === 'library' ? 'current' : ''} onClick={() => onSection('library')} title="Biblioteca (⌘1)">Biblioteca</button>
        <button className={section === 'fichero' ? 'current' : ''} onClick={() => onSection('fichero')} title="Fichero (⌘2)" data-testid="nav-fichero">Fichero</button>
        <button className={section === 'drafts' ? 'current' : ''} onClick={() => onSection('drafts')} title="Escritura (⌘3)" data-testid="nav-drafts">Escritura</button>
      </nav>
      <div className="spacer" />
      {children}
      <button className="settings-button" onClick={openSettings} title="Ajustes: proyecto y apariencia (⌘,)" aria-label="Ajustes" data-testid="open-settings">⚙︎</button>
    </header>
  )
}
