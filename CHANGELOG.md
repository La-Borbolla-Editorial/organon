# Cambios

## 0.6.0

El Fichero, más hoja de cálculo:

- **Ordenar y filtrar por columna.** Cada encabezado abre un menú: ordenar A→Z / Z→A (los números
  como números, las fechas por fecha, las celdas vacías siempre al final) y filtrar por texto, por
  valores (tags, autor, fuente, listas, casillas: con casillas, como en Sheets) o por rango (ID,
  números, fechas). Los filtros se suman a la búsqueda, se ven como etiquetas sobre la tabla y cada
  fichero recuerda los suyos. Sustituyen a los antiguos selectores de tag y de fuente.
- **Orden manual.** Las filas se mueven arrastrándolas por el asa ⠿ que aparece a la izquierda.
  El número de la ficha (su ID en los borradores) no cambia nunca. Se puede mover con filtros
  puestos; mientras se ordena por una columna, no. El CSV se exporta en ese orden.
- **Columnas propias**, en **Columnas…**: de texto, número, fecha, casilla o lista de opciones.
  Aparecen en la tabla y como campos en la ficha, y se exportan al CSV. En el mismo panel se
  renombran (los valores pasan al nombre nuevo), se reordenan, se ocultan o se eliminan todas las
  columnas del fichero, y se recupera un campo de Organon que falte. También se pueden escribir a
  mano en `organon.json` (el README explica el formato).
- Al reimportar un CSV en un fichero, las columnas propias conservan su tipo y sus opciones.

## 0.5.2

- **Versión para Windows** (instalador `Organon-…-windows-x64-setup.exe`). Abrir enlaces y la
  carpeta de temas usa el navegador y el Explorador de Windows; los atajos se muestran como
  Ctrl+B / Ctrl+I.
- Los releases se compilan solos en GitHub (macOS Apple Silicon, macOS Intel y Windows) al subir
  una etiqueta de versión.

## 0.5.1

- Se puede **quitar el PDF de una fuente** (Biblioteca → Editar → «Quitar el PDF»). La fuente y sus
  fichas se quedan; el archivo pasa a `pdfs/.papelera/` en la carpeta del proyecto. Las fichas
  conservan su texto, su página y su marca en el PDF, por si se vuelve a adjuntar el mismo.
- **Papelera del proyecto** en Ajustes → Este proyecto: muestra lo que hay en la papelera de PDF y
  en la de textos de Escritura, y permite vaciarlas (se borra para siempre, con confirmación).

## 0.5.0

- **Rendimiento con proyectos grandes** (probado con 300 fuentes, 4000 fichas y un PDF de 500 hojas):
  - Fichero: buscar ya no traba el campo (de hasta 1,6 s por tecla a menos de 70 ms); abrir una
    ficha pasa de casi 1 s a menos de 0,1 s. Las filas se pintan a medida que se baja.
  - Lector: pasar de hoja ya no congela la lista de fichas (antes, 0,3–0,6 s en cada cambio de hoja);
    abrir un PDF con cientos de fichas tarda menos de la mitad.
  - Biblioteca: las fuentes se pintan a medida que se baja y las referencias formateadas se guardan,
    así que volver a ella es instantáneo.
- El cursor de escritura toma el color del tema («Cursor de escritura» en Personalizar → Texto).

## 0.4.1

- PDF: las hojas ya no empiezan con un hueco en blanco arriba. En la app, los márgenes de página no
  se aplicaban y macOS ponía los suyos.

## 0.4.0

- **Ajustes** (⚙︎ en la barra superior): apariencia de Organon y ajustes del proyecto.
- **Temas**: colores y tipografía de la interfaz definidos en archivos de tema. Vienen
  Organon, Noche (oscuro), Sepia y Gryphon (oscuro, basado en Gryphon Code Dark); cualquiera se puede personalizar con vista previa en vivo y
  guardar como tema propio (`temas/*.json` en la configuración de Organon).
- El estilo de cita y el idioma pasan de la Biblioteca a Ajustes → Este proyecto.
- **Obras canónicas.** Una fuente se puede marcar como obra canónica (la *Ordinatio*, la
  *Metafísica*…) desde «Editar» en la Biblioteca. Sus fichas se citan con la estructura normal del
  estilo, pero con la referencia canónica en lugar de la página («Escoto, *Ordinatio*, Ord. II, d. 3,
  p. 1, q. 6, n. 188»): la primera línea de «Obra canónica / referencias». Sin referencia canónica,
  se cita la página y se avisa.
- Escritura: en el panel de fichas, el título de cada ficha la abre en el Fichero.

## 0.3.2

- Escritura: un solo botón **Exportar**, con las opciones (Word, PDF, PDF con fichas, Markdown)
  en un menú, cada una con lo que hace.

## 0.3.1

- Tutorial de cinco minutos, con capturas: [TUTORIAL.md](TUTORIAL.md).

## 0.3.0

Escritura: los textos de la tesis, escritos con las fichas.

- Pestaña **Escritura**: textos en Markdown (`escritura/*.md` dentro del proyecto), con
  guardado automático y papelera.
- Referencias a fichas en el texto: `{f. 51}` inserta la cita con su nota; `[f. 51]` deja solo
  la nota. Variantes: un pedazo de la cita (`{f. 51 «pedazo»}`), la cita completa en la nota
  (`+`), otra página (`[f. 51, p. 70]`), prefijos (`[cf. f. 51; f. 60]`) y fichero explícito
  (`{Escoto f. 3}`).
- Marcador propio por fichero («f.», «e.»…) y fichero por defecto para cada texto.
- Notas al pie numeradas y bibliografía compuestas con el estilo de cita del proyecto
  (ibid., formas breves y desambiguación incluidas).
- Editor con dos modos que se alternan: **Texto** (se ve el resultado: títulos, cursivas, citas
  y números de nota) y **Markdown** (la sintaxis tal cual).
- Esquemas: Tab y Mayús+Tab anidan y desanidan; las listas numeradas se numeran solas por nivel
  y Enter continúa la lista. Cmd+B y Cmd+I para negrita y cursiva.
- Ver una ficha dentro del editor, debajo de la línea que la nombra, sin añadirla al texto
  (una a una o todas a la vez). Su texto se puede seleccionar y copiar.
- Panel lateral con la vista final del texto y un buscador de fichas para insertarlas o
  referenciarlas (también solo un pedazo seleccionado). La vista final puede ir **en vivo** o
  ponerse al día solo al pulsar «Actualizar».
- Exportación a **Word (.docx)** con notas al pie de verdad, a **PDF** (diálogo de impresión) y
  a **Markdown** con las citas resueltas. **PDF con fichas**: el texto tal como se escribe, con
  cada ficha nombrada desplegada debajo de su punto, como documento de trabajo.
- PDF y Word en EB Garamond (incluida con la app, licencia SIL OFL).
- Rápido en textos largos: cientos de referencias sin esperas al escribir.

Además:

- El panel lateral se puede ocultar y ya no se desborda en ventanas estrechas.
- Lector: una cita que cruza de página deja fuera el encabezado y el número de página que
  quedan en medio, y lo avisa.

## 0.2.1

- Fichero: columnas de ancho ajustable (se arrastra el borde del encabezado; el ancho se guarda con el fichero).
- El editor de ficha es un panel más ancho, con el borde arrastrable, y se cierra con Esc.
- Organon detecta si los archivos del proyecto cambiaron fuera de la app (una sincronización, una
  edición a mano): avisa, no los sobrescribe y permite recargar.
- Aviso al añadir una fuente que ya está en la biblioteca (mismo DOI, o mismo título y autor).
- Adjuntar o cambiar el PDF y eliminar la fuente se hacen desde el formulario «Editar»; al añadir
  una fuente se puede adjuntar su PDF en el mismo paso.
- Al corregir la paginación, la lista de fichas afectadas muestra el título de cada una.

## 0.2.0

- Añadir fuentes a mano, sin pasar por Zotero, y editar los metadatos de cualquier fuente.
- Rellenar una fuente a partir de su DOI (doi.org) o su ISBN (Open Library).

## 0.1.0

Primera versión.

- Proyectos en carpetas propias, con los datos en archivos JSON legibles.
- Biblioteca: importación desde Zotero (BibTeX, BibLaTeX, CSL JSON) y PDF adjunto por fuente.
- Lector de PDF: fichas a partir de una selección, resaltados y salto al pasaje.
- Paginación: página impresa deducida del PDF, verificación por fuente y corrección a mano
  (desplazamiento, romanos, hojas dobles, tramos sin numerar).
- Fichero: tabla con tus columnas, búsqueda y filtros por tag y por fuente.
- CSV: importación con asignación de columnas y exportación sin pérdida.
- Citas con formato: Chicago (tres variantes), APA y MLA, en español o inglés.

Solo macOS con Apple Silicon. La app no está firmada (ver el README).
