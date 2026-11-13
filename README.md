# Organon

Lector de PDF y fichero para escribir una tesis. Marcas un pasaje mientras lees y
Organon crea una ficha con la cita, la fuente y la **página impresa** correcta,
enlazada al punto exacto del PDF.

*A PDF reader and note-card index for thesis writing. Select a passage and get a
card with the quote, its source and the correct printed page, linked back to the
exact spot in the PDF. The interface is in Spanish.*

Reúne en una sola herramienta lo que antes pedía tres: Zotero para leer y marcar,
una hoja de cálculo como fichero y un procesador de textos para citar.

## Qué hace

- **Proyectos en carpetas tuyas.** Un proyecto es una carpeta cualquiera (la de la
  tesis, la de un trabajo final). Dentro quedan las fuentes, los PDF y las fichas,
  en archivos legibles. Cambias de proyecto desde la barra superior.
- **Biblioteca.** Añade las fuentes a mano, a partir de un DOI o un ISBN, o
  importándolas desde Zotero (BibTeX, BibLaTeX o CSL JSON), y adjunta un PDF a
  cada una.
- **Lector.** Seleccionas texto, pulsas «+ Ficha» y rellenas la nota permanente,
  los tags y las notas. Las fichas quedan resaltadas en el PDF y un clic te lleva
  de vuelta al pasaje.
- **La página correcta.** La hoja del PDF casi nunca coincide con la página que
  hay que citar. Organon la deduce de los números impresos en encabezados y pies,
  te pide confirmarla una vez por fuente y te la enseña antes de guardar cada
  ficha. Admite preliminares en romanos, hojas dobles escaneadas y tramos sin
  numerar; siempre puedes corregirla a mano.
- **Fichero.** Una tabla por fichero, con tus columnas y en tu orden, búsqueda y
  filtros por tag y por fuente.
- **CSV de ida y vuelta.** Importa tu hoja de cálculo y la exporta igual, para
  seguir usando Google Sheets en paralelo.
- **Citas con formato.** Chicago (notas abreviadas, notas completas, autor-año),
  APA y MLA, en español o en inglés. Cualquier otro estilo CSL se añade con su
  archivo.

Todavía no hay editor de borradores ni exportación a .docx; es lo siguiente.

## Instalación (macOS, Apple Silicon)

1. Descarga `Organon-…-macos-arm64.zip` desde
   [Releases](../../releases) y descomprímelo.
2. Mueve `Organon.app` a Aplicaciones.
3. La app no está firmada con una cuenta de desarrollador de Apple, así que macOS
   la bloquea la primera vez. Quita la cuarentena desde la Terminal:

   ```bash
   xattr -dr com.apple.quarantine /Applications/Organon.app
   ```

Para Mac con Intel, Windows o Linux hay que compilarla (ver más abajo).

## Primeros pasos

1. Abre Organon y elige la carpeta del proyecto.
2. Pulsa **+ Añadir fuente** y pega su DOI o su ISBN (o rellena los datos a
   mano). Si usas Zotero, selecciona allí tus referencias, usa *Archivo →
   Exportar elementos…* (BibTeX, BibLaTeX o CSL JSON) y, en Organon, **Importar
   de Zotero…**
3. Pulsa **Adjuntar PDF…** en una fuente. Compara dos o tres hojas con el número
   que proponga Organon y confirma la paginación.
4. Selecciona un pasaje y pulsa **+ Ficha**.
5. Para traer tu fichero: en Sheets, *Archivo → Descargar → CSV* (una vez por
   pestaña) y, en la pestaña **Fichero** de Organon, **Importar CSV…**

Los PDF necesitan capa de texto. Si uno está escaneado sin OCR, Organon lo avisa:
pásalo antes por una herramienta de OCR.

## Tus datos

Cada proyecto es una carpeta con:

| Archivo | Contenido |
| --- | --- |
| `organon.json` | Ajustes del proyecto (estilo de cita, idioma) y sus ficheros |
| `fuentes.json` | Fuentes: metadatos CSL, PDF adjunto y paginación |
| `fichas.json` | Fichas |
| `pdfs/` | Los PDF adjuntos |

Son JSON legibles: puedes abrirlos, copiarlos, versionarlos con git o sincronizar
la carpeta. Organon no guarda nada más, salvo la lista de proyectos recientes.

Organon solo se conecta a internet cuando buscas una fuente por DOI (doi.org) o
por ISBN (Open Library), y solo envía ese identificador.

Si editas esos archivos a mano, o una sincronización los cambia, con el proyecto
abierto, Organon no lo ve hasta que lo vuelves a abrir, y su siguiente guardado
los pisaría. Cierra el proyecto antes.

## Desarrollo

Hace falta [Node](https://nodejs.org/) 22 o posterior y [Rust](https://rustup.rs/).

```bash
npm install
npm run app        # app nativa en modo desarrollo
npm run app:build  # genera src-tauri/target/release/bundle/
npm test
```

`npm run dev` abre la interfaz en el navegador (http://localhost:1420) con un
sustituto del núcleo nativo (`dev/shim.ts`), útil para trabajar en la interfaz.
En `fixtures/` hay datos inventados para probar.

Cómo está hecho:

- `src-tauri/`: núcleo nativo ([Tauri 2](https://tauri.app/), Rust). Solo lee y
  escribe los archivos del proyecto abierto.
- `src/store.ts`: los datos del proyecto, en memoria y en sus JSON.
- `src/pagination.ts` y `src/pdf/guess.ts`: de la hoja del PDF a la página impresa.
- `src/citations.ts`: citas con [citeproc-js](https://github.com/Juris-M/citeproc-js)
  y estilos CSL.
- `src/fichero-io.ts`: importación y exportación CSV.
- `src/lookup.ts` y `src/source-form.ts`: fuentes por DOI o ISBN y edición a mano.
- `src/components/`: biblioteca, lector ([PDF.js](https://mozilla.github.io/pdf.js/)) y fichero.

## Licencia

[MIT](LICENSE). Los estilos y traducciones de `src/csl/` son del proyecto Citation
Style Language y se distribuyen bajo CC BY-SA 3.0 (ver `src/csl/README.md`).
