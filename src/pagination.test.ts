import { expect, test } from 'vitest'
import { anchorPage, citedPages, fromRoman, printedPage, sheetLabel, toRoman, type PageRange } from './pagination'

const article: PageRange[] = [{ pdfStart: 1, first: 68, style: 'arabic', perPage: 1 }]
const book: PageRange[] = [
  { pdfStart: 1, first: 1, style: 'none', perPage: 1 },
  { pdfStart: 3, first: 1, style: 'roman', perPage: 1 },
  { pdfStart: 15, first: 1, style: 'arabic', perPage: 1 },
]
const spreads: PageRange[] = [{ pdfStart: 2, first: 10, style: 'arabic', perPage: 2 }]

test('desplazamiento simple', () => {
  expect(printedPage(article, 1)).toBe('68')
  expect(printedPage(article, 3)).toBe('70')
})

test('preliminares en romanos y luego arábigos', () => {
  expect(printedPage(book, 1)).toBeNull()
  expect(printedPage(book, 3)).toBe('i')
  expect(printedPage(book, 14)).toBe('xii')
  expect(printedPage(book, 15)).toBe('1')
  expect(printedPage(book, 20)).toBe('6')
})

test('hojas dobles', () => {
  expect(printedPage(spreads, 1)).toBeNull()
  expect(printedPage(spreads, 2, 0)).toBe('10')
  expect(printedPage(spreads, 2, 1)).toBe('11')
  expect(printedPage(spreads, 4, 1)).toBe('15')
  expect(sheetLabel(spreads, 3)).toBe('12-13')
})

test('selección que cruza de página', () => {
  expect(citedPages(article, { page: 2, half: 0 }, { page: 2, half: 0 })).toBe('69')
  expect(citedPages(article, { page: 2, half: 0 }, { page: 3, half: 0 })).toBe('69-70')
  expect(citedPages(spreads, { page: 2, half: 0 }, { page: 2, half: 1 })).toBe('10-11')
})

test('romanos', () => {
  expect(toRoman(14)).toBe('xiv')
  expect(fromRoman('xiv')).toBe(14)
  expect(fromRoman('XLII')).toBe(42)
  expect(fromRoman('iiii')).toBeNull()
  expect(fromRoman('mild')).toBeNull()
})

test('fijar la página impresa de una hoja', () => {
  expect(printedPage(anchorPage(article, 5, '80')!, 1)).toBe('76')
  const b = anchorPage(book, 20, '8')!
  expect(printedPage(b, 15)).toBe('3')
  expect(printedPage(b, 14)).toBe('xii')
  const c = anchorPage(article, 10, '1', true)!
  expect(printedPage(c, 9)).toBe('76')
  expect(printedPage(c, 11)).toBe('2')
  // «la hoja 5 es la página 2»: la numeración empieza en la hoja 4
  const d = anchorPage([{ pdfStart: 1, first: 1, style: 'arabic', perPage: 1 }], 5, '2')!
  expect(printedPage(d, 3)).toBeNull()
  expect(printedPage(d, 4)).toBe('1')
  expect(printedPage(d, 5)).toBe('2')
  expect(anchorPage(article, 1, 'abc')).toBeNull()
})
