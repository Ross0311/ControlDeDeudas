// ===== Capa de datos: Supabase (real) o localStorage (modo demo) =====
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const TABLAS = ['tarjetas', 'personas', 'compras', 'cuotas', 'estados_cuenta', 'categorias', 'fijos', 'ajustes'];
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  }));

export const modoDemo = !SUPABASE_URL || !SUPABASE_KEY;

// ---------------- Supabase ----------------
let sb = null;
async function cliente() {
  if (sb) return sb;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mis-deudas-sesion' }
  });
  return sb;
}
const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

const remoto = {
  async sesion() { const c = await cliente(); const { data } = await c.auth.getSession(); return data.session; },
  async entrar(email, password) {
    const c = await cliente();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
    return data.session;
  },
  async salir() { const c = await cliente(); await c.auth.signOut(); },
  async todo(tabla) {
    const c = await cliente(); const filas = []; const paso = 1000;
    for (let i = 0; ; i += paso) {
      const d = chk(await c.from(tabla).select('*').range(i, i + paso - 1));
      filas.push(...d); if (d.length < paso) break;
    }
    return filas;
  },
  async insertar(tabla, filas) {
    const c = await cliente(); const arr = Array.isArray(filas) ? filas : [filas];
    for (let i = 0; i < arr.length; i += 500) chk(await c.from(tabla).insert(arr.slice(i, i + 500)));
  },
  async actualizar(tabla, id, cambios) { const c = await cliente(); chk(await c.from(tabla).update(cambios).eq('id', id)); },
  async borrar(tabla, id) { const c = await cliente(); chk(await c.from(tabla).delete().eq('id', id)); },
  async borrarDonde(tabla, col, val) { const c = await cliente(); chk(await c.from(tabla).delete().eq(col, val)); },
  async actualizarVarios(tabla, ids, cambios) { const c = await cliente(); for (let i = 0; i < ids.length; i += 200) chk(await c.from(tabla).update(cambios).in('id', ids.slice(i, i + 200))); },
  async borrarVarios(tabla, ids) { const c = await cliente(); for (let i = 0; i < ids.length; i += 200) chk(await c.from(tabla).delete().in('id', ids.slice(i, i + 200))); },
  async upsert(tabla, fila, conflicto) { const c = await cliente(); chk(await c.from(tabla).upsert(fila, { onConflict: conflicto })); },
  async invocar(fn, body) {
    const c = await cliente(); const { data, error } = await c.functions.invoke(fn, { body });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch {} throw new Error(m); }
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// ---------------- Demo local ----------------
const KEY = 'mis-deudas-demo';
const leer = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const guardar = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
const local = {
  async sesion() { return leer()._sesion || null; },
  async entrar(email) { const s = leer(); s._sesion = { user: { email: email || 'demo@local' } }; guardar(s); return s._sesion; },
  async salir() { const s = leer(); delete s._sesion; guardar(s); },
  async todo(t) { return (leer()[t] || []).map(x => ({ ...x })); },
  async insertar(t, filas) { const s = leer(); s[t] = [...(s[t] || []), ...(Array.isArray(filas) ? filas : [filas])]; guardar(s); },
  async actualizar(t, id, c) { const s = leer(); s[t] = (s[t] || []).map(x => x.id === id ? { ...x, ...c } : x); guardar(s); },
  async borrar(t, id) { const s = leer(); s[t] = (s[t] || []).filter(x => x.id !== id); guardar(s); },
  async borrarDonde(t, col, val) { const s = leer(); s[t] = (s[t] || []).filter(x => x[col] !== val); guardar(s); },
  async actualizarVarios(t, ids, c) { const s = leer(); const set = new Set(ids); s[t] = (s[t] || []).map(x => set.has(x.id) ? { ...x, ...c } : x); guardar(s); },
  async borrarVarios(t, ids) { const s = leer(); const set = new Set(ids); s[t] = (s[t] || []).filter(x => !set.has(x.id)); guardar(s); },
  async invocar() { throw new Error('Disponible solo con Supabase conectado'); },
  async upsert(t, fila, conflicto) {
    const s = leer(); const cols = conflicto.split(',').filter(c => c !== 'user_id'); const arr = s[t] || [];
    const i = arr.findIndex(x => cols.every(c => x[c] === fila[c]));
    if (i >= 0) arr[i] = { ...arr[i], ...fila }; else arr.push({ id: uid(), ...fila });
    s[t] = arr; guardar(s);
  },
};

export const db = modoDemo ? local : remoto;
