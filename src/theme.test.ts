import { describe, expect, it } from 'vitest'
import { BUILTIN, COLOR_TOKENS, NOCHE, ORGANON, parseTheme, themeFileName, themeToJson, TYPE_TOKENS } from './theme'

describe('temas', () => {
  it('los temas incluidos definen todos los valores', () => {
    for (const theme of Object.values(BUILTIN)) {
      for (const t of COLOR_TOKENS) expect(theme.colores[t.key], `${theme.nombre}: ${t.key}`).toBeTruthy()
      for (const t of TYPE_TOKENS) expect(theme.tipografia[t.key], `${theme.nombre}: ${t.key}`).toBeTruthy()
    }
  })

  it('un tema parcial completa lo que falta con su base', () => {
    const t = parseTheme('{"nombre":"Rojo","colores":{"acento":"#c00000"}}')
    expect(t.nombre).toBe('Rojo')
    expect(t.colores.acento).toBe('#c00000')
    expect(t.colores.fondo).toBe(ORGANON.colores.fondo)
    const dark = parseTheme('{"esquema":"oscuro","tipografia":{"tamanoEditor":20}}', 'Archivo')
    expect(dark.nombre).toBe('Archivo')
    expect(dark.colores.fondo).toBe(NOCHE.colores.fondo)
    expect(dark.tipografia.tamanoEditor).toBe(20)
  })

  it('ignora valores que podrían romper la hoja de estilos', () => {
    const t = parseTheme('{"colores":{"fondo":"red; } body { display:none"},"tipografia":{"tamanoInterfaz":400,"editor":""}}')
    expect(t.colores.fondo).toBe(ORGANON.colores.fondo)
    expect(t.tipografia.tamanoInterfaz).toBe(14)
    expect(t.tipografia.editor).toBe(ORGANON.tipografia.editor)
  })

  it('ida y vuelta por JSON', () => {
    expect(parseTheme(themeToJson(NOCHE))).toEqual(NOCHE)
  })

  it('nombres de archivo', () => {
    expect(themeFileName('Mi tema: Ñandú', [])).toBe('mi-tema-nandu.json')
    expect(themeFileName('Noche', ['noche.json'])).toBe('noche-2.json')
    expect(themeFileName('¡¿?!', [])).toBe('tema.json')
  })
})
