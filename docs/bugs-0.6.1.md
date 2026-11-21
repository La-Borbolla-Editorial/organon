# Bugs para 0.6.1

Lista de partida (21 nov 2026). **Todos resueltos en 0.6.1** (ver CHANGELOG).
Las inconsistencias se resolvieron así: 14, la búsqueda mira solo lo visible; 15, orden manual y
columnas propias en Escritura; 16, se pregunta antes de descartar; 17, el aviso sale al guardar;
18, Alt+↑ / Alt+↓ con la fila seleccionada.

Gravedad: **alta** = se pierde trabajo o algo «desaparece»; **media** = molesta o confunde; **baja** = detalle.

## Confirmados en la app (los reproduje)

- [x] **1. Esc cierra también la ficha que estás editando** — alta
  Con una ficha abierta en el panel lateral, Esc para cerrar el menú de una columna, el panel
  «Columnas…» o los Ajustes cierra **también** la ficha, y lo que no hayas guardado se pierde.
  *Propuesta:* Esc cierra solo lo de arriba (menú o diálogo); la ficha, con un segundo Esc.

- [x] **2. Un filtro por valores esconde los valores nuevos** — alta
  Si en «Tema» desmarcas un tag, Organon guarda la lista de los que *sí* se ven. Un tag creado
  después no está en esa lista: las fichas con ese tag no aparecen, y el filtro se recuerda al
  cerrar la app. Igual con opciones nuevas de una lista y con fuentes nuevas.
  *Propuesta:* guardar los valores ocultados (como Sheets), no los mostrados.

- [x] **3. Una ficha nueva que no pasa los filtros desaparece sin aviso** — alta
  Con filtros o búsqueda puestos, guardar una ficha que no los cumple la guarda bien («4 de 6»),
  pero no se ve en la tabla y nada lo explica.
  *Propuesta:* aviso «Ficha guardada; los filtros la ocultan · Quitar filtros».

- [x] **4. No se puede renombrar un texto cambiando solo mayúsculas** — baja
  Escritura: renombrar «Prueba» a «prueba» dice «Ya existe un texto llamado «prueba»». El disco de
  macOS (y el de Windows) no distingue mayúsculas, así que el texto se ve a sí mismo.

## Seguros por el código (sin reproducir en la interfaz)

- [x] **5. «Quitar» las columnas ID, Autor o Paper/Texto borra datos del CSV** — alta
  El aviso dice que el campo sigue en la ficha, pero para esas tres columnas Organon guarda el
  texto original del CSV (p. ej. el autor y el título de una ficha sin fuente vinculada), y quitar
  la columna lo borra. Es justo lo que identifica a las fichas importadas sin fuente.
  *Propuesta:* al quitar esas columnas, conservar esos valores.

- [x] **6. Sin columna Autor o Paper/Texto, las fichas sin fuente ya no se pueden vincular solas** — media
  Vincular las fichas sin fuente usa el autor y el título de esas columnas.

- [x] **7. Renombrar una columna pierde su filtro y su orden guardados** — baja

- [x] **8. Las fechas solo se entienden como AAAA-MM-DD** — media
  Una fecha importada como «14/03/2026» se ordena como texto y no entra en ningún rango «desde – hasta».

- [x] **9. «1.000» se lee como 1** en las columnas de número — baja

- [x] **10. Las casillas se exportan como «sí»** — baja
  Google Sheets solo las reconoce como casilla si son TRUE / FALSE.

- [x] **11. Cambiar de fichero muy rápido puede aplicar los filtros del anterior** — baja

- [x] **12. Los filtros de un fichero eliminado se quedan en `organon.json`** — baja (inofensivo)

- [x] **13. Windows: textos de Escritura con `? * " < > |` en el nombre fallan al guardarse** — media
  macOS los acepta; Windows no, y Organon no lo avisa antes.

## Inconsistencias (¿bug o así está bien?)

- [x] **14.** La búsqueda encuentra fichas por lo que tienen en columnas **ocultas**.
- [x] **15.** Escritura: la lista de fichas para insertar sigue ordenada por número, no por el orden
  manual, y no busca en las columnas propias.
- [x] **16.** Esc en «Columnas…» descarta los cambios sin preguntar.
- [x] **17.** «Columnas…»: al añadir una columna aparece «Todas las columnas necesitan un nombre» antes
  de que escribas nada.
- [x] **18.** Las filas solo se pueden mover con el ratón (no hay atajo de teclado).

## Sin probar

- El instalador de Windows en un PC real.
- La versión Intel en un Mac Intel.

## Tuyos

- [ ] 
