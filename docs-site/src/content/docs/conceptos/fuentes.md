---
title: Fuentes
description: La biblioteca de un proyecto, los datos de cada fuente, su PDF y su clave.
sidebar:
  order: 2
---

Una **fuente** es una obra que lees y citas: un libro, un capítulo, un artículo, una tesis, una entrada de enciclopedia, una ponencia o una página web. Todas las fuentes del proyecto forman la **Biblioteca**.

## Qué guarda una fuente

| Dato | Qué es |
| --- | --- |
| **Metadatos** | Autor, título, año, revista o libro que la contiene, editorial, páginas… Se guardan en [CSL-JSON](https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html), el mismo formato que usa Zotero, y son los que alimentan las citas y la bibliografía. |
| **Clave** | Un identificador corto y único, como `pini2005`. Si la fuente viene de Zotero, es su *citation key*; si la creas en Organon, se forma con el apellido del primer autor y el año (`noone2003`, y `noone2003b` si ya existe). |
| **PDF** | Opcional. Se copia a la carpeta `pdfs/` del proyecto. |
| **Paginación** | Qué página impresa corresponde a cada hoja del PDF, y si ya la verificaste. Ver [La página impresa](/organon/conceptos/pagina-impresa/). |
| **Obra canónica** | Una marca que hace que sus fichas se citen por referencia canónica y no por página. Ver [Obras canónicas](/organon/guias/obras-canonicas/). |

## Tipos de fuente

Todos los tipos piden autor(es), título, año, traductor(es), DOI y URL. Además, el formulario muestra solo los campos que tienen sentido para cada tipo:

| Tipo | Campos propios |
| --- | --- |
| Libro | Editor(es), edición, editorial, lugar, volumen, ISBN |
| Capítulo de libro | Lo del libro, más *Libro que lo contiene* y páginas |
| Entrada de enciclopedia | Lo del libro, más *Enciclopedia* y páginas |
| Ponencia en actas | Lo del libro, más *Actas* y páginas |
| Artículo de revista | Revista, volumen, número, páginas |
| Tesis | Editorial (la institución) y lugar |
| Página web | Sitio web |
| Otro | Todos los campos |

Si cambias el tipo, los campos que el nuevo tipo no muestra no se borran: se conservan en la fuente tal como estaban.

Los autores, editores y traductores se escriben **una persona por línea**, en la forma `Apellido, Nombre`:

```text
Williams, Thomas
Cross, Richard
```

Sin coma, Organon toma la última palabra como apellido («Thomas Williams» → Williams, Thomas). Un nombre de una sola palabra («Aristóteles») se guarda entero.

Mientras rellenas el formulario, la sección **Así aparecerá en la bibliografía** muestra la entrada con el estilo de cita del proyecto. Es la forma más rápida de detectar un campo mal puesto.

## Cómo entra una fuente en la biblioteca

1. **Por DOI o ISBN.** Organon consulta [doi.org](https://doi.org) (artículos y capítulos con DOI) u [Open Library](https://openlibrary.org) (libros) y rellena el formulario. Solo se envía el identificador. Ver [Añadir fuentes](/organon/guias/anadir-fuentes/).
2. **Desde Zotero.** Exportas una colección en BibTeX, BibLaTeX o CSL JSON y la importas. Ver [Importar desde Zotero](/organon/guias/importar-desde-zotero/).
3. **A mano.** Rellenas el formulario.

Organon avisa si la fuente que vas a añadir parece estar ya en la biblioteca (mismo DOI, o mismo título y autor). Puedes añadirla de todos modos.

## Fuentes y fichas

Cada ficha apunta a una fuente. Por eso:

- **Editar los metadatos** de una fuente cambia al instante cómo se citan todas sus fichas.
- **Eliminar una fuente** no elimina sus fichas: se quedan en el fichero, sin fuente, y no se pueden citar hasta que les asignes otra.
- **Quitar el PDF** (Editar → *Quitar el PDF*) deja la fuente y sus fichas como estaban. El archivo pasa a `pdfs/.papelera/`. Las fichas conservan su texto, su página y su marca, y si vuelves a adjuntar el mismo PDF recuperan sus resaltados.
- **Cambiar el PDF** obliga a verificar de nuevo la paginación. Las fichas marcadas conservan su posición, así que hazlo solo si es el mismo documento (por ejemplo, la misma edición con OCR añadido).

## La lista de la Biblioteca

Cada fila muestra la entrada bibliográfica, la clave y unas etiquetas de estado:

- **Paginación verificada** o **Paginación sin verificar**: si ya confirmaste la página impresa.
- **Sin PDF**: la fuente no tiene PDF adjunto (puedes tener fichas igual, importadas o escritas a mano).
- **Obra canónica**.
- El número de fichas de la fuente.

El buscador filtra por autor, título, año o clave. **Abrir** lleva al lector; **Editar**, al formulario.
