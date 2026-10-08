/**
 * Pedido de almuerzos: guarda los días de venta y los pedidos en una hoja de Google.
 *
 * Se publica como "Aplicación web" (Ejecutar como: Yo, Quién tiene acceso:
 * Cualquier usuario). La página de GitHub Pages lee y escribe a través de
 * esta URL, así que nadie necesita cuenta para usar la app.
 *
 * Si el script está dentro de una hoja (Extensiones > Apps Script) usa esa hoja.
 * Si es un proyecto suelto (script.google.com > Nuevo proyecto) crea la hoja
 * "Almuerzos - pedidos" en tu Drive la primera vez que se usa.
 *
 * Pestañas:
 *   Dias:    fecha, producto, opciones, hora, observacion, creado
 *   Pedidos: id, fecha, nombre, opcion, parte, hora, nota, pagado, entregado, creado
 */

var DIAS = { hoja: 'Dias', columnas: ['fecha', 'producto', 'opciones', 'hora', 'observacion', 'creado'] };
var PEDIDOS = { hoja: 'Pedidos', columnas: ['id', 'fecha', 'nombre', 'opcion', 'parte', 'hora', 'nota', 'pagado', 'entregado', 'creado'] };
var ALIAS = { opcion: 'tipo' }; // hojas creadas con la primera versión

/** Lectura: ?action=list&fecha=AAAA-MM-DD&desde=AAAA-MM-DD */
function doGet(e) {
  var p = (e && e.parameter) || {};
  return responder_(function () {
    if (p.action === 'list') return estado_(p.fecha, p.desde);
    return { app: 'almuerzos', hoja: libro_().getUrl() };
  });
}

/** Escritura: cuerpo JSON con action = saveDay | deleteDay | add | update | delete */
function doPost(e) {
  return responder_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    libro_(); // si hay que crear la hoja, que sea antes de tomar el candado
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (body.action === 'saveDay') guardarDia_(body.day || {});
      else if (body.action === 'deleteDay') borrarDia_((body.day || {}).fecha);
      else if (body.action === 'add') agregar_(body.order || {});
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

/** Ejecútala una vez desde el editor si quieres crear la hoja y ver su enlace en el registro. */
function configurar() {
  Logger.log('Hoja de pedidos: ' + libro_().getUrl());
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

// ---------- Hoja de cálculo ----------

var libroCache_ = null;

function libro_() {
  if (libroCache_) return libroCache_;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('HOJA_ID');
    if (id) {
      try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
    }
    if (!ss) {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        id = props.getProperty('HOJA_ID');
        if (id) {
          try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
        }
        if (!ss) {
          ss = SpreadsheetApp.create('Almuerzos - pedidos');
          props.setProperty('HOJA_ID', ss.getId());
        }
      } finally {
        lock.releaseLock();
      }
    }
  }
  libroCache_ = ss;
  return ss;
}

/** Abre una pestaña, crea las columnas que falten y devuelve sus filas. */
function tabla_(def) {
  var ss = libro_();
  var sh = ss.getSheetByName(def.hoja) || ss.insertSheet(def.hoja);
  var ancho = sh.getLastColumn();
  var encabezado = ancho ? sh.getRange(1, 1, 1, ancho).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); }) : [];
  while (encabezado.length && !encabezado[encabezado.length - 1]) encabezado.pop();
  if (!encabezado.length) {
    sh.getRange(1, 1, sh.getMaxRows(), def.columnas.length).setNumberFormat('@');
    sh.setFrozenRows(1);
  }
  var idx = {};
  def.columnas.forEach(function (c) {
    var i = encabezado.indexOf(c);
    if (i < 0 && ALIAS[c]) i = encabezado.indexOf(ALIAS[c]);
    if (i < 0) {
      encabezado.push(c);
      i = encabezado.length - 1;
      sh.getRange(1, i + 1).setValue(c).setFontWeight('bold');
    }
    idx[c] = i;
  });
  var n = sh.getLastRow() - 1;
  var filas = n > 0 ? sh.getRange(2, 1, n, encabezado.length).getValues() : [];
  return { sh: sh, idx: idx, ancho: encabezado.length, filas: filas };
}

/** Escribe una fila completa. Conserva las columnas extra que alguien agregue a mano. */
function escribir_(t, fila, valores, base) {
  var datos = base ? base.slice() : [];
  while (datos.length < t.ancho) datos.push('');
  Object.keys(valores).forEach(function (c) {
    datos[t.idx[c]] = valores[c] == null ? '' : String(valores[c]);
  });
  if (fila > t.sh.getMaxRows()) t.sh.insertRowsAfter(t.sh.getMaxRows(), 200);
  t.sh.getRange(fila, 1, 1, t.ancho).setNumberFormat('@').setValues([datos]);
}

function borrarFilas_(sh, items) {
  items.map(function (x) { return x.fila; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (f) { sh.deleteRow(f); });
}

function leerDias_() {
  var t = tabla_(DIAS);
  var tz = Session.getScriptTimeZone();
  var lista = [];
  t.filas.forEach(function (r, i) {
    var fecha = texto_(r[t.idx.fecha], tz, 'yyyy-MM-dd');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    var producto = String(valor_(r, t.idx.producto)).trim() || 'Almuerzo';
    var ops = opciones_(valor_(r, t.idx.opciones));
    lista.push({
      fila: i + 2,
      base: r,
      fecha: fecha,
      producto: producto,
      opciones: ops.length ? ops : [producto],
      hora: texto_(r[t.idx.hora], tz, 'HH:mm'),
      observacion: String(valor_(r, t.idx.observacion)).trim(),
      creado: Number(r[t.idx.creado]) || 0
    });
  });
  return { t: t, lista: lista };
}

function leerPedidos_() {
  var t = tabla_(PEDIDOS);
  var tz = Session.getScriptTimeZone();
  var lista = [];
  t.filas.forEach(function (r, i) {
    var id = String(valor_(r, t.idx.id)).trim();
    if (!id) return;
    lista.push({
      fila: i + 2,
      base: r,
      id: id,
      date: texto_(r[t.idx.fecha], tz, 'yyyy-MM-dd'),
      name: String(valor_(r, t.idx.nombre)).trim(),
      option: String(valor_(r, t.idx.opcion)).trim(),
      place: String(valor_(r, t.idx.parte)).trim(),
      time: texto_(r[t.idx.hora], tz, 'HH:mm'),
      note: String(valor_(r, t.idx.nota)).trim(),
      paid: esSi_(r[t.idx.pagado]),
      delivered: esSi_(r[t.idx.entregado]),
      createdAt: Number(r[t.idx.creado]) || 0
    });
  });
  return { t: t, lista: lista };
}

// ---------- Acciones ----------

function estado_(fecha, desde) {
  var dias = leerDias_().lista;
  var pedidos = leerPedidos_().lista;
  var res = { fecha: fecha || '', day: null, orders: [], days: {}, names: [], places: [] };
  dias.forEach(function (d) {
    if (d.fecha === fecha) res.day = { fecha: d.fecha, producto: d.producto, opciones: d.opciones, hora: d.hora, observacion: d.observacion };
    if (!desde || d.fecha >= desde) res.days[d.fecha] = { producto: d.producto, count: 0 };
  });
  var nombres = {};
  var partes = {};
  var limite = desde ? sumarDias_(desde, -90) : '';
  pedidos.forEach(function (p) {
    if (fecha && p.date === fecha) res.orders.push(publico_(p));
    if (!desde || p.date >= desde) {
      if (!res.days[p.date]) res.days[p.date] = { producto: '', count: 0 };
      res.days[p.date].count++;
    }
    if (p.date >= limite) {
      if (p.name) nombres[p.name] = (nombres[p.name] || 0) + 1;
      if (p.place) partes[p.place] = (partes[p.place] || 0) + 1;
    }
  });
  res.orders.sort(function (a, b) { return a.createdAt - b.createdAt; });
  res.names = masUsados_(nombres, 80);
  res.places = masUsados_(partes, 40);
  return res;
}

function guardarDia_(d) {
  var fecha = fecha_(d.fecha);
  var producto = limpiar_(d.producto, 40);
  if (!producto) throw new Error('Escribe qué se vende');
  var ops = opciones_(Array.isArray(d.opciones) ? d.opciones.join(',') : d.opciones);
  var dias = leerDias_();
  var actual = buscarDia_(dias.lista, fecha);
  var valores = {
    fecha: fecha,
    producto: producto,
    opciones: (ops.length ? ops : [producto]).join(', '),
    hora: hora_(d.hora),
    observacion: limpiar_(d.observacion, 140),
    creado: actual ? actual.creado : Date.now()
  };
  if (actual) escribir_(dias.t, actual.fila, valores, actual.base);
  else escribir_(dias.t, dias.t.sh.getLastRow() + 1, valores, null);
}

function borrarDia_(fecha) {
  fecha = fecha_(fecha);
  var pedidos = leerPedidos_();
  borrarFilas_(pedidos.t.sh, pedidos.lista.filter(function (p) { return p.date === fecha; }));
  var dias = leerDias_();
  borrarFilas_(dias.t.sh, dias.lista.filter(function (d) { return d.fecha === fecha; }));
}

function agregar_(o) {
  var fecha = fecha_(o.date);
  var dia = buscarDia_(leerDias_().lista, fecha);
  if (!dia) throw new Error('Primero crea el día de venta');
  var pedidos = leerPedidos_();
  var id = /^[A-Za-z0-9-]{8,40}$/.test(String(o.id || '')) ? String(o.id) : Utilities.getUuid();
  if (buscar_(pedidos.lista, id)) return; // ya estaba guardado (reintento)
  var nombre = limpiar_(o.name, 40);
  if (!nombre) throw new Error('Falta el nombre');
  escribir_(pedidos.t, pedidos.t.sh.getLastRow() + 1, {
    id: id,
    fecha: fecha,
    nombre: nombre,
    opcion: opcionValida_(dia, o.option),
    parte: limpiar_(o.place, 40),
    hora: hora_(o.time),
    nota: limpiar_(o.note, 80),
    pagado: 'No',
    entregado: 'No',
    creado: Date.now()
  }, null);
}

function actualizar_(id, c) {
  var pedidos = leerPedidos_();
  var p = buscar_(pedidos.lista, id);
  if (!p) throw new Error('Ese pedido ya no existe');
  var v = {
    id: p.id, fecha: p.date, nombre: p.name, opcion: p.option, parte: p.place, hora: p.time, nota: p.note,
    pagado: p.paid ? 'Sí' : 'No', entregado: p.delivered ? 'Sí' : 'No', creado: p.createdAt
  };
  if ('paid' in c) v.pagado = c.paid === true ? 'Sí' : 'No';
  if ('delivered' in c) v.entregado = c.delivered === true ? 'Sí' : 'No';
  if ('name' in c) { var n = limpiar_(c.name, 40); if (n) v.nombre = n; }
  if ('option' in c) {
    var dia = buscarDia_(leerDias_().lista, p.date);
    v.opcion = dia ? opcionValida_(dia, c.option) : limpiar_(c.option, 30);
  }
  if ('place' in c) v.parte = limpiar_(c.place, 40);
  if ('time' in c) v.hora = hora_(c.time);
  if ('note' in c) v.nota = limpiar_(c.note, 80);
  escribir_(pedidos.t, p.fila, v, p.base);
}

function borrar_(id) {
  var pedidos = leerPedidos_();
  var p = buscar_(pedidos.lista, id);
  if (p) pedidos.t.sh.deleteRow(p.fila);
}

// ---------- Utilidades ----------

function buscar_(pedidos, id) {
  for (var i = 0; i < pedidos.length; i++) if (pedidos[i].id === String(id)) return pedidos[i];
  return null;
}

function buscarDia_(dias, fecha) {
  for (var i = 0; i < dias.length; i++) if (dias[i].fecha === fecha) return dias[i];
  return null;
}

function opcionValida_(dia, valor) {
  var v = limpiar_(valor, 30);
  for (var i = 0; i < dia.opciones.length; i++) {
    if (dia.opciones[i].toLowerCase() === v.toLowerCase()) return dia.opciones[i];
  }
  throw new Error('"' + v + '" no es una opción de este día');
}

function publico_(p) {
  return {
    id: p.id, date: p.date, name: p.name, option: p.option, place: p.place, time: p.time, note: p.note,
    paid: p.paid, delivered: p.delivered, createdAt: p.createdAt
  };
}

function masUsados_(conteo, max) {
  return Object.keys(conteo)
    .sort(function (a, b) { return conteo[b] - conteo[a] || a.localeCompare(b); })
    .slice(0, max);
}

function opciones_(v) {
  var vistas = {};
  return String(v == null ? '' : v).split(/[,;\n]/)
    .map(function (s) { return limpiar_(s, 30); })
    .filter(function (s) {
      var k = s.toLowerCase();
      if (!s || vistas[k]) return false;
      vistas[k] = true;
      return true;
    })
    .slice(0, 8);
}

function valor_(r, i) {
  var v = r[i];
  return v == null ? '' : v;
}

function texto_(v, tz, formato) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz, formato);
  return String(v == null ? '' : v).trim();
}

function esSi_(v) {
  return v === true || /^(s[ií]|true|1|x)$/i.test(String(v == null ? '' : v).trim());
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
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
