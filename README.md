# Pedido de almuerzos

App para tomar los pedidos de almuerzo de varias personas por fecha y llevar el control de quién pagó.

**App en línea:** https://claude.ai/artifact/TC7bv7yqeyKWahjU9gjfLt

## Qué hace

- Primero se elige la **fecha del pedido** y se cargan todos los pedidos de ese día.
- Cada pedido tiene nombre, tipo (Sencilla o Doble), hora y una nota opcional.
- Al tocar el nombre de una persona: marcar que pagó, cambiar Sencilla/Doble o borrar.
- Totales de sencillas, dobles y pedidos, y cuántos pagaron.
- "Copiar resumen" deja la lista del día lista para pegar en WhatsApp.
- Los datos se comparten en tiempo real entre todos los que abren el enlace.

## Cómo está hecha

`index.html` es una sola página (HTML, CSS y JavaScript sin dependencias) publicada como Artifact de Claude.
Los datos se guardan en la base de datos compartida del artifact (`claude.use("db")`):

- `orders/<id>`: `{ date: "YYYY-MM-DD", name, type: "Sencilla" | "Doble", time, note, paid, createdAt }`

## Compartir

Desde el botón **Compartir** del artifact, invita a cada persona por su correo. Para que puedan anotar pedidos y marcar pagos dales el nivel **Editor** (en planes de equipo, **Colaborador** también sirve); con "Lector" solo pueden ver. Si se activa el enlace público, las personas de fuera de tu organización quedan solo como lectoras. Cada persona necesita una cuenta de Claude (sirve la gratuita).

## Actualizar la app

Edita `index.html` y vuelve a publicarlo en el mismo artifact (el archivo no lleva `<html>`, `<head>` ni `<body>`: el artifact los agrega al publicar).
