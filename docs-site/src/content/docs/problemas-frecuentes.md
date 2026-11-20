---
title: Problemas frecuentes
description: Soluciones a los problemas más comunes al instalar y usar Organon.
---

## Instalación

### macOS dice que Organon «está dañado» o «no se puede abrir»

La app no está firmada con una cuenta de desarrollador de Apple. Quita la marca de cuarentena desde la Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Organon.app
```

Hay que repetirlo cada vez que instalas una versión nueva.

### Windows dice «Windows protegió tu PC»

Es SmartScreen, por el mismo motivo. Pulsa **Más información → Ejecutar de todas formas**.

## PDF

### El PDF no deja seleccionar texto

El PDF es un escaneo sin capa de texto (sin OCR). Organon lo avisa al abrirlo. Opciones para añadir OCR:

- **macOS:** Adobe Acrobat (*Escanear y OCR*), PDF Expert o ABBYY FineReader.
- **Windows:** Adobe Acrobat o ABBYY FineReader.
- **Gratis:** [OCRmyPDF](https://ocrmypdf.readthedocs.io/) en la línea de comandos (`ocrmypdf -l spa+eng entrada.pdf salida.pdf`), o un servicio web como iLovePDF (el aviso de Organon tiene un enlace). Ten en cuenta que un servicio web recibe el PDF entero.

Después, en la Biblioteca, **Editar → Cambiar PDF…** con el PDF nuevo. Como es el mismo documento, las fichas que tuviera conservan su posición.

### La cita sale con palabras partidas, guiones o saltos raros

El texto viene así de la capa de texto del PDF (guiones de final de línea, ligaduras como «ﬁ», saltos de línea). Corrígelo en el campo **Cita** antes de guardar la ficha. El resaltado en el PDF no cambia.

### La cita incluye el número de página o el título corrido

Si el pasaje cruza de página, Organon intenta quitar el pie y el encabezado intermedios, y avisa de lo que quitó. Si se le escapa algo (por ejemplo, una nota al pie de la primera página), bórralo a mano en el campo **Cita**.

### El botón dice «+ Ficha · p. ¿?»

Esa hoja no tiene número según la paginación de la fuente (está en un tramo *sin número*, o antes del primer tramo). Corrige la paginación o escribe la página a mano en la ficha.

### Las páginas de las fichas no coinciden con el libro

La paginación de la fuente está mal o sin verificar. Ver [Verificar la paginación](/organon/guias/verificar-la-paginacion/). Al corregirla, Organon te ofrece actualizar las fichas afectadas.

### No encuentro el PDF de una fuente

Está en `pdfs/` dentro de la carpeta del proyecto, con un nombre como `pini2005-3f2a9c1e.pdf`. Si quitaste el PDF de la fuente, está en `pdfs/.papelera/` hasta que vacíes la papelera.

## Fuentes

### La búsqueda por ISBN no encuentra el libro

Open Library no tiene todos los libros, sobre todo ediciones en español y de editoriales pequeñas. Prueba con el otro ISBN (el de 10 dígitos o el de 13) o rellena los datos a mano.

### Al reimportar desde Zotero se duplicaron fuentes

Organon reconoce las fuentes por su clave. Si cambiaste el formato de exportación (de BibTeX a CSL JSON) o la clave en Zotero, las ve como nuevas. Elimina las duplicadas desde **Editar → Eliminar fuente**; antes, comprueba en el Fichero (filtro por fuente) que no tengan fichas, o reasigna sus fichas a la buena.

### Una cita sale con un dato mal (mayúsculas, nombre, editorial)

Organon cita los metadatos tal como están. Corrígelos en **Editar** (o en Zotero y reimporta). El cambio se aplica a todas las citas de esa fuente.

## Fichero

### Las fichas importadas no tienen fuente

Organon vincula cada fila del CSV con una fuente por el autor y el título. No lo hace si no encuentra ninguna o si encuentra más de una candidata. Soluciones:

- Importa las fuentes que faltan (desde Zotero o a mano): las fichas se vinculan solas.
- Filtra el Fichero por **Sin fuente vinculada** y asígnales la fuente una a una en el formulario.

### Al importar un CSV, los acentos salen mal

El archivo no está en UTF-8. Google Sheets siempre exporta en UTF-8. Si viene de Excel, guárdalo como *CSV UTF-8 (delimitado por comas)*.

### Al importar un CSV, todo sale en una sola columna

El archivo usa punto y coma como separador (habitual en Excel en español). Ábrelo en Google Sheets o LibreOffice y vuelve a exportarlo con comas.

## Escritura

### Una referencia sale como «[⚠ sin referencia]»

Mira la lista de problemas en la **Vista final**: dice por qué no se pudo resolver. Los casos están en [Sintaxis de las citas → Avisos](/organon/referencia/sintaxis-de-citas/#avisos).

### Escribí `[f. 51]` y no pasa nada

- Comprueba que el marcador del fichero sea `f.` (la pestaña Fichero lo muestra junto al nombre).
- El número debe existir en ese fichero.
- La referencia no puede partirse en dos líneas.

### La nota aparece separada de la palabra

Escribiste un espacio antes de la referencia (`palabra [f. 51]`). Pégala a la palabra: `palabra[f. 51]`.

### «Este texto cambió fuera de Organon desde que lo abriste»

El archivo `.md` cambió en el disco (otro editor, una sincronización). Elige **Cargar la versión del disco** para descartar lo que tienes en Organon, o **Guardar la mía encima** para quedarte con lo tuyo.

### El Word sale con otra tipografía

El `.docx` pide EB Garamond. Instálala desde [Google Fonts](https://fonts.google.com/specimen/EB+Garamond) o cambia la fuente en Word.

## Proyecto

### «Los archivos del proyecto cambiaron fuera de Organon»

Algo modificó `organon.json`, `fuentes.json` o `fichas.json` mientras el proyecto estaba abierto: una sincronización, git o una edición a mano. Organon no guardó tu último cambio para no pisar el otro. Recarga el proyecto y repite el cambio. Para evitarlo, ver [Sincronizar y respaldar](/organon/guias/sincronizar-y-respaldar/).

### «El archivo fichas.json del proyecto está dañado»

El JSON no se puede leer, normalmente por una edición a mano o un conflicto de sincronización. Recupera una versión anterior del archivo (Time Machine, Historial de archivos, el historial de versiones de Dropbox o iCloud, o git). Si tu servicio de sincronización creó un archivo como `fichas (copia en conflicto).json`, una de las dos versiones suele estar entera.

### «Este proyecto se creó con una versión más reciente de Organon»

Actualiza Organon en este equipo.

## ¿Otro problema?

Abre un [*issue* en GitHub](https://github.com/La-Borbolla-Editorial/organon/issues) con la versión de Organon, el sistema operativo y los pasos para reproducirlo.
