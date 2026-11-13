// Genera fixtures/articulo-ejemplo.pdf: un artículo inventado de 12 hojas cuyas
// páginas impresas van de la 68 a la 79 (para probar la paginación).
//   node fixtures/make.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'

const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.TimesRoman)
const para = [
  'This is an invented article used to test the reader. Each sheet carries a printed',
  'page number in its running head, and that number is not the position of the sheet',
  'in the file: the first sheet is page 68, as in a journal issue. One word is hyphen-',
  'ated across two lines so that the quotation clean-up can be checked.',
]
for (let i = 0; i < 12; i++) {
  const page = doc.addPage([432, 648])
  const n = 68 + i
  page.drawText(n % 2 === 0 ? `${n}    A. N. AUTHOR` : `AN INVENTED ARTICLE    ${n}`, { x: n % 2 === 0 ? 50 : 200, y: 600, size: 9, font })
  let y = 560
  for (let k = 1; k <= 6; k++) {
    page.drawText(`Paragraph ${n}.${k}.`, { x: 50, y, size: 10.5, font })
    y -= 15
    for (const line of para) { page.drawText(line, { x: 50, y, size: 10.5, font }); y -= 15 }
    y -= 12
  }
}
writeFileSync(new URL('./articulo-ejemplo.pdf', import.meta.url), await doc.save())
