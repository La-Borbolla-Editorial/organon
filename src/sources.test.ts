import { expect, test } from 'vitest'
import { cslFromDoi, cslFromOpenLibrary, parseIdentifier, splitName } from './lookup'
import { applyFields, EMPTY_FIELDS, fieldsFromCsl, suggestCitekey } from './source-form'

test('reconoce DOI e ISBN pegados de cualquier manera', () => {
  expect(parseIdentifier('https://doi.org/10.1017/CCOL0521632056.004')).toEqual({ kind: 'doi', value: '10.1017/CCOL0521632056.004' })
  expect(parseIdentifier('doi:10.5840/acpq2005791.')).toEqual({ kind: 'doi', value: '10.5840/acpq2005791' })
  expect(parseIdentifier('ISBN 978-0-521-63563-9')).toEqual({ kind: 'isbn', value: '9780521635639' })
  expect(parseIdentifier('0-521-63563-2')).toEqual({ kind: 'isbn', value: '0521635632' })
  expect(parseIdentifier('Scotus on Individuation')).toBeNull()
})

test('respuesta de doi.org → CSL limpio', () => {
  const csl = cslFromDoi({
    type: 'book-chapter', title: ['Universals and  Individuation'], author: [{ family: 'Noone', given: 'Timothy B.', sequence: 'first', affiliation: [] }],
    'container-title': ['The Cambridge Companion to Duns Scotus'], issued: { 'date-parts': [[2002, 12, 9]] }, page: '100-128', publisher: 'Cambridge University Press',
    ISBN: ['9780521632058', '9780521635639'], DOI: '10.1017/ccol0521632056.004', 'reference-count': 0, indexed: {},
  })
  expect(csl).toEqual({
    type: 'chapter', title: 'Universals and Individuation', author: [{ family: 'Noone', given: 'Timothy B.' }],
    'container-title': 'The Cambridge Companion to Duns Scotus', issued: { 'date-parts': [[2002]] }, page: '100-128', publisher: 'Cambridge University Press',
    ISBN: '9780521632058', DOI: '10.1017/ccol0521632056.004',
  })
})

test('respuesta de Open Library → CSL', () => {
  const csl = cslFromOpenLibrary({ title: 'The Cambridge Companion to Duns Scotus', authors: [{ name: 'Thomas Williams' }], publishers: [{ name: 'Cambridge University Press' }], publish_date: 'December 9, 2002' }, '9780521635639')
  expect(csl).toMatchObject({ type: 'book', author: [{ family: 'Williams', given: 'Thomas' }], issued: { 'date-parts': [[2002]] }, publisher: 'Cambridge University Press' })
})

test('nombres', () => {
  expect(splitName('Duns Scotus, John')).toEqual({ family: 'Duns Scotus', given: 'John' })
  expect(splitName('Paul Vincent Spade')).toEqual({ family: 'Spade', given: 'Paul Vincent' })
  expect(splitName('Aristóteles')).toEqual({ literal: 'Aristóteles' })
})

test('formulario → CSL y vuelta, sin perder campos ajenos', () => {
  const csl = applyFields({ note: 'campo de Zotero' }, {
    ...EMPTY_FIELDS, type: 'book', title: 'Five Texts on the Mediaeval Problem of Universals', author: 'Spade, Paul Vincent', translator: 'Spade, Paul Vincent',
    year: '1994', publisher: 'Hackett', publisherPlace: 'Indianapolis',
  })
  expect(csl).toEqual({
    note: 'campo de Zotero', type: 'book', title: 'Five Texts on the Mediaeval Problem of Universals',
    author: [{ family: 'Spade', given: 'Paul Vincent' }], translator: [{ family: 'Spade', given: 'Paul Vincent' }],
    issued: { 'date-parts': [[1994]] }, publisher: 'Hackett', 'publisher-place': 'Indianapolis',
  })
  expect(applyFields(csl, fieldsFromCsl(csl))).toEqual(csl)
  // Vaciar un campo lo quita; un tipo que el formulario no conoce se respeta.
  expect(applyFields(csl, { ...fieldsFromCsl(csl), publisher: '' }).publisher).toBeUndefined()
  expect(applyFields({ type: 'manuscript', title: 'x' }, fieldsFromCsl({ type: 'manuscript', title: 'x' })).type).toBe('manuscript')
})

test('clave de cita', () => {
  const csl = { author: [{ family: 'Pini' }], issued: { 'date-parts': [[2005]] } }
  expect(suggestCitekey(csl, new Set())).toBe('pini2005')
  expect(suggestCitekey(csl, new Set(['pini2005']))).toBe('pini2005b')
  expect(suggestCitekey({ title: 'Ordinatio' }, new Set())).toBe('ordinatio')
})
