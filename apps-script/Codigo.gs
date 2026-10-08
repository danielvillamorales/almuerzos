/**
 * Pedido de almuerzos: guarda los pedidos en esta hoja de Google.
 *
 * Se publica como "Aplicación web" (Ejecutar como: Yo, Quién tiene acceso:
 * Cualquier usuario). La página de GitHub Pages lee y escribe a través de
 * esta URL, así que nadie necesita cuenta para usar la app.
 *
 * @OnlyCurrentDoc
 */

var HOJA = 'Pedidos';
var COLUMNAS = ['id', 'fecha', 'nombre', 'tipo', 'hora', 'nota', 'pagado', 'creado'];
var TIPOS = ['Sencilla', 'Doble'];

/** Lectura: ?action=list&fecha=AAAA-MM-DD&desde=AAAA-MM-DD */
function doGet(e) {
  var p = (e && e.parameter) || {};
  return responder_(function () {
    if (p.action === 'list') return estado_(p.fecha, p.desde);
    return { app: 'almuerzos' };
  });
}

/** Escritura: cuerpo JSON con action = add | update | delete */
function doPost(e) {
  return responder_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (body.action === 'add') agregar_(body.order || {});
      else if (body.action === 'update') actualizar_(body.id, body.changes || {});
      else if (body.action === 'delete') borrar_(body.id);
      else throw new Error('Acción desconocida');
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
    return estado_(body.fecha, body.desde);
  });
}

function responder_(fn) {
  var out;
  try {
    out = fn();
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Hoja ----------

function hoja_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.getRange('A:H').setNumberFormat('@');
    sh.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leer_() {
  var sh = hoja_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return { sh: sh, pedidos: [] };
  var tz = Session.getScriptTimeZone();
  var datos = sh.getRange(2, 1, n, COLUMNAS.length).getValues();
  var pedidos = [];
  for (var i = 0; i < datos.length; i++) {
    var r = datos[i];
    var id = String(r[0] || '').trim();
    if (!id) continue;
    pedidos.push({
      fila: i + 2,
      id: id,
      date: texto_(r[1], tz, 'yyyy-MM-dd'),
      name: String(r[2] == null ? '' : r[2]),
      type: String(r[3]).trim() === 'Doble' ? 'Doble' : 'Sencilla',
      time: texto_(r[4], tz, 'HH:mm'),
      note: String(r[5] == null ? '' : r[5]),
      paid: esSi_(r[6]),
      createdAt: Number(r[7]) || 0
    });
  }
  return { sh: sh, pedidos: pedidos };
}

function escribirFila_(sh, fila, p) {
  if (fila > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  sh.getRange(fila, 1, 1, COLUMNAS.length)
    .setNumberFormat('@')
    .setValues([[p.id, p.date, p.name, p.type, p.time, p.note, p.paid ? 'Sí' : 'No', String(p.createdAt)]]);
}

// ---------- Acciones ----------

function estado_(fecha, desde) {
  var pedidos = leer_().pedidos;
  var orders = [];
  var days = {};
  var conteo = {};
  var limiteNombres = desde ? sumarDias_(desde, -60) : '';
  for (var i = 0; i < pedidos.length; i++) {
    var p = pedidos[i];
    if (fecha && p.date === fecha) orders.push(sinFila_(p));
    if (!desde || p.date >= desde) days[p.date] = (days[p.date] || 0) + 1;
    if (p.date >= limiteNombres && p.name) conteo[p.name] = (conteo[p.name] || 0) + 1;
  }
  orders.sort(function (a, b) { return a.createdAt - b.createdAt; });
  var names = Object.keys(conteo).sort(function (a, b) { return conteo[b] - conteo[a] || a.localeCompare(b); }).slice(0, 80);
  return { fecha: fecha || '', orders: orders, days: days, names: names };
}

function agregar_(o) {
  var datos = leer_();
  var id = /^[A-Za-z0-9-]{8,40}$/.test(String(o.id || '')) ? String(o.id) : Utilities.getUuid();
  for (var i = 0; i < datos.pedidos.length; i++) {
    if (datos.pedidos[i].id === id) return; // ya estaba guardado (reintento)
  }
  var nombre = limpiar_(o.name, 40);
  if (!nombre) throw new Error('Falta el nombre');
  escribirFila_(datos.sh, datos.sh.getLastRow() + 1, {
    id: id,
    date: fecha_(o.date),
    name: nombre,
    type: TIPOS.indexOf(o.type) >= 0 ? o.type : 'Sencilla',
    time: hora_(o.time),
    note: limpiar_(o.note, 80),
    paid: false,
    createdAt: Date.now()
  });
}

function actualizar_(id, c) {
  var datos = leer_();
  var p = buscar_(datos.pedidos, id);
  if (!p) throw new Error('Ese pedido ya no existe');
  if ('paid' in c) p.paid = c.paid === true;
  if ('type' in c && TIPOS.indexOf(c.type) >= 0) p.type = c.type;
  if ('name' in c) { var n = limpiar_(c.name, 40); if (n) p.name = n; }
  if ('time' in c) p.time = hora_(c.time);
  if ('note' in c) p.note = limpiar_(c.note, 80);
  if ('date' in c) p.date = fecha_(c.date);
  escribirFila_(datos.sh, p.fila, p);
}

function borrar_(id) {
  var datos = leer_();
  var p = buscar_(datos.pedidos, id);
  if (p) datos.sh.deleteRow(p.fila);
}

// ---------- Utilidades ----------

function buscar_(pedidos, id) {
  for (var i = 0; i < pedidos.length; i++) if (pedidos[i].id === String(id)) return pedidos[i];
  return null;
}

function sinFila_(p) {
  return { id: p.id, date: p.date, name: p.name, type: p.type, time: p.time, note: p.note, paid: p.paid, createdAt: p.createdAt };
}

function texto_(v, tz, formato) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz, formato);
  return String(v == null ? '' : v).trim();
}

function esSi_(v) {
  return v === true || /^(s[ií]|si|true|1|x)$/i.test(String(v).trim());
}

function limpiar_(s, max) {
  return String(s == null ? '' : s).replace(/^[=+\-@\s]+/, '').trim().slice(0, max);
}

function fecha_(f) {
  f = String(f || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new Error('Fecha no válida');
  return f;
}

function hora_(h) {
  h = String(h || '').trim();
  if (h && !/^\d{2}:\d{2}$/.test(h)) throw new Error('Hora no válida');
  return h;
}

function sumarDias_(f, n) {
  var p = f.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  var dd = ('0' + d.getDate()).slice(-2);
  return d.getFullYear() + '-' + mm + '-' + dd;
}
