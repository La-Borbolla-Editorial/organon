import JSZip from 'jszip'
import { expect, test } from 'vitest'
import { markdownToDocx } from './export-docx'

const text = (xml: string) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')

test('el .docx lleva el texto, las notas al pie y la bibliografía', async () => {
  const markdown = [
    '# Capítulo 1',
    '',
    'Como dice Pini, «algo *importante*»[^1] y **sigue**.',
    '',
    '> Una cita en bloque.[^2]',
    '',
    '- Uno',
    '\t- Anidado',
    '',
    '[^1]: Pini, «Scotus on Individuation», 68.',
    '',
    '[^2]: Noone, «Universals», 101: «Universals come first.».',
    '',
    '## Bibliografía',
    '',
    'Pini, G. «Scotus on Individuation». *Revista* 5 (2005): 50-69.',
    '',
  ].join('\n')
  const bytes = await markdownToDocx(markdown, { title: 'Capítulo 1', bibliographyHeading: 'Bibliografía' })
  const zip = await JSZip.loadAsync(bytes)
  const document = await zip.file('word/document.xml')!.async('string')
  const footnotes = await zip.file('word/footnotes.xml')!.async('string')

  expect(text(document)).toContain('Como dice Pini, «algo importante» y sigue.')
  expect(text(document)).toContain('Una cita en bloque.')
  expect(text(document)).toContain('Pini, G. «Scotus on Individuation». Revista 5 (2005): 50-69.')
  // Dos llamadas de nota en el cuerpo y sus dos textos en las notas.
  expect(document.match(/<w:footnoteReference /g)).toHaveLength(2)
  expect(text(footnotes)).toContain('Pini, «Scotus on Individuation», 68.')
  expect(text(footnotes)).toContain('Noone, «Universals», 101: «Universals come first.».')
  // Las notas no se repiten al final del cuerpo.
  expect(text(document)).not.toContain('Scotus on Individuation», 68.')
  // Cursiva, negrita, título, lista anidada y sangría francesa en la bibliografía.
  expect(document).toMatch(/<w:i\/>[\s\S]*?importante/)
  expect(document).toMatch(/<w:b\/>[\s\S]*?sigue/)
  expect(document).toContain('w:val="Heading1"')
  expect(document).toContain('<w:ilvl w:val="1"/>')
  expect(document).toMatch(/w:hanging="720"/)
})
