---
title: Estilos de cita
description: Los cinco estilos de cita de Organon, con el mismo texto compuesto en cada uno.
sidebar:
  order: 2
---

Organon compone las citas con [citeproc-js](https://github.com/Juris-M/citeproc-js), el mismo motor que usa Zotero, y los estilos oficiales del proyecto [Citation Style Language](https://citationstyles.org/). El estilo y el idioma se eligen por proyecto en **Ajustes → Este proyecto**.

| Estilo | Tipo | Bibliografía |
| --- | --- | --- |
| Chicago (notas abreviadas y bibliografía) | Notas al pie, forma breve desde la primera | Sí |
| Chicago (notas completas y bibliografía) | Notas al pie, completa la primera vez y breve después | Sí |
| Chicago (autor-año) | Paréntesis en el texto | Sí, con el año tras el autor |
| APA 7.ª | Paréntesis en el texto | Sí |
| MLA 9.ª | Paréntesis en el texto | Sí (*Works Cited*) |

Cada uno en **español** o **inglés**.

## El mismo texto en cada estilo

Todos los ejemplos parten de este texto de Escritura:

```md
Pini lo plantea así: {f. 51}

Noone discute la naturaleza común[f. 60] y vuelve sobre ella más
adelante[f. 60, p. 115].

[cf. f. 51; f. 60]

La fórmula de Escoto[e. 3].
```

Y son salidas reales de Organon (en español).

### Chicago, notas abreviadas

> Pini lo plantea así: «Some held that the principle is a positive entity, others that it is a negation.»¹
>
> Noone discute la naturaleza común² y vuelve sobre ella más adelante³.
>
> ⁴
>
> La fórmula de Escoto⁵.

1. Pini, «Scotus on Individuation», 69.
2. Noone, «Universals and Individuation», 112.
3. Noone, «Universals and Individuation», 115.
4. cf. Pini, «Scotus on Individuation», 69; Noone, «Universals and Individuation», 112.
5. Escoto, *Ordinatio*, vol. 7, Ord. II, d. 3, p. 1, q. 6, n. 188.

**Bibliografía**

Escoto, Juan Duns. *Ordinatio*. Vol. 7. Typis Polyglottis Vaticanis, 1973.

Noone, Timothy B. «Universals and Individuation». En *The Cambridge Companion to Duns Scotus*, editado por Thomas Williams. Cambridge University Press, 2003.

Pini, Giorgio. «Scotus on Individuation». *Proceedings of the Society for Medieval Logic and Metaphysics* 5 (2005): 50-69.

Es el estilo por defecto. No usa «ibid.»: repite la forma breve, como recomienda la Chicago desde su 17.ª edición.

### Chicago, notas completas

La primera nota de cada fuente es completa; las siguientes, breves.

1. Giorgio Pini, «Scotus on Individuation», *Proceedings of the Society for Medieval Logic and Metaphysics* 5 (2005): 69.
2. Timothy B. Noone, «Universals and Individuation», en *The Cambridge Companion to Duns Scotus*, ed. Thomas Williams (Cambridge University Press, 2003), 112.
3. Noone, «Universals and Individuation», 115.

La bibliografía es igual que en notas abreviadas.

### Chicago, autor-año

> Pini lo plantea así: «Some held that the principle is a positive entity, others that it is a negation.» (Pini 2005, 69)
>
> Noone discute la naturaleza común (Noone 2003, 112) y vuelve sobre ella más adelante (Noone 2003, 115).
>
> (cf. Pini 2005, 69; Noone 2003, 112)
>
> La fórmula de Escoto (Escoto 1973, Ord. II, d. 3, p. 1, q. 6, n. 188).

**Bibliografía**

Pini, Giorgio. 2005. «Scotus on Individuation». *Proceedings of the Society for Medieval Logic and Metaphysics* 5: 50-69.

### APA 7.ª

> Noone discute la naturaleza común (Noone, 2003, p. 112) y vuelve sobre ella más adelante (Noone, 2003, p. 115).
>
> (Noone, 2003, p. 112; cf. Pini, 2005, p. 69)

**Bibliografía**

Noone, T. B. (2003). Universals and Individuation. En T. Williams (Ed.), *The Cambridge Companion to Duns Scotus* (pp. 100-128). Cambridge University Press.

APA ordena alfabéticamente las referencias dentro de un mismo paréntesis.

### MLA 9.ª

> Noone discute la naturaleza común (Noone 112) y vuelve sobre ella más adelante (Noone 115).
>
> La fórmula de Escoto (Escoto, Ord. II, d. 3, p. 1, q. 6, n. 188).

**Bibliografía**

Noone, Timothy B. «Universals and Individuation». *The Cambridge Companion to Duns Scotus*, editado por Thomas Williams, Cambridge University Press, 2003, pp. 100-28.

## Idioma de las citas

El idioma cambia los términos y la puntuación del estilo, no los datos de tus fuentes:

| | Español | English |
| --- | --- | --- |
| Comillas | «Universals and Individuation» | “Universals and Individuation,” |
| Capítulo | En *The Cambridge Companion…*, editado por | In *The Cambridge Companion…*, edited by |
| Encabezado | Bibliografía | Bibliography |

Organon no traduce ni cambia las mayúsculas de los títulos: los cita tal como están en la fuente.

## Lo que hace el motor por ti

- **Formas breves** a partir de la segunda cita, en los estilos que las piden.
- **Desambiguación:** si citas a dos autores con el mismo apellido, o dos obras del mismo autor y año (2003a, 2003b), el estilo añade lo necesario.
- **Orden de la bibliografía** según el estilo, solo con las fuentes citadas en el texto.

## Otros estilos

Por ahora los cinco estilos vienen dentro de la app. Añadir otro estilo CSL (por ejemplo, el de una revista concreta, de entre los más de 10.000 del [repositorio de estilos CSL](https://github.com/citation-style-language/styles)) requiere compilar Organon: basta con añadir el archivo `.csl` a `src/csl/` y una línea a `STYLES` en `src/citations.ts`. Ver [Desarrollo](/organon/referencia/desarrollo/).
