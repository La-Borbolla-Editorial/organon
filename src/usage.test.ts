import { expect, test } from 'vitest'
import { cellText, setUsage } from './fichero-io'
import { filterKind, matchFilter, sortByColumn } from './fichero-table'
import { addCounts, countIn, usageOf } from './usage'
import type { Column, Ficha, Fichero } from './types'

const ficha = (id: string, ficheroId: string, num: number): Ficha => ({
  id, ficheroId, num, notaPermanente: '', cita: 'cita', sourceId: null, pageLabel: '', pageManual: true, anchor: null,
  tags: [], referencia: '', notas: '', extra: {}, createdAt: '', updatedAt: '',
})
const ficheros: Fichero[] = [
  { id: 'g', name: 'General', marker: 'f.', columns: [] },
  { id: 'e', name: 'Escoto', marker: 'e.', columns: [] },
]
const fichas = [ficha('g1', 'g', 1), ficha('g2', 'g', 2), ficha('e1', 'e', 1)]
const ctx = { fichas, ficheros, sources: [] }

test('se cuentan las citas {…} y […], con varias referencias en una', () => {
  const md = 'Texto {f. 1} y más [f. 1; e. 1 p. 4]. Otra vez {f. 1 «cita»}. Y {f. 99} no existe.'
  expect(Object.fromEntries(countIn(md, ctx))).toEqual({ g1: 3, e1: 1 })
})

test('las de todos los textos se suman', () => {
  const { byDraft, total } = usageOf([{ name: 'a', text: '{f. 2}' }, { name: 'b', text: '{f. 2} [e. 1]' }], ctx)
  expect(byDraft.get('a')?.get('g2')).toBe(1)
  expect(Object.fromEntries(total)).toEqual({ g2: 2, e1: 1 })
  expect(Object.fromEntries(addCounts(new Map([['x', 1]]), new Map([['x', 2], ['y', 1]])))).toEqual({ x: 3, y: 1 })
})

test('la columna «Veces usada» es un número: se filtra por rango y se ordena', () => {
  const col: Column = { header: 'Veces usada', field: 'usos' }
  setUsage(new Map([['g1', 3], ['e1', 1]]))
  expect(filterKind(col)).toBe('numero')
  expect(cellText(fichas[1], col, undefined)).toBe('0')
  const pass = (f: Ficha, filter: object) => matchFilter(f, col, filter, undefined, cellText(f, col, undefined))
  expect(fichas.filter((f) => pass(f, { max: '0' })).map((f) => f.id)).toEqual(['g2']) // sin usar
  expect(fichas.filter((f) => pass(f, { min: '2' })).map((f) => f.id)).toEqual(['g1'])
  expect(sortByColumn(fichas, col, true, () => undefined).map((f) => f.id)).toEqual(['g1', 'e1', 'g2'])
  setUsage(new Map())
})

test('en «Veces usada», el filtro «Sin usar» deja las que valen 0', () => {
  const col: Column = { header: 'Veces usada', field: 'usos' }
  setUsage(new Map([['g1', 3]]))
  const pass = (f: Ficha, empty: 'vacia' | 'llena') => matchFilter(f, col, { empty }, undefined, cellText(f, col, undefined))
  expect(fichas.filter((f) => pass(f, 'vacia')).map((f) => f.id)).toEqual(['g2', 'e1'])
  expect(fichas.filter((f) => pass(f, 'llena')).map((f) => f.id)).toEqual(['g1'])
  setUsage(new Map())
})
