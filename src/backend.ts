// Puente con el núcleo nativo (Tauri). En el navegador (`npm run dev`) usa el
// sustituto de dev/shim.ts, que expone los mismos comandos por HTTP.
import { invoke } from '@tauri-apps/api/core'

/** true dentro de la app nativa; false en el navegador de desarrollo. */
export const isNative = '__TAURI_INTERNALS__' in window

async function dev(cmd: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`/__dev/invoke/${cmd}`, { method: 'POST', ...init })
  if (!res.ok) throw new Error(await res.text())
  return res
}

async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isNative) return invoke<T>(cmd, args)
  return (await dev(cmd, { body: JSON.stringify(args) })).json()
}

export interface ProjectInfo {
  /** Ruta absoluta de la carpeta del proyecto. */
  path: string
  name: string
  exists: boolean
}

export const backend = {
  // ---- Proyectos ----
  recentProjects: () => call<ProjectInfo[]>('recent_projects'),
  forgetProject: (path: string) => call<void>('forget_project', { path }),
  currentProject: () => call<ProjectInfo | null>('current_project'),
  /** Selector de carpetas del sistema. `null` si se cancela (o en el navegador). */
  pickFolder: () => call<string | null>('pick_folder'),
  openProject: (path: string) => call<ProjectInfo>('open_project', { path }),
  closeProject: () => call<void>('close_project'),

  // ---- Archivos del proyecto abierto ----
  /** Lee un .json de la raíz del proyecto; `null` si no existe. */
  readData: (name: string) => call<string | null>('read_data', { name }),
  /** Escribe varios .json a la vez: o se guardan todos o ninguno. */
  writeData: (files: { name: string; content: string }[]) => call<void>('write_data', { files }),

  async savePdf(name: string, bytes: Uint8Array): Promise<void> {
    if (isNative) await invoke('save_pdf', bytes, { headers: { 'x-name': name } })
    else await dev('save_pdf', { body: bytes as BodyInit, headers: { 'x-name': name } })
  },
  async readPdf(name: string): Promise<Uint8Array> {
    if (isNative) return new Uint8Array(await invoke<ArrayBuffer>('read_pdf', { name }))
    return new Uint8Array(await (await dev('read_pdf', { body: JSON.stringify({ name }) })).arrayBuffer())
  },

  /** Guarda un archivo de texto donde elija el usuario. `false` si cancela. */
  async saveTextFile(defaultName: string, content: string): Promise<boolean> {
    if (isNative) return invoke<boolean>('save_text_file', { defaultName, content })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    a.download = defaultName
    a.click()
    URL.revokeObjectURL(a.href)
    return true
  },

  async openUrl(url: string): Promise<void> {
    if (isNative) await invoke('open_url', { url })
    else window.open(url, '_blank', 'noopener')
  },
}
