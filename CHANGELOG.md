# Cambios

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
