// Del texto ya compuesto (Markdown con notas `[^n]` y bibliografía) a un .docx
// con notas al pie de verdad, que Word o Pages numeran y colocan en cada página.
import { Document, ExternalHyperlink, FootnoteReferenceRun, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun, type IParagraphOptions, type ParagraphChild } from 'docx'
import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'

type MdToken = ReturnType<InstanceType<typeof MarkdownIt>['parse']>[number]

const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).use(footnote)
md.disable('code') // una línea sangrada es parte de un esquema, no código

const FONT = 'EB Garamond'
const BODY = 24 // medios puntos: 12 pt
const NOTE = 20
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]

/** Los hijos de un token `inline` → fragmentos de Word. */
function inlineRuns(children: MdToken[] | null, size: number): ParagraphChild[] {
  const out: ParagraphChild[] = []
  let bold = false
  let italics = false
  let link: { href: string; runs: TextRun[] } | null = null
  const push = (run: TextRun) => (link ? link.runs.push(run) : out.push(run))
  const text = (t: string, extra: object = {}) => push(new TextRun({ text: t, bold, italics, size, ...(link ? { style: 'Hyperlink' } : {}), ...extra }))
  for (const t of children ?? []) {
    switch (t.type) {
      case 'text': if (t.content) text(t.content); break
      case 'code_inline': text(t.content, { font: 'Menlo', size: size - 2 }); break
      case 'softbreak': text(' '); break
      case 'hardbreak': push(new TextRun({ break: 1 })); break
      case 'strong_open': bold = true; break
      case 'strong_close': bold = false; break
      case 'em_open': italics = true; break
      case 'em_close': italics = false; break
      case 'link_open': link = { href: String(t.attrGet('href') ?? ''), runs: [] }; break
      case 'link_close':
        if (link) out.push(new ExternalHyperlink({ link: link.href, children: link.runs }))
        link = null
        break
      // Los ids de las notas de Word empiezan en 1.
      case 'footnote_ref': out.push(new FootnoteReferenceRun(Number(t.meta?.id ?? 0) + 1)); break
      case 'footnote_anchor': break
      default: if (t.content) text(t.content)
    }
  }
  return out
}

export interface DocxOptions {
  /** Título del documento (propiedades del archivo). */
  title: string
  /** Texto del encabezado de la bibliografía, para sangrar sus entradas a la francesa. */
  bibliographyHeading?: string
}

export async function markdownToDocx(markdown: string, options: DocxOptions): Promise<Uint8Array> {
  const tokens = md.parse(markdown, {})
  const body: Paragraph[] = []
  const footnotes: Record<string, { children: Paragraph[] }> = {}

  let quote = 0
  let inBibliography = false
  let footnoteId: number | null = null
  const lists: { ordered: boolean; instance: number }[] = []
  let instances = 0
  let firstInItem = false

  const add = (p: Paragraph) => {
    if (footnoteId !== null) (footnotes[footnoteId] ??= { children: [] }).children.push(p)
    else body.push(p)
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    switch (t.type) {
      case 'heading_open': {
        const level = Number(t.tag.slice(1))
        const inline = tokens[i + 1]
        inBibliography = !!options.bibliographyHeading && inline.content.trim() === options.bibliographyHeading
        add(new Paragraph({ heading: HEADINGS[level - 1], children: inlineRuns(inline.children, BODY + Math.max(0, 4 - level) * 4) }))
        break
      }
      case 'paragraph_open': {
        const inNote = footnoteId !== null
        const size = inNote ? NOTE : quote ? BODY - 2 : BODY
        const list = lists[lists.length - 1]
        const level = lists.length - 1
        let props: Partial<IParagraphOptions> = {}
        if (list && firstInItem) {
          props = list.ordered ? { numbering: { reference: 'lista-numerada', level: Math.min(level, 4), instance: list.instance } } : { bullet: { level: Math.min(level, 4) } }
          firstInItem = false
        } else if (list) props = { indent: { left: 720 * (level + 1) } }
        else if (quote) props = { indent: { left: 720 * quote } }
        else if (inBibliography) props = { indent: { left: 720, hanging: 720 } }
        add(new Paragraph({ ...props, spacing: inNote ? { line: 240, after: 60 } : quote ? { line: 300, after: 160 } : undefined, children: inlineRuns(tokens[i + 1].children, size) }))
        break
      }
      case 'blockquote_open': quote++; break
      case 'blockquote_close': quote--; break
      case 'bullet_list_open': lists.push({ ordered: false, instance: 0 }); break
      case 'ordered_list_open': lists.push({ ordered: true, instance: ++instances }); break
      case 'bullet_list_close':
      case 'ordered_list_close': lists.pop(); break
      case 'list_item_open': firstInItem = true; break
      case 'hr': add(new Paragraph({ thematicBreak: true })); break
      case 'fence':
        for (const line of t.content.replace(/\n$/, '').split('\n')) add(new Paragraph({ spacing: { line: 240, after: 0 }, children: [new TextRun({ text: line, font: 'Menlo', size: BODY - 4 })] }))
        break
      case 'footnote_open': footnoteId = Number(t.meta?.id ?? 0) + 1; break
      case 'footnote_close': footnoteId = null; break
      default: break
    }
  }

  const doc = new Document({
    title: options.title,
    creator: 'Organon',
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY }, paragraph: { spacing: { line: 360, after: 160 } } },
        heading1: { run: { font: FONT, size: 36, bold: true, color: '000000' }, paragraph: { spacing: { before: 240, after: 200 } } },
        heading2: { run: { font: FONT, size: 30, bold: true, color: '000000' }, paragraph: { spacing: { before: 280, after: 160 } } },
        heading3: { run: { font: FONT, size: 26, bold: true, color: '000000' }, paragraph: { spacing: { before: 240, after: 120 } } },
      },
    },
    numbering: {
      config: [{
        reference: 'lista-numerada',
        levels: [0, 1, 2, 3, 4].map((level) => ({
          level, format: level % 2 ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL, text: `%${level + 1}.`,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    footnotes,
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: body }],
  })
  return new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer())
}
