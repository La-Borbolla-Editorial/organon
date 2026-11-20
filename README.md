# Organon

Lector de PDF, fichero y editor para escribir una tesis. Marcas un pasaje mientras
lees y Organon crea una ficha con la cita, la fuente y la **página impresa**
correcta, enlazada al punto exacto del PDF. Luego escribes citando esas fichas, y
Organon compone las notas al pie y la bibliografía.

*A PDF reader, note-card index and writing editor for thesis work. Select a passage
and get a card with the quote, its source and the correct printed page, linked back
to the exact spot in the PDF; then write citing those cards and get footnotes and a
bibliography. The interface is in Spanish.*

Reúne en una sola herramienta lo que antes pedía tres: Zotero para leer y marcar,
una hoja de cálculo como fichero y un procesador de textos para citar.

**¿Primera vez? Lee el [tutorial de cinco minutos](TUTORIAL.md).**

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
- **Fichero.** Una tabla por fichero, como una hoja de cálculo: búsqueda, y en
  cada encabezado un menú para ordenar y filtrar por esa columna (por texto, por
  valores, por rango). Las filas se reordenan arrastrándolas, sin que cambie el
  número de ninguna ficha. Y columnas propias (texto, número, fecha, casilla o
  lista de opciones) en **Columnas…**.
- **CSV de ida y vuelta.** Importa tu hoja de cálculo y la exporta igual, para
  seguir usando Google Sheets en paralelo.
- **Escritura.** Escribe tus textos en Markdown citando las fichas: `{f. 51}`
  inserta la cita con su nota al pie y `[f. 51]` deja solo la nota. Organon numera
  las notas y compone la bibliografía. Puedes ver cualquier ficha dentro del texto
  sin pegarla, escribir viendo el resultado o la sintaxis, y hacer esquemas con Tab.
- **Exportación.** Word (.docx) con notas al pie de verdad, PDF y Markdown. Y un
  «PDF con fichas»: el texto con cada ficha nombrada desplegada debajo, para trabajar.
- **Citas con formato.** Chicago (notas abreviadas, notas completas, autor-año),
  APA y MLA, en español o en inglés. Cualquier otro estilo CSL se añade con su
  archivo.
  El estilo y el idioma se eligen en **Ajustes** (⚙︎), por proyecto.
- **Temas.** En Ajustes → Apariencia: Organon, Noche (oscuro) o Sepia, o un tema
  propio con tus colores y tipografías.

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
6. En **Escritura**, crea un texto y escribe `{f. 1}` o `[f. 1]` para citar la
   ficha 1. El panel de la derecha muestra cómo queda, y su pestaña **Fichas**
   busca e inserta fichas por ti.

### Cómo se cita una ficha

| Escribes | Resultado |
| --- | --- |
| `{f. 51}` | La cita de la ficha 51 en el texto, con su nota al pie |
| `[f. 51]` | Solo la nota al pie |
| `{f. 51 «un pedazo»}` | Solo ese pedazo de la cita, con su nota |
| `{f. 51 +}` · `[f. 51 +]` | Además, la cita completa dentro de la nota |
| `[f. 51, p. 70]` | La nota, con otra página |
| `[cf. f. 51; f. 60]` | Una nota con dos fichas y un prefijo |
| `{Escoto f. 3}` | La ficha 3 del fichero «Escoto» |

Si la fuente está marcada como **obra canónica** (en «Editar», en la Biblioteca),
la cita sigue el estilo de siempre, pero con la referencia canónica de la ficha en
lugar de la página: «Escoto, *Ordinatio*, Ord. II, d. 3, p. 1, q. 6, n. 188». Es la
primera línea de su campo «Obra canónica / referencias».

El marcador («f.») se define en cada fichero. Si dos ficheros comparten marcador,
elige el fichero por defecto del texto o escribe el nombre delante.

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
| `escritura/` | Tus textos, uno por archivo `.md` (y `.papelera/` con los eliminados) |

Son JSON legibles: puedes abrirlos, copiarlos, versionarlos con git o sincronizar
la carpeta. Organon no guarda nada más, salvo la lista de proyectos recientes.

Organon solo se conecta a internet cuando buscas una fuente por DOI (doi.org) o
por ISBN (Open Library), y solo envía ese identificador.

### Columnas de un fichero

Cada fichero de `organon.json` tiene su lista `columns`, en el orden de la tabla.
Se editan en **Columnas…**, pero también se pueden escribir a mano:

```json
"columns": [
  { "header": "ID", "field": "num" },
  { "header": "Cita", "field": "cita", "width": 400 },
  { "header": "Referencias", "field": "referencia", "hidden": true },
  { "header": "Estado", "field": "extra", "kind": "lista", "options": ["Pendiente", "En curso", "Lista"] },
  { "header": "Revisada", "field": "extra", "kind": "casilla" },
  { "header": "Leída", "field": "extra", "kind": "fecha" }
]
```

- `header`: el nombre de la columna, único en el fichero.
- `field`: el campo de la ficha que muestra (`num`, `notaPermanente`, `cita`, `tags`,
  `autor`, `fuente`, `pageLabel`, `referencia`, `notas`), o `extra` para una columna propia.
- `kind` (solo columnas propias): `texto` (si falta), `numero`, `fecha` (AAAA-MM-DD),
  `casilla` o `lista`, con sus `options`.
- `hidden`: oculta en la tabla; se sigue viendo en la ficha y se exporta.
- `width`: ancho en píxeles.

Los valores de las columnas propias se guardan en cada ficha de `fichas.json`, en
`extra`, por nombre de columna: `"extra": { "Estado": "Lista", "Revisada": "sí" }`.
Si renombras una columna a mano, renombra también esa clave en las fichas (desde
**Columnas…** se hace solo). El orden manual de las filas es el campo `orden` de
cada ficha; sin él, la ficha va en el lugar de su número.

Si editas esos archivos a mano, o una sincronización los cambia, con el proyecto
abierto, Organon lo detecta al volver a su ventana o al guardar: avisa, no
sobrescribe nada y te ofrece recargar el proyecto.

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
- `src/draft.ts`: referencias a fichas en los textos, notas y bibliografía.
- `src/export-docx.ts` y `src/export-fichas.ts`: exportación a Word y «PDF con fichas».
- `src/lookup.ts` y `src/source-form.ts`: fuentes por DOI o ISBN y edición a mano.
- `src/components/`: biblioteca, lector ([PDF.js](https://mozilla.github.io/pdf.js/)),
  fichero y escritura ([CodeMirror](https://codemirror.net/)).

## Licencia

[MIT](LICENSE). Los estilos y traducciones de `src/csl/` son del proyecto Citation
Style Language y se distribuyen bajo CC BY-SA 3.0 (ver `src/csl/README.md`). La
tipografía EB Garamond (`src/assets/fonts/`) se distribuye bajo la SIL Open Font
License 1.1.
