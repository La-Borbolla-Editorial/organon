# Plan para 0.7.0: el editor de PDF

Acordado el 22 nov 2026. Marca con [x] lo que vaya quedando hecho.

## Principios

- **Organon no toca tus PDF.** Las marcas viven en el proyecto, en un archivo nuevo, `marcas.json`.
  Escribirlas dentro de un PDF es solo una exportación, siempre a una copia.
- **Los colores no significan nada para Organon.** Organon guarda el color de cada resaltado y
  nada más; cada quien decide qué quiere decir cada uno.

## 1. Leer

- [x] **Zoom con el trackpad.** Pellizcar acerca o aleja alrededor del punto donde están los
  dedos, no del centro de la página. ⌘+ y ⌘− hacen lo mismo con el teclado.
- [x] **Recordar el zoom y la hoja** de cada fuente al volver a abrirla.
- [x] **Buscar en el PDF (⌘F).** Se resaltan todos los resultados y se salta de uno a otro con
  Intro y ⇧Intro. La búsqueda no distingue acentos ni mayúsculas, y encuentra también las
  palabras cortadas con guion al final de línea.
- [x] **Índice y miniaturas** en un panel lateral. El índice son los marcadores que trae el PDF,
  si los trae.
- [x] **Volver atrás.** Después de saltar a una ficha, a un resultado o a una entrada del índice,
  un botón (y ⌘← o ⌘[) regresa a donde estabas.

## 2. Marcar

- [ ] **Resaltar sin hacer ficha.** Seleccionas un pasaje y lo resaltas; la ficha se hace después,
  o nunca.
- [ ] **Colores del resaltado.** Una paleta fija de unos seis colores. Organon recuerda el último que
  usaste. Las fichas que tienen pasaje en el PDF también llevan color.
- [ ] **Convertir un resaltado en ficha** con un clic. La ficha hereda el pasaje y el color, y el
  resaltado suelto desaparece porque ya es la ficha.
- [ ] **Notas al margen.** Un comentario pegado a un punto de la página, que no es una ficha.
- [ ] **Panel de marcas de la fuente.** Reúne resaltados, notas y fichas, filtrables por color y por
  tipo, y lleva a cada marca con un clic.
- [ ] **Captura por rectángulo.** Arrastras un recuadro sobre una tabla, un esquema o un escaneo
  sin texto. Organon guarda la imagen y puedes hacer una ficha con ella.

## 3. Entrar y salir

- [ ] **Importar las anotaciones del PDF.** Al adjuntar un PDF, o cuando lo pidas, Organon lee los
  resaltados y las notas que ya traiga de Zotero, Vista Previa o el iPad, y los copia como marcas
  con su color. El PDF queda igual.
- [ ] **Exportar una copia con las marcas.** Los resaltados, las notas y las fichas salen como
  anotaciones estándar del PDF, que se ven en Vista Previa, en Zotero o en el iPad.

## Fuera de 0.7.0

- Editar el documento en sí: rotar, borrar o reordenar hojas, o pasar OCR. Moverlo rompería la
  posición de las fichas y la paginación verificada.

## Notas técnicas

- **`marcas.json`:** una lista de marcas, cada una con `id`, `sourceId` y su tipo:
  - **resaltado:** guarda un `anchor`, igual que el de las fichas.
  - **nota:** guarda una página, un punto y el texto.
  - **recorte:** guarda una página, un rectángulo y la imagen.

  Todas llevan además `color` y las fechas.
- **Color:** `color` opcional en las marcas y en las fichas. Sin él, el resaltado lleva el amarillo
  de hoy.
- **Recortes:** la imagen se guarda en `recortes/`, dentro del proyecto. Falta decidir cómo sale en
  el CSV y en Escritura: la ruta en el CSV y la imagen en el .docx.
- **Zoom:** WebKit envía el pellizco del trackpad como `wheel` con `ctrlKey`, o como eventos
  `gesture*`. Se escucha en el visor y se reescala manteniendo fijo el punto bajo los dedos.
- **Búsqueda:** sobre el texto que pdf.js ya extrae para la capa de selección. Se indexa una vez
  por documento.
- **Importar:** pdf.js lee las anotaciones de tipo Highlight (con sus QuadPoints), Text y FreeText.
- **Exportar:** hace falta escribir PDF. Las opciones son `pdf-lib` (JavaScript) o `lopdf` (Rust).
  Se elige al llegar a esa parte.

## Orden propuesto

1. Leer: el zoom primero, porque es lo que más se nota al usar el Lector.
2. Marcar: `marcas.json` y los colores, luego la conversión a ficha, las notas, el panel y, al
   final, el recorte.
3. Importar y exportar.

Cada bloque se puede probar y usar por separado. Si alguno se alarga, lo hecho puede salir antes
como 0.7.0 y el resto en 0.7.x.
