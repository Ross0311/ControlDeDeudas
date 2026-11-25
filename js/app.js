import { db, uid, modoDemo } from './db.js';
import * as L from './logic.js';

// ===================== Estado =====================
const S = {
  sesion: null,
  tarjetas: [], personas: [], compras: [], cuotas: [], estados: [],
  tab: 'resumen',
  mes: null,
  filtro: { q: '', persona: '', tarjeta: '' },
};

// ===================== Utilidades =====================
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const soles = (n) => 'S/ ' + fmt.format(Number(n) || 0);
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const iniciales = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pref = { get: (k) => { try { return localStorage.getItem('md-' + k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem('md-' + k, v); } catch {} } };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/></svg>',
  left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="color:var(--ink-3)"><path d="M9 5l7 7-7 7"/></svg>',
};
const COLORES = ['#1f9d6b', '#e8590c', '#7c5cd6', '#1c7ed6', '#d6336c', '#f59f00', '#495057', '#0ca678'];

// ===================== Datos por defecto =====================
const TARJETAS_INICIALES = [
  { nombre: 'SAGA FALABELLA (JHONATAN)', banco: 'SAGA FALABELLA', dia_cierre: 15, dia_pago: 8, meses_pago: 1, color: '#1f9d6b', orden: 1 },
  { nombre: 'SAGA FALABELLA (JOHANNA)', banco: 'SAGA FALABELLA', dia_cierre: 15, dia_pago: 8, meses_pago: 1, color: '#7c5cd6', orden: 2 },
  { nombre: 'BCP (JOHANNA)', banco: 'BCP', dia_cierre: 10, dia_pago: 5, meses_pago: 1, color: '#e8590c', orden: 3 },
];
const PERSONAS_INICIALES = ['JHONATAN MORZAN', 'ANGIE MORZAN', 'LUIS MORZAN', 'SILVIA PASCO', 'ELSA BARRIOS', 'CECILIA PASCO', 'JOHANNA IBAÑEZ'];

// ===================== Arranque =====================
async function iniciar() {
  registrarSW();
  try {
    S.sesion = await db.sesion();
  } catch (e) {
    return pantallaError('No se pudo conectar. Revisa tu internet y vuelve a abrir la app.<br><span class="tiny">' + esc(e.message) + '</span>');
  }
  if (!S.sesion) return pantallaLogin();
  await cargarTodo(true);
}

async function cargarTodo(primeraVez = false) {
  try {
    const [t, p, c, q, e] = await Promise.all(['tarjetas', 'personas', 'compras', 'cuotas', 'estados_cuenta'].map(x => db.todo(x)));
    Object.assign(S, { tarjetas: t, personas: p, compras: c, cuotas: q, estados: e });
    if (primeraVez && !t.length && !p.length) await sembrar();
    if (!S.mes) S.mes = mesPorDefecto();
    render();
  } catch (err) {
    pantallaError('Error cargando datos: ' + esc(err.message));
  }
}

async function sembrar() {
  const t = TARJETAS_INICIALES.map(x => ({ id: uid(), activa: true, ...x }));
  const p = PERSONAS_INICIALES.map((n, i) => ({ id: uid(), nombre: n, activa: true, orden: i }));
  await db.insertar('tarjetas', t); await db.insertar('personas', p);
  S.tarjetas = t; S.personas = p;
}

function mesPorDefecto() {
  const hoy = L.hoyISO();
  const futuras = S.cuotas.map(c => c.fecha_pago).filter(f => f >= hoy).sort();
  return futuras.length ? L.periodo(futuras[0]) : L.periodo(hoy);
}

function registrarSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
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
    } catch (e) {
      $('#lerr').textContent = e.message; btn.disabled = false; btn.textContent = 'Entrar';
    }
  };
}

// ===================== Datos derivados =====================
const tarjetaDe = (id) => S.tarjetas.find(t => t.id === id) || { nombre: '¿?', banco: '¿?', color: '#999' };
const personaDe = (id) => S.personas.find(p => p.id === id) || { nombre: '¿?' };
const compraDe = (id) => S.compras.find(c => c.id === id);
const ordenar = (arr) => [...arr].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
const nombreCorto = (n) => n.split(/\s+/)[0];

function cuotasDelMes(per) {
  return S.cuotas.filter(c => L.periodo(c.fecha_pago) === per).map(c => {
    const compra = compraDe(c.compra_id) || {};
    return { ...c, compra, tarjeta: tarjetaDe(compra.tarjeta_id), persona: personaDe(compra.persona_id) };
  });
}
const estadoDe = (banco, per) => S.estados.find(e => e.banco === banco && e.periodo === per);

function deudaPendiente() {
  const mesHoy = L.periodo(L.hoyISO());
  let total = 0;
  for (const c of S.cuotas) {
    const per = L.periodo(c.fecha_pago); if (per < mesHoy) continue;
    const comp = compraDe(c.compra_id); if (!comp) continue;
    const est = estadoDe(tarjetaDe(comp.tarjeta_id).banco, per);
    if (est?.pagado) continue;
    total += Number(c.monto);
  }
  return r2(total);
}

// ===================== Render principal =====================
function render() {
  const tabs = [
    ['resumen', 'Resumen', ICON.home],
    ['movimientos', 'Gastos', ICON.list],
    ['tarjetas', 'Tarjetas', ICON.card],
    ['ajustes', 'Ajustes', ICON.gear],
  ];
  const nav = (t) => `<button class="navbtn ${S.tab === t[0] ? 'on' : ''}" data-act="tab" data-v="${t[0]}">${t[2]}<span>${t[1]}</span></button>`;
  const titulos = { resumen: 'Resumen', movimientos: 'Gastos', tarjetas: 'Tarjetas y personas', ajustes: 'Ajustes' };
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
    case 'movimientos': return vistaMovimientos();
    case 'tarjetas': return vistaTarjetas();
    case 'ajustes': return vistaAjustes();
    default: return vistaResumen();
  }
}

function postRender() {
  const q = $('#q');
  if (q) q.oninput = () => { S.filtro.q = q.value; $('#lista-mov').innerHTML = listaMovimientos(); };
  ['fp', 'ft'].forEach(id => {
    const el = $('#' + id); if (!el) return;
    el.onchange = () => { S.filtro[id === 'fp' ? 'persona' : 'tarjeta'] = el.value; $('#lista-mov').innerHTML = listaMovimientos(); };
  });
  document.querySelectorAll('[data-banco-input]').forEach(inp => {
    inp.onchange = () => guardarEstado(inp.dataset.bancoInput, { monto_banco: inp.value === '' ? null : r2(inp.value) });
  });
}

// ===================== Vista: Resumen =====================
function vistaResumen() {
  const per = S.mes;
  const items = cuotasDelMes(per);
  const total = r2(items.reduce((a, c) => a + Number(c.monto), 0));

  // por banco
  const bancos = {};
  for (const c of items) {
    const b = c.tarjeta.banco;
    bancos[b] ??= { banco: b, monto: 0, fecha: c.fecha_pago, color: c.tarjeta.color };
    bancos[b].monto += Number(c.monto);
    if (c.fecha_pago < bancos[b].fecha) bancos[b].fecha = c.fecha_pago;
  }
  const listaBancos = Object.values(bancos).sort((a, b) => b.monto - a.monto);

  // por persona
  const pers = {};
  for (const c of items) { pers[c.persona.nombre] = (pers[c.persona.nombre] || 0) + Number(c.monto); }
  const listaPers = Object.entries(pers).sort((a, b) => b[1] - a[1]);
  const maxP = listaPers[0]?.[1] || 1;

  // pivote persona x tarjeta
  const tarjs = ordenar(S.tarjetas).filter(t => items.some(c => c.tarjeta.id === t.id));
  const pivot = {};
  for (const c of items) { pivot[c.persona.nombre] ??= {}; pivot[c.persona.nombre][c.tarjeta.id] = (pivot[c.persona.nombre][c.tarjeta.id] || 0) + Number(c.monto); }

  // detalle por tarjeta
  const porTarj = {};
  for (const c of items) { (porTarj[c.tarjeta.id] ??= []).push(c); }

  const hoy = L.hoyISO();
  const pend = deudaPendiente();

  const nav = `
  <div class="monthnav">
    <button data-act="mes" data-v="-1" aria-label="Mes anterior">${ICON.left}</button>
    <div class="m">${capital(L.nombreMes(per))}<span class="tiny">Mes de pago</span></div>
    <button data-act="mes" data-v="1" aria-label="Mes siguiente">${ICON.right}</button>
  </div>`;

  if (!items.length) {
    return nav + `<div class="card empty"><div class="ico">🎉</div><b>Nada que pagar en ${L.nombreMes(per)}</b><p class="tiny">Deuda total pendiente: ${soles(pend)}</p></div>`;
  }

  const hero = `
  <div class="card hero">
    <div class="label">Total a pagar en ${L.nombreMes(per)}</div>
    <div class="big num"><small>S/</small>${fmt.format(total)}</div>
    <div class="chips">
      ${listaBancos.map(b => `<span class="chip">${esc(b.banco)} <b class="num">${soles(b.monto)}</b> · ${L.fechaCorta(b.fecha).slice(0, 5)}</span>`).join('')}
    </div>
    <div class="label" style="margin-top:12px;position:relative;z-index:1">Deuda pendiente desde este mes: <b class="num">${soles(pend)}</b></div>
  </div>`;

  const estado = `
  <div class="card">
    <h3 style="flex-direction:column;align-items:flex-start;gap:2px">Estado de cuenta <span class="tiny">Compara con lo que cobra el banco</span></h3>
    ${listaBancos.map(b => {
      const e = estadoDe(b.banco, per) || {};
      const nuestro = r2(b.monto);
      const dif = e.monto_banco != null ? r2(Number(e.monto_banco) - nuestro) : null;
      const vencido = b.fecha < hoy && !e.pagado;
      const badge = e.pagado ? '<span class="badge ok">Pagado</span>' : vencido ? '<span class="badge bad">Vencido</span>' : `<span class="badge warn">Vence ${L.fechaCorta(b.fecha).slice(0, 5)}</span>`;
      return `<div class="banco">
        <div class="head"><div><b><span class="dot" style="display:inline-block;background:${b.color};margin-right:6px"></span>${esc(b.banco)}</b><div style="margin-top:4px">${badge}</div></div>
          <button class="btn sm ghost" data-act="pagado" data-v="${esc(b.banco)}">${e.pagado ? 'Desmarcar' : 'Marcar pagado'}</button></div>
        <div class="kv">
          <div><div class="k">Nuestro</div><div class="v num">${fmt.format(nuestro)}</div></div>
          <div><div class="k">Banco cobra</div><input class="num" type="number" inputmode="decimal" step="0.01" placeholder="Escribir" data-banco-input="${esc(b.banco)}" value="${e.monto_banco ?? ''}"></div>
          <div><div class="k">Diferencia</div><div class="v num" style="color:${dif == null ? 'var(--ink-3)' : Math.abs(dif) < 0.01 ? 'var(--ok)' : 'var(--danger)'}">${dif == null ? '—' : fmt.format(dif)}</div></div>
        </div></div>`;
    }).join('')}
  </div>`;

  const personas = `
  <div class="card">
    <h3>¿Quién debe cuánto?</h3>
    ${listaPers.map(([n, m]) => `
      <div class="row"><div class="avatar">${esc(iniciales(n))}</div>
        <div class="grow"><div class="t1">${esc(n)}</div><div class="bar"><i style="width:${(m / maxP * 100).toFixed(1)}%"></i></div></div>
        <div class="amt num">${soles(m)}</div></div>`).join('')}
  </div>`;

  const tabla = `
  <div class="card">
    <h3>Persona × tarjeta</h3>
    <div class="tablewrap"><table class="pivot num">
      <thead><tr><th>Persona</th>${tarjs.map(t => `<th>${esc(t.nombre)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${Object.keys(pivot).sort((a, b) => (pers[b] - pers[a])).map(n => `<tr><td>${esc(nombreCorto(n))} ${esc(n.split(/\s+/)[1] || '')}</td>${tarjs.map(t => `<td>${pivot[n][t.id] ? fmt.format(pivot[n][t.id]) : ''}</td>`).join('')}<td><b>${fmt.format(pers[n])}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td>${tarjs.map(t => `<td>${fmt.format(items.filter(c => c.tarjeta.id === t.id).reduce((a, c) => a + Number(c.monto), 0))}</td>`).join('')}<td>${fmt.format(total)}</td></tr></tfoot>
    </table></div>
  </div>`;

  const detalle = tarjs.map(t => {
    const lista = porTarj[t.id].sort((a, b) => (a.compra.fecha_compra || '').localeCompare(b.compra.fecha_compra || ''));
    const sub = lista.reduce((a, c) => a + Number(c.monto), 0);
    return `<div class="group-h"><span>${esc(t.nombre)}</span><span class="num">${soles(sub)}</span></div>
    <div class="card" style="padding-top:6px;padding-bottom:6px">
      ${lista.map(c => `
      <div class="row tap" data-act="editar" data-v="${c.compra_id}">
        <span class="dot" style="background:${t.color}"></span>
        <div class="grow"><div class="t1">${esc(c.compra.descripcion || 'Sin descripción')}</div>
          <div class="t2">${esc(nombreCorto(c.persona.nombre))} · ${L.fechaCorta(c.compra.fecha_compra).slice(0, 5)}${c.total > 1 ? ` · cuota ${c.numero}/${c.total}` : ''}</div></div>
        <div class="amt num">${soles(c.monto)}</div>
      </div>`).join('')}
    </div>`;
  }).join('');

  return nav + hero + `<div class="grid-2">${estado}${personas}</div>` + tabla + `<div class="group-h" style="margin-top:6px"><span>Detalle del mes</span><span>${items.length} cargos</span></div>` + detalle;
}

// ===================== Vista: Movimientos =====================
function vistaMovimientos() {
  const pers = ordenar(S.personas), tarjs = ordenar(S.tarjetas);
  return `
  <div class="search">${ICON.search}<input class="input" id="q" type="search" placeholder="Buscar gasto…" value="${esc(S.filtro.q)}"></div>
  <div class="filters">
    <select class="input" id="fp"><option value="">Todas las personas</option>${pers.map(p => `<option value="${p.id}" ${S.filtro.persona === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
    <select class="input" id="ft"><option value="">Todas las tarjetas</option>${tarjs.map(t => `<option value="${t.id}" ${S.filtro.tarjeta === t.id ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select>
  </div>
  <div id="lista-mov">${listaMovimientos()}</div>`;
}

function listaMovimientos() {
  const q = S.filtro.q.trim().toLowerCase();
  const lista = S.compras.filter(c =>
    (!S.filtro.persona || c.persona_id === S.filtro.persona) &&
    (!S.filtro.tarjeta || c.tarjeta_id === S.filtro.tarjeta) &&
    (!q || (c.descripcion || '').toLowerCase().includes(q) || personaDe(c.persona_id).nombre.toLowerCase().includes(q))
  ).sort((a, b) => b.fecha_compra.localeCompare(a.fecha_compra) || (b.created_at || '').localeCompare(a.created_at || ''));
  if (!lista.length) return `<div class="card empty"><div class="ico">🧾</div><b>Sin gastos</b><p class="tiny">Toca el botón + para registrar uno.</p></div>`;
  const grupos = {};
  for (const c of lista) (grupos[L.periodo(c.fecha_compra)] ??= []).push(c);
  return Object.entries(grupos).map(([per, arr]) => `
    <div class="group-h"><span>Compras de ${L.nombreMes(per)}</span><span class="num">${soles(arr.reduce((a, c) => a + Number(c.monto_total), 0))}</span></div>
    <div class="card" style="padding-top:6px;padding-bottom:6px">
      ${arr.map(c => {
        const t = tarjetaDe(c.tarjeta_id);
        const info = c.num_cuotas > 1 ? `${c.num_cuotas} cuotas · 1ª ${L.fechaCorta(c.primera_fecha_pago).slice(0, 5)}` : c.cuota_ref ? `cuota ${c.cuota_ref} · paga ${L.fechaCorta(c.primera_fecha_pago).slice(0, 5)}` : `paga ${L.fechaCorta(c.primera_fecha_pago)}`;
        return `<div class="row tap" data-act="editar" data-v="${c.id}">
          <span class="dot" style="background:${t.color}"></span>
          <div class="grow"><div class="t1">${esc(c.descripcion || 'Sin descripción')}</div>
            <div class="t2">${L.fechaCorta(c.fecha_compra).slice(0, 5)} · ${esc(nombreCorto(personaDe(c.persona_id).nombre))} · ${esc(t.nombre)}</div>
            <div class="t2">${info}</div></div>
          <div class="amt num">${soles(c.monto_total)}</div></div>`;
      }).join('')}
    </div>`).join('');
}

// ===================== Vista: Tarjetas y personas =====================
function textoCiclo(t) {
  const ini = t.dia_cierre >= 28 ? 1 : t.dia_cierre + 1;
  const cuando = ['el mismo mes del cierre', 'el mes siguiente', 'dos meses después'][t.meses_pago ?? 1];
  return `Ciclo del ${ini} al ${t.dia_cierre} · paga el ${t.dia_pago}, ${cuando}`;
}

function vistaTarjetas() {
  const tarjs = ordenar(S.tarjetas), pers = ordenar(S.personas);
  return `
  <div class="grid-2">
  <div class="card">
    <h3>Tarjetas <button class="btn sm ghost" data-act="tarjeta" data-v="">+ Agregar</button></h3>
    ${tarjs.map(t => `
      <button class="settings-item" data-act="tarjeta" data-v="${t.id}">
        <span class="dot" style="background:${t.color};width:14px;height:14px"></span>
        <span class="grow"><b>${esc(t.nombre)}</b> ${t.activa ? '' : '<span class="badge">Inactiva</span>'}<br><span class="tiny">${esc(t.banco)} · ${textoCiclo(t)}</span></span>${ICON.chev}
      </button>`).join('') || '<p class="tiny">Aún no tienes tarjetas.</p>'}
  </div>
  <div class="card">
    <h3>Personas <button class="btn sm ghost" data-act="persona" data-v="">+ Agregar</button></h3>
    ${pers.map(p => `
      <button class="settings-item" data-act="persona" data-v="${p.id}">
        <span class="avatar">${esc(iniciales(p.nombre))}</span>
        <span class="grow"><b>${esc(p.nombre)}</b> ${p.activa ? '' : '<span class="badge">Inactiva</span>'}</span>${ICON.chev}
      </button>`).join('')}
  </div>
  </div>`;
}

// ===================== Vista: Ajustes =====================
function vistaAjustes() {
  const importados = S.compras.filter(c => c.importado).length;
  return `
  <div class="card">
    <h3>Mis datos</h3>
    <button class="settings-item" data-act="exportar"><span class="grow"><b>Exportar a Excel</b><br><span class="tiny">Descarga todas las cuotas en un archivo .xlsx</span></span>${ICON.chev}</button>
    <label class="settings-item" style="cursor:pointer"><span class="grow"><b>Importar historial</b><br><span class="tiny">${importados ? `Ya importaste ${importados} registros` : 'Sube el archivo historial_deudas.json'}</span></span>${ICON.chev}
      <input type="file" accept=".json,application/json" id="imp" class="hidden"></label>
  </div>
  <div class="card">
    <h3>Instalar en el celular</h3>
    <p class="tiny" style="line-height:1.6;margin:0">iPhone: abre esta página en <b>Safari</b> → botón Compartir → <b>Agregar a pantalla de inicio</b>. La primera vez inicia sesión dentro de la app instalada y ya queda guardada.</p>
  </div>
  <div class="card">
    <h3>Cuenta</h3>
    <div class="settings-item"><span class="grow">${esc(S.sesion?.user?.email || '')}<br><span class="tiny">${modoDemo ? 'Modo demo (sin Supabase)' : 'Conectado a Supabase'} · ${S.compras.length} gastos · ${S.cuotas.length} cuotas</span></span></div>
    <button class="btn ghost" data-act="recargar" style="margin:6px 0 10px">Actualizar datos</button>
    <button class="btn danger" data-act="salir">Cerrar sesión</button>
  </div>`;
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

// ===================== Formulario de compra =====================
function formCompra(id) {
  const c = id ? compraDe(id) : null;
  const tarjs = ordenar(S.tarjetas).filter(t => t.activa || t.id === c?.tarjeta_id);
  const pers = ordenar(S.personas).filter(p => p.activa || p.id === c?.persona_id);
  const F = {
    monto: c ? c.monto_total : '',
    modo: 'total',
    descripcion: c?.descripcion || '',
    persona_id: c?.persona_id || (pers.find(p => p.id === pref.get('persona')) || pers[0])?.id,
    tarjeta_id: c?.tarjeta_id || (tarjs.find(t => t.id === pref.get('tarjeta')) || tarjs[0])?.id,
    fecha_compra: c?.fecha_compra || L.hoyISO(),
    num_cuotas: c?.num_cuotas || 1,
    manual: c?.pago_manual || false,
    fecha_manual: c?.primera_fecha_pago || '',
  };
  if (!tarjs.length || !pers.length) { toast('Primero agrega una tarjeta y una persona'); S.tab = 'tarjetas'; render(); return; }

  const html = `
  <div class="field"><label>Monto</label>
    <div class="money"><span>S/</span><input class="input num" id="c-monto" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${F.monto}"></div>
  </div>
  <div class="field"><label for="c-desc">Descripción</label><input class="input" id="c-desc" placeholder="¿En qué se gastó?" value="${esc(F.descripcion)}" autocomplete="off" list="dl-desc">
    <datalist id="dl-desc">${[...new Set(S.compras.map(x => x.descripcion).filter(Boolean))].slice(0, 200).map(d => `<option value="${esc(d)}">`).join('')}</datalist></div>
  <div class="field"><span class="lbl">¿Quién usó la tarjeta?</span><div class="chips-sel" id="c-pers">
    ${pers.map(p => `<button type="button" class="chip-sel ${p.id === F.persona_id ? 'on' : ''}" data-id="${p.id}">${esc(nombreCorto(p.nombre))} ${esc(p.nombre.split(/\s+/)[1]?.[0] || '')}</button>`).join('')}
    <button type="button" class="chip-sel add" id="c-addp">+ Nueva</button></div></div>
  <div class="field"><span class="lbl">Tarjeta</span><div class="chips-sel" id="c-tarj">
    ${tarjs.map(t => `<button type="button" class="chip-sel ${t.id === F.tarjeta_id ? 'on' : ''}" data-id="${t.id}"><span class="dot" style="background:${t.color}"></span>${esc(t.nombre)}</button>`).join('')}
  </div></div>
  <div class="two">
    <div class="field"><label for="c-fecha">Fecha de compra</label><input class="input" id="c-fecha" type="date" value="${F.fecha_compra}"></div>
    <div class="field"><span class="lbl">Cuotas</span><div class="stepper"><button type="button" id="c-menos">−</button><input id="c-cuotas" class="num" type="number" inputmode="numeric" min="1" max="60" value="${F.num_cuotas}"><button type="button" id="c-mas">+</button></div></div>
  </div>
  <div class="field ${F.num_cuotas > 1 ? '' : 'hidden'}" id="c-modo-w"><div class="seg" id="c-modo"><button type="button" data-m="total" class="on">El monto es el total</button><button type="button" data-m="cuota">El monto es por cuota</button></div></div>
  <div class="switch"><div><b style="font-size:14px">Cambiar fecha del primer pago</b><div class="tiny">Solo si el banco lo facturó en otro mes</div></div><button type="button" class="toggle ${F.manual ? 'on' : ''}" id="c-man" aria-label="Fecha manual"></button></div>
  <div class="field ${F.manual ? '' : 'hidden'}" id="c-fman-w"><label for="c-fman">Primer pago</label><input class="input" id="c-fman" type="date" value="${F.fecha_manual}"></div>
  <div class="preview" id="c-prev"></div>
  <div class="err" id="c-err"></div>
  <button class="btn" id="c-save">${c ? 'Guardar cambios' : 'Guardar gasto'}</button>
  ${c ? `<button class="btn danger" id="c-del" style="margin-top:10px">Eliminar gasto</button>` : ''}
  ${c?.importado ? '<p class="tiny" style="text-align:center">Registro importado del Excel antiguo</p>' : ''}`;

  abrirHoja(c ? 'Editar gasto' : 'Nuevo gasto', html, (sh) => {
    const val = () => {
      F.monto = $('#c-monto', sh).value; F.descripcion = $('#c-desc', sh).value;
      F.fecha_compra = $('#c-fecha', sh).value; F.num_cuotas = Math.min(60, Math.max(1, parseInt($('#c-cuotas', sh).value) || 1));
      F.fecha_manual = $('#c-fman', sh).value;
    };
    const plan = () => {
      const t = tarjetaDe(F.tarjeta_id);
      if (!F.fecha_compra) return null;
      const ciclo = L.calcularCiclo(F.fecha_compra, t);
      const usarManual = F.manual && F.fecha_manual;
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
      $('#c-modo-w', sh).classList.toggle('hidden', F.num_cuotas <= 1);
      const p = plan(); const prev = $('#c-prev', sh);
      if (!p) { prev.innerHTML = '<div class="why">Elige la fecha de compra.</div>'; return; }
      const why = p.usarManual
        ? `Primer pago puesto a mano: <b>${L.fechaHumana(p.primera)}</b>.`
        : `Compra del <b>${L.fechaHumana(F.fecha_compra)}</b> → entra al ciclo <b>${L.fechaCorta(p.ciclo.inicio).slice(0, 5)} al ${L.fechaCorta(p.ciclo.cierre).slice(0, 5)}</b> de ${esc(p.t.nombre)} → se paga el <b>${L.fechaHumana(p.ciclo.primerPago)}</b>.`;
      const lista = p.cuotas.length > 6 ? [...p.cuotas.slice(0, 4), null, p.cuotas[p.cuotas.length - 1]] : p.cuotas;
      prev.innerHTML = `<div class="why">${why}</div>` + lista.map(q => q ? `<div class="cq"><span>${q.total > 1 ? `Cuota ${q.numero}/${q.total}` : 'Pago único'} · ${L.fechaCorta(q.fecha_pago)}</span><b class="num">${soles(q.monto)}</b></div>` : '<div class="cq"><span>…</span><span></span></div>').join('')
        + (p.cuotas.length > 1 ? `<div class="cq"><span>Total</span><b class="num">${soles(p.total)}</b></div>` : '');
    };
    sh.querySelectorAll('input').forEach(i => i.addEventListener('input', pintar));
    $('#c-pers', sh).onclick = (e) => { const b = e.target.closest('[data-id]'); if (!b) return; F.persona_id = b.dataset.id; sh.querySelectorAll('#c-pers [data-id]').forEach(x => x.classList.toggle('on', x === b)); };
    $('#c-tarj', sh).onclick = (e) => { const b = e.target.closest('[data-id]'); if (!b) return; F.tarjeta_id = b.dataset.id; sh.querySelectorAll('#c-tarj [data-id]').forEach(x => x.classList.toggle('on', x === b)); pintar(); };
    $('#c-addp', sh).onclick = async () => {
      const n = prompt('Nombre de la persona'); if (!n?.trim()) return;
      const p = { id: uid(), nombre: n.trim().toUpperCase(), activa: true, orden: S.personas.length };
      try { await db.insertar('personas', p); S.personas.push(p); F.persona_id = p.id;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-sel on'; b.dataset.id = p.id; b.textContent = nombreCorto(p.nombre);
        sh.querySelectorAll('#c-pers [data-id]').forEach(x => x.classList.remove('on')); $('#c-addp', sh).before(b);
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
    $('#c-save', sh).onclick = async () => {
      val(); const p = plan(); const err = $('#c-err', sh);
      if (!(r2(F.monto) > 0)) { err.textContent = 'Ingresa un monto mayor a 0'; return; }
      if (!F.fecha_compra) { err.textContent = 'Falta la fecha de compra'; return; }
      const btn = $('#c-save', sh); btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await guardarCompra(c, F, p);
        pref.set('persona', F.persona_id); pref.set('tarjeta', F.tarjeta_id);
        cerrarHoja(); toast(c ? 'Cambios guardados' : 'Gasto guardado ✓');
        if (!c) S.mes = L.periodo(p.cuotas[0].fecha_pago);
        render();
      } catch (e) { err.textContent = 'No se pudo guardar: ' + e.message; btn.disabled = false; btn.textContent = 'Reintentar'; }
    };
    if (c) $('#c-del', sh).onclick = async () => {
      if (!confirm('¿Eliminar este gasto y todas sus cuotas?')) return;
      try { await db.borrar('compras', c.id); S.compras = S.compras.filter(x => x.id !== c.id); S.cuotas = S.cuotas.filter(q => q.compra_id !== c.id); if (modoDemo) await db.borrarDonde('cuotas', 'compra_id', c.id);
        cerrarHoja(); toast('Gasto eliminado'); render(); } catch (e) { toast('Error: ' + e.message); }
    };
    pintar();
    if (!c) setTimeout(() => $('#c-monto', sh)?.focus(), 300);
  });
}

async function guardarCompra(c, F, p) {
  const ahora = new Date().toISOString();
  const datos = {
    persona_id: F.persona_id, tarjeta_id: F.tarjeta_id, descripcion: F.descripcion.trim(),
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
    await db.insertar('compras', nueva);
    S.compras.push(nueva);
  }
  await db.insertar('cuotas', cuotas);
  S.cuotas.push(...cuotas);
}

// ===================== Formulario tarjeta =====================
function formTarjeta(id) {
  const t = id ? S.tarjetas.find(x => x.id === id) : null;
  const F = t ? { ...t } : { nombre: '', banco: '', dia_cierre: 15, dia_pago: 5, meses_pago: 1, color: COLORES[S.tarjetas.length % COLORES.length], activa: true };
  const bancos = [...new Set(S.tarjetas.map(x => x.banco))];
  const enUso = t && S.compras.some(c => c.tarjeta_id === t.id);
  const html = `
  <div class="field"><label>Nombre de la tarjeta</label><input class="input" id="t-nom" placeholder="Ej. SAGA FALABELLA (JHONATAN)" value="${esc(F.nombre)}"></div>
  <div class="field"><label>Banco donde se paga</label><input class="input" id="t-banco" list="dl-b" placeholder="Ej. SAGA FALABELLA" value="${esc(F.banco)}"><datalist id="dl-b">${bancos.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
  <div class="two">
    <div class="field"><label>Día de cierre</label><input class="input num" id="t-cierre" type="number" inputmode="numeric" min="1" max="31" value="${F.dia_cierre}"></div>
    <div class="field"><label>Día de pago</label><input class="input num" id="t-pago" type="number" inputmode="numeric" min="1" max="31" value="${F.dia_pago}"></div>
  </div>
  <div class="field"><span class="lbl">El pago cae…</span><div class="seg" id="t-mp">
    ${['Mismo mes del cierre', 'Mes siguiente', '2 meses después'].map((x, i) => `<button type="button" data-v="${i}" class="${F.meses_pago == i ? 'on' : ''}">${x}</button>`).join('')}</div></div>
  <div class="preview"><div class="why" id="t-prev"></div></div>
  <div class="field"><span class="lbl">Color</span><div class="colors" id="t-col">${COLORES.map(c => `<button type="button" data-c="${c}" class="${c === F.color ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
  <div class="switch"><b style="font-size:14px">Tarjeta activa</b><button type="button" class="toggle ${F.activa ? 'on' : ''}" id="t-act"></button></div>
  <div class="err" id="t-err"></div>
  <button class="btn" id="t-save">Guardar tarjeta</button>
  ${t ? `<button class="btn danger" id="t-del" style="margin-top:10px">${enUso ? 'No se puede eliminar (tiene gastos) · desactívala' : 'Eliminar tarjeta'}</button>` : ''}
  <p class="tiny" style="line-height:1.5">Los cambios de ciclo se aplican a los gastos nuevos o a los que vuelvas a guardar.</p>`;
  abrirHoja(t ? 'Editar tarjeta' : 'Nueva tarjeta', html, (sh) => {
    const leer = () => { F.nombre = $('#t-nom', sh).value.trim().toUpperCase(); F.banco = $('#t-banco', sh).value.trim().toUpperCase(); F.dia_cierre = parseInt($('#t-cierre', sh).value) || 1; F.dia_pago = parseInt($('#t-pago', sh).value) || 1; };
    const prev = () => {
      leer(); const d = Math.min(31, Math.max(1, F.dia_cierre));
      const hoy = L.hoyISO(); const ej = L.calcularCiclo(hoy, { ...F, dia_cierre: d, dia_pago: Math.min(31, Math.max(1, F.dia_pago)) });
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
      const datos = { nombre: F.nombre, banco: F.banco, dia_cierre: F.dia_cierre, dia_pago: F.dia_pago, meses_pago: F.meses_pago, color: F.color, activa: F.activa };
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
  const enUso = p && S.compras.some(c => c.persona_id === p.id);
  abrirHoja(p ? 'Editar persona' : 'Nueva persona', `
    <div class="field"><label>Nombre</label><input class="input" id="p-nom" value="${esc(p?.nombre || '')}" placeholder="Ej. ANGIE MORZAN"></div>
    <div class="switch"><b style="font-size:14px">Aparece en el formulario</b><button type="button" class="toggle ${activa ? 'on' : ''}" id="p-act"></button></div>
    <div class="err" id="p-err"></div>
    <button class="btn" id="p-save">Guardar</button>
    ${p ? `<button class="btn danger" id="p-del" style="margin-top:10px">${enUso ? 'Tiene gastos · desactívala' : 'Eliminar persona'}</button>` : ''}`, (sh) => {
    $('#p-act', sh).onclick = (e) => { activa = !activa; e.currentTarget.classList.toggle('on', activa); };
    $('#p-save', sh).onclick = async () => {
      const nombre = $('#p-nom', sh).value.trim().toUpperCase(); if (!nombre) { $('#p-err', sh).textContent = 'Escribe un nombre'; return; }
      try {
        if (p) { await db.actualizar('personas', p.id, { nombre, activa }); Object.assign(p, { nombre, activa }); }
        else { const n = { id: uid(), nombre, activa, orden: S.personas.length }; await db.insertar('personas', n); S.personas.push(n); }
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

// ===================== Estado de cuenta =====================
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
      compras.push({ id, persona_id: pmap[norm(r.persona)], tarjeta_id: tmap[norm(r.tarjeta)], descripcion: r.descripcion, monto_total: r2(r.monto), num_cuotas: 1,
        fecha_compra: r.fecha_compra, primera_fecha_pago: r.fecha_pago, pago_manual: true, importado: true,
        cuota_ref: r.cuota_total > 1 ? `${r.cuota_numero}/${r.cuota_total}` : null, created_at: r.creado ? new Date(r.creado).toISOString() : new Date().toISOString(), updated_at: new Date().toISOString() });
      cuotas.push({ id: uid(), compra_id: id, numero: r.cuota_numero || 1, total: r.cuota_total || 1, monto: r2(r.monto), fecha_pago: r.fecha_pago });
    }
    await db.insertar('compras', compras); S.compras.push(...compras);
    await db.insertar('cuotas', cuotas); S.cuotas.push(...cuotas);
    S.mes = mesPorDefecto();
    toast(`Listo: ${compras.length} registros importados`); render();
  } catch (e) { toast('Error importando: ' + e.message); }
}

async function exportar() {
  const filas = S.cuotas.map(q => {
    const c = compraDe(q.compra_id) || {}; const t = tarjetaDe(c.tarjeta_id);
    return {
      'FECHA DE COMPRA': c.fecha_compra, 'PERSONA QUE USA LA TARJETA': personaDe(c.persona_id).nombre, 'QUE TARJETA USO?': t.nombre,
      'BANCO DONDE SE PAGA': t.banco, 'DESCRIPCION': c.descripcion, 'MONTO CUOTA': Number(q.monto), 'CUOTA': `${q.numero}/${q.total}`,
      'FECHA DE PAGO': q.fecha_pago, 'MES DE PAGO': L.periodo(q.fecha_pago), 'MONTO TOTAL COMPRA': Number(c.monto_total),
    };
  }).sort((a, b) => (a['FECHA DE PAGO'] || '').localeCompare(b['FECHA DE PAGO'] || ''));
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
  mes: (el) => { S.mes = L.sumarPeriodo(S.mes, +el.dataset.v); render(); },
  pagado: (el) => { const e = estadoDe(el.dataset.v, S.mes); guardarEstado(el.dataset.v, { pagado: !e?.pagado }); },
  tarjeta: (el) => formTarjeta(el.dataset.v || null),
  persona: (el) => formPersona(el.dataset.v || null),
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
// Al volver a la app después de un rato, refresca los datos
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.sesion && !modoDemo && !$('#sheet-root').innerHTML) cargarTodo();
});

iniciar();
