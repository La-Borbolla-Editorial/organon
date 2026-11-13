// Copia los recursos estáticos de PDF.js (fuentes, cmaps, wasm) a public/pdfjs.
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, 'node_modules/pdfjs-dist')
const to = join(root, 'public/pdfjs')
mkdirSync(to, { recursive: true })
for (const d of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) cpSync(join(from, d), join(to, d), { recursive: true })
