# Pedido de almuerzos

App para tomar los pedidos de almuerzo de varias personas por fecha y llevar el control de quién pagó.

**App en línea:** https://claude.ai/artifact/TC7bv7yqeyKWahjU9gjfLt

## Qué hace

- Pedidos por fecha: navega entre días o elige una fecha en el calendario.
- Cada pedido tiene nombre, tipo (Sencilla o Doble), hora y una nota opcional.
- Botón por persona para marcar **Debe / ✓ Pagó**, y filtros "Sin pagar" y "Pagados".
- Totales de sencillas, dobles y pedidos; con precios configurados muestra lo cobrado y lo que falta.
- "Copiar resumen" deja la lista del día lista para pegar en WhatsApp.
- Los datos se comparten en tiempo real entre todos los que abren el enlace.

## Cómo está hecha

`index.html` es una sola página (HTML, CSS y JavaScript sin dependencias) publicada como Artifact de Claude.
Los datos se guardan en la base de datos compartida del artifact (`claude.use("db")`):

- `orders/<id>`: `{ date: "YYYY-MM-DD", name, type: "Sencilla" | "Doble", time, note, paid, createdAt }`
- `config/precios`: `{ sencilla, doble }`

## Compartir

Desde el menú **Compartir** del artifact, da acceso a las personas. Para que puedan anotar pedidos y marcar pagos necesitan el nivel **Colaborador**; con "Lector" solo pueden ver. Cada persona necesita una cuenta de Claude (sirve la gratuita).

## Actualizar la app

Edita `index.html` y vuelve a publicarlo en el mismo artifact (el archivo no lleva `<html>`, `<head>` ni `<body>`: el artifact los agrega al publicar).
