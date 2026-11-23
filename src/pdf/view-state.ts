// Zoom y posición del Lector: el pellizco del trackpad y lo que se recuerda de cada fuente.

export const MIN_SCALE = 0.25
export const MAX_SCALE = 6

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

/**
 * Factor de un evento `wheel` con `ctrlKey`: así envían Chrome y Firefox el pellizco del
 * trackpad (y la rueda con Ctrl). `deltaY` negativo acerca. Una rueda de ratón da saltos
 * grandes (100 px), que se suavizan para que cada clic no duplique el tamaño.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  return Math.exp(-Math.max(-50, Math.min(50, px)) / 100)
}

/**
 * Lo que se recuerda de cada fuente: el zoom («page-width» = ajustada al ancho), la hoja y el punto
 * de la hoja que estaba arriba a la izquierda (en unidades del PDF), para volver al mismo sitio.
 */
export interface ReaderState {
  scale: number | 'page-width'
  page: number
  top?: number
  left?: number
}

export const readerStateKey = (sourceId: string) => `lector:${sourceId}`

export function readReaderState(json: string | undefined, numPages: number): ReaderState | null {
  if (!json) return null
  try {
    const v = JSON.parse(json)
    const scale = v.scale === 'page-width' ? 'page-width' : typeof v.scale === 'number' && Number.isFinite(v.scale) ? clampScale(v.scale) : 'page-width'
    const page = Number.isInteger(v.page) ? Math.min(Math.max(1, v.page), numPages) : 1
    const state: ReaderState = { scale, page }
    // El punto exacto solo vale si la hoja es la misma (un PDF más corto la habría cambiado).
    if (page === v.page && Number.isFinite(v.top) && Number.isFinite(v.left)) { state.top = v.top; state.left = v.left }
    return state
  } catch {
    return null
  }
}
