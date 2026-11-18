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

export type Stamps = Record<string, string | null>

export type TrashName = 'pdfs' | 'escritura'
export type TrashInfo = Record<TrashName, { count: number; bytes: number }>

export const backend = {
  // ---- Proyectos ----
  recentProjects: () => call<ProjectInfo[]>('recent_projects'),
  forgetProject: (path: string) => call<void>('forget_project', { path }),
  currentProject: () => call<ProjectInfo | null>('current_project'),
  /** Selector de carpetas del sistema. `null` si se cancela (o en el navegador). */
  pickFolder: () => call<string | null>('pick_folder'),
  openProject: (path: string) => call<ProjectInfo>('open_project', { path }),
  closeProject: () => call<void>('close_project'),

  // ---- Ajustes de Organon y temas (carpeta de configuración de la app) ----
  readAppSettings: () => call<string | null>('read_app_settings'),
  writeAppSettings: (content: string) => call<void>('write_app_settings', { content }),
  listThemes: () => call<{ file: string; content: string }[]>('list_themes'),
  writeTheme: (file: string, content: string) => call<void>('write_theme', { file, content }),
  deleteTheme: (file: string) => call<void>('delete_theme', { file }),
  revealThemesFolder: () => call<void>('reveal_themes_folder'),

  // ---- Archivos del proyecto abierto ----
  /** Lee un .json de la raíz del proyecto; `null` si no existe. */
  readData: (name: string) => call<string | null>('read_data', { name }),
  /** Sello (fecha de modificación y tamaño) de cada archivo; `null` si no existe. */
  dataStamps: (names: string[]) => call<Stamps>('data_stamps', { names }),
  /**
   * Escribe varios .json a la vez: o se guardan todos o ninguno. Si algún
   * archivo ya no tiene el sello de `expected` (cambió fuera de Organon), no
   * escribe nada y falla con un error que empieza por «CONFLICT».
   */
  writeData: (files: { name: string; content: string }[], expected: Stamps) => call<Stamps>('write_data', { files, expected }),

  // ---- Escritura (escritura/*.md) ----
  listDrafts: () => call<{ name: string; stamp: string | null }[]>('list_drafts'),
  readDraft: (name: string) => call<{ content: string; stamp: string | null }>('read_draft', { name }),
  /** Devuelve el sello nuevo. Falla con «CONFLICT» si el archivo cambió fuera de Organon (salvo con `force`). */
  writeDraft: (name: string, content: string, expected: string | null, force = false) => call<string | null>('write_draft', { name, content, expected, force }),
  renameDraft: (from: string, to: string) => call<void>('rename_draft', { from, to }),
  /** Mueve el texto a escritura/.papelera/ (no lo borra). */
  trashDraft: (name: string) => call<void>('trash_draft', { name }),

  /** Guarda un archivo binario donde elija el usuario. `false` si cancela. */
  async saveBinaryFile(defaultName: string, bytes: Uint8Array, mime: string): Promise<boolean> {
    if (isNative) return invoke<boolean>('save_binary_file', bytes, { headers: { 'x-name': encodeURIComponent(defaultName) } })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
    a.download = defaultName
    a.click()
    URL.revokeObjectURL(a.href)
    return true
  },

  async savePdf(name: string, bytes: Uint8Array): Promise<void> {
    if (isNative) await invoke('save_pdf', bytes, { headers: { 'x-name': name } })
    else await dev('save_pdf', { body: bytes as BodyInit, headers: { 'x-name': name } })
  },
  /** Cuántos archivos (y bytes) hay en cada papelera del proyecto. */
  trashInfo: () => call<TrashInfo>('trash_info'),
  /** Borra de verdad el contenido de una papelera. No se puede deshacer. */
  emptyTrash: (which: TrashName) => call<void>('empty_trash', { which }),
  /** Mueve el PDF a `pdfs/.papelera/`. */
  trashPdf: (name: string) => call<void>('trash_pdf', { name }),
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

  /** Abre el diálogo de impresión con lo que la página muestra al imprimir. */
  async print(): Promise<void> {
    if (isNative) await invoke('print_page')
    else window.print()
  },

  async openUrl(url: string): Promise<void> {
    if (isNative) await invoke('open_url', { url })
    else window.open(url, '_blank', 'noopener')
  },
}
