---
title: Desarrollo
description: Cómo está hecho Organon, cómo compilarlo, probarlo, publicar una versión y mantener esta documentación.
sidebar:
  order: 6
---

Organon es software libre ([MIT](https://github.com/La-Borbolla-Editorial/organon/blob/main/LICENSE)). Esta página es para quien quiera compilarlo, cambiarlo o contribuir.

## Arquitectura

Organon es una app de [Tauri 2](https://tauri.app/): una interfaz web (React y TypeScript, compilada con Vite) dentro de una ventana nativa, con un núcleo pequeño en Rust.

| Parte | Dónde | Qué hace |
| --- | --- | --- |
| Núcleo nativo | `src-tauri/src/lib.rs` | Solo lee y escribe archivos del proyecto abierto (con comprobación de cambios externos), los PDF, los textos, las papeleras, los temas y los ajustes. Abre diálogos de archivo e imprime. |
| Datos | `src/store.ts` | El proyecto en memoria y en sus JSON. Cada cambio reescribe el archivo afectado de forma atómica, en cola. |
| Paginación | `src/pagination.ts`, `src/pdf/guess.ts` | De la hoja del PDF a la página impresa; conjetura inicial. |
| Selección en el PDF | `src/pdf/selection.ts` | De la selección del usuario a un `anchor` (hojas, mitades, rectángulos) y limpieza de encabezados y pies. |
| Citas | `src/citations.ts` | citeproc-js con los estilos CSL de `src/csl/`. |
| Escritura | `src/draft.ts` | Sintaxis de referencias, resolución de un texto a Markdown con notas y bibliografía. |
| CSV | `src/csv.ts`, `src/fichero-io.ts` | Lectura y escritura compatibles con Google Sheets; asignación de columnas. |
| Exportación | `src/export-docx.ts`, `src/export-fichas.ts` | Word con notas al pie; PDF con fichas. |
| Fuentes | `src/lookup.ts`, `src/source-form.ts` | DOI e ISBN; formulario de metadatos. |
| Temas | `src/theme.ts`, `src/appearance.ts` | Variables CSS y archivos de tema. |
| Pantallas | `src/components/` | Biblioteca, lector (PDF.js), fichero, escritura (CodeMirror), ajustes. |

## Compilar y probar

Hace falta [Node](https://nodejs.org/) 22 o posterior y [Rust](https://rustup.rs/).

```bash
npm install
npm run app        # app nativa en modo desarrollo
npm run app:build  # genera src-tauri/target/release/bundle/
npm test           # pruebas (Vitest)
```

`npm run dev` abre solo la interfaz en el navegador (`http://localhost:1420`) con un sustituto del núcleo nativo (`dev/shim.ts`). Sirve para trabajar en la interfaz sin compilar Rust. En `fixtures/` hay datos inventados para probar: un artículo de 12 hojas con las páginas impresas 68–79, dos referencias en BibTeX y un CSV con la forma de una pestaña de Google Sheets.

## Añadir un estilo de cita

1. Descarga el `.csl` del [repositorio de estilos CSL](https://github.com/citation-style-language/styles) y cópialo en `src/csl/`.
2. Impórtalo y añade una línea a `STYLES` en `src/citations.ts`:

```ts
import turabian from './csl/turabian-fullnote-bibliography.csl?raw'

export const STYLES = {
  // …
  turabian: { name: 'Turabian (notas completas)', xml: turabian },
} as const
```

El estilo aparece en **Ajustes → Este proyecto**. Los estilos que dependen de otro (*dependent styles*) no funcionan solos: usa el estilo padre.

## Publicar una versión

Los instaladores se compilan solos en GitHub Actions (`.github/workflows/release.yml`) al subir una etiqueta de versión:

```bash
git tag v0.5.3
git push origin v0.5.3
```

El workflow crea el release como borrador con las notas de esa versión del `CHANGELOG.md`, compila para macOS (Apple Silicon e Intel) y Windows, sube los tres instaladores y publica el release cuando terminan los tres.

Desde *Actions → Release → Run workflow* se puede lanzar a mano: con una etiqueta existente, añade o reemplaza los instaladores de ese release; sin etiqueta, hace una compilación de prueba de la rama elegida y deja los archivos en la página de la ejecución.

## Esta documentación

La documentación vive en `docs-site/` y está hecha con [Starlight](https://starlight.astro.build/). Cada página es un archivo Markdown (`.md`) o MDX (`.mdx`) en `docs-site/src/content/docs/`; la estructura de carpetas es la del menú lateral.

```bash
cd docs-site
npm install
npm run dev     # http://localhost:4321/organon/
npm run build   # comprueba que todo compila
```

Se publica sola en GitHub Pages (`.github/workflows/docs.yml`) cada vez que un cambio en `docs-site/` llega a `main`. Cada página tiene al pie un enlace **Editar página** que abre el archivo en GitHub.

Para que la documentación no se quede atrás, conviene que cada cambio de comportamiento de la app actualice su página en el mismo PR.

Convenciones:

- Los nombres de botones y campos, en **negrita** y exactamente como aparecen en la app.
- Los enlaces internos, con la ruta completa: `/organon/guias/exportar/`.
- Las capturas, en `docs-site/src/assets/`.
- Los ejemplos de citas, generados con Organon, no escritos a mano.
