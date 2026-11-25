// ===== Categorías por defecto y reglas automáticas por palabra clave =====
// El orden importa: gana la primera regla que coincide.
export const CATEGORIAS_INICIALES = [
  { clave: 'costos',      nombre: 'Costos de tarjeta',        emoji: '🏦', color: '#495057' },
  { clave: 'suscripcion', nombre: 'Suscripciones',            emoji: '🎬', color: '#7c5cd6' },
  { clave: 'hogar',       nombre: 'Hogar e internet',         emoji: '🏠', color: '#1c7ed6' },
  { clave: 'telefonia',   nombre: 'Telefonía móvil',          emoji: '📱', color: '#15aabf' },
  { clave: 'salud',       nombre: 'Salud',                    emoji: '🩺', color: '#e03131' },
  { clave: 'mascotas',    nombre: 'Mascotas',                 emoji: '🐶', color: '#a0522d' },
  { clave: 'estudios',    nombre: 'Estudios',                 emoji: '🎓', color: '#3b5bdb' },
  { clave: 'pareja',      nombre: 'Salidas en pareja',        emoji: '❤️', color: '#d6336c' },
  { clave: 'transporte',  nombre: 'Transporte y auto',        emoji: '🚗', color: '#f59f00' },
  { clave: 'ropa',        nombre: 'Ropa y calzado',           emoji: '👕', color: '#0ca678' },
  { clave: 'ocio',        nombre: 'Ocio y entretenimiento',   emoji: '🎮', color: '#ae3ec9' },
  { clave: 'super',       nombre: 'Supermercado y minimarket',emoji: '🛒', color: '#2f9e44' },
  { clave: 'comida',      nombre: 'Comida y delivery',        emoji: '🍔', color: '#e8590c' },
  { clave: 'compras',     nombre: 'Compras y regalos',        emoji: '🛍️', color: '#c2255c' },
  { clave: 'prestamos',   nombre: 'Préstamos y efectivo',     emoji: '💸', color: '#5c940d' },
  { clave: 'otros',       nombre: 'Otros',                    emoji: '📦', color: '#868e96' },
];

const REGLAS = [
  ['transporte',  ['uber', 'didi', 'yango', 'taxi', 'rides', 'cabify', 'indriver', 'estacionamiento', 'peaje']],
  ['compras',     ['flores mama', 'regalo mama', 'regalo para']],
  ['costos',      ['degravamen', 'desgravamen', 'comision', 'interes', 'membresia tarjeta', 'seguro de tarjeta', 'cuota de manejo']],
  ['suscripcion', ['netflix', 'apple music', 'cloude', 'claude', 'icloud', 'spotify', 'youtube', 'disney', 'hbo', 'max ', 'prime video', 'rappi membresia', 'rappi prime', 'chatgpt', 'membresia']],
  ['hogar',       ['internet', 'movistar hogar', 'luz del sur', 'enel', 'sedapal', 'sodimac', 'promart', 'balon de gas', 'cable']],
  ['telefonia',   ['movistar', 'celular', 'linea movil', 'claro', 'entel', 'bitel', 'recarga']],
  ['salud',       ['odm', 'dent', 'bracket', 'endodoncia', 'farma', 'boticas', 'paracetamol', 'pastilla', 'chequeo', 'medic', 'lentes', 'clinica', 'ampoy', 'ampoll', 'doctor', 'laboratorio']],
  ['mascotas',    ['noah', 'patitas', 'paatitas', 'veterin', 'petshop', 'mascota']],
  ['estudios',    ['idat', 'matricula', 'curso', 'universidad', 'instituto', 'libro', 'pension']],
  ['pareja',      ['hotel', 'nuestro dia', 'airbnb', 'flores johanna', 'regalo johanna', 'regalo de johanna', 'cita']],
  ['transporte',  ['gasolina', 'grifo', 'aceite auto', 'gas carro', 'estacionamiento', 'peaje', 'uber', 'didi', 'yango', 'taxi', 'rides', 'cabify', 'indriver', 'repsol', 'primax', 'pecsa', 'movilidad']],
  ['ropa',        ['zapatilla', 'pantalon', 'ropa', 'puma', 'adidas', 'nike', 'polo', 'casaca', 'zapato', 'zara']],
  ['ocio',        ['rito games', 'riot', 'games', 'mall aventura', 'cine', 'pelicula', 'salida con', 'karaoke', 'steam', 'playstation', 'concierto', 'entradas']],
  ['super',       ['plaza vea', 'tambo', 'taambo', 'oxxo', 'listo', 'wong', 'tottus', 'metro', 'market', 'mass', 'makro', 'bodega', 'mercado']],
  ['comida',      ['chifa', 'rocky', 'rokys', 'mc donald', 'mcdonald', 'bembos', 'kfc', 'pizza', 'cena', 'almuerzo', 'desayuno', 'rappi', 'pedidos ya', 'makis', 'fu hao', 'fu hau', 'helado', 'pollo', 'comida', 'polleria', 'cevich', 'burger', 'starbucks', 'cafe']],
  ['compras',     ['temu', 'saga', 'ripley', 'aruma', 'regalo', 'aliexpress', 'mercado libre', 'falabella', 'oechsle', 'cositas']],
  ['prestamos',   ['prestamo', 'efectivo', 'disposicion', 'avance', 'retiro']],
];

export const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Devuelve la clave de categoría sugerida o null si no reconoce el texto */
export function sugerirClave(descripcion) {
  const t = ' ' + normalizar(descripcion) + ' ';
  for (const [clave, palabras] of REGLAS) if (palabras.some(p => t.includes(p))) return clave;
  return null;
}
