---
title: La página impresa
description: Por qué la hoja del PDF casi nunca es la página que se cita, y cómo lo resuelve Organon con tramos de paginación.
sidebar:
  order: 3
---

Cuando citas, citas la **página impresa**: el número que está en el encabezado o el pie de la página del libro o la revista. El visor de PDF, en cambio, cuenta **hojas**: la primera hoja del archivo es la 1, sea lo que sea.

Las dos cosas casi nunca coinciden:

- Un artículo de revista empieza en la página 68, pero en el PDF es la hoja 1.
- JSTOR y otros repositorios añaden una portada: la página 68 es la hoja 2.
- Un libro tiene preliminares en números romanos (i–xxiv) y luego empieza en 1.
- Un escaneo tiene dos páginas por hoja: la hoja 35 contiene las páginas 68 y 69.
- Hay láminas o páginas en blanco sin número en medio del libro.

Organon resuelve esto una vez por fuente. Luego cada ficha lleva automáticamente la página correcta.

## Hoja, página y tramo

A lo largo de la documentación y de la interfaz:

- **Hoja** es la página del archivo PDF (la que muestra el campo *Hoja 12 de 30* del lector).
- **Página** es la página impresa, la que se cita (*Se cita: p. 79*).
- **Tramo** es una parte del PDF con una numeración regular.

La paginación de una fuente es una lista de tramos. Cada tramo dice:

> Desde la hoja **N** del PDF, la página impresa es **P**, numerada en **estilo** (1, 2, 3… / i, ii, iii… / I, II, III… / sin número), con **1 o 2** páginas por hoja.

Cada tramo rige hasta que empieza el siguiente. Las hojas anteriores al primer tramo no tienen número.

### Ejemplos

Un artículo de 12 hojas, páginas 68–79, sin portada:

| Desde la hoja | Página impresa | Numeración | Págs. por hoja |
| --- | --- | --- | --- |
| 1 | 68 | 1, 2, 3… | 1 |

La hoja 5 se cita como p. 72 (68 + 5 − 1).

El mismo artículo descargado de JSTOR, con una portada añadida:

| Desde la hoja | Página impresa | Numeración | Págs. por hoja |
| --- | --- | --- | --- |
| 1 | 1 | sin número | 1 |
| 2 | 68 | 1, 2, 3… | 1 |

Un libro con 24 páginas de preliminares en romanos, el cuerpo desde la hoja 27 y una lámina sin número en la hoja 150:

| Desde la hoja | Página impresa | Numeración | Págs. por hoja |
| --- | --- | --- | --- |
| 1 | 1 | sin número | 1 |
| 3 | 1 | i, ii, iii… | 1 |
| 27 | 1 | 1, 2, 3… | 1 |
| 150 | 1 | sin número | 1 |
| 151 | 124 | 1, 2, 3… | 1 |

Un escaneo a doble página, donde la hoja 1 contiene las páginas 2 y 3:

| Desde la hoja | Página impresa | Numeración | Págs. por hoja |
| --- | --- | --- | --- |
| 1 | 2 | 1, 2, 3… | 2 (hoja doble) |

En hojas dobles, Organon sabe en qué mitad de la hoja está lo que seleccionas: un pasaje en la mitad izquierda de la hoja 34 se cita como p. 68, y uno en la mitad derecha, como p. 69. Una selección que cruza de una mitad a la otra se cita como «68-69».

## Cómo propone Organon la paginación

Al adjuntar un PDF, Organon hace una conjetura y la deja **sin verificar**. Busca, por este orden:

1. **Los números impresos en encabezados y pies.** Toma una muestra de unas 24 hojas repartidas por todo el PDF, busca números sueltos en la franja superior e inferior de cada una y se queda con el desplazamiento que más se repite. Si la mayoría de las hojas son apaisadas y los números encajan con dos páginas por hoja, propone hojas dobles. Es la señal más fiable.
2. **Las etiquetas de página del PDF.** Algunos PDF traen incrustada su propia numeración (la que muestra Vista Previa o Acrobat). Organon la convierte en tramos, romanos incluidos.
3. **El rango de páginas de los metadatos.** Si la fuente dice «páginas 50–69» y el PDF tiene 20 hojas, la hoja 1 es la página 50. Si el PDF tiene hasta 3 hojas de más, supone que son portadas añadidas al principio.
4. **Nada.** Supone que la hoja y la página coinciden.

El panel de paginación muestra de cuál de estas fuentes salió la conjetura (por ejemplo, «Conjetura: según los números impresos en encabezados y pies»).

## Verificada o sin verificar

Una conjetura puede fallar, así que Organon no la da por buena hasta que la confirmas. Mientras una fuente está **sin verificar**:

- La Biblioteca la marca con **Paginación sin verificar**.
- El lector muestra **⚠ sin verificar** junto a la página que se cita.
- El formulario de cada ficha nueva avisa: «La paginación de esta fuente no está verificada. Comprueba que **72** es el número impreso en la página».

Al confirmar la paginación desaparecen los avisos. Ver [Verificar la paginación](/organon/guias/verificar-la-paginacion/).

## La página de cada ficha

Al crear una ficha, Organon calcula la página a partir del punto del PDF donde empieza y termina la selección. Si va de la p. 69 a la p. 70, la ficha se cita como «69-70».

La página de la ficha es un campo de texto que siempre puedes escribir a mano («69n», «xii», «69-70»). Si la escribes a mano, Organon la marca como **escrita a mano** y nunca la recalcula. Si corriges después la paginación de la fuente, Organon lista las fichas cuya página cambiaría y te deja elegir cuáles actualizar. Las escritas a mano se quedan como están.

Si la fuente es una [obra canónica](/organon/guias/obras-canonicas/), la página se guarda igual pero la cita usa la referencia canónica.
