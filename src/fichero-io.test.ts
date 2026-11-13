import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseCsv, toCsv } from './csv'
import { fichasToCsv, guessColumns, matchSource, readCsv, rowsToFichas } from './fichero-io'
import type { Ficha, Source } from './types'

// Un fichero inventado con la forma de una exportación de Google Sheets.
const sample = readFileSync(new URL('../fixtures/fichero-ejemplo.csv', import.meta.url), 'utf8')

const source = (id: string, family: string, title: string): Source => ({
  id, citekey: id, csl: { id, type: 'article-journal', title, author: [{ family, given: 'X' }] },
  pdfFile: null, pdfPages: null, pagination: [], paginationVerified: false, paginationNote: '',
})

test('CSV: comillas, comas y saltos de línea dentro de una celda', () => {
  const rows = [['a', 'b,c', 'd "e"'], ['línea 1\nlínea 2', '', 'f']]
  expect(parseCsv(toCsv(rows))).toEqual(rows)
})

test('el fichero de ejemplo se lee y se vuelve a escribir idéntico', () => {
  expect(toCsv(parseCsv(sample))).toBe(sample)
})

test('adivina las columnas de las dos pestañas', () => {
  expect(guessColumns(['ID', 'Nota permanente', 'Cita', 'Tema', 'Autor', 'Paper/Texto', 'Página', 'Referencias', 'Notas']).map((c) => c.field)).toEqual([
    'num', 'notaPermanente', 'cita', 'tags', 'autor', 'fuente', 'pageLabel', 'referencia', 'notas',
  ])
  expect(guessColumns(['ID', 'Nota permanente', 'Cita', 'Tags', 'Obra Canónica', 'Trad.', 'Notas']).map((c) => c.field)).toEqual([
    'num', 'notaPermanente', 'cita', 'tags', 'referencia', 'extra', 'notas',
  ])
})

test('reconoce la fuente por autor y título', () => {
  const sources = [source('a', 'Pini', 'Scotus on Individuation'), source('b', 'Noone', 'Universals and Individuation'), source('c', 'Pini', 'Scotus on the Objects of Cognitive Acts')]
  expect(matchSource(sources, 'Pini', 'Scotus on Individuation')?.id).toBe('a')
  expect(matchSource(sources, 'Noone', 'Universals and Individuation')?.id).toBe('b')
  expect(matchSource(sources, 'Pini', '')).toBeNull() // dos de Pini: ambiguo
  expect(matchSource(sources, 'King', 'Scotus on Individuation')).toBeNull()
})

test('importar y exportar el fichero no pierde nada', () => {
  const csv = readCsv(sample)
  const columns = guessColumns(csv.headers)
  const sources = [source('a', 'Pini', 'Scotus on Individuation')]
  const imported = rowsToFichas(csv, columns, sources, null)
  expect(imported).toHaveLength(5)
  expect(imported[0]).toMatchObject({ num: 1, pageLabel: '68', tags: ['Problema General'], sourceId: 'a' })
  expect(imported[1]).toMatchObject({ pageLabel: '69-70', tags: ['Terminología', 'TEXTO CLAVE'] })
  expect(imported[2]).toMatchObject({ pageLabel: 'xii', sourceId: null })
  expect(imported[4].num).toBe(7)
  const fichas = imported.map((f, i): Ficha => ({ ...f, id: String(i), num: f.num ?? i + 1, ficheroId: 'x', pageManual: true, anchor: null, createdAt: '', updatedAt: '' }))
  expect(fichasToCsv(fichas, columns, sources)).toBe(sample)
})
