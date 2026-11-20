---
title: Formato de los temas
description: El formato JSON de un tema de Organon, con todas sus claves de color y tipografía.
sidebar:
  order: 4
---

Un tema es un archivo `.json` en la carpeta `temas/` de la configuración de Organon (ver [Ajustes y temas](/organon/guias/ajustes-y-temas/#temas-como-archivos)). Lo más cómodo es crearlo desde **Ajustes → Apariencia → Personalizar…**, pero también se puede escribir a mano.

## Estructura

```json title="temas/granate-oscuro.json"
{
  "nombre": "Granate oscuro",
  "esquema": "oscuro",
  "colores": {
    "acento": "#c0605a",
    "resaltado": "#6b4f1a"
  },
  "tipografia": {
    "editor": "'EB Garamond', serif",
    "tamanoEditor": 19
  }
}
```

| Clave | Qué es |
| --- | --- |
| `nombre` | El nombre que se ve en Ajustes. Si falta, se usa el nombre del archivo. |
| `esquema` | `"claro"` u `"oscuro"`. Decide de qué tema se toman los valores que faltan: Organon para los claros, Noche para los oscuros. |
| `colores` | Solo los colores que cambian. |
| `tipografia` | Solo las tipografías y tamaños que cambian. |

Organon ignora las claves que no conoce y los valores que no son válidos (se usa el del tema base). Si el archivo no es JSON válido, Ajustes lo avisa y no lo carga.

## Valores

- **Colores:** cualquier color CSS: `#7a2e2e`, `rgb(60 45 20 / 0.16)`, `hsl(0 45% 33%)`.
- **Tipografías:** una lista de familias como en CSS, de la preferida a la de respaldo: `"'Iowan Old Style', Palatino, Georgia, serif"`. Las que tienen espacios van entre comillas simples. `'Organon Garamond'` es la EB Garamond que viene incluida en la app.
- **Tamaños:** un número de píxeles entre 9 y 32.

## Tipografía

| Clave | Qué usa esa tipografía | Organon |
| --- | --- | --- |
| `interfaz` | Botones, menús, tablas | Sistema |
| `texto` | Citas, fichas y vista final | Iowan Old Style |
| `editor` | Editor de Escritura | Iowan Old Style |
| `mono` | Código | Menlo |
| `tamanoInterfaz` | Tamaño de la interfaz | `14` |
| `tamanoEditor` | Tamaño del editor | `17` |

## Colores

### Superficies

| Clave | Qué colorea | Organon |
| --- | --- | --- |
| `fondo` | Fondo de la ventana | `#f6f4ef` |
| `panel` | Paneles y tarjetas | `#ffffff` |
| `papel` | Hoja del editor | `#ffffff` |
| `campos` | Campos de texto | `#ffffff` |
| `suave` | Fondos suaves (tags, encabezados) | `#efebe3` |
| `hover` | Al pasar el ratón | `#f5f2ec` |
| `lineas` | Bordes | `#e2ddd3` |
| `lineasFuertes` | Bordes marcados | `#c9c2b4` |
| `fondoPdf` | Alrededor del PDF | `#d9d5cc` |
| `sombra` | Sombras | `rgb(60 45 20 / 0.16)` |
| `velo` | Velo detrás de los diálogos | `rgb(0 0 0 / 0.35)` |

### Texto

| Clave | Qué colorea | Organon |
| --- | --- | --- |
| `texto` | Texto | `#23201c` |
| `textoSuave` | Texto de citas | `#45403a` |
| `textoTenue` | Texto secundario | `#7b746a` |
| `seleccion` | Selección | `#e7dcc8` |
| `cursor` | Cursor de escritura | `#7a2e2e` |

### Acento

| Clave | Qué colorea | Organon |
| --- | --- | --- |
| `acento` | Acento (botones, enlaces) | `#7a2e2e` |
| `textoSobreAcento` | Texto sobre el acento | `#ffffff` |

### Avisos

| Clave | Qué colorea | Organon |
| --- | --- | --- |
| `ok` | Correcto | `#2f6b3f` |
| `okFondo` | Correcto: fondo | `#e5f1e7` |
| `okLinea` | Correcto: borde | `#b9d8bf` |
| `aviso` | Aviso | `#8a5a00` |
| `avisoFondo` | Aviso: fondo | `#fdf1d3` |
| `avisoLinea` | Aviso: borde | `#ecd596` |
| `error` | Error | `#a02222` |
| `errorFondo` | Error: fondo | `#fbe4e1` |
| `errorLinea` | Error: borde | `#e8b3ad` |
| `textoSobreError` | Texto sobre el error | `#ffffff` |

### Fichas y referencias

| Clave | Qué colorea | Organon |
| --- | --- | --- |
| `marca` | Ficha activa | `#e0a030` |
| `marcaFondo` | Ficha activa: fondo | `#fffaf0` |
| `resaltado` | Resaltado en el PDF | `#ffe27a` |
| `resaltadoActivo` | Resaltado activo | `#ffbf47` |
| `resaltadoNuevo` | Selección nueva en el PDF | `#a9d5ff` |
| `citaInsertadaFondo` | {f. N}: fondo | `#fdeebf` |
| `citaInsertadaTexto` | {f. N}: texto | `#6b4a00` |
| `notaFondo` | [f. N]: fondo | `#e2edf8` |
| `notaTexto` | [f. N]: texto | `#1f4d7a` |
| `fichaAsomadaFondo` | Ficha en el texto: fondo | `#fbf7ea` |
| `fichaAsomadaLinea` | Ficha en el texto: borde | `#e7c873` |
