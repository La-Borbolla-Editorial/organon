import { expect, test } from 'vitest'
import { nearestColor, textUnder, trimPartialWords, type TextBox } from './annotations'

test('los colores de Zotero y Vista Previa van al de Organon más parecido', () => {
  expect(nearestColor([255, 212, 0])).toBe('amarillo') // Zotero amarillo
  expect(nearestColor([255, 102, 102])).toBe('rosa') // Zotero rojo
  expect(nearestColor([95, 178, 54])).toBe('verde')
  expect(nearestColor([46, 168, 229])).toBe('azul')
  expect(nearestColor([162, 138, 229])).toBe('morado')
  expect(nearestColor([241, 152, 55])).toBe('naranja')
  expect(nearestColor([229, 110, 238])).toBe('rosa') // magenta
  expect(nearestColor([170, 170, 170])).toBe('amarillo') // gris
  expect(nearestColor(null)).toBe('amarillo')
})

test('el texto bajo las líneas de un resaltado, con las palabras partidas unidas', () => {
  // Dos líneas de 0,5 de ancho; cada letra mide 0,5/len.
  const l1 = 'Lorem ipsum dolor sit hyphen-'
  const l2 = 'ated across two lines here.'
  const boxes: TextBox[] = [
    { str: l1, x: 0.1, y: 0.10, w: 0.5, h: 0.02 },
    { str: l2, x: 0.1, y: 0.13, w: 0.5, h: 0.02 },
  ]
  const at = (s: string, word: string) => 0.1 + (s.indexOf(word) / s.length) * 0.5
  const r1: [number, number, number, number] = [at(l1, 'dolor'), 0.1, 0.6 - at(l1, 'dolor'), 0.02]
  const r2: [number, number, number, number] = [0.1, 0.13, at(l2, ' two') - 0.1, 0.02]
  expect(textUnder(boxes, [r1, r2])).toBe('dolor sit hyphenated across')
})

test('un trocito de palabra que se coló por un borde se quita', () => {
  expect(trimPartialWords('e. One word is', true, false)).toBe('One word is')
  expect(trimPartialWords('One word is th', false, true)).toBe('One word is')
  expect(trimPartialWords('a la una', false, false)).toBe('a la una') // sin corte, no se toca
  expect(trimPartialWords('palabra', true, true)).toBe('palabra') // una sola palabra se queda
})
