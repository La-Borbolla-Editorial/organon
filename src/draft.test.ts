import { expect, test } from 'vitest'
import { findTokens, isFragmentOf, markerProblem, resolveDraft, setFrontMatter, splitFrontMatter, tokenText, type DraftContext } from './draft'
import type { Ficha, Source } from './types'

const source = (id: string, family: string, title: string, year: number): Source => ({
  id, citekey: id, csl: { id, type: 'article-journal', title, author: [{ family, given: 'G.' }], 'container-title': 'Revista', volume: '5', issued: { 'date-parts': [[year]] }, page: '50-69' },
  pdfFile: null, pdfPages: null, pagination: [], paginationVerified: true, paginationNote: '',
})
const ficha = (ficheroId: string, num: number, cita: string, sourceId: string | null, pageLabel: string): Ficha => ({
  id: `${ficheroId}-${num}`, ficheroId, num, notaPermanente: '', cita, sourceId, pageLabel, pageManual: true, anchor: null, tags: [], referencia: '', notas: '', extra: {}, createdAt: '', updatedAt: '',
})

const ctx: DraftContext = {
  ficheros: [{ id: 'sec', name: 'Secundarias', marker: 'f.', columns: [] }, { id: 'esc', name: 'Escoto', marker: 'f.', columns: [] }],
  sources: [source('pini', 'Pini', 'Scotus on Individuation', 2005), source('noone', 'Noone', 'Universals and Individuation', 2003)],
  fichas: [
    ficha('sec', 1, 'Some held that the principle is a positive entity.', 'pini', '68'),
    ficha('sec', 2, 'A second passage.', 'pini', '69-70'),
    ficha('sec', 3, 'Universals come first.', 'noone', '101'),
    ficha('sec', 4, 'Sin fuente.', null, ''),
    ficha('esc', 1, 'Natura est indifferens.', 'noone', '12'),
    ficha('esc', 9, 'Solo en Escoto.', 'pini', '55'),
  ],
  cite: { style: 'chicago-short', locale: 'es-ES' },
}

test('cabecera', () => {
  const md = '---\nfichero: Secundarias\n---\n\nTexto.'
  expect(splitFrontMatter(md)).toMatchObject({ meta: { fichero: 'Secundarias' }, body: '\nTexto.' })
  expect(setFrontMatter('Texto.', 'fichero', 'Escoto')).toBe('---\nfichero: Escoto\n---\n\nTexto.')
  expect(setFrontMatter(md, 'fichero', 'Escoto')).toBe('---\nfichero: Escoto\n---\n\nTexto.')
  expect(setFrontMatter(md, 'fichero', '')).toBe('Texto.')
})

test('reconoce las referencias y nada más', () => {
  const names = ctx.ficheros
  const plain = { fragment: null, fullInNote: false, page: null, marker: 'f.' }
  const t = findTokens('Uno {f. 51} dos [f. 7] tres [cf. f. 2; Escoto f. 3] y {Escoto f. 9}.', names)
  expect(t.map((x) => [x.kind, x.refs])).toEqual([
    ['insert', [{ ...plain, fichero: null, num: 51, prefix: '' }]],
    ['cite', [{ ...plain, fichero: null, num: 7, prefix: '' }]],
    ['cite', [{ ...plain, fichero: null, num: 2, prefix: 'cf.' }, { ...plain, fichero: 'Escoto', num: 3, prefix: '' }]],
    ['insert', [{ ...plain, fichero: 'Escoto', num: 9, prefix: '' }]],
  ])
  // Enlaces, notas de Markdown y corchetes cualesquiera no son referencias.
  expect(findTokens('[f. 3](http://x) [^f. 3] [una nota] {llaves} [f. 3]: def', names)).toEqual([])
  // El editor de texto enriquecido puede escapar los corchetes.
  expect(findTokens('\\[f. 3\\]', names)).toHaveLength(1)
})

test('cita dentro de la frase, cita en bloque y solo referencia', () => {
  const md = '---\nfichero: Secundarias\n---\nComo dice Pini, {f. 1} y sigue.\n\n{f. 3}\n\nUna paráfrasis [f. 2].\n'
  const r = resolveDraft(md, ctx)
  expect(r.problems).toEqual([])
  expect(r.markdown).toBe(
    [
      'Como dice Pini, «Some held that the principle is a positive entity.»[^1] y sigue.',
      '',
      '> Universals come first.[^2]',
      '',
      'Una paráfrasis [^3].',
      '',
      '[^1]: Pini, «Scotus on Individuation», 68.',
      '',
      '[^2]: Noone, «Universals and Individuation», 101.',
      '',
      '[^3]: Pini, «Scotus on Individuation», 69-70.',
      '',
      '## Bibliografía',
      '',
      'Noone, G. «Universals and Individuation». *Revista* 5 (2003): 50-69.',
      '',
      'Pini, G. «Scotus on Individuation». *Revista* 5 (2005): 50-69.',
      '',
    ].join('\n'),
  )
  expect(r).toMatchObject({ citations: 3, sources: 2 })
})

test('varias fichas en una nota, con prefijo y fichero', () => {
  const r = resolveDraft('Texto [cf. Secundarias f. 2; Escoto f. 9].', ctx)
  expect(r.problems).toEqual([])
  expect(r.markdown).toContain('[^1]: cf. Pini, «Scotus on Individuation», 69-70; Pini, «Scotus on Individuation», 55.')
})

test('avisa de lo que no puede resolver', () => {
  const r = resolveDraft('A {f. 1} b [f. 99] c [Secundarias f. 4] d {f. 9}.', ctx)
  expect(r.problems.map((p) => p.message)).toEqual([
    expect.stringContaining('Hay una ficha 1 en varios ficheros con el marcador «f.» (Secundarias, Escoto)'),
    'No existe la ficha f. 99.',
    'La ficha f. 4 no tiene fuente: no se puede citar.',
  ])
  expect(r.markdown).toContain('d «Solo en Escoto.»[^1].') // la única ficha 9 se resuelve sin nombrar el fichero
  expect(r.markdown).toContain('**[⚠ sin referencia]**')
})

test('estilo autor-año: la cita va en el texto', () => {
  const r = resolveDraft('Una paráfrasis [Secundarias f. 2].', { ...ctx, cite: { style: 'apa', locale: 'es-ES' } })
  expect(r.markdown).toContain('Una paráfrasis (Pini, 2005, pp. 69-70).')
  expect(r.markdown).not.toContain('[^1]')
})

// ---- Marcador propio de cada fichero -------------------------------------------------

const marked: DraftContext = { ...ctx, ficheros: [{ ...ctx.ficheros[0], marker: 's.' }, { ...ctx.ficheros[1], marker: 'e.' }] }

test('cada fichero con su marcador: el marcador dice de qué fichero es', () => {
  const r = resolveDraft('Uno {s. 1} y otro {e. 1}, y además [cf. e. 9; s. 3].', marked)
  expect(r.problems).toEqual([])
  expect(r.markdown).toContain('Uno «Some held that the principle is a positive entity.»[^1] y otro «Natura est indifferens.»[^2]')
  expect(r.markdown).toContain('[^3]: cf. Pini, «Scotus on Individuation», 55; Noone, «Universals and Individuation», 101.')
  // «f.» ya no es marcador de nadie: se queda como texto.
  expect(findTokens('{f. 1} [f. 2]', marked.ficheros)).toEqual([])
  // Un marcador no se reconoce pegado a otra palabra.
  expect(findTokens('[tres. 1] {cosas. 2}', marked.ficheros)).toEqual([])
})

test('marcadores válidos', () => {
  expect(markerProblem('e.')).toBeNull()
  expect(markerProblem('Esc')).toBeNull()
  expect(markerProblem('')).not.toBeNull()
  expect(markerProblem('a b')).not.toBeNull()
  expect(markerProblem('f1')).not.toBeNull()
  expect(markerProblem('[f]')).not.toBeNull()
})

test('escribir una referencia: solo nombra el fichero si el marcador no basta', () => {
  const [sec1, , , , esc1, esc9] = ctx.fichas
  expect(tokenText('insert', sec1, marked, null)).toBe('{s. 1}')
  expect(tokenText('cite', esc1, marked, null, { fullInNote: true })).toBe('[e. 1 +]')
  expect(tokenText('insert', sec1, marked, null, { fragment: 'a positive\n entity' })).toBe('{s. 1 «a positive entity»}')
  // Con el mismo marcador en los dos ficheros:
  expect(tokenText('insert', sec1, ctx, null)).toBe('{Secundarias f. 1}') // hay otra ficha 1
  expect(tokenText('insert', esc9, ctx, null)).toBe('{f. 9}') // solo hay una ficha 9
  expect(tokenText('insert', sec1, ctx, ctx.ficheros[0])).toBe('{f. 1}') // es el fichero por defecto
  expect(tokenText('insert', esc9, ctx, ctx.ficheros[0])).toBe('{Escoto f. 9}')
})

// ---- Opciones: pedazo, cita completa en la nota, página ----------------------------

test('citar solo un pedazo de la ficha', () => {
  const r = resolveDraft('Para Pini es {s. 1 «a positive entity»}.', marked)
  expect(r.problems).toEqual([])
  expect(r.markdown).toContain('Para Pini es «a positive entity»[^1].')
  expect(r.markdown).toContain('[^1]: Pini, «Scotus on Individuation», 68.')
})

test('pedazo en el texto y cita completa en la nota', () => {
  const r = resolveDraft('Para Pini es {s. 1 «a positive entity» +}.', marked)
  expect(r.markdown).toContain('Para Pini es «a positive entity»[^1].')
  expect(r.markdown).toContain('[^1]: Pini, «Scotus on Individuation», 68: «Some held that the principle is a positive entity.».')
})

test('paráfrasis con la cita (completa o un pedazo) en la nota', () => {
  const r = resolveDraft('Algunos lo creían positivo [s. 1 +]; otros, lo contrario [s. 1 "a positive entity"].', marked)
  expect(r.problems).toEqual([])
  expect(r.markdown).toContain('Algunos lo creían positivo [^1]; otros, lo contrario [^2].')
  expect(r.markdown).toContain('[^1]: Pini, «Scotus on Individuation», 68: «Some held that the principle is a positive entity.».')
  expect(r.markdown).toContain('[^2]: Pini, «Scotus on Individuation», 68: «a positive entity».')
})

test('otra página para esta cita', () => {
  const r = resolveDraft('Véase [s. 2, p. 70] y [s. 2 pp. 69–71 +].', marked)
  expect(r.problems).toEqual([])
  expect(r.markdown).toContain('[^1]: Pini, «Scotus on Individuation», 70.')
  expect(r.markdown).toContain('[^2]: Pini, «Scotus on Individuation», 69-71: «A second passage.».')
})

test('avisa si el pedazo no está en la ficha', () => {
  expect(isFragmentOf('the principle  is a “positive” entity', 'Some held that the principle is a "positive" entity.')).toBe(true)
  expect(isFragmentOf('Some held […] a positive entity', 'Some held that the principle is a positive entity.')).toBe(true)
  expect(isFragmentOf('a positive entity ... Some held', 'Some held that the principle is a positive entity.')).toBe(false)
  const r = resolveDraft('Dice {s. 1 «a negative entity»}.', marked)
  expect(r.problems.map((p) => p.message)).toEqual(['El pedazo «a negative entity» no aparece tal cual en la ficha s. 1. Revísalo.'])
  expect(r.markdown).toContain('Dice «a negative entity»[^1].') // se respeta lo escrito, pero avisando
})

test('estilo autor-año con cita en nota', () => {
  const r = resolveDraft('Una paráfrasis [s. 2 +].', { ...marked, cite: { style: 'apa', locale: 'es-ES' } })
  expect(r.markdown).toContain('Una paráfrasis (Pini, 2005, pp. 69-70)[^1].')
  expect(r.markdown).toContain('[^1]: «A second passage.».')
})
