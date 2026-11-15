import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { renumber } from './lists'

const apply = (src: string, from = 1, to = 9999) => {
  const doc = Text.of(src.split('\n'))
  const changes = renumber(doc, from, Math.min(to, doc.lines))
  let out = src
  for (const c of [...changes].reverse()) out = out.slice(0, c.from) + c.insert + out.slice(c.to)
  return out
}

describe('renumber', () => {
  it('un punto anidado empieza en 1 y su nivel sigue', () => {
    expect(apply('# T\n\n1. aks\n\t2. askad\n\t\t3. a\n\t\t4. b\n\t\t5. c')).toBe('# T\n\n1. aks\n\t1. askad\n\t\t1. a\n\t\t2. b\n\t\t3. c')
  })
  it('al volver a un nivel, sigue su cuenta', () => {
    expect(apply('1. a\n\t1. b\n\t2. c\n1. d\n\t5. e')).toBe('1. a\n\t1. b\n\t2. c\n2. d\n\t1. e')
  })
  it('insertar en medio corrige los siguientes', () => {
    expect(apply('1. a\n2. nuevo\n2. b\n3. c')).toBe('1. a\n2. nuevo\n3. b\n4. c')
  })
  it('las líneas en blanco no cortan la lista; un párrafo sí', () => {
    expect(apply('1. a\n\n3. b\n\nPárrafo\n\n5. c')).toBe('1. a\n\n2. b\n\nPárrafo\n\n1. c')
  })
  it('respeta el separador y las viñetas', () => {
    expect(apply('1) a\n- x\n7) b')).toBe('1) a\n- x\n3) b')
    expect(apply('- x\n\t4. a\n\t9. b\n- y')).toBe('- x\n\t1. a\n\t2. b\n- y')
  })
  it('solo toca la lista de las líneas pedidas', () => {
    expect(apply('5. a\n\nPárrafo\n\n3. b', 5, 5)).toBe('5. a\n\nPárrafo\n\n1. b')
  })
})
