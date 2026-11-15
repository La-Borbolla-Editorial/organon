// Ajustes de Organon (no de un proyecto): por ahora, el tema. Se guardan en
// `ajustes.json` y los temas propios en `temas/`, en la carpeta de configuración.
import { backend } from './backend'
import { applyTheme, BUILTIN, ORGANON, parseTheme, type Theme } from './theme'

export interface AppSettings {
  /** «organon», «noche», «sepia» o «archivo:mi-tema.json». */
  tema: string
}

export interface ThemeEntry {
  id: string
  theme: Theme
  /** Archivo en `temas/` si es un tema propio. */
  file?: string
}

const DEFAULTS: AppSettings = { tema: 'organon' }
let settings: AppSettings & Record<string, unknown> = { ...DEFAULTS }

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const text = await backend.readAppSettings()
    const raw = text ? JSON.parse(text) : {}
    settings = { ...DEFAULTS, ...raw, tema: typeof raw.tema === 'string' ? raw.tema : DEFAULTS.tema }
  } catch {
    settings = { ...DEFAULTS }
  }
  return settings
}

export async function saveAppSettings(next: Partial<AppSettings>): Promise<void> {
  settings = { ...settings, ...next }
  await backend.writeAppSettings(`${JSON.stringify(settings, null, 2)}\n`)
}

export const appSettings = (): AppSettings => settings

/** Los temas incluidos y los de la carpeta `temas/`. Los que no se pueden leer se saltan. */
export async function loadThemes(): Promise<{ themes: ThemeEntry[]; broken: string[] }> {
  const themes: ThemeEntry[] = Object.entries(BUILTIN).map(([id, theme]) => ({ id, theme }))
  const broken: string[] = []
  try {
    for (const { file, content } of await backend.listThemes()) {
      try {
        themes.push({ id: `archivo:${file}`, file, theme: parseTheme(content, file.replace(/\.json$/, '')) })
      } catch {
        broken.push(file)
      }
    }
  } catch {
    // Sin carpeta de temas: solo los incluidos.
  }
  return { themes, broken }
}

/** Al arrancar: aplica el tema guardado (o «Organon» si ya no existe). */
export async function initAppearance(): Promise<void> {
  const { tema } = await loadAppSettings()
  const { themes } = await loadThemes()
  applyTheme(themes.find((t) => t.id === tema)?.theme ?? ORGANON)
}
