import { expect, test } from 'vitest'
import { findTokens, resolveDraft, setFrontMatter, splitFrontMatter, type DraftContext } from './draft'
import type { Ficha, Source } from './types'

const source = (id: string, family: string, title: string, year: number): Source => ({
  id, citekey: id, csl: { id, type: 'article-journal', title, author: [{ family, given: 'G.' }], 'container-title': 'Revista', volume: '5', issued: { 'date-parts': [[year]] }, page: '50-69' },
  pdfFile: null, pdfPages: null, pagination: [], paginationVerified: true, paginationNote: '',
})
const ficha = (ficheroId: string, num: number, cita: string, sourceId: string | null, pageLabel: string): Ficha => ({
  id: `${ficheroId}-${num}`, ficheroId, num, notaPermanente: '', cita, sourceId, pageLabel, pageManual: true, anchor: null, tags: [], referencia: '', notas: '', extra: {}, createdAt: '', updatedAt: '',
})

const ctx: DraftContext = {
  ficheros: [{ id: 'sec', name: 'Secundarias', columns: [] }, { id: 'esc', name: 'Escoto', columns: [] }],
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
  const names = ['Secundarias', 'Escoto']
  const t = findTokens('Uno {f. 51} dos [f. 7] tres [cf. f. 2; Escoto f. 3] y {Escoto f. 9}.', names)
  expect(t.map((x) => [x.kind, x.refs])).toEqual([
    ['insert', [{ fichero: null, num: 51, prefix: '' }]],
    ['cite', [{ fichero: null, num: 7, prefix: '' }]],
    ['cite', [{ fichero: null, num: 2, prefix: 'cf.' }, { fichero: 'Escoto', num: 3, prefix: '' }]],
    ['insert', [{ fichero: 'Escoto', num: 9, prefix: '' }]],
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
    expect.stringContaining('Hay una ficha 1 en varios ficheros (Secundarias, Escoto)'),
    'No existe la ficha 99.',
    'La ficha 4 no tiene fuente: no se puede citar.',
  ])
  expect(r.markdown).toContain('d «Solo en Escoto.»[^1].') // la única ficha 9 se resuelve sin nombrar el fichero
  expect(r.markdown).toContain('**[⚠ sin referencia]**')
})

test('estilo autor-año: la cita va en el texto', () => {
  const r = resolveDraft('Una paráfrasis [Secundarias f. 2].', { ...ctx, cite: { style: 'apa', locale: 'es-ES' } })
  expect(r.markdown).toContain('Una paráfrasis (Pini, 2005, pp. 69-70).')
  expect(r.markdown).not.toContain('[^1]')
})
