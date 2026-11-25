// ===== Lógica de ciclos de facturación y cuotas =====
// Las fechas se manejan como texto 'YYYY-MM-DD' para evitar problemas de zona horaria.

export const pad = (n) => String(n).padStart(2, '0');
export const diasDelMes = (y, m) => new Date(y, m, 0).getDate(); // m: 1-12

export function partes(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return { y, m, d };
}
export function armar(y, m, d) {
  // normaliza meses fuera de rango (ej. m=13 -> enero del año siguiente)
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  const dd = Math.min(d, diasDelMes(y, m));
  return `${y}-${pad(m)}-${pad(dd)}`;
}
export function sumarMeses(fecha, k, diaPreferido) {
  const { y, m, d } = partes(fecha);
  return armar(y, m + k, diaPreferido ?? d);
}
export const periodo = (fecha) => fecha.slice(0, 7); // 'YYYY-MM'

/**
 * Calcula el ciclo en el que entra una compra.
 * tarjeta: { dia_cierre, dia_pago, meses_pago }
 *  - dia_cierre: último día del ciclo (ej. 15 => ciclo del 16 al 15)
 *  - meses_pago: cuántos meses después del cierre se paga (normalmente 1)
 */
export function calcularCiclo(fechaCompra, tarjeta) {
  const { y, m, d } = partes(fechaCompra);
  const cierreEsteMes = Math.min(tarjeta.dia_cierre, diasDelMes(y, m));
  const mesCierre = d <= cierreEsteMes ? m : m + 1;
  const cierre = armar(y, mesCierre, tarjeta.dia_cierre);
  const inicio = sumarMeses(cierre, -1, tarjeta.dia_cierre);
  const pc = partes(cierre);
  const primerPago = armar(pc.y, pc.m + Number(tarjeta.meses_pago ?? 1), tarjeta.dia_pago);
  return { inicio: sumarDias(inicio, 1), cierre, primerPago };
}

export function sumarDias(fecha, n) {
  const { y, m, d } = partes(fecha);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Genera el cronograma de cuotas.
 * opts: { montoTotal, numCuotas, primeraFechaPago, diaPago }
 */
export function cronograma({ montoTotal, numCuotas, primeraFechaPago, diaPago }) {
  const n = Math.max(1, parseInt(numCuotas) || 1);
  const total = r2(Number(montoTotal) || 0);
  const base = Math.floor((total / n) * 100) / 100;
  const dia = diaPago ?? partes(primeraFechaPago).d;
  const out = [];
  for (let i = 0; i < n; i++) {
    const monto = i === n - 1 ? r2(total - base * (n - 1)) : base;
    out.push({ numero: i + 1, total: n, monto, fecha_pago: sumarMeses(primeraFechaPago, i, dia) });
  }
  return out;
}

export function hoyISO() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export const nombreMes = (per) => { const [y, m] = per.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
export const fechaCorta = (f) => { if (!f) return ''; const { y, m, d } = partes(f); return `${pad(d)}/${pad(m)}/${y}`; };
export const fechaHumana = (f) => { const { y, m, d } = partes(f); return `${d} de ${MESES[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`; };
export const sumarPeriodo = (per, k) => sumarMeses(per + '-01', k, 1).slice(0, 7);
