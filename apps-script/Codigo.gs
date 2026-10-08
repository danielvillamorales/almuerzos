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
 * Para responder rápido, las respuestas se guardan un rato en la caché de
 * Apps Script. Lo que se cambia desde la app se ve al instante; lo que se
 * cambia a mano en la hoja tarda hasta 2 minutos en aparecer.
 *
 * Pestañas:
 *   Dias:    fecha, producto, opciones, hora, observacion, creado
 *   Pedidos: id, fecha, nombre, opcion, cantidad, parte, hora, nota, pagado, entregado, creado
 */

var DIAS = { hoja: 'Dias', columnas: ['fecha', 'producto', 'opciones', 'hora', 'observacion', 'creado'] };
var PEDIDOS = { hoja: 'Pedidos', columnas: ['id', 'fecha', 'nombre', 'opcion', 'cantidad', 'parte', 'hora', 'nota', 'pagado', 'entregado', 'creado'] };
var ALIAS = { opcion: 'tipo' }; // hojas creadas con la primera versión
var VERSION = 3; // 2: cantidades. 3: caché y próximos días en cada respuesta
var CACHE_SEG = 120;
var PROXIMOS = 14; // cuántos días de venta próximos se mandan en cada respuesta

/** Lectura: ?action=list&fecha=AAAA-MM-DD&desde=AAAA-MM-DD */
function doGet(e) {
  var p = (e && e.parameter) || {};
  return responder_(function () {
    if (p.action === 'list') return listar_(p.fecha, p.desde);
    return { app: 'almuerzos', version: VERSION, hoja: libro_().getUrl() };
  });
}

/** Escritura: cuerpo JSON con action = saveDay | deleteDay | add | update | delete */
function doPost(e) {
  return responder_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    libro_(); // si hay que crear la hoja, que sea antes de tomar el candado
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var db, gen;
    try {
      db = cargar_();
      if (body.action === 'saveDay') guardarDia_(db, body.day || {});
      else if (body.action === 'deleteDay') borrarDia_(db, (body.day || {}).fecha);
      else if (body.action === 'add') agregar_(db, body.order || {});
      else if (body.action === 'update') actualizar_(db, body.id, body.changes || {});
      else if (body.action === 'delete') borrar_(db, body.id);
      else throw new Error('Acción desconocida');
      SpreadsheetApp.flush();
    } finally {
      gen = nuevaGeneracion_(); // cualquier intento de escritura invalida la caché
      lock.releaseLock();
    }
    var res = estado_(db, body.fecha, body.desde);
    guardarCache_(clave_(gen, body.fecha, body.desde), res);
    return res;
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

function listar_(fecha, desde) {
  var k = clave_(generacion_(), fecha, desde);
  var guardado = leerCache_(k);
  if (guardado) return guardado;
  var res = estado_(cargar_(), fecha, desde);
  guardarCache_(k, res);
  return res;
}

// ---------- Caché ----------
// Cada escritura cambia la "generación"; las respuestas guardadas con la
// generación anterior dejan de usarse y vencen solas.

function cache_() {
  return CacheService.getScriptCache();
}

function generacion_() {
  var g = cache_().get('gen');
  if (!g) {
    g = String(Date.now());
    cache_().put('gen', g, 21600);
  }
  return g;
}

function nuevaGeneracion_() {
  var g = String(Date.now()) + Math.random().toString(36).slice(2, 6);
  try { cache_().put('gen', g, 21600); } catch (e) {}
  return g;
}

function clave_(gen, fecha, desde) {
  return 'e' + gen + '|' + (fecha || '') + '|' + (desde || '');
}

function leerCache_(k) {
  try {
    var v = cache_().get(k);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

function guardarCache_(k, res) {
  try {
    var s = JSON.stringify(res);
    if (s.length < 95000) cache_().put(k, s, CACHE_SEG);
  } catch (e) {}
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

/** Lee una pestaña completa de una vez, crea las columnas que falten y devuelve sus filas. */
function tabla_(def) {
  var ss = libro_();
  var sh = ss.getSheetByName(def.hoja);
  var datos = [];
  if (sh) datos = sh.getDataRange().getValues();
  else sh = ss.insertSheet(def.hoja);
  var encabezado = (datos[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
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
  return { sh: sh, idx: idx, ancho: encabezado.length, filas: datos.slice(1) };
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

/** Agrega una fila al final y la recuerda para la siguiente. */
function agregarFila_(t, valores) {
  var fila = t.filas.length + 2;
  escribir_(t, fila, valores, null);
  t.filas.push([]);
  return fila;
}

function borrarFilas_(sh, items) {
  items.map(function (x) { return x.fila; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (f) { sh.deleteRow(f); });
}

function cargar_() {
  return { dias: leerDias_(), pedidos: leerPedidos_() };
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
      qty: cantidad_(r[t.idx.cantidad]),
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

/**
 * Respuesta para la página: el día pedido (aunque sea pasado) y, para cambiar
 * de día sin esperar, los próximos días de venta con sus pedidos.
 */
function estado_(db, fecha, desde) {
  var res = { version: VERSION, fecha: fecha || '', day: null, orders: [], days: {}, upcoming: {}, names: [], places: [] };
  var grupos = {};
  var grupo = function (f) { return grupos[f] || (grupos[f] = { day: null, orders: [] }); };
  var interesa = function (f) { return f === fecha || (desde && f >= desde); };

  db.dias.lista.forEach(function (d) {
    if (interesa(d.fecha)) grupo(d.fecha).day = diaPublico_(d);
    if (!desde || d.fecha >= desde) res.days[d.fecha] = { producto: d.producto, count: 0 };
  });
  var nombres = {};
  var partes = {};
  var limite = desde ? sumarDias_(desde, -90) : '';
  db.pedidos.lista.forEach(function (p) {
    if (interesa(p.date)) grupo(p.date).orders.push(publico_(p));
    if (!desde || p.date >= desde) {
      if (!res.days[p.date]) res.days[p.date] = { producto: '', count: 0 };
      res.days[p.date].count++;
    }
    if (p.date >= limite) {
      if (p.name) nombres[p.name] = (nombres[p.name] || 0) + 1;
      if (p.place) partes[p.place] = (partes[p.place] || 0) + 1;
    }
  });
  Object.keys(grupos).forEach(function (f) {
    grupos[f].orders.sort(function (a, b) { return a.createdAt - b.createdAt; });
  });
  if (grupos[fecha]) {
    res.day = grupos[fecha].day;
    res.orders = grupos[fecha].orders;
  }
  if (desde) {
    Object.keys(grupos)
      .filter(function (f) { return f >= desde && f !== fecha; })
      .sort()
      .slice(0, PROXIMOS)
      .forEach(function (f) { res.upcoming[f] = grupos[f]; });
  }
  res.names = masUsados_(nombres, 80);
  res.places = masUsados_(partes, 40);
  return res;
}

function guardarDia_(db, d) {
  var fecha = fecha_(d.fecha);
  var producto = limpiar_(d.producto, 40);
  if (!producto) throw new Error('Escribe qué se vende');
  var ops = opciones_(Array.isArray(d.opciones) ? d.opciones.join(',') : d.opciones);
  if (!ops.length) ops = [producto];
  var hora = hora_(d.hora);
  var observacion = limpiar_(d.observacion, 140);
  var t = db.dias.t;
  var actual = buscarDia_(db.dias.lista, fecha);
  var valores = { fecha: fecha, producto: producto, opciones: ops.join(', '), hora: hora, observacion: observacion, creado: actual ? actual.creado : Date.now() };
  if (actual) {
    escribir_(t, actual.fila, valores, actual.base);
  } else {
    actual = { fila: agregarFila_(t, valores), base: null, fecha: fecha, creado: valores.creado };
    db.dias.lista.push(actual);
  }
  actual.producto = producto;
  actual.opciones = ops;
  actual.hora = hora;
  actual.observacion = observacion;
}

function borrarDia_(db, fecha) {
  fecha = fecha_(fecha);
  borrarFilas_(db.pedidos.t.sh, db.pedidos.lista.filter(function (p) { return p.date === fecha; }));
  borrarFilas_(db.dias.t.sh, db.dias.lista.filter(function (d) { return d.fecha === fecha; }));
  db.pedidos.lista = db.pedidos.lista.filter(function (p) { return p.date !== fecha; });
  db.dias.lista = db.dias.lista.filter(function (d) { return d.fecha !== fecha; });
}

function agregar_(db, o) {
  var fecha = fecha_(o.date);
  var dia = buscarDia_(db.dias.lista, fecha);
  if (!dia) throw new Error('Primero crea el día de venta');
  var id = /^[A-Za-z0-9-]{8,40}$/.test(String(o.id || '')) ? String(o.id) : Utilities.getUuid();
  if (buscar_(db.pedidos.lista, id)) return; // ya estaba guardado (reintento)
  var nombre = limpiar_(o.name, 40);
  if (!nombre) throw new Error('Falta el nombre');
  var p = {
    id: id, date: fecha, name: nombre, option: opcionValida_(dia, o.option), qty: cantidad_(o.qty),
    place: limpiar_(o.place, 40), time: hora_(o.time), note: limpiar_(o.note, 80),
    paid: false, delivered: false, createdAt: Date.now(), base: null
  };
  p.fila = agregarFila_(db.pedidos.t, filaPedido_(p));
  db.pedidos.lista.push(p);
}

function actualizar_(db, id, c) {
  var p = buscar_(db.pedidos.lista, id);
  if (!p) throw new Error('Ese pedido ya no existe');
  var n = {
    name: p.name, option: p.option, qty: p.qty, place: p.place, time: p.time, note: p.note,
    paid: p.paid, delivered: p.delivered
  };
  if ('paid' in c) n.paid = c.paid === true;
  if ('delivered' in c) n.delivered = c.delivered === true;
  if ('name' in c) { var nombre = limpiar_(c.name, 40); if (nombre) n.name = nombre; }
  if ('option' in c) {
    var dia = buscarDia_(db.dias.lista, p.date);
    n.option = dia ? opcionValida_(dia, c.option) : limpiar_(c.option, 30);
  }
  if ('qty' in c) n.qty = cantidad_(c.qty);
  if ('place' in c) n.place = limpiar_(c.place, 40);
  if ('time' in c) n.time = hora_(c.time);
  if ('note' in c) n.note = limpiar_(c.note, 80);
  Object.keys(n).forEach(function (k) { p[k] = n[k]; });
  escribir_(db.pedidos.t, p.fila, filaPedido_(p), p.base);
}

function borrar_(db, id) {
  var p = buscar_(db.pedidos.lista, id);
  if (!p) return;
  db.pedidos.t.sh.deleteRow(p.fila);
  db.pedidos.lista = db.pedidos.lista.filter(function (x) { return x !== p; });
}

// ---------- Utilidades ----------

function filaPedido_(p) {
  return {
    id: p.id, fecha: p.date, nombre: p.name, opcion: p.option, cantidad: p.qty, parte: p.place, hora: p.time, nota: p.note,
    pagado: p.paid ? 'Sí' : 'No', entregado: p.delivered ? 'Sí' : 'No', creado: p.createdAt
  };
}

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

function diaPublico_(d) {
  return { fecha: d.fecha, producto: d.producto, opciones: d.opciones, hora: d.hora, observacion: d.observacion };
}

function publico_(p) {
  return {
    id: p.id, date: p.date, name: p.name, option: p.option, qty: p.qty, place: p.place, time: p.time, note: p.note,
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

/** Cantidad entera entre 1 y 99; vacío o inválido cuenta como 1. */
function cantidad_(v) {
  var n = Math.floor(Number(v));
  if (!isFinite(n) || n < 1) return 1;
  return Math.min(n, 99);
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
