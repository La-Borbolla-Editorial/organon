---
title: Proyectos
description: Qué es un proyecto en Organon, qué guarda y cómo se cambia de uno a otro.
sidebar:
  order: 1
---

Un **proyecto** es una carpeta cualquiera de tu disco: la de la tesis, la de un artículo, la de un curso. Organon guarda dentro todo lo que haces en ese proyecto, en archivos legibles, y no guarda nada en ningún otro sitio.

```text
Tesis/
├── organon.json      ← ajustes del proyecto y sus ficheros
├── fuentes.json      ← la biblioteca: metadatos, PDF adjunto y paginación
├── fichas.json       ← todas las fichas
├── pdfs/             ← los PDF adjuntos (y .papelera/ con los quitados)
└── escritura/        ← tus textos, un .md por texto (y .papelera/)
```

El detalle de cada archivo está en [Archivos del proyecto](/organon/referencia/archivos-del-proyecto/).

## Por qué carpetas y no una base de datos

- **Tus datos son tuyos.** Puedes abrir `fichas.json` con cualquier editor, copiar la carpeta a un disco externo o enviarla por correo. Si algún día dejas de usar Organon, todo sigue ahí.
- **Se sincronizan y se versionan como cualquier carpeta.** Dropbox, iCloud Drive, OneDrive o git funcionan sin configuración especial. Ver [Sincronizar y respaldar](/organon/guias/sincronizar-y-respaldar/).
- **Un proyecto no contamina al otro.** Las fuentes, las fichas, el estilo de cita y el idioma son de cada proyecto. Puedes citar en Chicago en la tesis y en APA en un artículo.

## Abrir, crear y cambiar de proyecto

- **Crear:** en la pantalla de inicio, **Abrir o crear un proyecto en una carpeta…** y elige una carpeta vacía (o cualquier carpeta: Organon solo añade sus archivos y no toca lo demás).
- **Abrir:** el mismo botón con una carpeta que ya tenga un `organon.json`, o un clic en **Proyectos recientes**.
- **Cambiar:** pulsa el nombre del proyecto arriba a la izquierda para volver a la pantalla de inicio.
- **Quitar de recientes:** la × junto a un proyecto reciente lo quita de la lista. No borra nada de la carpeta.

La lista de proyectos recientes es lo único que Organon guarda fuera de los proyectos, junto con la apariencia (ver [Temas](/organon/guias/ajustes-y-temas/)).

## Qué es de cada proyecto y qué es de Organon

| Del proyecto (viaja con la carpeta) | De Organon (se queda en tu equipo) |
| --- | --- |
| Fuentes, PDF y paginación | Tema y tipografías |
| Fichas y ficheros, con sus columnas | Proyectos recientes |
| Textos de Escritura | |
| Estilo de cita e idioma | |
| Papelera de PDF y de textos | |

## Cambios hechos fuera de Organon

Si mientras el proyecto está abierto cambias sus archivos a mano, o una sincronización los reemplaza, Organon lo detecta al volver a su ventana o al guardar. Entonces avisa, **no sobrescribe nada** y te ofrece recargar el proyecto. En Escritura, si el texto abierto cambió en el disco, puedes elegir entre **Cargar la versión del disco** y **Guardar la mía encima**.

## Proyectos creados con otra versión

Los archivos llevan un número de formato. Una versión de Organon más antigua que la que creó el proyecto se niega a abrirlo («Este proyecto se creó con una versión más reciente de Organon») en lugar de arriesgarse a perder datos. Actualiza Organon y vuelve a abrirlo.
