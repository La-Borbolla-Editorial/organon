import type { ReactNode } from 'react'
import type { ProjectInfo } from '../backend'

export type Section = 'library' | 'fichero'

interface Props {
  project: ProjectInfo
  section: Section
  onSection: (s: Section) => void
  onSwitchProject: () => void
  children?: ReactNode
}

export function TopNav({ project, section, onSection, onSwitchProject, children }: Props) {
  return (
    <header className="topbar">
      <h1>Organon</h1>
      <button className="project-switch" onClick={onSwitchProject} title="Cambiar de proyecto" data-testid="switch-project">
        <strong>{project.name}</strong> ▾
      </button>
      <nav className="sections">
        <button className={section === 'library' ? 'current' : ''} onClick={() => onSection('library')}>Biblioteca</button>
        <button className={section === 'fichero' ? 'current' : ''} onClick={() => onSection('fichero')} data-testid="nav-fichero">Fichero</button>
      </nav>
      <div className="spacer" />
      {children}
    </header>
  )
}
