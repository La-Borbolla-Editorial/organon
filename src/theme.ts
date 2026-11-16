// Temas: colores y tipografía de la interfaz. Cada valor es una variable CSS de
// styles.css; un tema es un archivo JSON que les da valor. Los que faltan en un tema
// se toman del tema «Organon», así que basta con escribir lo que se quiere cambiar.
//
// Formato de un archivo de tema:
//   {
//     "nombre": "Mi tema",
//     "esquema": "claro" | "oscuro",
//     "colores": { "fondo": "#f6f4ef", "acento": "#7a2e2e", … },
//     "tipografia": { "interfaz": "…", "texto": "…", "editor": "…", "mono": "…",
//                     "tamanoInterfaz": 14, "tamanoEditor": 17 }
//   }

export type Scheme = 'claro' | 'oscuro'

export interface Theme {
  nombre: string
  esquema: Scheme
  colores: Record<string, string>
  tipografia: Record<string, string | number>
}

export interface ColorToken { key: string; css: string; label: string; group: string }
export interface TypeToken { key: string; css: string; label: string; kind: 'font' | 'size' }

export const COLOR_TOKENS: ColorToken[] = [
  { key: 'fondo', css: '--bg', label: 'Fondo de la ventana', group: 'Superficies' },
  { key: 'panel', css: '--panel', label: 'Paneles y tarjetas', group: 'Superficies' },
  { key: 'papel', css: '--paper', label: 'Hoja del editor', group: 'Superficies' },
  { key: 'campos', css: '--field', label: 'Campos de texto', group: 'Superficies' },
  { key: 'suave', css: '--subtle', label: 'Fondos suaves (tags, encabezados)', group: 'Superficies' },
  { key: 'hover', css: '--hover', label: 'Al pasar el ratón', group: 'Superficies' },
  { key: 'lineas', css: '--line', label: 'Bordes', group: 'Superficies' },
  { key: 'lineasFuertes', css: '--line-strong', label: 'Bordes marcados', group: 'Superficies' },
  { key: 'fondoPdf', css: '--pdf-bg', label: 'Alrededor del PDF', group: 'Superficies' },
  { key: 'sombra', css: '--shadow', label: 'Sombras', group: 'Superficies' },
  { key: 'velo', css: '--backdrop', label: 'Velo detrás de los diálogos', group: 'Superficies' },

  { key: 'texto', css: '--ink', label: 'Texto', group: 'Texto' },
  { key: 'textoSuave', css: '--ink-soft', label: 'Texto de citas', group: 'Texto' },
  { key: 'textoTenue', css: '--muted', label: 'Texto secundario', group: 'Texto' },
  { key: 'seleccion', css: '--selection', label: 'Selección', group: 'Texto' },
  { key: 'cursor', css: '--caret', label: 'Cursor de escritura', group: 'Texto' },

  { key: 'acento', css: '--accent', label: 'Acento (botones, enlaces)', group: 'Acento' },
  { key: 'textoSobreAcento', css: '--accent-ink', label: 'Texto sobre el acento', group: 'Acento' },

  { key: 'ok', css: '--ok', label: 'Correcto', group: 'Avisos' },
  { key: 'okFondo', css: '--ok-bg', label: 'Correcto: fondo', group: 'Avisos' },
  { key: 'okLinea', css: '--ok-line', label: 'Correcto: borde', group: 'Avisos' },
  { key: 'aviso', css: '--warn', label: 'Aviso', group: 'Avisos' },
  { key: 'avisoFondo', css: '--warn-bg', label: 'Aviso: fondo', group: 'Avisos' },
  { key: 'avisoLinea', css: '--warn-line', label: 'Aviso: borde', group: 'Avisos' },
  { key: 'error', css: '--bad', label: 'Error', group: 'Avisos' },
  { key: 'errorFondo', css: '--bad-bg', label: 'Error: fondo', group: 'Avisos' },
  { key: 'errorLinea', css: '--bad-line', label: 'Error: borde', group: 'Avisos' },
  { key: 'textoSobreError', css: '--bad-ink', label: 'Texto sobre el error', group: 'Avisos' },

  { key: 'marca', css: '--mark', label: 'Ficha activa', group: 'Fichas y referencias' },
  { key: 'marcaFondo', css: '--mark-bg', label: 'Ficha activa: fondo', group: 'Fichas y referencias' },
  { key: 'resaltado', css: '--hl', label: 'Resaltado en el PDF', group: 'Fichas y referencias' },
  { key: 'resaltadoActivo', css: '--hl-active', label: 'Resaltado activo', group: 'Fichas y referencias' },
  { key: 'resaltadoNuevo', css: '--hl-draft', label: 'Selección nueva en el PDF', group: 'Fichas y referencias' },
  { key: 'citaInsertadaFondo', css: '--ref-insert-bg', label: '{f. N}: fondo', group: 'Fichas y referencias' },
  { key: 'citaInsertadaTexto', css: '--ref-insert-ink', label: '{f. N}: texto', group: 'Fichas y referencias' },
  { key: 'notaFondo', css: '--ref-cite-bg', label: '[f. N]: fondo', group: 'Fichas y referencias' },
  { key: 'notaTexto', css: '--ref-cite-ink', label: '[f. N]: texto', group: 'Fichas y referencias' },
  { key: 'fichaAsomadaFondo', css: '--peek-bg', label: 'Ficha en el texto: fondo', group: 'Fichas y referencias' },
  { key: 'fichaAsomadaLinea', css: '--peek-line', label: 'Ficha en el texto: borde', group: 'Fichas y referencias' },
]

export const TYPE_TOKENS: TypeToken[] = [
  { key: 'interfaz', css: '--font-ui', label: 'Interfaz', kind: 'font' },
  { key: 'texto', css: '--font-text', label: 'Citas, fichas y vista final', kind: 'font' },
  { key: 'editor', css: '--font-editor', label: 'Editor de Escritura', kind: 'font' },
  { key: 'mono', css: '--font-mono', label: 'Código', kind: 'font' },
  { key: 'tamanoInterfaz', css: '--size-ui', label: 'Tamaño de la interfaz', kind: 'size' },
  { key: 'tamanoEditor', css: '--size-editor', label: 'Tamaño del editor', kind: 'size' },
]

/** Tipografías a mano en el selector. Cualquier otra instalada se puede escribir. */
export const FONT_PRESETS: { label: string; value: string }[] = [
  { label: 'Sistema (San Francisco)', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: 'Iowan Old Style', value: "'Iowan Old Style', 'Palatino', Georgia, serif" },
  { label: 'EB Garamond (incluida)', value: "'Organon Garamond', 'EB Garamond', Garamond, serif" },
  { label: 'Palatino', value: "Palatino, 'Palatino Linotype', serif" },
  { label: 'Charter', value: "Charter, 'Bitstream Charter', Georgia, serif" },
  { label: 'Baskerville', value: "Baskerville, 'Libre Baskerville', serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Avenir Next', value: "'Avenir Next', Avenir, sans-serif" },
  { label: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: 'Menlo', value: 'ui-monospace, Menlo, monospace' },
]

const SYSTEM = FONT_PRESETS[0].value
const IOWAN = FONT_PRESETS[1].value
const GARAMOND = FONT_PRESETS[2].value
const MONO = FONT_PRESETS[9].value

export const ORGANON: Theme = {
  nombre: 'Organon',
  esquema: 'claro',
  colores: {
    fondo: '#f6f4ef', panel: '#ffffff', papel: '#ffffff', campos: '#ffffff', suave: '#efebe3', hover: '#f5f2ec',
    lineas: '#e2ddd3', lineasFuertes: '#c9c2b4', fondoPdf: '#d9d5cc', sombra: 'rgb(60 45 20 / 0.16)', velo: 'rgb(0 0 0 / 0.35)',
    texto: '#23201c', textoSuave: '#45403a', textoTenue: '#7b746a', seleccion: '#e7dcc8', cursor: '#7a2e2e',
    acento: '#7a2e2e', textoSobreAcento: '#ffffff',
    ok: '#2f6b3f', okFondo: '#e5f1e7', okLinea: '#b9d8bf',
    aviso: '#8a5a00', avisoFondo: '#fdf1d3', avisoLinea: '#ecd596',
    error: '#a02222', errorFondo: '#fbe4e1', errorLinea: '#e8b3ad', textoSobreError: '#ffffff',
    marca: '#e0a030', marcaFondo: '#fffaf0', resaltado: '#ffe27a', resaltadoActivo: '#ffbf47', resaltadoNuevo: '#a9d5ff',
    citaInsertadaFondo: '#fdeebf', citaInsertadaTexto: '#6b4a00', notaFondo: '#e2edf8', notaTexto: '#1f4d7a',
    fichaAsomadaFondo: '#fbf7ea', fichaAsomadaLinea: '#e7c873',
  },
  tipografia: { interfaz: SYSTEM, texto: IOWAN, editor: IOWAN, mono: MONO, tamanoInterfaz: 14, tamanoEditor: 17 },
}

export const NOCHE: Theme = {
  nombre: 'Noche',
  esquema: 'oscuro',
  colores: {
    fondo: '#1c1a17', panel: '#24211d', papel: '#22201c', campos: '#2d2a25', suave: '#34302a', hover: '#2f2b26',
    lineas: '#3d3832', lineasFuertes: '#5a5249', fondoPdf: '#141210', sombra: 'rgb(0 0 0 / 0.45)', velo: 'rgb(0 0 0 / 0.55)',
    texto: '#ece6dc', textoSuave: '#d6cfc3', textoTenue: '#a0978a', seleccion: '#4d4234', cursor: '#e0907d',
    acento: '#e0907d', textoSobreAcento: '#1c1a17',
    ok: '#8fc79c', okFondo: '#1f3326', okLinea: '#2f5a3c',
    aviso: '#e5b85c', avisoFondo: '#3a2f15', avisoLinea: '#6b5420',
    error: '#f08a80', errorFondo: '#3d1f1c', errorLinea: '#6e322c', textoSobreError: '#1c1a17',
    marca: '#e0a030', marcaFondo: '#332a1a', resaltado: '#ffe27a', resaltadoActivo: '#ffbf47', resaltadoNuevo: '#a9d5ff',
    citaInsertadaFondo: '#3d3420', citaInsertadaTexto: '#f0d38a', notaFondo: '#1f3042', notaTexto: '#a9c9ec',
    fichaAsomadaFondo: '#2b271f', fichaAsomadaLinea: '#8a7330',
  },
  tipografia: { ...ORGANON.tipografia },
}

export const SEPIA: Theme = {
  nombre: 'Sepia',
  esquema: 'claro',
  colores: {
    ...ORGANON.colores,
    fondo: '#efe6d4', panel: '#f8f1e3', papel: '#fbf5e9', campos: '#fffaf0', suave: '#e6dbc6', hover: '#f1e8d6',
    lineas: '#d9ccb3', lineasFuertes: '#bfae8e', fondoPdf: '#cfc2a8',
    texto: '#3b2f22', textoSuave: '#4f4132', textoTenue: '#85745c', seleccion: '#e3cfa6', cursor: '#8b4513',
    acento: '#8b4513', fichaAsomadaFondo: '#f6ecd6',
  },
  tipografia: { ...ORGANON.tipografia, texto: GARAMOND, editor: GARAMOND, tamanoEditor: 19 },
}

/** Basado en Gryphon Code Dark, el tema de VS Code de José Pablo Iglesias (github.com/fraile-tok/gryphon-code-dark). */
export const GRYPHON: Theme = {
  nombre: 'Gryphon',
  esquema: 'oscuro',
  colores: {
    fondo: '#0b1017', panel: '#11161d', papel: '#0b1017', campos: '#1c222a', suave: '#1c222a', hover: '#161c24',
    lineas: '#232b35', lineasFuertes: '#36414f', fondoPdf: '#070a0f', sombra: 'rgb(0 0 0 / 0.5)', velo: 'rgb(0 0 0 / 0.6)',
    texto: '#cfdce9', textoSuave: '#b2ccd6', textoTenue: '#7d8794', seleccion: '#093669', cursor: '#79b0ff',
    acento: '#316dca', textoSobreAcento: '#cfdce9',
    ok: '#57ab5a', okFondo: '#0f2418', okLinea: '#1f4d2c',
    aviso: '#ffb61e', avisoFondo: '#2a2110', avisoLinea: '#5c4614',
    error: '#fa4549', errorFondo: '#2b1216', errorLinea: '#5e1f25', textoSobreError: '#0b1017',
    marca: '#ffb61e', marcaFondo: '#1d1a12', resaltado: '#ffc64b', resaltadoActivo: '#ffb61e', resaltadoNuevo: '#8fbcff',
    citaInsertadaFondo: '#2a2312', citaInsertadaTexto: '#ffb61e', notaFondo: '#0d2745', notaTexto: '#79b0ff',
    fichaAsomadaFondo: '#11161d', fichaAsomadaLinea: '#b083f0',
  },
  tipografia: { ...ORGANON.tipografia },
}

/** Temas que vienen con Organon, por su identificador. */
export const BUILTIN: Record<string, Theme> = { organon: ORGANON, noche: NOCHE, sepia: SEPIA, gryphon: GRYPHON }

const isColor = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length < 80 && !/[;{}]/.test(v)
const isFont = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length < 300 && !/[;{}]/.test(v)

/**
 * Lee un tema de un archivo. Lo que falta o no es válido se toma del tema base
 * («Organon», o «Noche» si el tema es oscuro). Lanza un error si no es JSON.
 */
export function parseTheme(text: string, fallbackName = 'Tema sin nombre'): Theme {
  const raw = JSON.parse(text) as Partial<Theme> & Record<string, unknown>
  const esquema: Scheme = raw.esquema === 'oscuro' ? 'oscuro' : 'claro'
  const base = esquema === 'oscuro' ? NOCHE : ORGANON
  const colores = { ...base.colores }
  for (const t of COLOR_TOKENS) { const v = raw.colores?.[t.key]; if (isColor(v)) colores[t.key] = v.trim() }
  const tipografia: Record<string, string | number> = { ...base.tipografia }
  for (const t of TYPE_TOKENS) {
    const v = raw.tipografia?.[t.key]
    if (t.kind === 'size' && typeof v === 'number' && v >= 9 && v <= 32) tipografia[t.key] = v
    if (t.kind === 'font' && isFont(v)) tipografia[t.key] = v.trim()
  }
  return { nombre: typeof raw.nombre === 'string' && raw.nombre.trim() ? raw.nombre.trim() : fallbackName, esquema, colores, tipografia }
}

export function themeToJson(theme: Theme): string {
  return `${JSON.stringify({ nombre: theme.nombre, esquema: theme.esquema, colores: theme.colores, tipografia: theme.tipografia }, null, 2)}\n`
}

/** Aplica el tema a toda la ventana. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  for (const t of COLOR_TOKENS) root.style.setProperty(t.css, theme.colores[t.key])
  for (const t of TYPE_TOKENS) {
    const v = theme.tipografia[t.key]
    root.style.setProperty(t.css, t.kind === 'size' ? `${v}px` : String(v))
  }
  root.style.setProperty('color-scheme', theme.esquema === 'oscuro' ? 'dark' : 'light')
  root.dataset.esquema = theme.esquema
}

/** Nombre de archivo para un tema nuevo: «Mi tema» → «mi-tema.json». */
export function themeFileName(name: string, taken: string[]): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tema'
  let file = `${base}.json`
  for (let n = 2; taken.includes(file); n++) file = `${base}-${n}.json`
  return file
}
