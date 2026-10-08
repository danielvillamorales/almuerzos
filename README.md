# Pedido de almuerzos

App para tomar los pedidos de almuerzo de varias personas, por día, y llevar el control de quién pagó.

- **Gratis**: la página está en GitHub Pages y los pedidos se guardan en una hoja de Google.
- **Sin cuentas**: cualquiera que tenga el enlace puede ver, agregar, editar y borrar pedidos.
- **Enlace de la app**: https://danielvillamorales.github.io/almuerzos/

## Qué hace

1. **Primero se crea el día de venta**: la fecha, qué se vende (por ejemplo Almuerzo), sus opciones (por ejemplo Sencilla, Doble), la hora de entrega y una observación opcional (menú, precio...).
2. **Después se anotan los pedidos de ese día**: nombre, opción, cantidad, para qué parte va (Diseño, Costos, Bodega...), hora y una nota opcional. Nombres y lugares se autocompletan con los de días anteriores.
3. **Al entregar y cobrar**, cada pedido tiene dos botones: **Por entregar / ✓ Entregado** y **Sin pagar / ✓ Pagó**. Si se toca por error, el mensaje de abajo tiene **Deshacer**.

Además:

- Filtros **Todos, Por entregar, Entregados y Sin pagar**.
- Pestaña **Por cobrar**: revisa todos los días hasta hoy y muestra quién falta por pagar, agrupado por persona (día, producto, pedido y dirección de cada deuda). Ahí mismo se puede **Marcar pagó**, copiar la lista o enviarla por WhatsApp. Tiene su propio enlace para compartir: https://danielvillamorales.github.io/almuerzos/#por-cobrar
- **Ordenar** por llegada, dirección (la parte a la que va), nombre u hora. Por dirección y por hora se agrupan con un título por grupo. El orden elegido se recuerda en cada teléfono.
- **Descargar PDF** (tabla con todos los pedidos, totales y quién falta por recibir y pagar) y **Descargar imagen** (PNG lista para WhatsApp), siempre en el orden elegido.
- Totales por opción sumando las cantidades (por ejemplo 7 Sencillas, 8 Dobles, 15 Total) y cuántos se han entregado y pagado.
- Atajos para Hoy, Mañana y los próximos días creados (con un punto naranja), y **+ Nuevo día**.
- **Calendario**: al tocar la fecha se abre un calendario con los días que tienen venta marcados en naranja (también los pasados) y, debajo, la lista de esos días del mes con su producto y número de pedidos.
- Tocando el nombre de una persona se puede editar o borrar su pedido. **Editar día** cambia el producto, las opciones o la observación, o borra el día con sus pedidos.
- "Copiar resumen" y "Enviar por WhatsApp" mandan la lista del día con quién falta por recibir y por pagar.
- Todos ven los mismos datos. La página se actualiza sola cada 20 segundos y cada vez que se vuelve a abrir.
- Es rápida aunque Google tarde: la página guarda en el teléfono lo último que vio y lo muestra al instante mientras se actualiza ("actualizando…"), y trae en segundo plano los próximos días, así que cambiar de día no espera. Guardar también es inmediato: el cambio se ve de una vez y se envía por detrás.

## Puesta en marcha (una sola vez, unos 5 minutos)

Solo el dueño hace estos pasos, y se pueden hacer desde el celular o el computador. Las demás personas solo usan el enlace.

### 1. Activar GitHub Pages

En github.com (en el navegador; la app de GitHub no tiene esta opción), abre este repositorio y ve a **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` y `/ (root)` → Save**. En uno o dos minutos la página abre en https://danielvillamorales.github.io/almuerzos/

### 2. Crear el proyecto de Google Apps Script

La app de Hojas de cálculo del celular no tiene Apps Script, así que esto se hace en el navegador:

1. En Chrome abre https://script.new con tu cuenta de Gmail. En el celular, activa **⋮ → Sitio de escritorio** para ver el editor completo.
2. Abre https://raw.githubusercontent.com/danielvillamorales/almuerzos/main/apps-script/Codigo.gs, selecciona todo y cópialo.
3. En el editor de Apps Script borra lo que aparece en `Código.gs` y pega el código. Guarda con el ícono del disquete.
4. Opcional: cambia el nombre "Proyecto sin título" por **Almuerzos**.

No hace falta crear la hoja: el código crea **Almuerzos - pedidos** en tu Drive la primera vez que se usa.

### 3. Publicarlo como aplicación web

1. Botón azul **Implementar → Nueva implementación**.
2. En **Seleccionar tipo** (ícono del engranaje) elige **Aplicación web**.
3. Configura:
   - **Ejecutar como**: Yo (tu correo)
   - **Quién tiene acceso**: **Cualquier usuario** (no "Cualquier usuario con una Cuenta de Google")
4. Toca **Implementar** y luego **Autorizar acceso**. Elige tu cuenta.
5. Google mostrará "Google no verificó esta app". Es normal porque el código es tuyo: toca **Configuración avanzada → Ir a Almuerzos (no seguro) → Permitir**. Pide permiso sobre tus hojas de cálculo porque crea y actualiza la hoja de pedidos.
6. Copia la **URL de la aplicación web** (termina en `/exec`). Si la abres en el navegador debe mostrar `"app":"almuerzos"` y el enlace de la hoja.

### 4. Conectar la página con la hoja

Pega la URL entre las comillas de [`config.js`](config.js):

```js
window.ALMUERZOS_API_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
```

En GitHub: abre `config.js`, toca el lápiz (**Edit**), pega la URL y toca **Commit changes**. La página se actualiza en uno o dos minutos.

## Actualizar el código de Google

Cuando cambie [`apps-script/Codigo.gs`](apps-script/Codigo.gs) hay que pegar la versión nueva en Google. La URL de la app no cambia.

1. En Chrome abre https://script.google.com (en el celular, con **⋮ → Sitio de escritorio**) y entra al proyecto.
2. Copia todo el texto de https://raw.githubusercontent.com/danielvillamorales/almuerzos/main/apps-script/Codigo.gs, borra el código del editor, pégalo y guarda con el ícono del disquete.
3. **Implementar → Administrar implementaciones** → lápiz (**Editar**) → en **Versión** elige **Nueva versión** → **Implementar**.

Si la página dice "Para guardar cantidades hay que actualizar el código en Google", es que falta este paso.

El código guarda las respuestas unos minutos para contestar más rápido. Lo que se cambia desde la app se ve al instante; si editas la hoja a mano, el cambio tarda hasta 2 minutos en aparecer en la app.

## Compartir

Manda el enlace https://danielvillamorales.github.io/almuerzos/ por WhatsApp o donde quieras. No hace falta cuenta.

Cualquiera con el enlace puede borrar pedidos. Si se borra algo por error, en la hoja de Google ve a **Archivo → Historial de versiones** para recuperarlo. En la pestaña **Pedidos** de la hoja también puedes ver todos los pedidos.

## Cómo está hecha

- `index.html`: la página (HTML, CSS y JavaScript, sin dependencias).
- `config.js`: la URL de la hoja de Google.
- `vendor/`: jsPDF y jsPDF-AutoTable (MIT) para el PDF; solo se cargan al tocar **Descargar PDF**.
- `apps-script/Codigo.gs`: el servidor en Google Apps Script. Usa dos pestañas de la hoja:
  - **Dias**: `fecha, producto, opciones, hora, observacion, creado` (un día de venta por fecha).
  - **Pedidos**: `id, fecha, nombre, opcion, cantidad, parte, hora, nota, pagado, entregado, creado` (en una hoja que ya existía, las columnas nuevas se agregan al final).
- `claude-artifact/index.html`: la primera versión, publicada como Artifact de Claude (necesita cuenta de Claude y guarda sus datos aparte).

