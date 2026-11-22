import { expect, test } from 'vitest'
import { fichaFieldsFrom, inDocumentOrder, marcaAt, recorteAnchor, rectBetween } from './marks'
import type { Anchor, Ficha, Marca } from '../types'

const anchor = (page: number, r: [number, number, number, number]): Anchor => ({ start: { page, half: 0 }, end: { page, half: 0 }, exact: 'texto', rects: [{ page, r: [r] }] })
const marca = (id: string, patch: Partial<Marca>): Marca => ({ id, sourceId: 's', kind: 'resaltado', createdAt: '', updatedAt: '', ...patch })

test('lo que hay bajo el cursor: la nota gana al resaltado que tiene debajo', () => {
  const hl = marca('hl', { anchor: anchor(1, [0.1, 0.1, 0.5, 0.02]), color: 'verde' })
  const nota = marca('n', { kind: 'nota', page: 1, at: [0.3, 0.11] })
  const rec = marca('r', { kind: 'recorte', page: 2, rect: [0.1, 0.5, 0.3, 0.2] })
  const all = [hl, nota, rec]
  expect(marcaAt(all, 1, 0.3, 0.11)?.id).toBe('n')
  expect(marcaAt(all, 1, 0.55, 0.11)?.id).toBe('hl')
  expect(marcaAt(all, 2, 0.2, 0.6)?.id).toBe('r')
  expect(marcaAt(all, 1, 0.2, 0.6)).toBeNull()
  expect(marcaAt(all, 2, 0.55, 0.11)).toBeNull() // otra hoja
})

test('en el orden del documento, mezclando marcas y fichas', () => {
  const f = { id: 'f', anchor: anchor(2, [0.1, 0.2, 0.5, 0.02]) } as Ficha
  const sinPasaje = { id: 'x', anchor: null } as Ficha
  const items = [marca('b', { kind: 'nota', page: 2, at: [0.5, 0.6] }), sinPasaje, f, marca('a', { anchor: anchor(1, [0.1, 0.9, 0.5, 0.02]) })]
  expect(inDocumentOrder(items).map((i) => i.id)).toEqual(['a', 'f', 'b', 'x'])
})

test('un rectángulo arrastrado en cualquier dirección queda dentro de la hoja', () => {
  rectBetween([0.6, 0.5], [0.2, 0.1]).forEach((v, i) => expect(v).toBeCloseTo([0.2, 0.1, 0.4, 0.4][i]))
  const r = rectBetween([0.9, -0.2], [1.3, 0.1])
  expect(r[0]).toBeCloseTo(0.9); expect(r[1]).toBe(0); expect(r[2]).toBeCloseTo(0.1); expect(r[3]).toBeCloseTo(0.1)
})

test('lo que una ficha hereda de un resaltado y de un recorte', () => {
  const hl = marca('hl', { anchor: anchor(3, [0.1, 0.1, 0.5, 0.02]), color: 'rosa' })
  expect(fichaFieldsFrom(hl)).toEqual({ anchor: hl.anchor, cita: 'texto', color: 'rosa' })
  const rec = marca('r', { kind: 'recorte', page: 4, rect: [0.6, 0.1, 0.3, 0.2], imagen: 'r.png' })
  expect(fichaFieldsFrom(rec)).toEqual({ anchor: recorteAnchor(4, [0.6, 0.1, 0.3, 0.2]), cita: '', imagen: 'r.png' })
  expect(recorteAnchor(4, [0.6, 0.1, 0.3, 0.2]).start).toEqual({ page: 4, half: 1 }) // a la derecha: segunda mitad de la hoja
  expect(fichaFieldsFrom(marca('n', { kind: 'nota', page: 1, at: [0, 0] }))).toBeNull()
})
