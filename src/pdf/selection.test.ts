import { expect, test } from 'vitest'
import { cleanQuote, dropRunningHeads, piecesText, type Piece } from './selection'

const line = (page: number, y: number, text: string, x = 0.1, w = 0.8): Piece => ({ page, text, rect: [x, y, w, 0.02] })

test('una cita que cruza de página pierde el encabezado y el número', () => {
  const pieces = [
    line(1, 0.86, 'some contingent marks of the object. The name denoting that'),
    // página siguiente: título corrido y número en la misma línea, luego el texto
    line(2, 0.06, 'NAMING AND NECESSITY', 0.3, 0.35),
    line(2, 0.06, '107', 0.82, 0.05),
    line(2, 0.11, 'object is'),
  ]
  const { kept, dropped } = dropRunningHeads(pieces)
  expect(dropped).toEqual(['NAMING AND NECESSITY 107'])
  expect(cleanQuote(piecesText(kept))).toBe('some contingent marks of the object. The name denoting that object is')
})

test('también el pie de la primera página', () => {
  const pieces = [line(1, 0.8, 'final del texto de la página exis-'), line(1, 0.93, '68', 0.48, 0.04), line(2, 0.12, 'tence continúa aquí'), line(2, 0.15, 'y sigue.')]
  const { kept, dropped } = dropRunningHeads(pieces)
  expect(dropped).toEqual(['68'])
  expect(cleanQuote(piecesText(kept))).toBe('final del texto de la página existence continúa aquí y sigue.')
})

test('no toca el texto corriente', () => {
  // Sin encabezado: la primera línea de la segunda página sigue al resto sin hueco.
  const two = [line(1, 0.9, 'acaba la página'), line(2, 0.1, 'y empieza otra'), line(2, 0.125, 'sin encabezado.')]
  expect(dropRunningHeads(two)).toEqual({ kept: two, dropped: [] })
  // En una sola página no se quita nada, aunque haya un número arriba.
  const one = [line(3, 0.05, '107'), line(3, 0.12, 'texto')]
  expect(dropRunningHeads(one)).toEqual({ kept: one, dropped: [] })
})

test('fragmentos de una misma línea', () => {
  expect(piecesText([line(1, 0.5, 'uno', 0.1, 0.1), line(1, 0.5, 'dos', 0.25, 0.1), line(1, 0.5, 'pegado', 0.35, 0.1)])).toBe('uno dospegado')
})
