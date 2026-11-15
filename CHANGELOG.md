# Cambios

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
