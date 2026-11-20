---
title: Fichas y ficheros
description: Qué es una ficha, qué campos tiene, cómo se numera y para qué sirven los ficheros y sus marcadores.
sidebar:
  order: 4
---

Una **ficha** es la unidad de trabajo de Organon: un pasaje de una fuente, con su página, y lo que piensas de él. Un **fichero** es una colección de fichas con su propia numeración, como una pestaña de una hoja de cálculo.

## Los campos de una ficha

| Campo | Qué va ahí | Ejemplo |
| --- | --- | --- |
| **Número** | El ID visible de la ficha dentro de su fichero. Es el que escribes para citarla. | `51` |
| **Nota permanente** | La idea del pasaje, con tus palabras, en una línea. Hace de título. | *La individuación pide un principio positivo* |
| **Cita** | El texto literal del pasaje. Sale de la selección en el PDF, y puedes retocarlo. | *Some held that the principle is a positive entity…* |
| **Fuente** | La obra de la que sale el pasaje. | Pini 2005 |
| **Página** | La página impresa que se cita. Ver [La página impresa](/organon/conceptos/pagina-impresa/). | `69`, `69-70`, `xii` |
| **Tags** | Temas para agrupar y filtrar. | `individuación`, `TEXTO CLAVE` |
| **Obra canónica / referencias** | Una referencia canónica o cruzada. En una obra canónica, su primera línea se cita en lugar de la página. | `Ord. II, d. 3, p. 1, q. 6, n. 188` |
| **Notas** | Comentarios, dudas, conexiones. No se citan nunca. | |
| **Otras columnas** | Las columnas de tu hoja de cálculo que Organon no interpreta, guardadas tal cual. | |

Además, cada ficha creada desde el lector guarda su **posición en el PDF**: en qué hojas empieza y termina, y los rectángulos exactos del resaltado. Por eso un clic en la ficha te lleva al pasaje, y un clic en el resaltado abre la ficha.

### Nota permanente y cita

La distinción viene del método de fichas (el *Zettelkasten*): la **cita** es lo que dice el autor, y la **nota permanente** es lo que entendiste tú, escrito para que se entienda sola dentro de un año. Organon no te obliga a llenarla, pero el fichero, el buscador de Escritura y el «PDF con fichas» la usan como título, así que una ficha sin ella aparece como *Sin nota permanente*.

## Numeración

- Cada fichero numera sus fichas por separado, empezando por 1.
- Una ficha nueva recibe el número siguiente al más alto del fichero. Los huecos que dejan las fichas eliminadas no se reutilizan.
- Al importar un CSV, las fichas conservan el ID de tu hoja si es un número entero. Ver [Fichero y Google Sheets](/organon/guias/fichero-y-google-sheets/).
- Si mueves una ficha a otro fichero, recibe el número siguiente de ese fichero.

Como el número es lo que escribes en tus textos (`{f. 51}`), conviene no renumerar fichas que ya citaste.

## Ficheros

Un proyecto empieza con un fichero llamado **General**. Puedes crear más con **+ Nuevo fichero** en la pestaña Fichero. Algunos usos:

- Un fichero por autor principal: *Escoto*, *Ockham*, *Secundaria*.
- Un fichero por capítulo de la tesis.
- Un fichero por pestaña de la hoja de cálculo que ya tenías.

Cada fichero tiene:

- **Nombre.**
- **Marcador:** cómo se nombran sus fichas al escribir. El de *General* es `f.`, así que su ficha 51 se cita `{f. 51}`. Si al fichero *Escoto* le das el marcador `e.`, su ficha 3 se cita `{e. 3}`.
- **Columnas:** cuáles se ven en la tabla, con qué encabezado y en qué orden. Se guardan con el fichero y se exportan igual.

Al crear un fichero, Organon le propone un marcador libre: `f.` si nadie lo usa o, si no, la inicial del nombre (`e.` para *Escoto*). Un marcador tiene como máximo 8 caracteres, sin espacios, sin números al principio ni al final, y sin estos signos: `{ } [ ] ; « » " +`.

### Dos ficheros con el mismo marcador

Se puede, pero entonces `{f. 3}` es ambiguo. Organon lo resuelve así:

1. Si escribes el nombre del fichero delante (`{Escoto f. 3}`), usa ese.
2. Si el texto tiene un **fichero por defecto** y es uno de los que usan ese marcador, usa ese.
3. Si solo uno de los ficheros tiene una ficha 3, usa esa.
4. Si no, avisa: «Hay una ficha 3 en varios ficheros con el marcador «f.»…».

Lo más cómodo es darle a cada fichero su propio marcador.

### Eliminar un fichero

**Eliminar fichero** borra el fichero **y todas sus fichas**, y no pasa por la papelera. Organon pide confirmación («¿Eliminar «Escoto» y sus 120 fichas?»). Si no estás seguro, exporta antes el fichero a CSV. Un proyecto siempre necesita al menos un fichero.

## Dónde se crean y se editan las fichas

- **En el lector**, seleccionando un pasaje. Es la forma principal: la ficha nace con su cita, su fuente, su página y su posición en el PDF.
- **En el Fichero**, con **+ Ficha**: una ficha escrita a mano, por ejemplo de un libro en papel. Eliges la fuente y escribes la página.
- **En el Fichero**, abriendo una ficha de la tabla para editarla. Desde ahí puedes cambiarle la fuente, ver el pasaje en el PDF o marcarlo si aún no lo tiene.
- **Importando un CSV.** Las fichas importadas no tienen posición en el PDF. Ver [Marcar el pasaje de una ficha importada](/organon/guias/leer-y-marcar/#marcar-el-pasaje-de-una-ficha-que-no-lo-tiene).

Eliminar una ficha la borra del fichero. Si la citabas en un texto, la vista final mostrará el aviso «No existe la ficha f. 51».
