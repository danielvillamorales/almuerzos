# Pedido de almuerzos

App para tomar los pedidos de almuerzo de varias personas, por día, y llevar el control de quién pagó.

- **Gratis**: la página está en GitHub Pages y los pedidos se guardan en una hoja de Google.
- **Sin cuentas**: cualquiera que tenga el enlace puede ver, agregar, editar y borrar pedidos.
- **Enlace de la app**: https://danielvillamorales.github.io/almuerzos/

## Qué hace

- La fecha es el **día en que se necesita el almuerzo**. Se elige arriba (o con los atajos Hoy, Mañana y los próximos días que ya tienen pedidos) y se cargan todos los pedidos de ese día.
- Al agregar un pedido se indica para qué día se necesita, así se pueden tomar pedidos con anticipación.
- Al abrir la app, si hoy no hay pedidos, muestra el próximo día que sí tiene.
- Cada pedido tiene nombre, tipo (Sencilla o Doble), hora y una nota opcional. El nombre se autocompleta con los de días anteriores.
- Al tocar el nombre de una persona: marcar que pagó, cambiar Sencilla/Doble o borrar.
- Totales de sencillas, dobles y pedidos, y cuántos pagaron.
- "Copiar resumen" y "Enviar por WhatsApp" mandan la lista del día con los que faltan por pagar.
- Todos ven los mismos datos. La página se actualiza sola cada 20 segundos y cada vez que se vuelve a abrir.

## Puesta en marcha (una sola vez, unos 5 minutos)

Solo el dueño hace estos pasos. Las demás personas solo usan el enlace.

### 1. Activar GitHub Pages

En este repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` y `/ (root)` → Save**. En uno o dos minutos la página abre en https://danielvillamorales.github.io/almuerzos/ (todavía sin datos).

### 2. Crear la hoja de Google y pegar el código

1. Entra a https://sheets.new con tu cuenta de Gmail. Se crea una hoja nueva; ponle de nombre **Almuerzos**.
2. En el menú, ve a **Extensiones → Apps Script**.
3. Borra todo lo que aparece en el editor (`Código.gs`) y pega el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Para copiarlo fácil, abre el archivo en GitHub y usa el botón **Copy raw file**.
4. Arriba, cambia el nombre del proyecto de "Proyecto sin título" a **Almuerzos** y guarda con el ícono del disquete (o Ctrl + S).

### 3. Publicar la hoja como aplicación web

1. Botón azul **Implementar → Nueva implementación**.
2. En **Seleccionar tipo** (ícono del engranaje) elige **Aplicación web**.
3. Configura:
   - **Ejecutar como**: Yo (tu correo)
   - **Quién tiene acceso**: **Cualquier usuario** (no "Cualquier usuario con una Cuenta de Google")
4. Toca **Implementar** y luego **Autorizar acceso**. Elige tu cuenta.
5. Google mostrará "Google no verificó esta app". Es normal porque el código es tuyo: toca **Configuración avanzada → Ir a Almuerzos (no seguro) → Permitir**. El permiso solo da acceso a esa hoja.
6. Copia la **URL de la aplicación web** (termina en `/exec`). Si la abres en el navegador debe mostrar `{"app":"almuerzos","ok":true}`.

### 4. Conectar la página con la hoja

Pega la URL entre las comillas de [`config.js`](config.js):

```js
window.ALMUERZOS_API_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
```

En GitHub: abre `config.js`, toca el lápiz (**Edit**), pega la URL y toca **Commit changes**. La página se actualiza en uno o dos minutos.

## Compartir

Manda el enlace https://danielvillamorales.github.io/almuerzos/ por WhatsApp o donde quieras. No hace falta cuenta.

Cualquiera con el enlace puede borrar pedidos. Si se borra algo por error, en la hoja de Google ve a **Archivo → Historial de versiones** para recuperarlo. En la pestaña **Pedidos** de la hoja también puedes ver todos los pedidos.

## Cómo está hecha

- `index.html`: la página (HTML, CSS y JavaScript, sin dependencias).
- `config.js`: la URL de la hoja de Google.
- `apps-script/Codigo.gs`: el servidor en Google Apps Script. Guarda cada pedido como una fila de la pestaña **Pedidos**: `id, fecha (día en que se necesita), nombre, tipo, hora, nota, pagado, creado`.
- `claude-artifact/index.html`: la primera versión, publicada como Artifact de Claude (necesita cuenta de Claude y guarda sus datos aparte).

Si cambias `Codigo.gs`, publica la nueva versión en **Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva versión → Implementar**. Así la URL no cambia.
