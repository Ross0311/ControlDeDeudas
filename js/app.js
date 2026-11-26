import { db, uid, modoDemo } from './db.js';
import { VAPID_PUBLIC_KEY } from './config.js';
import * as L from './logic.js';
import { CATEGORIAS_INICIALES, sugerirClave, normalizar } from './categorias.js';

// ===================== Estado =====================
const S = {
  sesion: null,
  tarjetas: [], personas: [], compras: [], cuotas: [], estados: [], categorias: [], fijos: [], ajustes: {},
  validaciones: [], ingresos: [], cobros: [],
  cargos: [],                 // cuotas reales + cargos de gastos fijos (calculado)
  tab: 'resumen',
  mes: null,
  vistaGastos: 'compras',     // compras | fijos
  vistaQuien: 'persona',      // persona | tarjeta
  abiertos: new Set(),        // personas/tarjetas expandidas en el resumen
  seleccionFijos: new Set(),
  filtro: { q: '', persona: '', tarjeta: '', categoria: '', mesPago: '', mesCompra: '', banco: '' },
};

// ===================== Utilidades =====================
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
const soles = (n) => 'S/ ' + fmt.format(Number(n) || 0);
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const suma = (arr, f = (x) => x.monto) => r2(arr.reduce((a, x) => a + Number(f(x) || 0), 0));
const iniciales = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const nombrePila = (n) => capital((n || '').split(/\s+/)[0].toLowerCase());
const nombreCorto = (n) => { const p = (n || '').split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); };
const pct = (a, b) => (b ? Math.round((a - b) / b * 100) : null);
const pref = { get: (k) => { try { return localStorage.getItem('md-' + k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem('md-' + k, v); } catch {} } };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); }
  catch { const ta = document.createElement('textarea'); ta.value = texto; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Mensaje copiado ✓');
}

const I = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  home: I('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 2.6),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  more: I('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
  left: I('<path d="M15 5l-7 7 7 7"/>', 2.4),
  right: I('<path d="M9 5l7 7-7 7"/>', 2.4),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>', 2.4),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 2.2),
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="color:var(--ink-3);flex:none"><path d="M9 5l7 7-7 7"/></svg>',
  copy: I('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
  bell: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  repeat: I('<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>'),
};
const COLORES = ['#1f9d6b', '#e8590c', '#7c5cd6', '#1c7ed6', '#d6336c', '#f59f00', '#495057', '#0ca678', '#15aabf', '#a0522d'];
const COL_TUYO = 'var(--c-tuyo)', COL_OTROS = 'var(--c-otros)';

// ===================== Datos por defecto =====================
const TARJETAS_INICIALES = [
  { nombre: 'SAGA FALABELLA (JHONATAN)', banco: 'SAGA FALABELLA', dia_cierre: 15, dia_pago: 8, meses_pago: 1, color: '#1f9d6b', orden: 1 },
  { nombre: 'SAGA FALABELLA (JOHANNA)', banco: 'SAGA FALABELLA', dia_cierre: 15, dia_pago: 8, meses_pago: 1, color: '#7c5cd6', orden: 2 },
  { nombre: 'BCP (JOHANNA)', banco: 'BCP', dia_cierre: 10, dia_pago: 5, meses_pago: 1, color: '#e8590c', orden: 3 },
];
const PERSONAS_INICIALES = ['JHONATAN MORZAN', 'ANGIE MORZAN', 'LUIS MORZAN', 'SILVIA PASCO', 'ELSA BARRIOS', 'CECILIA PASCO', 'JOHANNA IBAÑEZ'];
const DIAS_AVISO_DEF = [14, 7, 1];

// ===================== Arranque =====================
async function iniciar() {
  registrarSW();
  try { S.sesion = await db.sesion(); }
  catch (e) { return pantallaError('No se pudo conectar. Revisa tu internet y vuelve a abrir la app.<br><span class="tiny">' + esc(e.message) + '</span>'); }
  if (!S.sesion) return pantallaLogin();
  await cargarTodo(true);
}

async function cargarTodo(primeraVez = false) {
  try {
    const nombres = ['tarjetas', 'personas', 'compras', 'cuotas', 'estados_cuenta', 'categorias', 'fijos', 'ajustes', 'validaciones', 'ingresos', 'cobros'];
    const [t, p, c, q, e, cat, f, aj, val, ing, cob] = await Promise.all(nombres.map(x => db.todo(x)));
    Object.assign(S, { tarjetas: t, personas: p, compras: c, cuotas: q, estados: e, categorias: cat, fijos: f, ajustes: aj[0]?.datos || {}, validaciones: val, ingresos: ing, cobros: cob });
    if (primeraVez && !t.length && !p.length) await sembrar();
    if (!S.categorias.length) await sembrarCategorias();
    if (!S.mes) S.mes = mesPorDefecto();
    render();
  } catch (err) {
    const m = String(err.message || err);
    if (/validaciones|ingresos|cobros|tope|linea/i.test(m))
      pantallaError('Falta actualizar la base de datos.<br>Ejecuta el archivo <b>PASO_1</b> de la carpeta de Supabase en el SQL Editor y vuelve a intentar.<br><span class="tiny">' + esc(m) + '</span>');
    else if (/categorias|fijos|ajustes|schema cache|does not exist/i.test(m))
      pantallaError('Falta actualizar la base de datos.<br>Ejecuta el archivo de actualización en el SQL Editor de Supabase y vuelve a intentar.<br><span class="tiny">' + esc(m) + '</span>');
    else pantallaError('Error cargando datos: ' + esc(m));
  }
}

async function sembrar() {
  const t = TARJETAS_INICIALES.map(x => ({ id: uid(), activa: true, ...x }));
  const p = PERSONAS_INICIALES.map((n, i) => ({ id: uid(), nombre: n, activa: true, orden: i }));
  await db.insertar('tarjetas', t); await db.insertar('personas', p);
  S.tarjetas = t; S.personas = p;
}

async function sembrarCategorias() {
  const cats = CATEGORIAS_INICIALES.map((c, i) => ({ id: uid(), ...c, orden: i }));
  await db.insertar('categorias', cats);
  S.categorias = cats;
  await autoCategorizar(true);
}

/** Asigna categoría a los gastos que no tienen, según la descripción. */
async function autoCategorizar(silencioso = false) {
  const porClave = Object.fromEntries(S.categorias.filter(c => c.clave).map(c => [c.clave, c.id]));
  const grupos = {};
  for (const c of S.compras) {
    if (c.categoria_id) continue;
    const id = porClave[sugerirClave(c.descripcion)];
    if (id) (grupos[id] ??= []).push(c.id);
  }
  let n = 0;
  for (const [catId, ids] of Object.entries(grupos)) {
    await db.actualizarVarios('compras', ids, { categoria_id: catId });
    S.compras.forEach(c => { if (ids.includes(c.id)) c.categoria_id = catId; });
    n += ids.length;
  }
  const faltan = S.compras.filter(c => !c.categoria_id).length;
  if (!silencioso) toast(`${n} gastos categorizados · ${faltan} sin categoría`);
  return { n, faltan };
}

function mesPorDefecto() {
  const hoy = L.hoyISO();
  const futuras = calcularCargos().map(c => c.fecha_pago).filter(f => f >= hoy).sort();
  return futuras.length ? L.periodo(futuras[0]) : L.periodo(hoy);
}

function registrarSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ===================== Pantallas sin sesión =====================
function pantallaError(html) {
  $('#app').innerHTML = `<div class="login"><div class="logo-mark">S/</div><p>${html}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
}

function pantallaLogin() {
  $('#app').innerHTML = `
  <form class="login" id="f-login" autocomplete="on">
    <div class="logo-mark">S/</div>
    <div><h1>Mis Deudas</h1><p>Ingresa una sola vez; la sesión queda guardada en este equipo.</p></div>
    ${modoDemo ? '<p class="demo-banner" style="border-radius:12px">Modo demo: aún no configuraste Supabase. Entra con cualquier correo para probar.</p>' : ''}
    <div class="field"><label for="em">Correo</label><input class="input" id="em" type="email" autocomplete="username" required inputmode="email" value="${esc(pref.get('email') || '')}"></div>
    <div class="field"><label for="pw">Contraseña</label><input class="input" id="pw" type="password" autocomplete="current-password" ${modoDemo ? '' : 'required'}></div>
    <div class="err" id="lerr"></div>
    <button class="btn" type="submit" id="lbtn">Entrar</button>
  </form>`;
  $('#f-login').onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $('#lbtn'); btn.disabled = true; btn.textContent = 'Entrando…'; $('#lerr').textContent = '';
    try {
      const email = $('#em').value.trim();
      S.sesion = await db.entrar(email, $('#pw').value);
      pref.set('email', email);
      $('#app').innerHTML = '<div class="splash"><div class="logo-mark">S/</div><p>Cargando tus datos…</p></div>';
      await cargarTodo(true);
    } catch (e) { $('#lerr').textContent = e.message; btn.disabled = false; btn.textContent = 'Entrar'; }
  };
}

// ===================== Datos derivados =====================
const SIN_CAT = { id: '', nombre: 'Sin categoría', emoji: '❔', color: '#adb5bd' };
const tarjetaDe = (id) => S.tarjetas.find(t => t.id === id) || { nombre: '¿?', banco: '¿?', color: '#999' };
const personaDe = (id) => S.personas.find(p => p.id === id) || { nombre: '¿?' };
const categoriaDe = (id) => S.categorias.find(c => c.id === id) || SIN_CAT;
const compraDe = (id) => S.compras.find(c => c.id === id);
const ordenar = (arr) => [...arr].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
const estadoDe = (banco, per) => S.estados.find(e => e.banco === banco && e.periodo === per);
const diasAviso = () => (Array.isArray(S.ajustes.dias_aviso) && S.ajustes.dias_aviso.length ? S.ajustes.dias_aviso : DIAS_AVISO_DEF).map(Number).sort((a, b) => b - a);
const principalId = () => S.ajustes.principal_id && S.personas.some(p => p.id === S.ajustes.principal_id)
  ? S.ajustes.principal_id : (S.personas.find(p => /JHONATAN/i.test(p.nombre)) || ordenar(S.personas)[0])?.id;
const ingreso = () => Number(S.ajustes.ingreso) || 0;
/** Días de pago de las tarjetas activas (ej. [5, 8]). */
const diasDePago = () => { const d = [...new Set(S.tarjetas.filter(t => t.activa !== false).map(t => Number(t.dia_pago)))].sort((a, b) => a - b); return d.length ? d : [1]; };
/** Mes de pago que un ingreso alcanza a cubrir: solo sirve si llega ANTES del primer pago del mes. */
function mesQueCubre(fecha) {
  const { d } = L.partes(fecha); const per = L.periodo(fecha);
  return d < diasDePago()[0] ? per : L.sumarPeriodo(per, 1);
}
/** Fechas de pago de un mes, ej. "05/12 y 08/12". */
const fechasPagoTexto = (per) => diasDePago().map(d => L.fechaCorta(L.armar(+per.slice(0, 4), +per.slice(5, 7), d)).slice(0, 5)).join(' y ');
const extrasMes = (per) => S.ingresos.filter(i => mesQueCubre(i.fecha) === per);
const ingresoMes = (per) => r2(ingreso() + suma(extrasMes(per)));
const TIPOS_INGRESO = [['extra', '🛠️', 'Trabajo extra'], ['grati', '🎄', 'Gratificación'], ['cts', '🏦', 'CTS'], ['bono', '🎯', 'Bono'], ['otro', '💵', 'Otro']];
const tipoIngreso = (k) => TIPOS_INGRESO.find(t => t[0] === k) || TIPOS_INGRESO[4];
const validado = (clave) => S.validaciones.some(v => v.clave === clave);
const cobroDe = (personaId, per) => S.cobros.find(c => c.persona_id === personaId && c.periodo === per);

/** Cuánto debe cada persona (que no eres tú) en un mes y cuánto ya pagó. */
function deudasPersonas(per, items = cargosDelMes(per)) {
  const pid = principalId(); const out = {};
  for (const c of items) { if (c.persona.id === pid) continue; (out[c.persona.id] ??= { p: c.persona, debe: 0 }).debe += c.monto; }
  return Object.values(out).map(x => { const cb = cobroDe(x.p.id, per); const pagado = Number(cb?.monto || 0); return { ...x, debe: r2(x.debe), pagado, falta: r2(Math.max(0, x.debe - pagado)), cobro: cb }; });
}

/** Estado del mes: validado, pagado al banco y cobrado a las personas. */
function estadoMes(per) {
  const items = cargosDelMes(per);
  const bancos = [...new Set(items.map(c => c.tarjeta.banco))];
  const nVal = items.filter(c => validado(c.id)).length;
  const bPag = bancos.filter(b => estadoDe(b, per)?.pagado).length;
  const deudas = deudasPersonas(per, items);
  const cobrados = deudas.filter(d => d.falta < 0.01).length;
  const cerrado = items.length > 0 && nVal === items.length && bPag === bancos.length && cobrados === deudas.length;
  return { items, nVal, nItems: items.length, bPag, nBancos: bancos.length, cobrados, nDeudas: deudas.length, faltaCobrar: suma(deudas, d => d.falta), cerrado };
}

/** Línea usada de una tarjeta: cargos ya hechos que aún no se pagan al banco. */
function lineaUsada(t) {
  const hoy = L.hoyISO();
  return suma(S.cargos.filter(c => c.tarjeta.id === t.id && c.fecha_cargo <= hoy && c.fecha_pago >= hoy && !estadoDe(t.banco, L.periodo(c.fecha_pago))?.pagado));
}

/** Gasto propio por categoría en un mes, comparado con su tope. */
function topesMes(per) {
  const pid = principalId(); const items = cargosDelMes(per).filter(c => c.persona.id === pid);
  return ordenar(S.categorias).filter(c => Number(c.tope) > 0).map(c => {
    const usado = suma(items.filter(x => x.categoria.id === c.id)); const tope = Number(c.tope);
    return { c, usado, tope, pct: Math.round(usado / tope * 100) };
  }).sort((a, b) => b.pct - a.pct);
}

/** Une cuotas reales y cargos generados por gastos fijos en una sola lista. */
function calcularCargos() {
  const out = [];
  for (const q of S.cuotas) {
    const c = compraDe(q.compra_id); if (!c) continue;
    out.push({ id: q.id, tipo: 'cuota', ref: c.id, monto: Number(q.monto), fecha_pago: q.fecha_pago, fecha_cargo: c.fecha_compra,
      numero: q.numero, total: q.total, descripcion: c.descripcion, tarjeta: tarjetaDe(c.tarjeta_id), persona: personaDe(c.persona_id), categoria: categoriaDe(c.categoria_id) });
  }
  const limite = L.sumarPeriodo(L.periodo(L.hoyISO()), 18);
  for (const f of S.fijos) {
    const t = S.tarjetas.find(x => x.id === f.tarjeta_id);
    for (const g of L.cargosFijo(f, t, limite)) {
      out.push({ id: 'f-' + f.id + '-' + g.fecha_cargo, tipo: 'fijo', ref: f.id, monto: Number(f.monto), fecha_pago: g.fecha_pago, fecha_cargo: g.fecha_cargo,
        numero: 1, total: 1, descripcion: f.descripcion, tarjeta: tarjetaDe(f.tarjeta_id), persona: personaDe(f.persona_id), categoria: categoriaDe(f.categoria_id) });
    }
  }
  return out;
}
const cargosDelMes = (per) => S.cargos.filter(c => L.periodo(c.fecha_pago) === per);

/** Próximos pagos por banco (desde hoy), con días que faltan. */
function proximosPagos(maxDias = 45) {
  const hoy = L.hoyISO(); const grupos = {};
  for (const c of S.cargos) {
    if (c.fecha_pago < hoy) continue;
    const dias = L.diasEntre(hoy, c.fecha_pago); if (dias > maxDias) continue;
    const k = c.tarjeta.banco + '|' + c.fecha_pago;
    grupos[k] ??= { banco: c.tarjeta.banco, fecha: c.fecha_pago, dias, monto: 0, color: c.tarjeta.color, items: [] };
    grupos[k].monto += c.monto; grupos[k].items.push(c);
  }
  return Object.values(grupos).filter(g => !estadoDe(g.banco, L.periodo(g.fecha))?.pagado).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function deudaPendiente() {
  const mesHoy = L.periodo(L.hoyISO());
  return suma(S.cargos.filter(c => { const per = L.periodo(c.fecha_pago); return per >= mesHoy && !estadoDe(c.tarjeta.banco, per)?.pagado; }));
}

/** Resumen de un mes de pago: totales, tuyo vs otros, por categoría. */
function resumenMes(per) {
  const items = cargosDelMes(per); const pid = principalId();
  const tuyo = suma(items.filter(c => c.persona.id === pid));
  const fijos = suma(items.filter(c => c.tipo === 'fijo'));
  const porCat = {};
  for (const c of items) { const k = c.categoria.id || ''; porCat[k] = (porCat[k] || 0) + c.monto; }
  return { per, items, total: suma(items), tuyo, otros: r2(suma(items) - tuyo), fijos, porCat };
}

// ===================== Render principal =====================
function render() {
  S.cargos = calcularCargos();
  const tabs = [['resumen', 'Resumen', ICON.home], ['gastos', 'Gastos', ICON.list], ['analisis', 'Análisis', ICON.chart], ['mas', 'Más', ICON.more]];
  const nav = (t) => `<button class="navbtn ${S.tab === t[0] ? 'on' : ''}" data-act="tab" data-v="${t[0]}">${t[2]}<span>${t[1]}</span></button>`;
  const titulos = { resumen: 'Resumen', gastos: 'Gastos', analisis: 'Análisis', mas: 'Más opciones' };
  $('#app').innerHTML = `
  ${modoDemo ? '<div class="demo-banner">Modo demo · los datos solo se guardan en este navegador</div>' : ''}
  <div class="shell">
    <nav class="bottomnav">
      <div class="brand-side"><div class="logo-mark">S/</div>Mis Deudas</div>
      ${nav(tabs[0])}${nav(tabs[1])}
      <button class="fab" data-act="nueva" aria-label="Nuevo gasto">${ICON.plus}</button>
      ${nav(tabs[2])}${nav(tabs[3])}
    </nav>
    <div>
      <header class="topbar"><h1>${titulos[S.tab]}</h1></header>
      <main class="main" id="main">${vista()}</main>
    </div>
  </div>`;
  postRender();
}

function vista() {
  switch (S.tab) {
    case 'gastos': return vistaGastos();
    case 'analisis': return vistaAnalisis();
    case 'mas': return vistaMas();
    default: return vistaResumen();
  }
}

function postRender() {
  const q = $('#q');
  if (q) q.oninput = () => { S.filtro.q = q.value; $('#lista-mov').innerHTML = listaCompras(); };
  for (const [id, k] of [['fp', 'persona'], ['ft', 'tarjeta'], ['fc', 'categoria'], ['fmp', 'mesPago'], ['fmc', 'mesCompra'], ['fb', 'banco']]) {
    const el = $('#' + id); if (el) el.onchange = () => { S.filtro[k] = el.value; const y = window.scrollY; render(); window.scrollTo(0, y); };
  }
  document.querySelectorAll('[data-banco-input]').forEach(inp => {
    inp.onchange = () => guardarEstado(inp.dataset.bancoInput, { monto_banco: inp.value === '' ? null : r2(inp.value) });
  });
  const ing = $('#aj-ingreso'); if (ing) ing.onchange = () => guardarAjustes({ ingreso: r2(ing.value) || 0 });
  const pp = $('#aj-principal'); if (pp) pp.onchange = () => guardarAjustes({ principal_id: pp.value });
  montarTooltips();
}

const navMes = (sub = 'Mes de pago') => `
  <div class="monthnav">
    <button data-act="mes" data-v="-1" aria-label="Mes anterior">${ICON.left}</button>
    <div class="m">${capital(L.nombreMes(S.mes))}<span class="tiny">${sub}</span></div>
    <button data-act="mes" data-v="1" aria-label="Mes siguiente">${ICON.right}</button>
  </div>`;

// ===================== Vista: Resumen =====================
function vistaAvisos() {
  const proximos = proximosPagos(Math.max(...diasAviso(), 7));
  if (!proximos.length) return '';
  return `<div class="card avisos">
    <h3>${ICON.bell}<span style="flex:1">Próximos pagos</span></h3>
    ${proximos.map(g => {
      const nivel = g.dias <= 3 ? 'bad' : g.dias <= 7 ? 'warn' : 'info';
      const cuando = g.dias === 0 ? 'Hoy' : g.dias === 1 ? 'Mañana' : `En ${g.dias} días`;
      return `<button class="aviso ${nivel}" data-act="irmes" data-v="${L.periodo(g.fecha)}">
        <span class="dot" style="background:${g.color}"></span>
        <span class="grow"><b>${esc(g.banco)}</b> · ${L.diaSemana(g.fecha)} ${L.fechaCorta(g.fecha).slice(0, 5)}<br><span class="tiny">${cuando}</span></span>
        <b class="num">${soles(g.monto)}</b></button>`;
    }).join('')}
  </div>`;
}

function vistaResumen() {
  const per = S.mes; const R = resumenMes(per); const items = R.items;
  if (!items.length) {
    return vistaAvisos() + navMes() + `<div class="card empty"><div class="ico">🎉</div><b>Nada que pagar en ${L.nombreMes(per)}</b><p class="tiny">Deuda total pendiente: ${soles(deudaPendiente())}</p></div>`;
  }
  const hoy = L.hoyISO();
  const bancos = {};
  for (const c of items) {
    const b = c.tarjeta.banco;
    bancos[b] ??= { banco: b, monto: 0, fecha: c.fecha_pago, color: c.tarjeta.color };
    bancos[b].monto += c.monto; if (c.fecha_pago < bancos[b].fecha) bancos[b].fecha = c.fecha_pago;
  }
  const listaBancos = Object.values(bancos).sort((a, b) => b.monto - a.monto);

  const hero = `
  <div class="card hero">
    <div class="label">Total a pagar en ${L.nombreMes(per)}</div>
    <div class="big num"><small>S/</small>${fmt.format(R.total)}</div>
    <div class="chips">
      ${listaBancos.map(b => `<span class="chip">${esc(b.banco)} <b class="num">${soles(b.monto)}</b> · ${L.fechaCorta(b.fecha).slice(0, 5)}</span>`).join('')}
    </div>
    <div class="hero-split">
      <div><span class="tiny-l">Tu parte</span><b class="num">${soles(R.tuyo)}</b></div>
      <div><span class="tiny-l">Falta cobrar</span><b class="num">${soles(suma(deudasPersonas(per, items), d => d.falta))}</b></div>
      <div><span class="tiny-l">Gastos fijos</span><b class="num">${soles(R.fijos)}</b></div>
    </div>
    <div class="label" style="margin-top:10px;position:relative;z-index:1">Deuda pendiente desde este mes: <b class="num">${soles(deudaPendiente())}</b></div>
  </div>`;

  const estado = `
  <div class="card">
    <h3 style="flex-direction:column;align-items:flex-start;gap:2px">Estado de cuenta <span class="tiny">Compara con lo que cobra el banco</span></h3>
    ${listaBancos.map(b => {
      const e = estadoDe(b.banco, per) || {};
      const nuestro = r2(b.monto);
      const dif = e.monto_banco != null ? r2(Number(e.monto_banco) - nuestro) : null;
      const vencido = b.fecha < hoy && !e.pagado;
      const badge = e.pagado ? '<span class="badge ok">✓ Pagado</span>' : vencido ? '<span class="badge bad">! Vencido</span>' : `<span class="badge warn">Vence ${L.fechaCorta(b.fecha).slice(0, 5)}</span>`;
      return `<div class="banco">
        <div class="head"><div><b><span class="dot" style="display:inline-block;background:${b.color};margin-right:6px"></span>${esc(b.banco)}</b><div style="margin-top:4px">${badge}</div></div>
          <button class="btn sm ghost" data-act="pagado" data-v="${esc(b.banco)}">${e.pagado ? 'Desmarcar' : 'Marcar pagado'}</button></div>
        ${(() => { const its = items.filter(c => c.tarjeta.banco === b.banco); const ok = its.filter(c => validado(c.id)).length;
          return `<div class="tiny" style="margin:-4px 0 8px">${ok === its.length ? '✓ Todos los cargos validados' : `Validados ${ok} de ${its.length} cargos`}</div>`; })()}
        <div class="kv">
          <div><div class="k">Nuestro</div><div class="v num">${fmt.format(nuestro)}</div></div>
          <div><div class="k">Banco cobra</div><input class="num" type="number" inputmode="decimal" step="0.01" placeholder="Escribir" data-banco-input="${esc(b.banco)}" value="${e.monto_banco ?? ''}"></div>
          <div><div class="k">Diferencia</div><div class="v num" style="color:${dif == null ? 'var(--ink-3)' : Math.abs(dif) < 0.01 ? 'var(--ok)' : 'var(--danger)'}">${dif == null ? '—' : fmt.format(dif)}</div></div>
        </div></div>`;
    }).join('')}
  </div>`;

  const detalle = vistaDetalle(items);
  const EM = estadoMes(per);
  const paso = (ok, txt, cnt, sub = '') => `<div class="paso ${ok ? 'ok' : ''}"><span>${ok ? '✓' : '○'}</span><div class="grow">${txt}${sub ? `<div class="tiny">${sub}</div>` : ''}</div><b class="num">${cnt}</b></div>`;
  const cierre = `<div class="card cierre ${EM.cerrado ? 'cerrado' : ''}">
    <h3>${EM.cerrado ? '✅ Mes cerrado' : '📋 Para cerrar el mes'}</h3>
    ${paso(EM.nVal === EM.nItems, 'Validar cargos con el estado de cuenta', `${EM.nVal}/${EM.nItems}`)}
    ${paso(EM.bPag === EM.nBancos, 'Pagar al banco', `${EM.bPag}/${EM.nBancos}`)}
    ${EM.nDeudas ? paso(EM.cobrados === EM.nDeudas, 'Cobrar a las personas', `${EM.cobrados}/${EM.nDeudas}`, EM.faltaCobrar > 0 ? `Falta cobrar ${soles(EM.faltaCobrar)}` : '') : ''}
  </div>`;

  const topes = topesMes(per);
  const cTopes = topes.length ? `<div class="card"><h3>🎯 Topes por categoría <span class="tiny">solo tu parte</span></h3>
    ${topes.map(x => `<div class="cbar"><div class="cl"><span>${x.c.emoji}</span><span class="grow">${esc(x.c.nombre)}</span><b class="num">${soles(x.usado)}</b><span class="tiny">/ ${soles(x.tope)}</span></div>
      <div class="ctrack"><i class="${x.pct >= 100 ? 'bad' : x.pct >= 80 ? 'warn' : ''}" style="width:${Math.min(100, x.pct)}%"></i></div>
      ${x.pct >= 100 ? `<div class="tiny txt-bad">! Te pasaste por ${soles(x.usado - x.tope)}</div>` : x.pct >= 80 ? `<div class="tiny txt-warn">Vas en ${x.pct}%, cuidado</div>` : ''}</div>`).join('')}</div>` : '';

  const conLinea = ordenar(S.tarjetas).filter(t => Number(t.linea) > 0 && t.activa);
  const cLinea = conLinea.length ? `<div class="card"><h3>💳 Línea disponible <span class="tiny">hoy</span></h3>
    ${conLinea.map(t => { const usada = lineaUsada(t); const disp = r2(Number(t.linea) - usada); const pctU = Math.min(100, Math.round(usada / Number(t.linea) * 100));
      return `<div class="cbar"><div class="cl"><span class="dot" style="background:${t.color}"></span><span class="grow">${esc(t.nombre)}</span><b class="num ${disp < 0 ? 'txt-bad' : ''}">${soles(disp)}</b></div>
        <div class="ctrack"><i class="${pctU >= 90 ? 'bad' : pctU >= 70 ? 'warn' : ''}" style="width:${pctU}%"></i></div>
        <div class="tiny">Usado ${soles(usada)} de ${soles(t.linea)} (${pctU}%)</div></div>`; }).join('')}</div>` : '';

  return vistaAvisos() + navMes(EM.cerrado ? '✅ Mes cerrado' : 'Mes de pago') + cierre + hero + `<div class="grid-2">${vistaQuien(items)}${estado}</div>` +
    (cTopes || cLinea ? `<div class="grid-2">${cTopes}${cLinea}</div>` : '') + detalle;
}

/** ¿Quién debe cuánto? — por persona (con desglose por tarjeta) o por tarjeta. */
function vistaQuien(items) {
  const pid = principalId();
  const seg = `<div class="seg" style="margin-bottom:10px">
    <button data-act="quien" data-v="persona" class="${S.vistaQuien === 'persona' ? 'on' : ''}">Por persona</button>
    <button data-act="quien" data-v="tarjeta" class="${S.vistaQuien === 'tarjeta' ? 'on' : ''}">Por tarjeta</button></div>`;

  if (S.vistaQuien === 'tarjeta') {
    const porT = {};
    for (const c of items) { (porT[c.tarjeta.id] ??= { t: c.tarjeta, items: [] }).items.push(c); }
    const lista = Object.values(porT).sort((a, b) => suma(b.items) - suma(a.items));
    return `<div class="card"><h3>¿Quién debe cuánto?</h3>${seg}
      ${lista.map(({ t, items: its }) => {
        const pers = {}; for (const c of its) pers[c.persona.nombre] = (pers[c.persona.nombre] || 0) + c.monto;
        const tot = suma(its);
        return `<div class="tblock"><div class="trow"><span class="dot" style="background:${t.color}"></span><b class="grow">${esc(t.nombre)}</b><b class="num">${soles(tot)}</b></div>
          ${Object.entries(pers).sort((a, b) => b[1] - a[1]).map(([n, m]) => `<div class="subrow"><span class="grow">${esc(n)}</span><span class="pctxt">${Math.round(m / tot * 100)}%</span><span class="num">${soles(m)}</span></div>`).join('')}</div>`;
      }).join('')}</div>`;
  }

  const porP = {};
  for (const c of items) { (porP[c.persona.id] ??= { p: c.persona, items: [] }).items.push(c); }
  const lista = Object.values(porP).sort((a, b) => (a.p.id === pid ? -1 : b.p.id === pid ? 1 : suma(b.items) - suma(a.items)));
  return `<div class="card"><h3>¿Quién debe cuánto?</h3>${seg}
    ${lista.map(({ p, items: its }) => {
      const tot = suma(its); const abierto = S.abiertos.has(p.id);
      const porT = {}; for (const c of its) { (porT[c.tarjeta.id] ??= { t: c.tarjeta, m: 0, f: c.fecha_pago }).m += c.monto; }
      const ts = Object.values(porT).sort((a, b) => b.m - a.m);
      const esYo = p.id === pid;
      return `<div class="pblock ${abierto ? 'open' : ''}">
        <button class="prow" data-act="abrir" data-v="${p.id}">
          <span class="avatar">${esc(iniciales(p.nombre))}</span>
          <span class="grow"><b>${esc(p.nombre)}</b>${esYo ? ' <span class="badge">Tú</span>' : (() => { const cb = cobroDe(p.id, S.mes); const pg = Number(cb?.monto || 0);
              return pg >= tot - 0.009 ? ' <span class="badge ok">✓ Pagó</span>' : pg > 0 ? ` <span class="badge warn">Pagó ${soles(pg)}</span>` : ' <span class="badge">Pendiente</span>'; })()}
            <span class="stack">${ts.map(x => `<i style="flex:${x.m};background:${x.t.color}"></i>`).join('')}</span></span>
          <b class="num">${soles(tot)}</b>${ICON.chev}
        </button>
        <div class="pchips">${ts.map(x => `<span class="pchip"><span class="dot" style="background:${x.t.color}"></span>${esc(x.t.nombre)} <b class="num">${soles(x.m)}</b></span>`).join('')}</div>
        ${abierto ? `<div class="pdet">
          ${its.sort((a, b) => a.fecha_cargo.localeCompare(b.fecha_cargo)).map(c => `<div class="subrow"><span>${c.categoria.emoji}</span><span class="grow">${esc(c.descripcion || 'Sin descripción')}${c.total > 1 ? ` · ${c.numero}/${c.total}` : ''}${c.tipo === 'fijo' ? ' · fijo' : ''}</span><span class="num">${soles(c.monto)}</span></div>`).join('')}
          ${esYo ? '' : `<button class="btn sm ${cobroDe(p.id, S.mes) ? 'ghost' : ''}" style="width:100%;margin-top:10px" data-act="cobro" data-v="${p.id}" data-total="${tot}">${cobroDe(p.id, S.mes) ? '💰 Editar lo que me pagó' : '💰 Ya me pagó'}</button>
          <div class="btnrow" style="margin-top:8px">
            <button class="btn sm ghost grow" data-act="copiarmsg" data-v="${p.id}">${ICON.copy} Copiar mensaje</button>
            <a class="btn sm wa grow" href="${linkWhatsApp(p, mensajePersona(p, its))}" target="_blank" rel="noopener">${ICON.wa} WhatsApp</a></div>`}
        </div>` : ''}
      </div>`;
    }).join('')}
    <p class="tiny" style="margin:10px 0 0">Toca a una persona para ver el detalle y mandarle su mensaje.</p>
  </div>`;
}

function vistaDetalle(items) {
  const porTarj = {};
  for (const c of items) (porTarj[c.tarjeta.id] ??= []).push(c);
  const tarjs = ordenar(S.tarjetas).filter(t => porTarj[t.id]);
  const nVal = items.filter(c => validado(c.id)).length;
  return `<div class="group-h" style="margin-top:6px"><span>Detalle del mes</span><span>${nVal}/${items.length} validados</span></div>
  <p class="tiny" style="margin:-2px 4px 8px">Marca el ✓ de cada cargo cuando lo encuentres en tu estado de cuenta.</p>` + tarjs.map(t => {
    const lista = porTarj[t.id].sort((a, b) => a.fecha_cargo.localeCompare(b.fecha_cargo));
    const ok = lista.filter(c => validado(c.id)).length; const todo = ok === lista.length;
    return `<div class="group-h"><span>${esc(t.nombre)}</span><span class="num">${soles(suma(lista))}</span></div>
    <div class="card" style="padding-top:6px;padding-bottom:6px">
      <div class="valbar"><div class="vprog"><i style="width:${(ok / lista.length * 100).toFixed(0)}%"></i></div>
        <span class="tiny ${todo ? 'txt-ok' : ''}">${todo ? '✓ Todo validado' : `${ok} de ${lista.length} validados`}</span>
        ${todo ? '' : `<button class="btn sm ghost" data-act="validartodos" data-v="${t.id}">Validar todos</button>`}</div>
      ${lista.map(c => { const v = validado(c.id); return `
      <div class="row ${v ? 'val' : ''}">
        <button class="vcheck ${v ? 'on' : ''}" data-act="validar" data-v="${c.id}" aria-label="${v ? 'Quitar validación' : 'Marcar como validado'}"></button>
        <span class="emo" title="${esc(c.categoria.nombre)}">${c.categoria.emoji}</span>
        <div class="grow tap" data-act="${c.tipo === 'fijo' ? 'fijo' : 'editar'}" data-v="${c.ref}"><div class="t1">${esc(c.descripcion || 'Sin descripción')}</div>
          <div class="t2">${esc(nombreCorto(c.persona.nombre))} · ${L.fechaCorta(c.fecha_cargo).slice(0, 5)}${c.total > 1 ? ` · cuota ${c.numero}/${c.total}` : ''}${c.tipo === 'fijo' ? ' · 🔁 fijo' : ''}</div></div>
        <div class="amt num tap" data-act="${c.tipo === 'fijo' ? 'fijo' : 'editar'}" data-v="${c.ref}">${soles(c.monto)}</div>
      </div>`; }).join('')}
    </div>`;
  }).join('');
}

async function alternarValidado(clave) {
  const v = S.validaciones.find(x => x.clave === clave);
  try {
    if (v) { await db.borrar('validaciones', v.id); S.validaciones = S.validaciones.filter(x => x !== v); }
    else { const n = { id: uid(), clave }; await db.insertar('validaciones', n); S.validaciones.push(n); }
    const y = window.scrollY; render(); window.scrollTo(0, y);
  } catch (e) { toast('Error: ' + e.message); }
}
async function validarTodos(tarjetaId) {
  const nuevos = cargosDelMes(S.mes).filter(c => c.tarjeta.id === tarjetaId && !validado(c.id)).map(c => ({ id: uid(), clave: c.id }));
  if (!nuevos.length) return;
  try { await db.insertar('validaciones', nuevos); S.validaciones.push(...nuevos); const y = window.scrollY; render(); window.scrollTo(0, y); toast(`${nuevos.length} cargos validados ✓`); }
  catch (e) { toast('Error: ' + e.message); }
}

// ----- Mensajes para WhatsApp -----
function mensajePersona(p, items) {
  const porT = {};
  for (const c of items) (porT[c.tarjeta.id] ??= { t: c.tarjeta, items: [], f: c.fecha_pago }).items.push(c);
  const bloques = Object.values(porT);
  const fechaLim = items.map(c => c.fecha_pago).sort()[0];
  let txt = `Hola ${nombrePila(p.nombre)} 👋\nTe paso el detalle de la tarjeta de ${L.nombreMes(S.mes)}:\n`;
  for (const b of bloques) {
    b.items.sort((x, y) => x.fecha_cargo.localeCompare(y.fecha_cargo));
    const fp = b.items[0].fecha_pago;
    txt += `\n💳 ${b.t.nombre} (vence ${L.diaSemana(fp)} ${L.fechaCorta(fp).slice(0, 5)})\n`;
    for (const c of b.items) txt += `• ${L.fechaCorta(c.fecha_cargo).slice(0, 5)} ${c.descripcion || 'Consumo'}${c.total > 1 ? ` (cuota ${c.numero}/${c.total})` : ''} — ${soles(c.monto)}\n`;
    if (bloques.length > 1) txt += `Subtotal: ${soles(suma(b.items))}\n`;
  }
  txt += `\n💰 *Total a pagar: ${soles(suma(items))}*\n📅 Fecha límite: ${L.diaSemana(fechaLim)} ${L.fechaCorta(fechaLim)}\n¡Gracias! 🙌`;
  return txt;
}
function linkWhatsApp(p, texto) {
  let num = String(p.telefono || '').replace(/\D/g, '');
  if (num.length === 9) num = '51' + num;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

// ===================== Vista: Gastos =====================
function vistaGastos() {
  const seg = `<div class="seg" style="margin-bottom:12px">
    <button data-act="vgastos" data-v="compras" class="${S.vistaGastos === 'compras' ? 'on' : ''}">Compras</button>
    <button data-act="vgastos" data-v="fijos" class="${S.vistaGastos === 'fijos' ? 'on' : ''}">🔁 Gastos fijos (${S.fijos.filter(f => !f.hasta || f.hasta > L.hoyISO()).length})</button></div>`;
  if (S.vistaGastos === 'fijos') return seg + vistaFijos();
  const F = S.filtro;
  const pers = ordenar(S.personas), tarjs = ordenar(S.tarjetas), cats = ordenar(S.categorias);
  const sinCat = S.compras.filter(c => !c.categoria_id).length;
  const mesesPago = [...new Set(S.cuotas.map(q => L.periodo(q.fecha_pago)))].sort().reverse();
  const mesesCompra = [...new Set(S.compras.map(c => L.periodo(c.fecha_compra)))].sort().reverse();
  const bancos = [...new Set(S.tarjetas.map(t => t.banco))].sort();
  const opt = (v, txt, sel) => `<option value="${esc(v)}" ${sel === v ? 'selected' : ''}>${txt}</option>`;
  const activos = ['mesPago', 'mesCompra', 'banco', 'tarjeta', 'persona', 'categoria'].filter(k => F[k]).length + (F.q ? 1 : 0);
  return seg + `
  ${sinCat ? `<button class="card nota" data-act="filtrosincat">❔ Tienes <b>${sinCat}</b> gastos sin categoría. Toca para verlos.</button>` : ''}
  <div class="search">${ICON.search}<input class="input" id="q" type="search" placeholder="Buscar gasto…" value="${esc(F.q)}"></div>
  <div class="fgrid">
    <label class="fsel ${F.mesPago ? 'on' : ''}"><span>📅 Mes de pago</span><select id="fmp">${opt('', 'Todos', F.mesPago)}${mesesPago.map(m => opt(m, capital(L.nombreMes(m)), F.mesPago)).join('')}</select></label>
    <label class="fsel ${F.mesCompra ? 'on' : ''}"><span>🛍️ Mes de compra</span><select id="fmc">${opt('', 'Todos', F.mesCompra)}${mesesCompra.map(m => opt(m, capital(L.nombreMes(m)), F.mesCompra)).join('')}</select></label>
    <label class="fsel ${F.banco ? 'on' : ''}"><span>🏦 Banco</span><select id="fb">${opt('', 'Todos', F.banco)}${bancos.map(b => opt(b, esc(b), F.banco)).join('')}</select></label>
    <label class="fsel ${F.tarjeta ? 'on' : ''}"><span>💳 Tarjeta</span><select id="ft">${opt('', 'Todas', F.tarjeta)}${tarjs.map(t => opt(t.id, esc(t.nombre), F.tarjeta)).join('')}</select></label>
    <label class="fsel ${F.persona ? 'on' : ''}"><span>👤 Persona</span><select id="fp">${opt('', 'Todas', F.persona)}${pers.map(p => opt(p.id, esc(p.nombre), F.persona)).join('')}</select></label>
    <label class="fsel ${F.categoria ? 'on' : ''}"><span>🏷️ Categoría</span><select id="fc">${opt('', 'Todas', F.categoria)}${opt('__sin', '❔ Sin categoría', F.categoria)}${cats.map(c => opt(c.id, `${c.emoji} ${esc(c.nombre)}`, F.categoria)).join('')}</select></label>
  </div>
  ${activos ? `<button class="btn sm ghost limpiar" data-act="limpiarfiltros">✕ Quitar filtros (${activos})</button>` : ''}
  <div id="lista-mov">${listaCompras()}</div>`;
}

function listaCompras() {
  const F = S.filtro; const q = normalizar(F.q); const fc = F.categoria;
  // cuotas por compra en el mes de pago elegido
  const cuotasMes = {};
  if (F.mesPago) for (const qq of S.cuotas) if (L.periodo(qq.fecha_pago) === F.mesPago) (cuotasMes[qq.compra_id] ??= []).push(qq);
  const lista = S.compras.filter(c => {
    const t = tarjetaDe(c.tarjeta_id);
    return (!F.persona || c.persona_id === F.persona) &&
      (!F.tarjeta || c.tarjeta_id === F.tarjeta) &&
      (!F.banco || t.banco === F.banco) &&
      (!F.mesCompra || L.periodo(c.fecha_compra) === F.mesCompra) &&
      (!F.mesPago || cuotasMes[c.id]) &&
      (!fc || (fc === '__sin' ? !c.categoria_id : c.categoria_id === fc)) &&
      (!q || normalizar(c.descripcion).includes(q) || normalizar(personaDe(c.persona_id).nombre).includes(q));
  }).sort((a, b) => b.fecha_compra.localeCompare(a.fecha_compra) || (b.created_at || '').localeCompare(a.created_at || ''));
  if (!lista.length) return `<div class="card empty"><div class="ico">🧾</div><b>Sin gastos con estos filtros</b><p class="tiny">Prueba quitando algún filtro.</p></div>`;

  const montoDe = (c) => F.mesPago ? suma(cuotasMes[c.id]) : Number(c.monto_total);
  const fila = (c) => {
    const t = tarjetaDe(c.tarjeta_id); const cat = categoriaDe(c.categoria_id);
    let info;
    if (F.mesPago) { const qs = cuotasMes[c.id]; const q0 = qs[0]; info = `${q0.total > 1 ? `cuota ${q0.numero}/${q0.total}` : c.cuota_ref ? `cuota ${c.cuota_ref}` : 'pago único'} · paga ${L.fechaCorta(q0.fecha_pago).slice(0, 5)}${c.num_cuotas > 1 ? ` · total compra ${soles(c.monto_total)}` : ''}`; }
    else info = c.num_cuotas > 1 ? `${c.num_cuotas} cuotas · 1ª ${L.fechaCorta(c.primera_fecha_pago).slice(0, 5)}` : c.cuota_ref ? `cuota ${c.cuota_ref} · paga ${L.fechaCorta(c.primera_fecha_pago).slice(0, 5)}` : `paga ${L.fechaCorta(c.primera_fecha_pago)}`;
    return `<div class="row tap" data-act="editar" data-v="${c.id}">
      <span class="emo" style="--c:${t.color}" title="${esc(cat.nombre)}">${cat.emoji}</span>
      <div class="grow"><div class="t1">${esc(c.descripcion || 'Sin descripción')}</div>
        <div class="t2">${L.fechaCorta(c.fecha_compra).slice(0, 5)} · ${esc(nombreCorto(personaDe(c.persona_id).nombre))} · ${esc(t.nombre)}</div>
        <div class="t2">${info}</div></div>
      <div class="amt num">${soles(montoDe(c))}</div></div>`;
  };

  // Agrupar: por banco + fecha de pago (si se filtra por mes de pago) o por mes de compra
  const grupos = {};
  for (const c of lista) {
    const k = F.mesPago ? tarjetaDe(c.tarjeta_id).banco + '|' + cuotasMes[c.id][0].fecha_pago : L.periodo(c.fecha_compra);
    (grupos[k] ??= []).push(c);
  }
  const claves = Object.keys(grupos).sort((a, b) => F.mesPago ? a.localeCompare(b) : b.localeCompare(a));
  const total = suma(lista, montoDe);
  const cab = `<div class="resfil"><span>${lista.length} gasto${lista.length > 1 ? 's' : ''}${F.mesPago ? ` que se pagan en ${L.nombreMes(F.mesPago)}` : ''}</span><b class="num">${soles(total)}</b></div>`;
  return cab + claves.map(k => {
    const arr = grupos[k];
    const titulo = F.mesPago ? (() => { const [b, f] = k.split('|'); return `${esc(b)} · paga ${L.diaSemana(f)} ${L.fechaCorta(f).slice(0, 5)}`; })() : `Compras de ${L.nombreMes(k)}`;
    return `<div class="group-h"><span>${titulo}</span><span class="num">${soles(suma(arr, montoDe))}</span></div>
      <div class="card" style="padding-top:6px;padding-bottom:6px">${arr.map(fila).join('')}</div>`;
  }).join('');
}

function vistaFijos() {
  const hoy = L.hoyISO();
  const activos = S.fijos.filter(f => !f.hasta || f.hasta > hoy).sort((a, b) => a.dia_cargo - b.dia_cargo);
  const cancelados = S.fijos.filter(f => f.hasta && f.hasta <= hoy);
  const totalMes = suma(activos);
  const sel = S.seleccionFijos;
  const fila = (f, activo) => {
    const t = tarjetaDe(f.tarjeta_id), cat = categoriaDe(f.categoria_id), p = personaDe(f.persona_id);
    return `<div class="row">
      ${activo ? `<button class="check ${sel.has(f.id) ? 'on' : ''}" data-act="selfijo" data-v="${f.id}" aria-label="Seleccionar"></button>` : ''}
      <span class="emo">${cat.emoji}</span>
      <div class="grow tap" data-act="fijo" data-v="${f.id}"><div class="t1">${esc(f.descripcion)}</div>
        <div class="t2">Día ${f.dia_cargo} · ${esc(nombreCorto(p.nombre))} · ${esc(t.nombre)}</div>
        <div class="t2">${activo ? (f.hasta ? `Termina ${L.fechaCorta(f.hasta)}` : 'Activo, sin fecha de fin') : `Cancelado desde ${L.fechaCorta(f.hasta)}`}</div></div>
      <div class="amt num tap" data-act="fijo" data-v="${f.id}">${soles(f.monto)}</div></div>`;
  };
  return `
  <div class="card hero" style="padding:14px 16px">
    <div class="label">Gastos fijos activos al mes</div>
    <div class="big num" style="font-size:30px;margin-bottom:4px"><small>S/</small>${fmt.format(totalMes)}</div>
    <div class="label">Se repiten solos cada mes en su tarjeta hasta que los canceles.</div>
  </div>
  <div class="btnrow" style="margin-bottom:14px">
    <button class="btn sm" data-act="fijo" data-v="" style="flex:1">+ Nuevo gasto fijo</button>
    ${sel.size ? `<button class="btn sm danger" data-act="cancelarfijos" style="flex:1">Cancelar ${sel.size} seleccionado${sel.size > 1 ? 's' : ''}</button>` : ''}
  </div>
  ${activos.length ? `<div class="card" style="padding-top:6px;padding-bottom:6px">${activos.map(f => fila(f, true)).join('')}</div>` : '<div class="card empty"><div class="ico">🔁</div><b>No tienes gastos fijos</b><p class="tiny">Ej. Netflix, Apple Music, internet de la casa, cuota del dentista.</p></div>'}
  ${activos.length ? '<p class="tiny" style="margin:-4px 4px 14px">Marca varios con el círculo para cancelarlos juntos.</p>' : ''}
  ${cancelados.length ? `<div class="group-h"><span>Cancelados</span></div><div class="card" style="padding-top:6px;padding-bottom:6px;opacity:.75">${cancelados.map(f => fila(f, false)).join('')}</div>` : ''}`;
}

// ===================== Vista: Análisis =====================
function vistaAnalisis() {
  const per = S.mes; const pid = principalId(); const ing = ingresoMes(per); const extras = extrasMes(per); const totExtras = suma(extras);
  const meses = []; for (let k = -6; k <= 3; k++) meses.push(L.sumarPeriodo(per, k));
  const R = Object.fromEntries(meses.map(m => [m, resumenMes(m)]));
  const act = R[per], ant = R[L.sumarPeriodo(per, -1)], sig = R[L.sumarPeriodo(per, 1)];
  const hoyPer = L.periodo(L.hoyISO());

  // ---- Mensajes de análisis ----
  const notas = [];
  const d = pct(act.total, ant.total);
  if (ant.total > 0 && d != null) {
    if (d > 10) notas.push(['warn', '📈', `Este mes subiste <b>${d}%</b> respecto a ${L.nombreMes(ant.per).split(' ')[0]} (+${soles(act.total - ant.total)}). Ojo con el ritmo.`]);
    else if (d < -10) notas.push(['ok', '📉', `¡Bien! Bajaste <b>${Math.abs(d)}%</b> respecto a ${L.nombreMes(ant.per).split(' ')[0]} (−${soles(ant.total - act.total)}).`]);
    else notas.push(['info', '➖', `Te mantienes estable: ${d >= 0 ? '+' : ''}${d}% respecto a ${L.nombreMes(ant.per).split(' ')[0]}.`]);
  }
  const dTuyo = pct(act.tuyo, ant.tuyo);
  if (ant.tuyo > 0 && dTuyo != null && Math.abs(dTuyo) > 10)
    notas.push([dTuyo > 0 ? 'warn' : 'ok', dTuyo > 0 ? '🧍' : '👏', `Tu gasto personal ${dTuyo > 0 ? 'subió' : 'bajó'} <b>${Math.abs(dTuyo)}%</b> (${soles(ant.tuyo)} → ${soles(act.tuyo)}).`]);
  if (totExtras > 0) notas.push(['ok', '💵', `Para estos pagos cuentas con <b>${soles(totExtras)}</b> de ingresos extras (${extras.map(x => `${esc(x.descripcion || tipoIngreso(x.tipo)[2])}, recibido el ${L.fechaCorta(x.fecha).slice(0, 5)}`).join('; ')}). En total tienes <b>${soles(ing)}</b>.`]);
  if (ing > 0) {
    const p = Math.round(act.tuyo / ing * 100); const queda = r2(ing - act.tuyo);
    const nivel = p >= 90 ? 'bad' : p >= 60 ? 'warn' : 'ok';
    const base = totExtras > 0 ? 'tus ingresos del mes (sueldo + extras)' : 'tu sueldo';
    notas.push([nivel, nivel === 'ok' ? '💚' : nivel === 'warn' ? '⚠️' : '🚨', `Tu parte de la tarjeta este mes es <b>${p}%</b> de ${base}. Te quedarían <b>${soles(queda)}</b> para todo lo demás.`]);
    if (queda < 0 && act.otros > 0) notas.push(['info', '🤝', `Ojo: aún no cuentas los <b>${soles(act.otros)}</b> que te deben otras personas. Si te pagan, te quedarían <b>${soles(queda + act.otros)}</b>.`]);
    if (sig.total > 0) {
      const ingS = ingresoMes(sig.per) || ing; const ps = Math.round(sig.tuyo / ingS * 100);
      notas.push([ps >= 60 ? 'warn' : 'info', '🔮', `${capital(L.nombreMes(sig.per))} ya tiene <b>${soles(sig.total)}</b> comprometidos (${soles(sig.fijos)} en fijos + ${soles(sig.total - sig.fijos)} en cuotas). Tu parte: ${soles(sig.tuyo)}, el ${ps}% de tus ingresos de ese mes${ps >= 60 ? ' — no te pases este mes.' : '.'}`]);
    }
  } else {
    notas.push(['info', '💼', `Agrega tu <b>sueldo mensual</b> en <b>Más → Mi sueldo y avisos</b> para decirte cuánto te queda cada mes.`]);
    if (sig.total > 0) notas.push(['info', '🔮', `${capital(L.nombreMes(sig.per))} ya tiene <b>${soles(sig.total)}</b> comprometidos (${soles(sig.fijos)} en fijos + ${soles(sig.total - sig.fijos)} en cuotas).`]);
  }
  if (act.otros > 0) notas.push(['info', '🤝', `Otras personas te deben <b>${soles(act.otros)}</b> este mes. Cóbrales antes del vencimiento desde el Resumen.`]);
  const catAct = Object.entries(act.porCat).sort((a, b) => b[1] - a[1]);
  if (catAct.length) { const c = categoriaDe(catAct[0][0]); notas.push(['info', c.emoji, `Tu mayor gasto es <b>${esc(c.nombre)}</b>: ${soles(catAct[0][1])} (${Math.round(catAct[0][1] / act.total * 100)}% del mes).`]); }
  let mayorSube = null;
  for (const [k, v] of catAct) { const delta = v - (ant.porCat[k] || 0); if (delta > 40 && (!mayorSube || delta > mayorSube[1])) mayorSube = [k, delta]; }
  if (mayorSube) { const c = categoriaDe(mayorSube[0]); notas.push(['warn', '🔺', `<b>${esc(c.nombre)}</b> creció ${soles(mayorSube[1])} respecto al mes anterior.`]); }
  for (const x of topesMes(per)) {
    if (x.pct >= 100) notas.push(['bad', '🎯', `Te pasaste del tope de <b>${esc(x.c.nombre)}</b>: ${soles(x.usado)} de ${soles(x.tope)}.`]);
    else if (x.pct >= 80) notas.push(['warn', '🎯', `<b>${esc(x.c.nombre)}</b> va en ${x.pct}% de su tope (${soles(x.usado)} de ${soles(x.tope)}).`]);
  }
  const EMa = estadoMes(per);
  if (EMa.nDeudas && EMa.faltaCobrar > 0) notas.push(['warn', '💰', `Te falta cobrar <b>${soles(EMa.faltaCobrar)}</b> (${EMa.nDeudas - EMa.cobrados} persona${EMa.nDeudas - EMa.cobrados > 1 ? 's' : ''}).`]);
  else if (EMa.nDeudas) notas.push(['ok', '💰', 'Ya te pagaron todos los que te debían este mes.']);
  if (EMa.cerrado) notas.push(['ok', '✅', 'Este mes está <b>cerrado</b>: todo validado, pagado y cobrado.']);
  const fijosAct = suma(S.fijos.filter(f => !f.hasta || f.hasta > L.hoyISO()));
  if (fijosAct > 0) notas.push(['info', '🔁', `Tus gastos fijos suman <b>${soles(fijosAct)}</b> al mes${ing ? ` (${fijosAct / ing < 0.01 ? 'menos del 1' : Math.round(fijosAct / ing * 100)}% de tus ingresos del mes)` : ''}.`]);

  // ---- KPIs ----
  const kpi = (label, valor, sub, cls = '') => `<div class="kpi"><span class="tiny">${label}</span><b class="num">${valor}</b><span class="tiny ${cls}">${sub}</span></div>`;
  const kpis = `<div class="kpis">
    ${kpi('Total del mes', soles(act.total), d == null ? '—' : `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(d)}% vs mes ant.`, d > 10 ? 'txt-warn' : d < -10 ? 'txt-ok' : '')}
    ${kpi('Tu parte', soles(act.tuyo), ing ? `${Math.round(act.tuyo / ing * 100)}% de tus ingresos` : 'sin sueldo cargado')}
    ${kpi('Te deben', soles(act.otros), (() => { const em = estadoMes(per); return em.nDeudas ? (em.faltaCobrar > 0 ? `falta cobrar ${soles(em.faltaCobrar)}` : '✓ todo cobrado') : 'nadie'; })(), estadoMes(per).faltaCobrar > 0 ? 'txt-warn' : 'txt-ok')}
    ${kpi(ing ? 'Te queda' : 'Fijos del mes', ing ? soles(ing - act.tuyo) : soles(act.fijos), ing ? (totExtras ? `sueldo + ${soles(totExtras)} extra − tu parte` : 'sueldo − tu parte') : 'se repiten cada mes', ing && ing - act.tuyo < 0 ? 'txt-bad' : '')}
  </div>`;

  // ---- Gráfico mes a mes ----
  const chart1 = graficoMeses(meses.map(m => ({ ...R[m], ing: ingresoMes(m) })), per, hoyPer);

  // ---- Categorías ----
  const maxC = Math.max(1, ...catAct.map(x => x[1]), ...Object.values(ant.porCat));
  const chart2 = `<div class="card"><h3>Por categoría <span class="tiny">${L.nombreMes(per)} vs ${L.nombreMes(ant.per).split(' ')[0]}</span></h3>
    <div class="legend"><span><i style="background:var(--c-tuyo)"></i>${capital(L.nombreMes(per).split(' ')[0])}</span><span><i class="ghost"></i>Mes anterior</span></div>
    ${catAct.map(([k, v]) => {
      const c = categoriaDe(k); const a = ant.porCat[k] || 0; const dd = r2(v - a);
      return `<div class="cbar" data-tip="${esc(c.nombre)}|${soles(v)} este mes|${soles(a)} mes anterior">
        <div class="cl"><span>${c.emoji}</span><span class="grow">${esc(c.nombre)}</span><b class="num">${soles(v)}</b><span class="num delta ${dd > 0 ? 'up' : dd < 0 ? 'down' : ''}">${dd > 0 ? '▲' : dd < 0 ? '▼' : ''}${dd ? fmt0.format(Math.abs(dd)) : '='}</span></div>
        <div class="ctrack"><i style="width:${(v / maxC * 100).toFixed(1)}%"></i><u style="left:calc(${(a / maxC * 100).toFixed(1)}% - 1px)"></u></div>
      </div>`;
    }).join('') || '<p class="tiny">Sin gastos este mes.</p>'}
  </div>`;

  // ---- Tabla mes a mes ----
  const tabla = `<div class="card"><h3>Mes a mes</h3><div class="tablewrap"><table class="pivot num">
    <thead><tr><th>Mes</th><th>Total</th><th>Tu parte</th><th>Otros</th><th>Fijos</th><th>Ingresos</th><th>Te queda</th><th>Var.</th></tr></thead>
    <tbody>${meses.map((m, i) => { const r = R[m], p0 = i ? R[meses[i - 1]] : null; const v = p0 ? pct(r.total, p0.total) : null;
      return `<tr class="${m === per ? 'sel' : ''}"><td>${estadoMes(m).cerrado ? '✅ ' : ''}${capital(L.nombreMes(m))}${m > hoyPer ? ' <span class="tiny">proy.</span>' : ''}</td><td>${fmt.format(r.total)}</td><td>${fmt.format(r.tuyo)}</td><td>${fmt.format(r.otros)}</td><td>${fmt.format(r.fijos)}</td><td>${ingresoMes(m) ? fmt.format(ingresoMes(m)) : '—'}</td><td class="${ingresoMes(m) && ingresoMes(m) - r.tuyo < 0 ? 'txt-bad' : ''}">${ingresoMes(m) ? fmt.format(ingresoMes(m) - r.tuyo) : '—'}</td><td class="${v > 10 ? 'txt-warn' : v < -10 ? 'txt-ok' : ''}">${v == null ? '—' : (v > 0 ? '+' : '') + v + '%'}</td></tr>`; }).join('')}</tbody>
  </table></div></div>`;

  const sim = `<button class="card simcard" data-act="simular"><span class="ic">🧮</span><span class="grow"><b>¿Me alcanza para una compra?</b><br><span class="tiny">Simula una compra en cuotas y mira cómo quedan tus próximos meses</span></span>${ICON.chev}</button>`;
  return navMes(EMa.cerrado ? '✅ Mes cerrado' : 'Mes de pago analizado') + kpis + sim +
    `<div class="card"><h3>Lo que te digo de ${L.nombreMes(per).split(' ')[0]} <button class="btn sm ghost" data-act="ingreso" data-v="" data-per="${per}">+ Ingreso extra</button></h3>${notas.map(([n, ic, t]) => `<div class="nota-a ${n}"><span class="ic">${ic}</span><span>${t}</span></div>`).join('')}</div>` +
    chart1 + `<div class="grid-2">${chart2}${tabla}</div>`;
}

function graficoMeses(datos, sel, hoyPer) {
  const ing = Math.max(0, ...datos.map(d => d.ing || 0));
  const ancho = window.innerWidth >= 900 ? Math.min(window.innerWidth - 240, 1000) - 96 : Math.min(window.innerWidth, 760) - 64;
  const W = Math.max(300, Math.round(ancho)), H = W < 500 ? 220 : 260, pl = 40, pr = 6, pt = 14, pb = 34;
  const max = Math.max(1, ...datos.map(d => d.total), ...datos.map(d => d.ing || 0)) * 1.08;
  const paso = niceStep(max / 4); const top = Math.ceil(max / paso) * paso;
  const y = (v) => pt + (H - pt - pb) * (1 - v / top);
  const bw = (W - pl - pr) / datos.length; const barW = Math.min(36, bw * 0.62);
  let g = '';
  for (let v = 0; v <= top + 0.01; v += paso) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${v >= 1000 ? fmt0.format(v / 1000) + 'k' : fmt0.format(v)}</text>`;
  const barras = datos.map((d, i) => {
    const x = pl + i * bw + (bw - barW) / 2; const fut = d.per > hoyPer; const esSel = d.per === sel;
    const hT = y(0) - y(d.tuyo), hO = y(0) - y(d.otros); const gap = d.tuyo > 0 && d.otros > 0 ? 2 : 0;
    const op = fut ? 0.45 : 1;
    const r = (yy, hh) => hh <= 0 ? '' : '';
    return `<g class="bar ${esSel ? 'sel' : ''}" data-act="irmes2" data-v="${d.per}" data-tip="${capital(L.nombreMes(d.per))}${fut ? ' (proyectado)' : ''}|Total ${soles(d.total)}|Tu parte ${soles(d.tuyo)}|Otros ${soles(d.otros)}${d.ing ? `|Ingresos ${soles(d.ing)}|Te queda ${soles(d.ing - d.tuyo)}` : ''}">
      <rect x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pt - pb}" class="hit"/>
      ${esSel ? `<rect x="${x - 5}" y="${pt}" width="${barW + 10}" height="${H - pt - pb}" rx="8" class="selbg"/>` : ''}
      ${hT > 0 ? `<path d="${barPath(x, y(d.tuyo), barW, hT, d.otros > 0 ? 0 : 4)}" fill="${COL_TUYO}" opacity="${op}"/>` : ''}
      ${hO > 0 ? `<path d="${barPath(x, y(d.total), barW, Math.max(0, hO - gap), 4)}" fill="${COL_OTROS}" opacity="${op}"/>` : ''}
      ${d.ing > 0 ? `<line x1="${pl + i * bw + 3}" x2="${pl + (i + 1) * bw - 3}" y1="${y(d.ing)}" y2="${y(d.ing)}" class="ingline"/>` : ''}
      <text x="${x + barW / 2}" y="${H - pb + 16}" class="ax ${esSel ? 'axsel' : ''}" text-anchor="middle">${L.mesCorto(d.per).slice(0, 3)}</text>
      ${i === 0 || d.per.endsWith('-01') ? `<text x="${x + barW / 2}" y="${H - pb + 29}" class="ax" text-anchor="middle" font-size="10">${d.per.slice(0, 4)}</text>` : ''}
    </g>`;
  }).join('');
  const linea = '';
  return `<div class="card"><h3>Mes a mes <span class="tiny">toca una barra para ver ese mes</span></h3>
    <div class="legend"><span><i style="background:var(--c-tuyo)"></i>Tu parte</span><span><i style="background:var(--c-otros)"></i>Otras personas</span>${ing ? '<span><i class="dash"></i>Ingresos del mes</span>' : ''}<span><i style="background:var(--ink-3);opacity:.45"></i>Meses que vienen</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Gasto por mes de pago">${g}${barras}${linea}</svg></div>`;
}
function barPath(x, yTop, w, h, r) {
  r = Math.min(r, h, w / 2); const yb = yTop + h;
  return `M${x},${yb} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${yb} Z`;
}
function niceStep(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

function montarTooltips() {
  let tip = $('#tip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); }
  document.querySelectorAll('[data-tip]').forEach(el => {
    const show = (e) => {
      const [t, ...rest] = el.dataset.tip.split('|');
      tip.innerHTML = `<b>${esc(t)}</b>${rest.map(r => `<div>${esc(r)}</div>`).join('')}`;
      tip.classList.add('show');
      const r = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2));
      tip.style.left = x + 'px'; tip.style.top = Math.max(8, r.top + window.scrollY - tip.offsetHeight - 6) + 'px';
    };
    el.addEventListener('pointerenter', show);
    el.addEventListener('pointerleave', () => tip.classList.remove('show'));
  });
}

// ===================== Vista: Más =====================
function vistaMas() {
  const tarjs = ordenar(S.tarjetas), pers = ordenar(S.personas), cats = ordenar(S.categorias);
  const importados = S.compras.filter(c => c.importado).length;
  const sinCat = S.compras.filter(c => !c.categoria_id).length;
  const pid = principalId();
  const usoCat = {}; for (const c of S.compras) usoCat[c.categoria_id] = (usoCat[c.categoria_id] || 0) + 1;
  const pushOk = 'serviceWorker' in navigator && 'PushManager' in window;
  const permiso = typeof Notification !== 'undefined' ? Notification.permission : 'no';
  return `
  <div class="grid-2">
  <div class="card">
    <h3>💼 Mi sueldo y avisos</h3>
    <div class="field"><label for="aj-ingreso">Sueldo neto mensual (lo que te depositan)</label>
      <div class="money sm"><span>S/</span><input class="input num" id="aj-ingreso" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${ingreso() || ''}"></div></div>
    <div class="field"><label for="aj-principal">¿Quién eres tú? (persona principal)</label>
      <select class="input" id="aj-principal">${pers.map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
    <div class="field"><span class="lbl">Avisarme antes de cada pago</span>
      <div class="chips-sel">${diasAviso().map(d => `<button class="chip-sel on" data-act="quitardia" data-v="${d}">${d === 0 ? 'El mismo día' : d === 1 ? '1 día antes' : d + ' días antes'} ✕</button>`).join('')}
      <button class="chip-sel add" data-act="agregardia">+ Agregar</button></div></div>
    <div class="settings-item" style="border-top:1px solid var(--line)"><span class="grow"><b>Notificaciones en este equipo</b><br>
      <span class="tiny">${!pushOk ? 'En iPhone primero instala la app en la pantalla de inicio (iOS 16.4 o más).' : permiso === 'granted' ? '✅ Activadas' : permiso === 'denied' ? '🚫 Bloqueadas: actívalas en Ajustes del celular' : 'Te avisan aunque no abras la app'}</span></span>
      ${pushOk && permiso !== 'denied' ? `<button class="btn sm ${permiso === 'granted' ? 'ghost' : ''}" data-act="${permiso === 'granted' ? 'probarnoti' : 'activarnoti'}">${permiso === 'granted' ? 'Probar' : 'Activar'}</button>` : ''}</div>
  </div>
  ${tarjetaIngresos()}
  <div class="card">
    <h3>Tarjetas <button class="btn sm ghost" data-act="tarjeta" data-v="">+ Agregar</button></h3>
    ${tarjs.map(t => `
      <button class="settings-item" data-act="tarjeta" data-v="${t.id}">
        <span class="dot" style="background:${t.color};width:14px;height:14px"></span>
        <span class="grow"><b>${esc(t.nombre)}</b> ${t.activa ? '' : '<span class="badge">Inactiva</span>'}<br><span class="tiny">${esc(t.banco)} · ${textoCiclo(t)}${Number(t.linea) > 0 ? `<br>Línea ${soles(t.linea)} · disponible ${soles(Number(t.linea) - lineaUsada(t))}` : ''}</span></span>${ICON.chev}
      </button>`).join('') || '<p class="tiny">Aún no tienes tarjetas.</p>'}
  </div>
  <div class="card">
    <h3>Personas <button class="btn sm ghost" data-act="persona" data-v="">+ Agregar</button></h3>
    ${pers.map(p => `
      <button class="settings-item" data-act="persona" data-v="${p.id}">
        <span class="avatar">${esc(iniciales(p.nombre))}</span>
        <span class="grow"><b>${esc(p.nombre)}</b> ${p.id === pid ? '<span class="badge">Tú</span>' : ''} ${p.activa ? '' : '<span class="badge">Inactiva</span>'}<br><span class="tiny">${p.telefono ? '📱 ' + esc(p.telefono) : 'Sin WhatsApp'}</span></span>${ICON.chev}
      </button>`).join('')}
  </div>
  <div class="card">
    <h3>Categorías <button class="btn sm ghost" data-act="categoria" data-v="">+ Agregar</button></h3>
    ${sinCat ? `<button class="btn ghost" data-act="autocat" style="margin-bottom:8px">✨ Categorizar automáticamente (${sinCat} sin categoría)</button>` : ''}
    ${cats.map(c => `<button class="settings-item" data-act="categoria" data-v="${c.id}"><span class="emo" style="font-size:20px">${c.emoji}</span><span class="grow"><b>${esc(c.nombre)}</b><br><span class="tiny">${usoCat[c.id] || 0} gastos${Number(c.tope) > 0 ? ` · tope ${soles(c.tope)}` : ''}</span></span>${ICON.chev}</button>`).join('')}
  </div>
  <div class="card">
    <h3>Mis datos</h3>
    <button class="settings-item" data-act="exportar"><span class="grow"><b>Exportar a Excel</b><br><span class="tiny">Todas las cuotas y fijos con su categoría</span></span>${ICON.chev}</button>
    <label class="settings-item" style="cursor:pointer"><span class="grow"><b>Importar historial</b><br><span class="tiny">${importados ? `Ya importaste ${importados} registros` : 'Sube el archivo historial_deudas.json'}</span></span>${ICON.chev}
      <input type="file" accept=".json,application/json" id="imp" class="hidden"></label>
  </div>
  <div class="card">
    <h3>Cuenta</h3>
    <div class="settings-item"><span class="grow">${esc(S.sesion?.user?.email || '')}<br><span class="tiny">${modoDemo ? 'Modo demo (sin Supabase)' : 'Conectado a Supabase'} · ${S.compras.length} gastos · ${S.fijos.length} fijos</span></span></div>
    <button class="btn ghost" data-act="recargar" style="margin:6px 0 10px">Actualizar datos</button>
    <button class="btn danger" data-act="salir">Cerrar sesión</button>
  </div>
  </div>`;
}

function tarjetaIngresos() {
  const desde = L.sumarPeriodo(L.periodo(L.hoyISO()), -6);
  const lista = S.ingresos.filter(i => mesQueCubre(i.fecha) >= desde).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const grupos = {}; for (const i of lista) (grupos[mesQueCubre(i.fecha)] ??= []).push(i);
  return `<div class="card">
    <h3>💵 Ingresos extras <button class="btn sm ghost" data-act="ingreso" data-v="">+ Agregar</button></h3>
    <p class="tiny" style="margin:-6px 0 8px">Trabajos aparte, gratificación, CTS, bonos… Cada ingreso se suma a los primeros pagos que llegas a cubrir: si lo recibes después del día de pago, cuenta para el mes siguiente.</p>
    ${Object.keys(grupos).length ? Object.entries(grupos).map(([per, arr]) => `
      <div class="group-h" style="margin:10px 0 2px"><span>Para pagos de ${L.nombreMes(per)}</span><span class="num">${soles(suma(arr))}</span></div>
      ${arr.map(i => { const t = tipoIngreso(i.tipo); return `<button class="settings-item" data-act="ingreso" data-v="${i.id}"><span class="emo" style="font-size:18px">${t[1]}</span>
        <span class="grow"><b>${esc(i.descripcion || t[2])}</b><br><span class="tiny">${t[2]} · lo recibes el ${L.fechaCorta(i.fecha)}</span></span><b class="num">${soles(i.monto)}</b></button>`; }).join('')}`).join('')
      : '<p class="tiny" style="margin:4px 0">Aún no registras ingresos extras.</p>'}
  </div>`;
}

function formIngreso(id, perSugerido) {
  const i = id ? S.ingresos.find(x => x.id === id) : null;
  let fechaDef = L.hoyISO();
  if (!i && perSugerido && perSugerido !== mesQueCubre(fechaDef)) fechaDef = L.sumarPeriodo(perSugerido, -1) + '-15';
  const F = i ? { ...i } : { monto: '', tipo: 'extra', descripcion: '', fecha: fechaDef };
  abrirHoja(i ? 'Editar ingreso extra' : 'Nuevo ingreso extra', `
    <div class="field"><label>Monto</label><div class="money"><span>S/</span><input class="input num" id="i-monto" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${F.monto}"></div></div>
    <div class="field"><span class="lbl">Tipo</span><div class="chips-sel" id="i-tipo">${TIPOS_INGRESO.map(t => `<button type="button" class="chip-sel cat ${t[0] === F.tipo ? 'on' : ''}" data-id="${t[0]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</div></div>
    <div class="field"><label>Descripción (opcional)</label><input class="input" id="i-desc" value="${esc(F.descripcion)}" placeholder="Ej. Página web para cliente, grati de diciembre"></div>
    <div class="field"><label>¿Cuándo lo recibes?</label><input class="input" id="i-fecha" type="date" value="${F.fecha}"><span class="tiny" id="i-per"></span></div>
    <div class="err" id="i-err"></div>
    <button class="btn" id="i-save">Guardar ingreso</button>
    ${i ? '<button class="btn danger" id="i-del" style="margin-top:10px">Eliminar</button>' : ''}`, (sh) => {
    const per = () => {
      const f = $('#i-fecha', sh).value; if (!f) { $('#i-per', sh).innerHTML = ''; return; }
      const m = mesQueCubre(f); const mismo = m === L.periodo(f);
      $('#i-per', sh).innerHTML = `Lo recibes el ${L.fechaCorta(f).slice(0, 5)} → te sirve para los pagos de <b>${L.nombreMes(m)}</b> (${fechasPagoTexto(m)})${mismo ? '' : `, porque los de ${L.nombreMes(L.periodo(f)).split(' ')[0]} vencen antes.`}`;
    };
    $('#i-fecha', sh).addEventListener('input', per); per();
    grupoChips(sh, '#i-tipo', (v) => { F.tipo = v; });
    $('#i-save', sh).onclick = async () => {
      const monto = r2($('#i-monto', sh).value); const fecha = $('#i-fecha', sh).value;
      if (!(monto > 0)) { $('#i-err', sh).textContent = 'Ingresa un monto mayor a 0'; return; }
      if (!fecha) { $('#i-err', sh).textContent = 'Elige la fecha'; return; }
      const datos = { monto, fecha, periodo: mesQueCubre(fecha), tipo: F.tipo, descripcion: $('#i-desc', sh).value.trim() };
      try {
        if (i) { await db.actualizar('ingresos', i.id, datos); Object.assign(i, datos); }
        else { const n = { id: uid(), ...datos }; await db.insertar('ingresos', n); S.ingresos.push(n); }
        cerrarHoja(); toast('Ingreso guardado 💵'); render();
      } catch (e) { $('#i-err', sh).textContent = e.message; }
    };
    if (i) $('#i-del', sh).onclick = async () => {
      if (!confirm('¿Eliminar este ingreso?')) return;
      try { await db.borrar('ingresos', i.id); S.ingresos = S.ingresos.filter(x => x.id !== i.id); cerrarHoja(); render(); } catch (e) { toast(e.message); }
    };
    if (!i) setTimeout(() => $('#i-monto', sh)?.focus(), 300);
  });
}

function formCobro(personaId, total) {
  const p = personaDe(personaId); const cb = cobroDe(personaId, S.mes);
  abrirHoja(`Pago de ${nombrePila(p.nombre)}`, `
    <div class="preview"><div class="why">${esc(p.nombre)} debe <b>${soles(total)}</b> en ${L.nombreMes(S.mes)}.</div></div>
    <div class="field"><label>¿Cuánto te pagó?</label><div class="money"><span>S/</span><input class="input num" id="b-monto" type="number" inputmode="decimal" step="0.01" value="${cb ? cb.monto : r2(total)}"></div>
      <span class="tiny">Si te pagó solo una parte, cambia el monto.</span></div>
    <div class="field"><label>Fecha</label><input class="input" id="b-fecha" type="date" value="${cb?.fecha || L.hoyISO()}"></div>
    <div class="err" id="b-err"></div>
    <button class="btn" id="b-save">Guardar pago</button>
    ${cb ? '<button class="btn danger" id="b-del" style="margin-top:10px">Quitar pago (aún no me paga)</button>' : ''}`, (sh) => {
    $('#b-save', sh).onclick = async () => {
      const monto = r2($('#b-monto', sh).value); const fecha = $('#b-fecha', sh).value || L.hoyISO();
      if (!(monto > 0)) { $('#b-err', sh).textContent = 'Ingresa el monto'; return; }
      try {
        if (cb) { await db.actualizar('cobros', cb.id, { monto, fecha }); Object.assign(cb, { monto, fecha }); }
        else { const n = { id: uid(), persona_id: personaId, periodo: S.mes, monto, fecha }; await db.insertar('cobros', n); S.cobros.push(n); }
        cerrarHoja(); toast(monto >= total - 0.009 ? `${nombrePila(p.nombre)} ya pagó ✓` : 'Pago parcial guardado'); const y = window.scrollY; render(); window.scrollTo(0, y);
      } catch (e) { $('#b-err', sh).textContent = e.message; }
    };
    if (cb) $('#b-del', sh).onclick = async () => {
      try { await db.borrar('cobros', cb.id); S.cobros = S.cobros.filter(x => x !== cb); cerrarHoja(); render(); } catch (e) { toast(e.message); }
    };
  });
}

function formSimular() {
  const tarjs = ordenar(S.tarjetas).filter(t => t.activa); const pers = ordenar(S.personas).filter(p => p.activa);
  if (!tarjs.length) { toast('Primero agrega una tarjeta'); return; }
  const F = { monto: '', cuotas: 1, tarjeta_id: (tarjs.find(t => t.id === pref.get('tarjeta')) || tarjs[0]).id, persona_id: principalId(), fecha: L.hoyISO(), descripcion: '' };
  abrirHoja('🧮 ¿Me alcanza?', `
    <p class="tiny" style="margin:-4px 0 12px">Simula una compra antes de hacerla. No se guarda nada.</p>
    <div class="field"><label>Monto total</label><div class="money"><span>S/</span><input class="input num" id="s-monto" type="number" inputmode="decimal" step="0.01" placeholder="0.00"></div></div>
    <div class="field"><label>¿Qué es? (opcional)</label><input class="input" id="s-desc" placeholder="Ej. Zapatillas"></div>
    <div class="two">
      <div class="field"><span class="lbl">Cuotas</span><div class="stepper"><button type="button" id="s-menos">−</button><input id="s-cuotas" class="num" type="number" inputmode="numeric" min="1" max="60" value="1"><button type="button" id="s-mas">+</button></div></div>
      <div class="field"><label>Fecha de compra</label><input class="input" id="s-fecha" type="date" value="${F.fecha}"></div>
    </div>
    <div class="field"><span class="lbl">Tarjeta</span><div class="chips-sel" id="s-tarj">${chipsTarjetas(tarjs, F.tarjeta_id)}</div></div>
    <div class="field"><span class="lbl">¿Para quién?</span><div class="chips-sel" id="s-pers">${chipsPersonas(pers, F.persona_id)}</div></div>
    <div id="s-res"></div>
    <button class="btn ghost" id="s-reg" style="margin-top:12px">Me animo: registrar esta compra</button>`, (sh) => {
    const pintar = () => {
      F.monto = r2($('#s-monto', sh).value); F.cuotas = Math.min(60, Math.max(1, parseInt($('#s-cuotas', sh).value) || 1)); F.fecha = $('#s-fecha', sh).value || L.hoyISO(); F.descripcion = $('#s-desc', sh).value;
      const res = $('#s-res', sh);
      if (!(F.monto > 0)) { res.innerHTML = '<div class="preview"><div class="why">Escribe el monto para ver cómo quedarían tus próximos meses.</div></div>'; return; }
      const t = tarjetaDe(F.tarjeta_id); const ciclo = L.calcularCiclo(F.fecha, t);
      const cuotas = L.cronograma({ montoTotal: F.monto, numCuotas: F.cuotas, primeraFechaPago: ciclo.primerPago, diaPago: t.dia_pago });
      const esMio = F.persona_id === principalId();
      const filas = cuotas.slice(0, 12).map(q => {
        const per = L.periodo(q.fecha_pago); const r = resumenMes(per); const ing = ingresoMes(per);
        const tuyo = r2(r.tuyo + (esMio ? q.monto : 0)); const queda = ing ? r2(ing - tuyo) : null;
        const nivel = queda == null ? '' : queda < 0 ? 'bad' : ing && tuyo / ing >= 0.6 ? 'warn' : 'ok';
        return `<tr class="${nivel}"><td>${capital(L.mesCorto(per).slice(0, 3))} ${per.slice(2, 4)}</td><td>${fmt.format(r.tuyo)}</td><td>+${fmt.format(esMio ? q.monto : 0)}</td><td>${ing ? fmt.format(ing) : '—'}</td><td><b>${queda == null ? '—' : fmt.format(queda)}</b></td></tr>`;
      }).join('');
      const peor = cuotas.map(q => { const per = L.periodo(q.fecha_pago); const ing = ingresoMes(per); return ing ? ing - (resumenMes(per).tuyo + (esMio ? q.monto : 0)) : null; }).filter(x => x != null);
      const minimo = peor.length ? Math.min(...peor) : null;
      const linea = Number(t.linea) > 0 ? r2(Number(t.linea) - lineaUsada(t) - F.monto) : null;
      let veredicto;
      if (minimo == null) veredicto = ['info', 'ℹ️', 'Agrega tu sueldo en Más para decirte si te alcanza.'];
      else if (minimo < 0) veredicto = ['bad', '🚨', `<b>No te alcanza</b>: algún mes te quedarías en <b>${soles(minimo)}</b>. Prueba con más cuotas o espera.`];
      else if (peor.some((x, i) => { const per = L.periodo(cuotas[i].fecha_pago); return (ingresoMes(per) - x) / ingresoMes(per) >= 0.6; })) veredicto = ['warn', '⚠️', `Te alcanza, pero justo: el mes más ajustado te quedarían <b>${soles(minimo)}</b>.`];
      else veredicto = ['ok', '💚', `<b>Sí te alcanza.</b> El mes más ajustado te quedarían <b>${soles(minimo)}</b>.`];
      res.innerHTML = `<div class="nota-a ${veredicto[0]}"><span class="ic">${veredicto[1]}</span><span>${veredicto[2]}${esMio ? '' : ' (es para otra persona: no afecta tu parte, pero sí ocupa tu línea).'}</span></div>
        ${linea != null ? `<div class="nota-a ${linea < 0 ? 'bad' : 'info'}"><span class="ic">💳</span><span>Línea disponible en ${esc(t.nombre)} después de comprar: <b>${soles(linea)}</b>${linea < 0 ? ' — no te alcanza la línea.' : '.'}</span></div>` : ''}
        <div class="why tiny" style="margin:10px 0 6px">1ª cuota el ${L.fechaHumana(ciclo.primerPago)}. Así quedarían tus meses (tu parte):</div>
        <div class="tablewrap"><table class="pivot num sim"><thead><tr><th>Mes</th><th>Ya tienes</th><th>Nueva</th><th>Ingresos</th><th>Te queda</th></tr></thead><tbody>${filas}</tbody></table></div>`;
    };
    sh.querySelectorAll('input').forEach(i => i.addEventListener('input', pintar));
    $('#s-menos', sh).onclick = () => { $('#s-cuotas', sh).value = Math.max(1, (parseInt($('#s-cuotas', sh).value) || 1) - 1); pintar(); };
    $('#s-mas', sh).onclick = () => { $('#s-cuotas', sh).value = Math.min(60, (parseInt($('#s-cuotas', sh).value) || 1) + 1); pintar(); };
    grupoChips(sh, '#s-tarj', (v) => { F.tarjeta_id = v; pintar(); });
    grupoChips(sh, '#s-pers', (v) => { F.persona_id = v; pintar(); });
    $('#s-reg', sh).onclick = () => {
      if (!(F.monto > 0)) { toast('Primero escribe el monto'); return; }
      const pre = { monto: F.monto, num_cuotas: F.cuotas, tarjeta_id: F.tarjeta_id, persona_id: F.persona_id, fecha_compra: F.fecha, descripcion: F.descripcion };
      cerrarHoja(); setTimeout(() => formCompra(null, pre), 280);
    };
    pintar(); setTimeout(() => $('#s-monto', sh)?.focus(), 300);
  });
}

function textoCiclo(t) {
  const ini = t.dia_cierre >= 28 ? 1 : t.dia_cierre + 1;
  const cuando = ['el mismo mes del cierre', 'el mes siguiente', 'dos meses después'][t.meses_pago ?? 1];
  return `Ciclo del ${ini} al ${t.dia_cierre} · paga el ${t.dia_pago}, ${cuando}`;
}

// ===================== Hoja inferior (modal) =====================
function abrirHoja(titulo, html, onMount) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-bg"></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-head"><h2>${titulo}</h2><button class="iconbtn" data-act="cerrar" aria-label="Cerrar">${ICON.x}</button></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { root.querySelector('.sheet-bg').classList.add('show'); root.querySelector('.sheet').classList.add('show'); });
  root.querySelector('.sheet-bg').onclick = cerrarHoja;
  onMount?.(root.querySelector('.sheet'));
}
function cerrarHoja() {
  const root = $('#sheet-root');
  root.querySelector('.sheet')?.classList.remove('show');
  root.querySelector('.sheet-bg')?.classList.remove('show');
  document.body.style.overflow = '';
  setTimeout(() => { root.innerHTML = ''; }, 260);
}

const chipsPersonas = (pers, sel) => pers.map(p => `<button type="button" class="chip-sel ${p.id === sel ? 'on' : ''}" data-id="${p.id}">${esc(nombreCorto(p.nombre))}</button>`).join('');
const chipsTarjetas = (tarjs, sel) => tarjs.map(t => `<button type="button" class="chip-sel ${t.id === sel ? 'on' : ''}" data-id="${t.id}"><span class="dot" style="background:${t.color}"></span>${esc(t.nombre)}</button>`).join('');
const chipsCategorias = (cats, sel) => cats.map(c => `<button type="button" class="chip-sel cat ${c.id === sel ? 'on' : ''}" data-id="${c.id}"><span>${c.emoji}</span>${esc(c.nombre)}</button>`).join('');
function grupoChips(sh, selector, onPick) {
  $(selector, sh).onclick = (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    sh.querySelectorAll(selector + ' [data-id]').forEach(x => x.classList.toggle('on', x === b));
    onPick(b.dataset.id);
  };
}
const marcarChip = (sh, selector, id) => sh.querySelectorAll(selector + ' [data-id]').forEach(x => x.classList.toggle('on', x.dataset.id === id));

// ===================== Formulario de compra =====================
function formCompra(id, pre = null) {
  const c = id ? compraDe(id) : null;
  const tarjs = ordenar(S.tarjetas).filter(t => t.activa || t.id === c?.tarjeta_id);
  const pers = ordenar(S.personas).filter(p => p.activa || p.id === c?.persona_id);
  const cats = ordenar(S.categorias);
  if (!tarjs.length || !pers.length) { toast('Primero agrega una tarjeta y una persona'); S.tab = 'mas'; render(); return; }
  const F = {
    monto: c ? c.monto_total : '', modo: 'total', descripcion: c?.descripcion || '',
    persona_id: c?.persona_id || (pers.find(p => p.id === pref.get('persona')) || pers[0])?.id,
    tarjeta_id: c?.tarjeta_id || (tarjs.find(t => t.id === pref.get('tarjeta')) || tarjs[0])?.id,
    categoria_id: c?.categoria_id || '', catManual: !!c?.categoria_id,
    fecha_compra: c?.fecha_compra || L.hoyISO(), num_cuotas: c?.num_cuotas || 1,
    manual: c?.pago_manual || false, fecha_manual: c?.primera_fecha_pago || '', fijo: false,
  };
  if (pre) Object.assign(F, pre);

  const html = `
  <div class="field"><label>Monto</label>
    <div class="money"><span>S/</span><input class="input num" id="c-monto" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${F.monto}"></div></div>
  <div class="field"><label for="c-desc">Descripción</label><input class="input" id="c-desc" placeholder="¿En qué se gastó?" value="${esc(F.descripcion)}" autocomplete="off" list="dl-desc">
    <datalist id="dl-desc">${[...new Set(S.compras.map(x => x.descripcion).filter(Boolean))].slice(0, 200).map(d => `<option value="${esc(d)}">`).join('')}</datalist></div>
  <div class="field"><span class="lbl">Categoría <span class="tiny" id="c-sug"></span></span><div class="chips-sel scroll" id="c-cat">${chipsCategorias(cats, F.categoria_id)}</div></div>
  <div class="field"><span class="lbl">¿Quién usó la tarjeta?</span><div class="chips-sel" id="c-pers">${chipsPersonas(pers, F.persona_id)}<button type="button" class="chip-sel add" id="c-addp">+ Nueva</button></div></div>
  <div class="field"><span class="lbl">Tarjeta</span><div class="chips-sel" id="c-tarj">${chipsTarjetas(tarjs, F.tarjeta_id)}</div></div>
  ${c ? '' : `<div class="switch"><div><b style="font-size:14px">🔁 Es un gasto fijo mensual</b><div class="tiny">Se repite cada mes con el mismo monto hasta que lo canceles</div></div><button type="button" class="toggle" id="c-fijo" aria-label="Gasto fijo"></button></div>`}
  <div class="two">
    <div class="field"><label for="c-fecha" id="c-fecha-l">Fecha de compra</label><input class="input" id="c-fecha" type="date" value="${F.fecha_compra}"></div>
    <div class="field" id="c-cuotas-w"><span class="lbl">Cuotas</span><div class="stepper"><button type="button" id="c-menos">−</button><input id="c-cuotas" class="num" type="number" inputmode="numeric" min="1" max="60" value="${F.num_cuotas}"><button type="button" id="c-mas">+</button></div></div>
  </div>
  <div class="field ${F.num_cuotas > 1 ? '' : 'hidden'}" id="c-modo-w"><div class="seg" id="c-modo"><button type="button" data-m="total" class="on">El monto es el total</button><button type="button" data-m="cuota">El monto es por cuota</button></div></div>
  <div id="c-man-w"><div class="switch"><div><b style="font-size:14px">Cambiar fecha del primer pago</b><div class="tiny">Solo si el banco lo facturó en otro mes</div></div><button type="button" class="toggle ${F.manual ? 'on' : ''}" id="c-man" aria-label="Fecha manual"></button></div>
  <div class="field ${F.manual ? '' : 'hidden'}" id="c-fman-w"><label for="c-fman">Primer pago</label><input class="input" id="c-fman" type="date" value="${F.fecha_manual}"></div></div>
  <div class="preview" id="c-prev"></div>
  <div class="err" id="c-err"></div>
  <button class="btn" id="c-save">${c ? 'Guardar cambios' : 'Guardar gasto'}</button>
  ${c ? `<button class="btn ghost" id="c-tofijo" style="margin-top:10px">🔁 Convertir en gasto fijo mensual</button>
         <button class="btn danger" id="c-del" style="margin-top:10px">Eliminar gasto</button>` : ''}
  ${c?.importado ? '<p class="tiny" style="text-align:center">Registro importado del Excel antiguo</p>' : ''}`;

  abrirHoja(c ? 'Editar gasto' : 'Nuevo gasto', html, (sh) => {
    const val = () => {
      F.monto = $('#c-monto', sh).value; F.descripcion = $('#c-desc', sh).value;
      F.fecha_compra = $('#c-fecha', sh).value; F.num_cuotas = F.fijo ? 1 : Math.min(60, Math.max(1, parseInt($('#c-cuotas', sh).value) || 1));
      F.fecha_manual = $('#c-fman', sh).value;
    };
    const sugerir = () => {
      const clave = sugerirClave(F.descripcion); const cat = S.categorias.find(x => x.clave === clave);
      $('#c-sug', sh).textContent = cat && !F.catManual ? '· sugerida automáticamente' : '';
      if (!F.catManual && cat) { F.categoria_id = cat.id; marcarChip(sh, '#c-cat', cat.id); }
    };
    const plan = () => {
      const t = tarjetaDe(F.tarjeta_id);
      if (!F.fecha_compra) return null;
      const ciclo = L.calcularCiclo(F.fecha_compra, t);
      const usarManual = F.manual && F.fecha_manual && !F.fijo;
      const primera = usarManual ? F.fecha_manual : ciclo.primerPago;
      const montoN = r2(F.monto);
      const total = F.modo === 'cuota' && F.num_cuotas > 1 ? r2(montoN * F.num_cuotas) : montoN;
      let cuotas = L.cronograma({ montoTotal: total, numCuotas: F.num_cuotas, primeraFechaPago: primera, diaPago: usarManual ? undefined : t.dia_pago });
      if (F.modo === 'cuota' && F.num_cuotas > 1) cuotas = cuotas.map(q => ({ ...q, monto: montoN }));
      if (c?.cuota_ref && F.num_cuotas === 1) { const [n, tt] = c.cuota_ref.split('/').map(Number); cuotas = cuotas.map(q => ({ ...q, numero: n, total: tt })); }
      return { t, ciclo, primera, total, cuotas, usarManual };
    };
    const pintar = () => {
      val();
      $('#c-modo-w', sh).classList.toggle('hidden', F.num_cuotas <= 1 || F.fijo);
      $('#c-cuotas-w', sh).classList.toggle('hidden', F.fijo);
      $('#c-man-w', sh).classList.toggle('hidden', F.fijo);
      $('#c-fecha-l', sh).textContent = F.fijo ? 'Primer cobro' : 'Fecha de compra';
      const p = plan(); const prev = $('#c-prev', sh);
      if (!p) { prev.innerHTML = '<div class="why">Elige la fecha.</div>'; return; }
      if (F.fijo) {
        const proximos = L.cargosFijo({ desde: F.fecha_compra, dia_cargo: L.partes(F.fecha_compra).d }, p.t, L.sumarPeriodo(L.periodo(F.fecha_compra), 2));
        prev.innerHTML = `<div class="why">Se cobrará <b>${soles(r2(F.monto))}</b> el día <b>${L.partes(F.fecha_compra).d}</b> de cada mes en ${esc(p.t.nombre)}, hasta que lo canceles.</div>` +
          proximos.map(g => `<div class="cq"><span>Cobro ${L.fechaCorta(g.fecha_cargo).slice(0, 5)} → paga ${L.fechaCorta(g.fecha_pago)}</span><b class="num">${soles(r2(F.monto))}</b></div>`).join('') + '<div class="cq"><span>… y así cada mes</span><span></span></div>';
        return;
      }
      const why = p.usarManual ? `Primer pago puesto a mano: <b>${L.fechaHumana(p.primera)}</b>.`
        : `Compra del <b>${L.fechaHumana(F.fecha_compra)}</b> → entra al ciclo <b>${L.fechaCorta(p.ciclo.inicio).slice(0, 5)} al ${L.fechaCorta(p.ciclo.cierre).slice(0, 5)}</b> de ${esc(p.t.nombre)} → se paga el <b>${L.fechaHumana(p.ciclo.primerPago)}</b>.`;
      const lista = p.cuotas.length > 6 ? [...p.cuotas.slice(0, 4), null, p.cuotas[p.cuotas.length - 1]] : p.cuotas;
      prev.innerHTML = `<div class="why">${why}</div>` + lista.map(q => q ? `<div class="cq"><span>${q.total > 1 ? `Cuota ${q.numero}/${q.total}` : 'Pago único'} · ${L.fechaCorta(q.fecha_pago)}</span><b class="num">${soles(q.monto)}</b></div>` : '<div class="cq"><span>…</span><span></span></div>').join('')
        + (p.cuotas.length > 1 ? `<div class="cq"><span>Total</span><b class="num">${soles(p.total)}</b></div>` : '');
    };
    sh.querySelectorAll('input').forEach(i => i.addEventListener('input', pintar));
    $('#c-desc', sh).addEventListener('input', () => { val(); sugerir(); });
    grupoChips(sh, '#c-cat', (v) => { F.categoria_id = v; F.catManual = true; $('#c-sug', sh).textContent = ''; });
    grupoChips(sh, '#c-pers', (v) => { F.persona_id = v; });
    grupoChips(sh, '#c-tarj', (v) => { F.tarjeta_id = v; pintar(); });
    $('#c-addp', sh).onclick = async () => {
      const n = prompt('Nombre de la persona'); if (!n?.trim()) return;
      const p = { id: uid(), nombre: n.trim().toUpperCase(), activa: true, orden: S.personas.length };
      try {
        await db.insertar('personas', p); S.personas.push(p); F.persona_id = p.id;
        $('#c-addp', sh).insertAdjacentHTML('beforebegin', chipsPersonas([p], p.id)); marcarChip(sh, '#c-pers', p.id);
      } catch (e) { toast('Error: ' + e.message); }
    };
    $('#c-menos', sh).onclick = () => { $('#c-cuotas', sh).value = Math.max(1, (parseInt($('#c-cuotas', sh).value) || 1) - 1); pintar(); };
    $('#c-mas', sh).onclick = () => { $('#c-cuotas', sh).value = Math.min(60, (parseInt($('#c-cuotas', sh).value) || 1) + 1); pintar(); };
    $('#c-modo', sh).onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; F.modo = b.dataset.m; sh.querySelectorAll('#c-modo button').forEach(x => x.classList.toggle('on', x === b)); pintar(); };
    $('#c-man', sh).onclick = (e) => {
      F.manual = !F.manual; e.currentTarget.classList.toggle('on', F.manual); $('#c-fman-w', sh).classList.toggle('hidden', !F.manual);
      if (F.manual && !$('#c-fman', sh).value) { const p = plan(); if (p) $('#c-fman', sh).value = p.ciclo.primerPago; }
      pintar();
    };
    const tf = $('#c-fijo', sh); if (tf) tf.onclick = () => { F.fijo = !F.fijo; tf.classList.toggle('on', F.fijo); pintar(); };
    $('#c-save', sh).onclick = async () => {
      val(); const p = plan(); const err = $('#c-err', sh);
      if (!(r2(F.monto) > 0)) { err.textContent = 'Ingresa un monto mayor a 0'; return; }
      if (!F.fecha_compra) { err.textContent = 'Falta la fecha'; return; }
      if (!F.categoria_id) { err.textContent = 'Elige una categoría'; return; }
      const btn = $('#c-save', sh); btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        pref.set('persona', F.persona_id); pref.set('tarjeta', F.tarjeta_id);
        if (F.fijo) {
          const f = { id: uid(), persona_id: F.persona_id, tarjeta_id: F.tarjeta_id, categoria_id: F.categoria_id, descripcion: F.descripcion.trim(), monto: r2(F.monto), dia_cargo: L.partes(F.fecha_compra).d, desde: F.fecha_compra, hasta: null };
          await db.insertar('fijos', f); S.fijos.push(f);
          cerrarHoja(); toast('Gasto fijo guardado 🔁'); render(); return;
        }
        await guardarCompra(c, F, p);
        cerrarHoja(); toast(c ? 'Cambios guardados' : 'Gasto guardado ✓');
        if (!c) S.mes = L.periodo(p.cuotas[0].fecha_pago);
        render();
      } catch (e) { err.textContent = 'No se pudo guardar: ' + e.message; btn.disabled = false; btn.textContent = 'Reintentar'; }
    };
    if (c) {
      $('#c-del', sh).onclick = async () => {
        if (!confirm('¿Eliminar este gasto y todas sus cuotas?')) return;
        try {
          await db.borrar('compras', c.id); if (modoDemo) await db.borrarDonde('cuotas', 'compra_id', c.id);
          S.compras = S.compras.filter(x => x.id !== c.id); S.cuotas = S.cuotas.filter(q => q.compra_id !== c.id);
          cerrarHoja(); toast('Gasto eliminado'); render();
        } catch (e) { toast('Error: ' + e.message); }
      };
      $('#c-tofijo', sh).onclick = () => { cerrarHoja(); setTimeout(() => formFijo(null, c), 280); };
    }
    if (!c) sugerir();
    pintar();
    sh.querySelector('#c-cat .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    if (!c) setTimeout(() => $('#c-monto', sh)?.focus(), 300);
  });
}

async function guardarCompra(c, F, p) {
  const ahora = new Date().toISOString();
  const datos = {
    persona_id: F.persona_id, tarjeta_id: F.tarjeta_id, categoria_id: F.categoria_id || null, descripcion: F.descripcion.trim(),
    monto_total: p.total, num_cuotas: F.num_cuotas, fecha_compra: F.fecha_compra,
    primera_fecha_pago: p.cuotas[0].fecha_pago, pago_manual: !!p.usarManual, updated_at: ahora,
  };
  const id = c?.id || uid();
  const cuotas = p.cuotas.map(q => ({ id: uid(), compra_id: id, numero: q.numero, total: q.total, monto: q.monto, fecha_pago: q.fecha_pago }));
  if (c) {
    await db.actualizar('compras', id, datos);
    await db.borrarDonde('cuotas', 'compra_id', id);
    Object.assign(c, datos);
    S.cuotas = S.cuotas.filter(q => q.compra_id !== id);
  } else {
    const nueva = { id, ...datos, importado: false, created_at: ahora };
    await db.insertar('compras', nueva); S.compras.push(nueva);
  }
  await db.insertar('cuotas', cuotas); S.cuotas.push(...cuotas);
}

// ===================== Formulario gasto fijo =====================
function formFijo(id, origen = null) {
  const f = id ? S.fijos.find(x => x.id === id) : null;
  const tarjs = ordenar(S.tarjetas).filter(t => t.activa || t.id === f?.tarjeta_id);
  const pers = ordenar(S.personas).filter(p => p.activa || p.id === f?.persona_id);
  const cats = ordenar(S.categorias);
  const base = f || (origen ? {
    persona_id: origen.persona_id, tarjeta_id: origen.tarjeta_id, categoria_id: origen.categoria_id, descripcion: origen.descripcion,
    monto: origen.num_cuotas > 1 ? r2(origen.monto_total / origen.num_cuotas) : origen.monto_total,
    dia_cargo: L.partes(origen.fecha_compra).d, desde: L.sumarMeses(origen.fecha_compra, 1), hasta: null,
  } : { persona_id: principalId(), tarjeta_id: tarjs[0]?.id, categoria_id: S.categorias.find(c => c.clave === 'suscripcion')?.id || '', descripcion: '', monto: '', dia_cargo: Number(L.hoyISO().slice(8)), desde: L.hoyISO(), hasta: null });
  const F = { ...base };
  const cancelado = f?.hasta && f.hasta <= L.hoyISO();
  const html = `
  ${origen ? `<div class="preview"><div class="why">Se crea un gasto fijo a partir de <b>${esc(origen.descripcion)}</b>, empezando el mes siguiente. Si ya tenías anotados meses futuros iguales, te ofreceré borrarlos para que no se dupliquen.</div></div>` : ''}
  <div class="field"><label>Monto mensual</label><div class="money"><span>S/</span><input class="input num" id="f-monto" type="number" inputmode="decimal" step="0.01" value="${F.monto}"></div></div>
  <div class="field"><label>Descripción</label><input class="input" id="f-desc" value="${esc(F.descripcion)}" placeholder="Ej. Netflix, Internet casa, Dentista"></div>
  <div class="field"><span class="lbl">Categoría</span><div class="chips-sel scroll" id="f-cat">${chipsCategorias(cats, F.categoria_id)}</div></div>
  <div class="field"><span class="lbl">¿De quién es?</span><div class="chips-sel" id="f-pers">${chipsPersonas(pers, F.persona_id)}</div></div>
  <div class="field"><span class="lbl">Tarjeta</span><div class="chips-sel" id="f-tarj">${chipsTarjetas(tarjs, F.tarjeta_id)}</div></div>
  <div class="two">
    <div class="field"><label>Día de cobro</label><input class="input num" id="f-dia" type="number" inputmode="numeric" min="1" max="31" value="${F.dia_cargo}"></div>
    <div class="field"><label>Desde</label><input class="input" id="f-desde" type="date" value="${F.desde}"></div>
  </div>
  <div class="preview" id="f-prev"></div>
  <div class="err" id="f-err"></div>
  <button class="btn" id="f-save">${f ? 'Guardar cambios' : 'Guardar gasto fijo'}</button>
  ${f ? `<div class="card" style="margin-top:14px;padding:14px">
      <b style="font-size:14px">${cancelado ? 'Este gasto fijo está cancelado' : 'Cancelar este gasto fijo'}</b>
      <p class="tiny" style="margin:4px 0 10px">${cancelado ? 'Puedes reactivarlo para que siga cobrándose.' : 'Deja de aparecer desde la fecha que elijas en adelante. Los meses anteriores se conservan.'}</p>
      ${cancelado ? '<button class="btn ghost" id="f-react">Reactivar</button>' : `<div class="two"><input class="input" id="f-hasta" type="date" value="${f.hasta || L.hoyISO()}"><button class="btn danger" id="f-cancel">Cancelar desde ahí</button></div>`}
    </div>
    <button class="btn danger" id="f-del" style="margin-top:4px">Eliminar por completo</button>` : ''}`;
  abrirHoja(f ? 'Gasto fijo' : 'Nuevo gasto fijo', html, (sh) => {
    const val = () => { F.monto = $('#f-monto', sh).value; F.descripcion = $('#f-desc', sh).value; F.dia_cargo = Math.min(31, Math.max(1, parseInt($('#f-dia', sh).value) || 1)); F.desde = $('#f-desde', sh).value; };
    const pintar = () => {
      val(); const t = tarjetaDe(F.tarjeta_id); if (!F.desde) return;
      const desde = F.desde > L.hoyISO() ? F.desde : L.hoyISO();
      const prox = L.cargosFijo({ ...F, desde: F.desde, hasta: f?.hasta }, t, L.sumarPeriodo(L.periodo(desde), 3)).filter(g => g.fecha_cargo >= L.sumarMeses(desde, -1)).slice(0, 3);
      $('#f-prev', sh).innerHTML = `<div class="why">Cobro el día <b>${F.dia_cargo}</b> de cada mes en ${esc(t.nombre)}.</div>` + (prox.length ? prox.map(g => `<div class="cq"><span>Cobro ${L.fechaCorta(g.fecha_cargo).slice(0, 5)} → paga ${L.fechaCorta(g.fecha_pago)}</span><b class="num">${soles(r2(F.monto))}</b></div>`).join('') : '<div class="cq"><span>Sin cobros próximos</span><span></span></div>');
    };
    sh.querySelectorAll('#f-monto,#f-desc,#f-dia,#f-desde').forEach(i => i.addEventListener('input', pintar));
    grupoChips(sh, '#f-cat', (v) => { F.categoria_id = v; });
    grupoChips(sh, '#f-pers', (v) => { F.persona_id = v; });
    grupoChips(sh, '#f-tarj', (v) => { F.tarjeta_id = v; pintar(); });
    $('#f-save', sh).onclick = async () => {
      val(); const err = $('#f-err', sh);
      if (!(r2(F.monto) > 0)) { err.textContent = 'Ingresa el monto mensual'; return; }
      if (!F.descripcion.trim()) { err.textContent = 'Escribe una descripción'; return; }
      if (!F.categoria_id) { err.textContent = 'Elige una categoría'; return; }
      if (!F.desde) { err.textContent = 'Elige desde cuándo'; return; }
      const datos = { persona_id: F.persona_id, tarjeta_id: F.tarjeta_id, categoria_id: F.categoria_id, descripcion: F.descripcion.trim(), monto: r2(F.monto), dia_cargo: F.dia_cargo, desde: F.desde };
      try {
        if (f) { await db.actualizar('fijos', f.id, datos); Object.assign(f, datos); }
        else {
          const n = { id: uid(), ...datos, hasta: null }; await db.insertar('fijos', n); S.fijos.push(n);
          if (origen) {
            const dups = S.compras.filter(x => x.id !== origen.id && x.tarjeta_id === origen.tarjeta_id && normalizar(x.descripcion) === normalizar(origen.descripcion) && x.fecha_compra >= F.desde);
            if (dups.length && confirm(`Encontré ${dups.length} registro(s) de "${origen.descripcion}" desde ${L.fechaCorta(F.desde)} que ya tenías anotados a mano. ¿Borrarlos para que no se dupliquen con el gasto fijo?`)) {
              const ids = dups.map(x => x.id); await db.borrarVarios('compras', ids);
              if (modoDemo) await db.borrarVarios('cuotas', S.cuotas.filter(q => ids.includes(q.compra_id)).map(q => q.id));
              S.compras = S.compras.filter(x => !ids.includes(x.id)); S.cuotas = S.cuotas.filter(q => !ids.includes(q.compra_id));
            }
          }
        }
        cerrarHoja(); toast('Gasto fijo guardado 🔁'); S.tab = 'gastos'; S.vistaGastos = 'fijos'; render();
      } catch (e) { err.textContent = e.message; }
    };
    if (f) {
      const can = $('#f-cancel', sh); if (can) can.onclick = async () => {
        const h = $('#f-hasta', sh).value; if (!h) return;
        try { await db.actualizar('fijos', f.id, { hasta: h }); f.hasta = h; cerrarHoja(); toast('Gasto fijo cancelado'); render(); } catch (e) { toast(e.message); }
      };
      const re = $('#f-react', sh); if (re) re.onclick = async () => {
        try { await db.actualizar('fijos', f.id, { hasta: null }); f.hasta = null; cerrarHoja(); toast('Reactivado'); render(); } catch (e) { toast(e.message); }
      };
      $('#f-del', sh).onclick = async () => {
        if (!confirm('¿Eliminar por completo? También desaparece de los meses pasados. Si solo ya no lo pagas, mejor usa "Cancelar".')) return;
        try { await db.borrar('fijos', f.id); S.fijos = S.fijos.filter(x => x.id !== f.id); cerrarHoja(); render(); } catch (e) { toast(e.message); }
      };
    }
    pintar();
  });
}

function cancelarFijosSeleccionados() {
  const ids = [...S.seleccionFijos]; if (!ids.length) return;
  abrirHoja(`Cancelar ${ids.length} gasto${ids.length > 1 ? 's' : ''} fijo${ids.length > 1 ? 's' : ''}`, `
    <div class="preview">${ids.map(i => { const f = S.fijos.find(x => x.id === i); return `<div class="cq"><span>${esc(f.descripcion)}</span><b class="num">${soles(f.monto)}</b></div>`; }).join('')}</div>
    <div class="field"><label>Dejan de cobrarse desde</label><input class="input" id="m-hasta" type="date" value="${L.hoyISO()}"></div>
    <button class="btn danger" id="m-ok">Cancelar todos desde esa fecha</button>`, (sh) => {
    $('#m-ok', sh).onclick = async () => {
      const h = $('#m-hasta', sh).value; if (!h) return;
      try {
        await db.actualizarVarios('fijos', ids, { hasta: h });
        S.fijos.forEach(f => { if (ids.includes(f.id)) f.hasta = h; }); S.seleccionFijos.clear();
        cerrarHoja(); toast('Gastos fijos cancelados'); render();
      } catch (e) { toast(e.message); }
    };
  });
}

// ===================== Formulario tarjeta =====================
function formTarjeta(id) {
  const t = id ? S.tarjetas.find(x => x.id === id) : null;
  const F = t ? { ...t } : { nombre: '', banco: '', dia_cierre: 15, dia_pago: 5, meses_pago: 1, color: COLORES[S.tarjetas.length % COLORES.length], activa: true };
  const bancos = [...new Set(S.tarjetas.map(x => x.banco))];
  const enUso = t && (S.compras.some(c => c.tarjeta_id === t.id) || S.fijos.some(c => c.tarjeta_id === t.id));
  const html = `
  <div class="field"><label>Nombre de la tarjeta</label><input class="input" id="t-nom" placeholder="Ej. SAGA FALABELLA (JHONATAN)" value="${esc(F.nombre)}"></div>
  <div class="field"><label>Banco donde se paga</label><input class="input" id="t-banco" list="dl-b" placeholder="Ej. SAGA FALABELLA" value="${esc(F.banco)}"><datalist id="dl-b">${bancos.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
  <div class="two">
    <div class="field"><label>Día de cierre</label><input class="input num" id="t-cierre" type="number" inputmode="numeric" min="1" max="31" value="${F.dia_cierre}"></div>
    <div class="field"><label>Día de pago</label><input class="input num" id="t-pago" type="number" inputmode="numeric" min="1" max="31" value="${F.dia_pago}"></div>
  </div>
  <div class="field"><label>Línea de crédito (opcional)</label><div class="money sm"><span>S/</span><input class="input num" id="t-linea" type="number" inputmode="decimal" step="0.01" placeholder="Ej. 5000" value="${Number(F.linea) > 0 ? F.linea : ''}"></div></div>
  <div class="field"><span class="lbl">El pago cae…</span><div class="seg" id="t-mp">
    ${['Mismo mes del cierre', 'Mes siguiente', '2 meses después'].map((x, i) => `<button type="button" data-v="${i}" class="${F.meses_pago == i ? 'on' : ''}">${x}</button>`).join('')}</div></div>
  <div class="preview"><div class="why" id="t-prev"></div></div>
  <div class="field"><span class="lbl">Color</span><div class="colors" id="t-col">${COLORES.map(c => `<button type="button" data-c="${c}" class="${c === F.color ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
  <div class="switch"><b style="font-size:14px">Tarjeta activa</b><button type="button" class="toggle ${F.activa ? 'on' : ''}" id="t-act"></button></div>
  <div class="err" id="t-err"></div>
  <button class="btn" id="t-save">Guardar tarjeta</button>
  ${t ? `<button class="btn danger" id="t-del" style="margin-top:10px">${enUso ? 'No se puede eliminar (tiene gastos) · desactívala' : 'Eliminar tarjeta'}</button>` : ''}
  <p class="tiny" style="line-height:1.5">Los cambios de ciclo se aplican a los gastos nuevos, a los fijos y a los que vuelvas a guardar.</p>`;
  abrirHoja(t ? 'Editar tarjeta' : 'Nueva tarjeta', html, (sh) => {
    const leer = () => { F.nombre = $('#t-nom', sh).value.trim().toUpperCase(); F.banco = $('#t-banco', sh).value.trim().toUpperCase(); F.dia_cierre = parseInt($('#t-cierre', sh).value) || 1; F.dia_pago = parseInt($('#t-pago', sh).value) || 1; };
    const prev = () => {
      leer(); const d = Math.min(31, Math.max(1, F.dia_cierre)); const hoy = L.hoyISO();
      const ej = L.calcularCiclo(hoy, { ...F, dia_cierre: d, dia_pago: Math.min(31, Math.max(1, F.dia_pago)) });
      $('#t-prev', sh).innerHTML = `${textoCiclo({ ...F, dia_cierre: d })}.<br>Ejemplo: una compra de hoy (${L.fechaCorta(hoy).slice(0, 5)}) se pagaría el <b>${L.fechaHumana(ej.primerPago)}</b>.`;
    };
    sh.querySelectorAll('input').forEach(i => i.addEventListener('input', prev));
    $('#t-mp', sh).onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; F.meses_pago = +b.dataset.v; sh.querySelectorAll('#t-mp button').forEach(x => x.classList.toggle('on', x === b)); prev(); };
    $('#t-col', sh).onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; F.color = b.dataset.c; sh.querySelectorAll('#t-col button').forEach(x => x.classList.toggle('on', x === b)); };
    $('#t-act', sh).onclick = (e) => { F.activa = !F.activa; e.currentTarget.classList.toggle('on', F.activa); };
    $('#t-save', sh).onclick = async () => {
      leer(); const err = $('#t-err', sh);
      if (!F.nombre || !F.banco) { err.textContent = 'Completa nombre y banco'; return; }
      if (F.dia_cierre < 1 || F.dia_cierre > 31 || F.dia_pago < 1 || F.dia_pago > 31) { err.textContent = 'Los días deben estar entre 1 y 31'; return; }
      const datos = { nombre: F.nombre, banco: F.banco, dia_cierre: F.dia_cierre, dia_pago: F.dia_pago, meses_pago: F.meses_pago, color: F.color, activa: F.activa, linea: r2($('#t-linea', sh).value) || null };
      try {
        if (t) { await db.actualizar('tarjetas', t.id, datos); Object.assign(t, datos); }
        else { const n = { id: uid(), orden: S.tarjetas.length + 1, ...datos }; await db.insertar('tarjetas', n); S.tarjetas.push(n); }
        cerrarHoja(); toast('Tarjeta guardada'); render();
      } catch (e) { err.textContent = e.message; }
    };
    if (t) $('#t-del', sh).onclick = async () => {
      if (enUso) { toast('Tiene gastos registrados: desactívala en su lugar'); return; }
      if (!confirm('¿Eliminar esta tarjeta?')) return;
      try { await db.borrar('tarjetas', t.id); S.tarjetas = S.tarjetas.filter(x => x.id !== t.id); cerrarHoja(); render(); } catch (e) { toast(e.message); }
    };
    prev();
  });
}

// ===================== Formulario persona =====================
function formPersona(id) {
  const p = id ? S.personas.find(x => x.id === id) : null;
  let activa = p ? p.activa : true;
  const enUso = p && (S.compras.some(c => c.persona_id === p.id) || S.fijos.some(c => c.persona_id === p.id));
  abrirHoja(p ? 'Editar persona' : 'Nueva persona', `
    <div class="field"><label>Nombre</label><input class="input" id="p-nom" value="${esc(p?.nombre || '')}" placeholder="Ej. ANGIE MORZAN"></div>
    <div class="field"><label>WhatsApp (opcional)</label><input class="input" id="p-tel" type="tel" inputmode="tel" value="${esc(p?.telefono || '')}" placeholder="Ej. 987654321"><span class="tiny">Para abrir su chat directo con el mensaje listo.</span></div>
    <div class="switch"><b style="font-size:14px">Aparece en el formulario</b><button type="button" class="toggle ${activa ? 'on' : ''}" id="p-act"></button></div>
    <div class="err" id="p-err"></div>
    <button class="btn" id="p-save">Guardar</button>
    ${p ? `<button class="btn danger" id="p-del" style="margin-top:10px">${enUso ? 'Tiene gastos · desactívala' : 'Eliminar persona'}</button>` : ''}`, (sh) => {
    $('#p-act', sh).onclick = (e) => { activa = !activa; e.currentTarget.classList.toggle('on', activa); };
    $('#p-save', sh).onclick = async () => {
      const nombre = $('#p-nom', sh).value.trim().toUpperCase(); if (!nombre) { $('#p-err', sh).textContent = 'Escribe un nombre'; return; }
      const telefono = $('#p-tel', sh).value.trim() || null;
      try {
        if (p) { await db.actualizar('personas', p.id, { nombre, activa, telefono }); Object.assign(p, { nombre, activa, telefono }); }
        else { const n = { id: uid(), nombre, activa, telefono, orden: S.personas.length }; await db.insertar('personas', n); S.personas.push(n); }
        cerrarHoja(); render();
      } catch (e) { $('#p-err', sh).textContent = e.message; }
    };
    if (p) $('#p-del', sh).onclick = async () => {
      if (enUso) { toast('Tiene gastos registrados: desactívala'); return; }
      if (!confirm('¿Eliminar a ' + p.nombre + '?')) return;
      try { await db.borrar('personas', p.id); S.personas = S.personas.filter(x => x.id !== p.id); cerrarHoja(); render(); } catch (e) { toast(e.message); }
    };
  });
}

// ===================== Formulario categoría =====================
function formCategoria(id) {
  const c = id ? S.categorias.find(x => x.id === id) : null;
  const F = c ? { ...c } : { nombre: '', emoji: '📦', color: COLORES[S.categorias.length % COLORES.length] };
  const enUso = c && (S.compras.some(x => x.categoria_id === c.id) || S.fijos.some(x => x.categoria_id === c.id));
  const EMOJIS = ['🍔', '🛒', '🚗', '🏠', '📱', '🎬', '🩺', '🐶', '🎓', '❤️', '👕', '🎮', '🛍️', '🏦', '💸', '📦', '✈️', '🎁', '⚽', '💄', '🧾', '👶', '🍺', '💡'];
  abrirHoja(c ? 'Editar categoría' : 'Nueva categoría', `
    <div class="field"><label>Nombre</label><input class="input" id="k-nom" value="${esc(F.nombre)}" placeholder="Ej. Viajes"></div>
    <div class="field"><label>Tope mensual (opcional)</label><div class="money sm"><span>S/</span><input class="input num" id="k-tope" type="number" inputmode="decimal" step="0.01" placeholder="Sin tope" value="${Number(F.tope) > 0 ? F.tope : ''}"></div><span class="tiny">Te aviso cuando tu parte en esta categoría llegue al 80% y si te pasas.</span></div>
    <div class="field"><span class="lbl">Ícono</span><div class="emojis" id="k-emo">${EMOJIS.map(e => `<button type="button" class="${e === F.emoji ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
    <div class="err" id="k-err"></div>
    <button class="btn" id="k-save">Guardar</button>
    ${c ? `<button class="btn danger" id="k-del" style="margin-top:10px">Eliminar categoría${enUso ? ' (sus gastos quedan sin categoría)' : ''}</button>` : ''}`, (sh) => {
    $('#k-emo', sh).onclick = (e) => { const b = e.target.closest('[data-e]'); if (!b) return; F.emoji = b.dataset.e; sh.querySelectorAll('#k-emo button').forEach(x => x.classList.toggle('on', x === b)); };
    $('#k-save', sh).onclick = async () => {
      const nombre = $('#k-nom', sh).value.trim(); if (!nombre) { $('#k-err', sh).textContent = 'Escribe un nombre'; return; }
      try {
        const tope = r2($('#k-tope', sh).value) || null;
        if (c) { await db.actualizar('categorias', c.id, { nombre, emoji: F.emoji, tope }); Object.assign(c, { nombre, emoji: F.emoji, tope }); }
        else { const n = { id: uid(), clave: null, nombre, emoji: F.emoji, color: F.color, orden: S.categorias.length, tope }; await db.insertar('categorias', n); S.categorias.push(n); }
        cerrarHoja(); render();
      } catch (e) { $('#k-err', sh).textContent = e.message; }
    };
    if (c) $('#k-del', sh).onclick = async () => {
      if (!confirm('¿Eliminar la categoría ' + c.nombre + '?')) return;
      try {
        await db.borrar('categorias', c.id); S.categorias = S.categorias.filter(x => x.id !== c.id);
        S.compras.forEach(x => { if (x.categoria_id === c.id) x.categoria_id = null; }); S.fijos.forEach(x => { if (x.categoria_id === c.id) x.categoria_id = null; });
        if (modoDemo) { const ids = S.compras.filter(x => !x.categoria_id).map(x => x.id); await db.actualizarVarios('compras', ids, { categoria_id: null }); }
        cerrarHoja(); render();
      } catch (e) { toast(e.message); }
    };
  });
}

// ===================== Ajustes / estado de cuenta =====================
async function guardarAjustes(cambios) {
  S.ajustes = { ...S.ajustes, ...cambios };
  const fila = { datos: S.ajustes, updated_at: new Date().toISOString() };
  if (!modoDemo) fila.user_id = S.sesion.user.id;
  try { await db.upsert('ajustes', fila, 'user_id'); toast('Guardado'); render(); } catch (e) { toast('Error: ' + e.message); }
}

async function guardarEstado(banco, cambios) {
  const actual = estadoDe(banco, S.mes);
  const fila = { banco, periodo: S.mes, monto_banco: actual?.monto_banco ?? null, pagado: actual?.pagado ?? false, ...cambios };
  if (!modoDemo) fila.user_id = S.sesion.user.id;
  try {
    await db.upsert('estados_cuenta', fila, 'user_id,banco,periodo');
    if (actual) Object.assign(actual, fila); else S.estados.push({ id: uid(), ...fila });
    render();
  } catch (e) { toast('Error: ' + e.message); }
}

// ===================== Notificaciones (Web Push) =====================
function b64aUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function activarNotificaciones() {
  try {
    if (!VAPID_PUBLIC_KEY) { toast('Falta la clave VAPID en config.js (ver guía)'); return; }
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { toast('No se dio permiso de notificaciones'); render(); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aUint8(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    const fila = { endpoint: json.endpoint, sub: json };
    if (!modoDemo) fila.user_id = S.sesion.user.id;
    await db.upsert('push_subs', fila, 'endpoint');
    if (!S.ajustes.dias_aviso) await guardarAjustes({ dias_aviso: DIAS_AVISO_DEF });
    toast('Notificaciones activadas 🔔'); render();
  } catch (e) { toast('No se pudo activar: ' + e.message); }
}
async function probarNotificacion() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const g = proximosPagos(60)[0];
    await reg.showNotification('Mis Deudas · prueba 🔔', {
      body: g ? `${g.banco}: ${soles(g.monto)} el ${L.diaSemana(g.fecha)} ${L.fechaCorta(g.fecha).slice(0, 5)} (en ${g.dias} días)` : 'Así te llegarán los recordatorios de pago.',
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'prueba',
    });
  } catch (e) { toast('Error: ' + e.message); }
}

// ===================== Importar / exportar =====================
async function importar(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('El archivo no es válido'); return; }
  const regs = data.registros || [];
  if (!regs.length) { toast('El archivo no tiene registros'); return; }
  if (S.compras.some(c => c.importado) && !confirm('Ya importaste un historial antes. ¿Importar de nuevo? (se duplicarían los registros)')) return;
  if (!confirm(`Se importarán ${regs.length} registros. ¿Continuar?`)) return;
  toast('Importando…');
  try {
    const norm = (s) => s.trim().toUpperCase();
    const tmap = Object.fromEntries(S.tarjetas.map(t => [norm(t.nombre), t.id]));
    const pmap = Object.fromEntries(S.personas.map(p => [norm(p.nombre), p.id]));
    const cmap = Object.fromEntries(S.categorias.filter(c => c.clave).map(c => [c.clave, c.id]));
    const nuevasT = [], nuevasP = [];
    for (const t of data.tarjetas || []) if (!tmap[norm(t.nombre)]) { const n = { id: uid(), activa: true, orden: S.tarjetas.length + nuevasT.length + 1, ...t, nombre: norm(t.nombre) }; nuevasT.push(n); tmap[n.nombre] = n.id; }
    for (const r of regs) {
      if (!tmap[norm(r.tarjeta)]) { const n = { id: uid(), nombre: norm(r.tarjeta), banco: norm(r.tarjeta), dia_cierre: 15, dia_pago: 5, meses_pago: 1, color: '#495057', activa: true, orden: 99 }; nuevasT.push(n); tmap[n.nombre] = n.id; }
      if (!pmap[norm(r.persona)]) { const n = { id: uid(), nombre: norm(r.persona), activa: true, orden: S.personas.length + nuevasP.length }; nuevasP.push(n); pmap[n.nombre] = n.id; }
    }
    if (nuevasT.length) { await db.insertar('tarjetas', nuevasT); S.tarjetas.push(...nuevasT); }
    if (nuevasP.length) { await db.insertar('personas', nuevasP); S.personas.push(...nuevasP); }
    const compras = [], cuotas = [];
    for (const r of regs) {
      const id = uid();
      compras.push({ id, persona_id: pmap[norm(r.persona)], tarjeta_id: tmap[norm(r.tarjeta)], categoria_id: cmap[sugerirClave(r.descripcion)] || null, descripcion: r.descripcion, monto_total: r2(r.monto), num_cuotas: 1,
        fecha_compra: r.fecha_compra, primera_fecha_pago: r.fecha_pago, pago_manual: true, importado: true,
        cuota_ref: r.cuota_total > 1 ? `${r.cuota_numero}/${r.cuota_total}` : null, created_at: r.creado ? new Date(r.creado).toISOString() : new Date().toISOString(), updated_at: new Date().toISOString() });
      cuotas.push({ id: uid(), compra_id: id, numero: r.cuota_numero || 1, total: r.cuota_total || 1, monto: r2(r.monto), fecha_pago: r.fecha_pago });
    }
    await db.insertar('compras', compras); S.compras.push(...compras);
    await db.insertar('cuotas', cuotas); S.cuotas.push(...cuotas);
    S.mes = null; S.cargos = calcularCargos(); S.mes = mesPorDefecto();
    toast(`Listo: ${compras.length} registros importados`); render();
  } catch (e) { toast('Error importando: ' + e.message); }
}

async function exportar() {
  const filas = S.cargos.map(c => ({
    'FECHA DE COMPRA/COBRO': c.fecha_cargo, 'PERSONA QUE USA LA TARJETA': c.persona.nombre, 'QUE TARJETA USO?': c.tarjeta.nombre,
    'BANCO DONDE SE PAGA': c.tarjeta.banco, 'CATEGORIA': c.categoria.nombre, 'DESCRIPCION': c.descripcion, 'TIPO': c.tipo === 'fijo' ? 'FIJO MENSUAL' : 'COMPRA',
    'MONTO CUOTA': c.monto, 'CUOTA': `${c.numero}/${c.total}`, 'FECHA DE PAGO': c.fecha_pago, 'MES DE PAGO': L.periodo(c.fecha_pago),
  })).sort((a, b) => a['FECHA DE PAGO'].localeCompare(b['FECHA DE PAGO']));
  const nombre = `mis-deudas-${L.hoyISO()}`;
  try {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const ws = XLSX.utils.json_to_sheet(filas); ws['!cols'] = Object.keys(filas[0] || {}).map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Cuotas');
    XLSX.writeFile(wb, nombre + '.xlsx');
  } catch {
    const cols = Object.keys(filas[0] || {});
    const csv = '﻿' + [cols.join(';'), ...filas.map(f => cols.map(c => `"${String(f[c] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = nombre + '.csv'; a.click();
  }
}

// ===================== Eventos globales =====================
const acciones = {
  tab: (el) => { S.tab = el.dataset.v; render(); window.scrollTo(0, 0); },
  nueva: () => formCompra(null),
  editar: (el) => formCompra(el.dataset.v),
  fijo: (el) => formFijo(el.dataset.v || null),
  mes: (el) => { S.mes = L.sumarPeriodo(S.mes, +el.dataset.v); render(); },
  irmes: (el) => { S.mes = el.dataset.v; render(); },
  irmes2: (el) => { S.mes = el.dataset.v; render(); },
  quien: (el) => { S.vistaQuien = el.dataset.v; render(); },
  abrir: (el) => { const k = el.dataset.v; S.abiertos.has(k) ? S.abiertos.delete(k) : S.abiertos.add(k); render(); },
  copiarmsg: (el) => { const p = personaDe(el.dataset.v); copiar(mensajePersona(p, cargosDelMes(S.mes).filter(c => c.persona.id === p.id))); },
  vgastos: (el) => { S.vistaGastos = el.dataset.v; render(); },
  filtrosincat: () => { S.filtro.categoria = '__sin'; render(); },
  selfijo: (el) => { const k = el.dataset.v; S.seleccionFijos.has(k) ? S.seleccionFijos.delete(k) : S.seleccionFijos.add(k); render(); },
  cancelarfijos: () => cancelarFijosSeleccionados(),
  pagado: (el) => { const e = estadoDe(el.dataset.v, S.mes); guardarEstado(el.dataset.v, { pagado: !e?.pagado }); },
  tarjeta: (el) => formTarjeta(el.dataset.v || null),
  persona: (el) => formPersona(el.dataset.v || null),
  categoria: (el) => formCategoria(el.dataset.v || null),
  autocat: async () => { await autoCategorizar(); render(); },
  quitardia: (el) => { const d = diasAviso().filter(x => x !== +el.dataset.v); guardarAjustes({ dias_aviso: d.length ? d : [0] }); },
  agregardia: () => { const v = prompt('¿Cuántos días antes del pago quieres el aviso? (0 = el mismo día)'); const n = parseInt(v); if (isNaN(n) || n < 0 || n > 60) return; guardarAjustes({ dias_aviso: [...new Set([...diasAviso(), n])] }); },
  activarnoti: () => activarNotificaciones(),
  probarnoti: () => probarNotificacion(),
  validar: (el) => alternarValidado(el.dataset.v),
  validartodos: (el) => validarTodos(el.dataset.v),
  limpiarfiltros: () => { S.filtro = { q: '', persona: '', tarjeta: '', categoria: '', mesPago: '', mesCompra: '', banco: '' }; render(); },
  ingreso: (el) => formIngreso(el.dataset.v || null, el.dataset.per),
  cobro: (el) => formCobro(el.dataset.v, Number(el.dataset.total)),
  simular: () => formSimular(),
  cerrar: () => cerrarHoja(),
  exportar: () => exportar(),
  recargar: async () => { toast('Actualizando…'); await cargarTodo(); toast('Datos actualizados'); },
  salir: async () => { if (!confirm('¿Cerrar sesión en este equipo?')) return; await db.salir(); location.reload(); },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = acciones[el.dataset.act]; if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'imp' && e.target.files[0]) importar(e.target.files[0]); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarHoja(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.sesion && !modoDemo && !$('#sheet-root').innerHTML) cargarTodo();
});

let _rz; window.addEventListener('resize', () => { clearTimeout(_rz); _rz = setTimeout(() => { if (S.tab === 'analisis' && !$('#sheet-root').innerHTML) render(); }, 250); });

iniciar();
