import { expect, test } from 'vitest'
import { MAX_SCALE, readReaderState, wheelZoomFactor } from './view-state'

test('el pellizco acerca con deltaY negativo y una rueda de ratón no dispara el zoom', () => {
  expect(wheelZoomFactor(-10, 0)).toBeGreaterThan(1)
  expect(wheelZoomFactor(10, 0)).toBeLessThan(1)
  expect(wheelZoomFactor(-10, 0) * wheelZoomFactor(10, 0)).toBeCloseTo(1)
  expect(wheelZoomFactor(-100, 0)).toBeCloseTo(Math.exp(0.5)) // un clic de rueda: como mucho ×1,65
  expect(wheelZoomFactor(-3, 1)).toBeCloseTo(Math.exp(0.48)) // en líneas
})

test('lo que se recuerda de una fuente se lee con cuidado', () => {
  expect(readReaderState(undefined, 10)).toBeNull()
  expect(readReaderState('no es json', 10)).toBeNull()
  expect(readReaderState('{"scale":1.5,"page":4}', 10)).toEqual({ scale: 1.5, page: 4 })
  expect(readReaderState('{"scale":"page-width","page":4}', 10)).toEqual({ scale: 'page-width', page: 4 })
  expect(readReaderState('{"scale":99,"page":40}', 10)).toEqual({ scale: MAX_SCALE, page: 10 }) // otro PDF, más corto
  expect(readReaderState('{"scale":"x","page":0}', 10)).toEqual({ scale: 'page-width', page: 1 })
})

test('se recuerda el punto exacto de la hoja, si la hoja sigue existiendo', () => {
  expect(readReaderState('{"scale":1.5,"page":4,"top":620,"left":12}', 10)).toEqual({ scale: 1.5, page: 4, top: 620, left: 12 })
  expect(readReaderState('{"scale":1.5,"page":40,"top":620,"left":12}', 10)).toEqual({ scale: 1.5, page: 10 }) // otro PDF, más corto
  expect(readReaderState('{"scale":1.5,"page":4,"top":"x"}', 10)).toEqual({ scale: 1.5, page: 4 })
})
