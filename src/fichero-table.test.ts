import { expect, test } from 'vitest'
import { fichasToCsv } from './fichero-io'
import { applyColumns, columnsProblem, distinctValues, matchFilter, readView, reorder, sortByColumn } from './fichero-table'
import type { Column, Ficha, Source } from './types'

const ficha = (num: number, patch: Partial<Ficha> = {}): Ficha => ({
  id: `f${num}`, ficheroId: 'x', num, notaPermanente: '', cita: '', sourceId: null, pageLabel: '', pageManual: true, anchor: null,
  tags: [], referencia: '', notas: '', extra: {}, createdAt: '', updatedAt: '', ...patch,
})
const none = () => undefined
const text = (f: Ficha, c: Column) => (c.field === 'extra' ? f.extra[c.header] ?? '' : String(f[c.field as keyof Ficha] ?? ''))

const estado: Column = { header: 'Estado', field: 'extra', kind: 'lista', options: ['Pendiente', 'Lista'] }
const revisada: Column = { header: 'Revisada', field: 'extra', kind: 'casilla' }
const peso: Column = { header: 'Peso', field: 'extra', kind: 'numero' }
const fecha: Column = { header: 'Leída', field: 'extra', kind: 'fecha' }
const notas: Column = { header: 'Notas', field: 'notas' }
const tags: Column = { header: 'Tags', field: 'tags' }

test('filtrar por texto, vacías y valores', () => {
  const a = ficha(1, { notas: 'Haecceitas y natura communis', tags: ['individuación'], extra: { Estado: 'Lista', Revisada: 'TRUE' } })
  const b = ficha(2, { notas: '', tags: [], extra: { Estado: 'Pendiente' } })
  const pass = (f: Ficha, c: Column, filter: object) => matchFilter(f, c, filter, undefined, text(f, c))
  expect(pass(a, notas, { q: 'NATURA' })).toBe(true)
  expect(pass(a, notas, { q: 'haecceitás' })).toBe(true) // sin acentos ni mayúsculas
  expect(pass(b, notas, { empty: 'vacia' })).toBe(true)
  expect(pass(a, notas, { empty: 'vacia' })).toBe(false)
  expect(pass(a, estado, { values: ['Lista'] })).toBe(true)
  expect(pass(b, estado, { values: ['Lista'] })).toBe(false)
  expect(pass(a, revisada, { values: ['sí'] })).toBe(true) // TRUE de Sheets cuenta como marcada
  expect(pass(b, revisada, { values: [''] })).toBe(true)
  expect(pass(b, tags, { values: [''] })).toBe(true) // sin tags = «(vacía)»
  expect(pass(a, tags, { values: [] })).toBe(false) // «Ninguno»
})

test('filtrar por rango de números, de fechas y de ID', () => {
  const f = ficha(7, { extra: { Peso: '2,5', Leída: '2026-03-14' } })
  const pass = (c: Column, filter: object) => matchFilter(f, c, filter, undefined, c.field === 'num' ? '7' : text(f, c))
  expect(pass(peso, { min: '2', max: '3' })).toBe(true)
  expect(pass(peso, { min: '3' })).toBe(false)
  expect(pass(fecha, { min: '2026-01-01', max: '2026-03-14' })).toBe(true)
  expect(pass(fecha, { max: '2026-03-13' })).toBe(false)
  expect(pass({ header: 'ID', field: 'num' }, { min: '5', max: '10' })).toBe(true)
})

test('ordenar por columna: números como números y las vacías siempre al final', () => {
  const fs = [ficha(1, { extra: { Peso: '10' } }), ficha(2), ficha(3, { extra: { Peso: '9' } }), ficha(4, { extra: { Peso: '9,5' } })]
  expect(sortByColumn(fs, peso, false, none).map((f) => f.num)).toEqual([3, 4, 1, 2])
  expect(sortByColumn(fs, peso, true, none).map((f) => f.num)).toEqual([1, 4, 3, 2])
  const ns = [ficha(1, { notas: 'b' }), ficha(2, { notas: 'Á' }), ficha(3, { notas: 'c 10' }), ficha(4, { notas: 'c 9' })]
  expect(sortByColumn(ns, notas, false, none).map((f) => f.num)).toEqual([2, 1, 4, 3])
})

test('valores distintos: las opciones de la lista en su orden, aunque nadie las use', () => {
  const fs = [ficha(1, { extra: { Estado: 'Lista' } }), ficha(2, { extra: { Estado: 'Lista' } }), ficha(3)]
  expect(distinctValues(fs, estado, none, new Map()).map((v) => [v.label, v.count])).toEqual([['Pendiente', 0], ['Lista', 2], ['(vacía)', 1]])
  const src: Source = { id: 's', citekey: 's', csl: { id: 's', title: 'Ordinatio' }, pdfFile: null, pdfPages: null, pagination: [], paginationVerified: false, paginationNote: '' }
  const withSource = [ficha(1, { sourceId: 's' }), ficha(2)]
  expect(distinctValues(withSource, { header: 'Paper', field: 'fuente' }, (f) => (f.sourceId ? src : undefined), new Map([['s', src]])).map((v) => v.label))
    .toEqual(['Ordinatio', 'Sin fuente vinculada'])
})

test('orden manual: mover una ficha no cambia ningún número', () => {
  const fs = [1, 2, 3, 4].map((n) => ficha(n))
  const moved = reorder(fs, 'f4', 'f2') // la 4 delante de la 2
  const after = fs.map((f) => ({ ...f, orden: moved.get(f.id) ?? f.orden })).sort((a, b) => a.orden! - b.orden!)
  expect(after.map((f) => f.num)).toEqual([1, 4, 2, 3])
  expect(moved.get('f1')).toBe(1)
  // Al final:
  const end = reorder(after, 'f1', null)
  const last = after.map((f) => ({ ...f, orden: end.get(f.id) ?? f.orden })).sort((a, b) => a.orden! - b.orden!)
  expect(last.map((f) => f.num)).toEqual([4, 2, 3, 1])
  // El CSV sale en ese orden.
  const csv = fichasToCsv(last.reverse(), [{ header: 'ID', field: 'num' }], [])
  expect(csv.trim().split(/\r?\n/)).toEqual(['ID', '4', '2', '3', '1'])
})

test('renombrar y eliminar columnas propias mueve o borra sus valores', () => {
  const before: Column[] = [notas, estado, { header: 'Trad.', field: 'extra' }]
  const fs = [ficha(1, { extra: { Estado: 'Lista', 'Trad.': 'Wolter', Suelta: 'x' } }), ficha(2)]
  const { columns, changed } = applyColumns(fs, before, [
    { ...notas, orig: 'Notas' },
    { ...estado, header: 'Situación', orig: 'Estado' },
    { header: 'Revisada', field: 'extra', kind: 'casilla' }, // nueva; «Trad.» se elimina
  ])
  expect(columns.map((c) => c.header)).toEqual(['Notas', 'Situación', 'Revisada'])
  expect(changed).toHaveLength(1)
  expect(changed[0].extra).toEqual({ Situación: 'Lista', Suelta: 'x' })
})

test('intercambiar dos nombres no pierde valores', () => {
  const before: Column[] = [{ header: 'A', field: 'extra' }, { header: 'B', field: 'extra' }]
  const { changed } = applyColumns([ficha(1, { extra: { A: '1', B: '2' } })], before, [{ header: 'B', field: 'extra', orig: 'A' }, { header: 'A', field: 'extra', orig: 'B' }])
  expect(changed[0].extra).toEqual({ B: '1', A: '2' })
})

test('el editor de columnas avisa de nombres repetidos, vacíos y listas sin opciones', () => {
  expect(columnsProblem([{ header: 'Estado', field: 'extra' }, { header: 'estado ', field: 'extra' }])).toMatch(/dos columnas/)
  expect(columnsProblem([{ header: ' ', field: 'extra' }])).toMatch(/nombre/)
  expect(columnsProblem([{ header: 'Estado', field: 'extra', kind: 'lista', options: [' '] }])).toMatch(/opción/)
  expect(columnsProblem([{ header: 'Notas', field: 'notas', hidden: true }])).toMatch(/visible/)
  expect(columnsProblem([notas, estado])).toBeNull()
})

test('la vista guardada olvida las columnas que ya no existen', () => {
  const json = JSON.stringify({ sort: { header: 'Viejo' }, filters: { Notas: { q: 'x' }, Viejo: { q: 'y' }, Tags: {} } })
  expect(readView(json, [notas, tags])).toEqual({ sort: undefined, filters: { Notas: { q: 'x' } } })
  expect(readView('no es json', [notas])).toEqual({ filters: {} })
})
