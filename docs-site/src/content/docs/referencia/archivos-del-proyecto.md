---
title: Archivos del proyecto
description: El formato de organon.json, fuentes.json y fichas.json, la carpeta de PDF y la de textos, y qué datos salen del equipo.
sidebar:
  order: 3
---

Todo lo que Organon sabe de un proyecto está en su carpeta, en archivos que puedes leer. Esta página describe su formato, para quien quiera leerlos con otras herramientas, escribir scripts o arreglar algo a mano.

```text
Tesis/
├── organon.json
├── fuentes.json
├── fichas.json
├── pdfs/
│   ├── pini2005-3f2a9c1e.pdf
│   └── .papelera/
└── escritura/
    ├── Capítulo 2.md
    └── .papelera/
```

Los tres JSON se escriben con sangría de dos espacios, una propiedad por línea, y las coordenadas redondeadas a 4 decimales. Cada escritura es atómica: el archivo se reemplaza entero de una vez, así que un corte de luz no deja un JSON a medias.

<aside>

**Antes de editar a mano**, cierra el proyecto en Organon (vuelve a la pantalla de proyectos) y haz una copia. Si editas con el proyecto abierto, Organon detectará el cambio y te pedirá recargar, sin sobrescribir nada.

</aside>

## organon.json

Ajustes del proyecto y lista de ficheros.

```json
{
  "format": 1,
  "settings": {
    "style": "chicago-short",
    "locale": "es-ES",
    "lastFichero": "general",
    "lastDraft": "Capítulo 2"
  },
  "ficheros": [
    {
      "id": "general",
      "name": "General",
      "marker": "f.",
      "columns": [
        { "header": "ID", "field": "num" },
        { "header": "Nota permanente", "field": "notaPermanente", "width": 260 },
        { "header": "Cita", "field": "cita" },
        { "header": "Tags", "field": "tags" },
        { "header": "Autor", "field": "autor" },
        { "header": "Paper/Texto", "field": "fuente" },
        { "header": "Página", "field": "pageLabel" },
        { "header": "Obra Canónica", "field": "referencia" },
        { "header": "Notas", "field": "notas" }
      ]
    }
  ]
}
```

| Campo | Qué es |
| --- | --- |
| `format` | Versión del formato. Organon se niega a abrir un proyecto con un formato más nuevo que el suyo. |
| `settings` | Ajustes del proyecto: `style` y `locale` (estilo e idioma de las citas), y el último fichero y el último texto abiertos. |
| `ficheros[].marker` | El [marcador](/organon/conceptos/fichas-y-ficheros/#ficheros) del fichero. |
| `ficheros[].columns` | Las columnas de la tabla y del CSV, en orden. `header` es el encabezado; `field`, el campo de la ficha (`num`, `notaPermanente`, `cita`, `tags`, `autor`, `fuente`, `pageLabel`, `referencia`, `notas` o `extra`); `width`, el ancho en píxeles si lo cambiaste. |

Los valores posibles de `style` son `chicago-short`, `chicago-notes`, `chicago-author-date`, `apa` y `mla`; los de `locale`, `es-ES` y `en-US`.

## fuentes.json

```json
{
  "format": 1,
  "fuentes": [
    {
      "id": "3f2a9c1e-…",
      "citekey": "pini2005",
      "csl": {
        "id": "3f2a9c1e-…",
        "type": "article-journal",
        "title": "Scotus on Individuation",
        "author": [{ "family": "Pini", "given": "Giorgio" }],
        "container-title": "Proceedings of the Society for Medieval Logic and Metaphysics",
        "volume": "5",
        "page": "50-69",
        "issued": { "date-parts": [[2005]] }
      },
      "pdfFile": "pini2005-3f2a9c1e.pdf",
      "pdfPages": 20,
      "pagination": [
        { "pdfStart": 1, "first": 50, "style": "arabic", "perPage": 1 }
      ],
      "paginationVerified": true,
      "paginationNote": "Verificada a mano.",
      "canonical": false
    }
  ]
}
```

| Campo | Qué es |
| --- | --- |
| `id` | Identificador interno (UUID). Las fichas apuntan a él. |
| `citekey` | La clave legible. Al reimportar desde Zotero, las fuentes se reconocen por ella. |
| `csl` | Los metadatos en [CSL-JSON](https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html). Se conservan todos los campos que traiga Zotero, aunque el formulario no los muestre. |
| `pdfFile` | Nombre del PDF dentro de `pdfs/`, o `null`. |
| `pdfPages` | Número de hojas del PDF. |
| `pagination` | Los [tramos](/organon/conceptos/pagina-impresa/#hoja-página-y-tramo). `style` es `arabic`, `roman` (i, ii), `ROMAN` (I, II) o `none`; `perPage` es `1` o `2`. |
| `paginationVerified` | Si confirmaste la paginación. |
| `paginationNote` | De dónde salió la paginación («Conjetura: según los números impresos…», «Verificada a mano.»). |
| `canonical` | Si es una [obra canónica](/organon/guias/obras-canonicas/). |

## fichas.json

```json
{
  "format": 1,
  "fichas": [
    {
      "id": "b71e…",
      "ficheroId": "general",
      "num": 51,
      "notaPermanente": "La individuación pide un principio positivo",
      "cita": "Some held that the principle is a positive entity, others that it is a negation.",
      "sourceId": "3f2a9c1e-…",
      "pageLabel": "69",
      "pageManual": false,
      "anchor": {
        "start": { "page": 20, "half": 0 },
        "end": { "page": 20, "half": 0 },
        "exact": "Some held that the principle is a positive entity, others that it is a negation.",
        "rects": [
          { "page": 20, "r": [[0.1182, 0.2311, 0.7604, 0.0142], [0.1182, 0.2483, 0.3127, 0.0142]] }
        ]
      },
      "tags": ["individuación", "TEXTO CLAVE"],
      "referencia": "",
      "notas": "",
      "extra": { "Paper/Texto": "Scotus on Individuation" },
      "createdAt": "2026-03-14T10:22:05.118Z",
      "updatedAt": "2026-03-14T10:24:40.002Z"
    }
  ]
}
```

| Campo | Qué es |
| --- | --- |
| `ficheroId` | El fichero al que pertenece. |
| `num` | El número visible, único dentro del fichero. |
| `sourceId` | La fuente, o `null`. |
| `pageLabel` | La página que se cita, como texto. |
| `pageManual` | `true` si la página se escribió a mano (o vino de un CSV): Organon no la recalcula al cambiar la paginación. |
| `anchor` | La posición en el PDF, o `null`. `start` y `end` son la hoja (desde 1) y la mitad (`0` izquierda, `1` derecha) donde empieza y termina; `exact`, el texto tal como salió del PDF; `rects`, los rectángulos del resaltado en coordenadas relativas a la página (x, y, ancho, alto, de 0 a 1). |
| `referencia` | El campo *Obra canónica / referencias*. |
| `extra` | Columnas del CSV que Organon no interpreta, y el autor y título originales, por encabezado. |

## pdfs/

Copias de los PDF adjuntos. El nombre se forma con la clave de la fuente y el comienzo de su `id` (`pini2005-3f2a9c1e.pdf`). Organon no modifica nunca el contenido de un PDF: los resaltados están en `fichas.json`, no en el archivo.

`pdfs/.papelera/` guarda los PDF quitados de sus fuentes hasta que vacíes la papelera.

## escritura/

Un archivo Markdown por texto, con el nombre del texto: `Capítulo 2.md`. Pueden empezar con una cabecera YAML:

```md
---
fichero: Escoto
---

## 2.1 El problema
…
```

La única clave que usa Organon es `fichero` (el fichero por defecto). Las demás se conservan.

`escritura/.papelera/` guarda los textos eliminados.

## Fuera del proyecto

Organon guarda en la carpeta de configuración de la app (`~/Library/Application Support/app.organon.desktop/` en macOS, `%APPDATA%\app.organon.desktop\` en Windows):

| Archivo | Contenido |
| --- | --- |
| `recientes.json` | La lista de proyectos recientes (rutas de carpetas). |
| `ajustes.json` | El tema elegido (`organon`, `noche`, `sepia`, `gryphon` o `archivo:mi-tema.json`). |
| `temas/*.json` | Tus temas. Ver [Formato de los temas](/organon/referencia/formato-de-tema/). |

## Privacidad: qué sale de tu equipo

Organon solo se conecta a internet en dos casos, y siempre porque lo pides:

| Cuándo | A dónde | Qué envía |
| --- | --- | --- |
| Buscas una fuente por DOI | `doi.org` | El DOI |
| Buscas una fuente por ISBN | `openlibrary.org` | El ISBN |

Además, el enlace **Abrir iLovePDF OCR** del aviso de PDF sin texto abre esa web en tu navegador; Organon no le envía nada.

No hay cuentas, telemetría, estadísticas de uso ni comprobación de actualizaciones.
