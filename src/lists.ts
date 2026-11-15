// Numeración automática de las listas: cada punto numerado lleva el número que le toca
// en su nivel, como en un procesador de textos. Al anidar un punto (Tab) empieza en 1;
// al insertar o quitar uno, los siguientes se corrigen.
import type { Text } from '@codemirror/state'

const ITEM = /^([ \t]*)(?:(\d+)([.)])|[-*+])[ \t]/
const INDENTED = /^[ \t]+\S/

const width = (ws: string) => [...ws].reduce((w, c) => w + (c === '\t' ? 4 : 1), 0)
const blank = (text: string) => text.trim() === ''
/** Parte de una lista: un punto, o texto sangrado que sigue a un punto. */
const inList = (text: string) => ITEM.test(text) || INDENTED.test(text)

export interface Renumber { from: number; to: number; insert: string }

/** ¿Hay algún punto de lista entre esas líneas (1-based)? */
export function touchesList(doc: Text, fromLine: number, toLine: number): boolean {
  for (let n = Math.max(1, fromLine - 1); n <= Math.min(doc.lines, toLine + 1); n++) if (ITEM.test(doc.line(n).text)) return true
  return false
}

/**
 * Cambios para renumerar la lista que contiene esas líneas. Una lista sigue a través de
 * líneas en blanco y de texto sangrado; la corta un párrafo o un título sin sangría.
 */
export function renumber(doc: Text, fromLine: number, toLine: number): Renumber[] {
  const boundary = (n: number) => { const t = doc.line(n).text; return !blank(t) && !inList(t) }
  let start = Math.max(1, fromLine)
  while (start > 1 && !boundary(start - 1)) start--
  let end = Math.min(doc.lines, toLine)
  while (end < doc.lines && !boundary(end + 1)) end++

  const changes: Renumber[] = []
  // Por cada nivel abierto, su sangría y cuántos puntos lleva.
  const stack: { width: number; count: number }[] = []
  for (let n = start; n <= end; n++) {
    const line = doc.line(n)
    const m = ITEM.exec(line.text)
    if (!m) {
      // Texto sin sangría (no debería estar aquí) cierra todos los niveles.
      if (!blank(line.text) && !INDENTED.test(line.text)) stack.length = 0
      continue
    }
    const w = width(m[1])
    while (stack.length && stack[stack.length - 1].width > w) stack.pop()
    const top = stack[stack.length - 1]
    if (top && top.width === w) top.count++
    else stack.push({ width: w, count: 1 })
    if (m[2] !== undefined) {
      const want = String(stack[stack.length - 1].count)
      if (m[2] !== want) {
        const from = line.from + m[1].length
        changes.push({ from, to: from + m[2].length, insert: want })
      }
    }
  }
  return changes
}
