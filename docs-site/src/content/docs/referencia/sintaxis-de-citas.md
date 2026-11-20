---
title: Sintaxis de las citas
description: Todas las formas de citar una ficha en Escritura, con el resultado de cada una.
sidebar:
  order: 1
---

Esta página reúne todas las formas de citar una ficha en un texto de Escritura. Los ejemplos usan el estilo **Chicago (notas abreviadas)** en español y estas fichas:

| Ficha | Fuente | Página | Cita |
| --- | --- | --- | --- |
| `f. 51` | Pini 2005 | 69 | *Some held that the principle is a positive entity, others that it is a negation.* |
| `f. 60` | Noone 2003 | 112 | *The common nature has a unity less than numerical unity.* |
| `e. 3` | Escoto, *Ordinatio* (obra canónica) | — | *Natura non est de se haec.* Referencia: `Ord. II, d. 3, p. 1, q. 6, n. 188` |

Los resultados de esta página son salidas reales de Organon con esas fichas.

## Resumen

| Escribes | En el texto | En la nota |
| --- | --- | --- |
| `{f. 51}` | La cita completa | La referencia |
| `[f. 51]` | Nada | La referencia |
| `{f. 51 «pedazo»}` | Solo ese pedazo | La referencia |
| `[f. 51 «pedazo»]` | Nada | La referencia y el pedazo |
| `{f. 51 +}` | La cita completa | La referencia y la cita completa |
| `[f. 51 +]` | Nada | La referencia y la cita completa |
| `[f. 51, p. 70]` | Nada | La referencia, con la p. 70 |
| `[f. 51; f. 60]` | Nada | Las dos referencias en una sola nota |
| `[cf. f. 51]` | Nada | «cf.» y la referencia |
| `{Escoto f. 3}` | La cita de la ficha 3 del fichero *Escoto* | La referencia |

**Llaves `{ }`** ponen texto citado en tu texto. **Corchetes `[ ]`** ponen solo la nota.

## Llaves: citar en el texto

### Dentro de una frase

```md
Pini lo plantea así: {f. 51}
```

> Pini lo plantea así: «Some held that the principle is a positive entity, others that it is a negation.»¹
>
> ¹ Pini, «Scotus on Individuation», 69.

La cita va entre comillas españolas («») si el idioma de las citas es español, e inglesas (“”) si es inglés.

### Sola en su párrafo: cita en bloque

Si la referencia ocupa un párrafo entero, se convierte en cita en bloque, sin comillas:

```md
Pini lo plantea así:

{f. 51}

Y sigue…
```

> Pini lo plantea así:
>
> > Some held that the principle is a positive entity, others that it is a negation.¹
>
> Y sigue…

### Solo un pedazo

Escribe entre comillas el fragmento de la cita que quieres usar:

```md
La primera opción es {f. 51 «a positive entity»}.
```

> La primera opción es «a positive entity»¹.

El pedazo se puede escribir con comillas españolas (`«»`), inglesas (`“”`) o rectas (`""`). Organon comprueba que el pedazo esté en la cita de la ficha, sin tener en cuenta espacios ni tipo de comillas. Si no lo encuentra, avisa: *El pedazo «…» no aparece tal cual en la ficha f. 51. Revísalo*.

Puedes saltar texto con una elipsis, y los trozos deben aparecer en ese orden:

```md
{f. 51 «Some held […] a negation»}
```

Se aceptan `…`, `...` y `[…]` o `[...]`.

## Corchetes: solo la nota

### Una paráfrasis

```md
Pini distingue dos posturas[f. 51].
```

> Pini distingue dos posturas¹.
>
> ¹ Pini, «Scotus on Individuation», 69.

### Con un pedazo de la cita en la nota

```md
Para algunos el principio sería negativo[f. 51 «a negation»].
```

> ¹ Pini, «Scotus on Individuation», 69: «a negation».

## Opciones

Las opciones van después del número, en cualquier orden, separadas por espacios o comas.

### `+`: la cita completa en la nota

```md
La naturaleza común tiene una unidad propia[f. 60 +].
```

> ¹ Noone, «Universals and Individuation», 112: «The common nature has a unity less than numerical unity.».

Con llaves y un pedazo, `+` pone el pedazo en el texto y la cita completa en la nota:

```md
{f. 51 «positive entity» +} dice.
```

> «positive entity»¹ dice.
>
> ¹ Pini, «Scotus on Individuation», 69: «Some held that the principle is a positive entity, others that it is a negation.».

### `p.`: otra página

Para citar una página distinta de la de la ficha (por ejemplo, la misma idea desarrollada más adelante):

```md
y vuelve sobre ella más adelante[f. 60, p. 115].
```

> ¹ Noone, «Universals and Individuation», 115.

Admite rangos y romanos: `p. 115-117`, `pp. 115–117`, `p. xii`.

## Varias fichas en una nota

Separa las fichas con punto y coma dentro de unos corchetes:

```md
Sobre el debate posterior[f. 51; f. 60].
```

> ¹ Pini, «Scotus on Individuation», 69; Noone, «Universals and Individuation», 112.

Cada ficha puede llevar sus propias opciones: `[f. 51, p. 70; f. 60 +]`.

Entre llaves solo cabe una ficha. `{f. 51; f. 60}` produce el aviso *Entre llaves solo cabe una ficha: usa una referencia por cita*.

## Prefijos: cf., véase…

Lo que escribas delante del marcador y que no sea el nombre de un fichero se pone delante de la referencia, en la nota:

```md
[cf. f. 51; f. 60]
[véase f. 60]
[Para una lectura distinta, véase f. 51]
```

> ¹ cf. Pini, «Scotus on Individuation», 69; Noone, «Universals and Individuation», 112.

En los estilos autor-año, el prefijo va dentro del paréntesis: (cf. Pini 2005, 69; Noone 2003, 112).

## Elegir el fichero

El **marcador** dice de qué fichero es la ficha: si *Escoto* tiene el marcador `e.`, `[e. 3]` es su ficha 3.

Si dos ficheros comparten marcador, escribe el nombre del fichero delante:

```md
{Escoto f. 3}
[cf. Escoto f. 3]
```

O elige un **fichero por defecto** para el texto. Ver [Dos ficheros con el mismo marcador](/organon/conceptos/fichas-y-ficheros/#dos-ficheros-con-el-mismo-marcador).

## Obras canónicas

Si la fuente de la ficha es una [obra canónica](/organon/guias/obras-canonicas/), se cita su referencia canónica en lugar de la página:

```md
La fórmula de Escoto[e. 3].
```

> ¹ Escoto, *Ordinatio*, vol. 7, Ord. II, d. 3, p. 1, q. 6, n. 188.

Con `p.` se fuerza la página: `[e. 3, p. 245]`.

## Estilos autor-año

En Chicago (autor-año), APA y MLA no hay notas: la referencia va entre paréntesis en el texto. La misma sintaxis produce:

| Escribes | Chicago (autor-año) | APA | MLA |
| --- | --- | --- | --- |
| `posturas[f. 51]` | posturas (Pini 2005, 69) | posturas (Pini, 2005, p. 69) | posturas (Pini 69) |
| `[cf. f. 51; f. 60]` | (cf. Pini 2005, 69; Noone 2003, 112) | (Noone, 2003, p. 112; cf. Pini, 2005, p. 69) | (cf. Pini 69; Noone 112) |

Lo que en un estilo de notas iría a la nota además de la referencia (un pedazo entre corchetes, o la cita completa con `+`) va en una nota al pie aparte.

## Lo que no es una referencia

Organon solo interpreta como referencia lo que tiene la forma *marcador + número* de un fichero que existe. Lo demás se queda como texto:

- `[1]`, `[sic]`, `{x}` no son referencias.
- Los enlaces de Markdown (`[texto](url)`) y las notas de Markdown (`[^1]`, `[^nota]`) se respetan.
- Un marcador pegado a una palabra no cuenta: en `[cf. f. 51]`, el «f.» de «cf.» no se confunde con el marcador.

## Avisos

La Vista final lista los problemas que encuentra:

| Aviso | Qué pasa | Qué hacer |
| --- | --- | --- |
| *No existe la ficha f. 99 en «General».* | El número no existe en ese fichero. | Corrige el número, o el marcador. |
| *Hay una ficha 3 en varios ficheros con el marcador «f.»…* | La referencia es ambigua. | Da marcadores distintos a los ficheros, elige un fichero por defecto o escribe el nombre delante. |
| *La ficha f. 12 no tiene fuente: no se puede citar.* | La ficha no está vinculada a ninguna fuente. | Asígnale una fuente en el Fichero. |
| *La ficha f. 12 no tiene página.* | Falta la página. | Escríbela en la ficha. |
| *La ficha f. 12 no tiene texto de cita.* | Usaste `{ }` o `+` con una ficha sin cita. | Usa `[ ]` o escribe la cita en la ficha. |
| *El pedazo «…» no aparece tal cual en la ficha f. 51.* | El fragmento no coincide con la cita. | Corrige el pedazo (o la cita de la ficha). |
| *Entre llaves solo cabe una ficha.* | `{f. 51; f. 60}` | Usa dos referencias, o corchetes. |
| *La ficha e. 3 es de una obra canónica pero no tiene referencia canónica: se cita la página.* | Falta la referencia canónica. | Escríbela en *Obra canónica / referencias*. |

Una referencia que no se puede resolver aparece en la Vista final y en las exportaciones como **[⚠ sin referencia]**.
