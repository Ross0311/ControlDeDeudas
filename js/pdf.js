// =====================================================================
//  Generador de PDF mínimo (sin librerías): texto, líneas, rectángulos
//  e imágenes JPEG incrustadas. Las imágenes quedan DENTRO del PDF.
// =====================================================================
const enc = (s) => { // texto → bytes WinAnsi (latín-1)
  const out = []; for (const ch of String(s)) { let c = ch.codePointAt(0);
    if (c === 0x2014 || c === 0x2013) c = 0x2d; else if (c === 0x2026) c = 0x85; else if (c === 0x2022) c = 0x95; else if (c === 0x2019) c = 0x27; else if (c > 255) c = 0x3f;
    out.push(c); }
  return out;
};
const esc = (s) => enc(s).map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : String.fromCharCode(c)).join('');
// Anchos aproximados de Helvetica (por 1000 de tamaño)
const W = (s, size, bold) => { let w = 0; for (const ch of String(s)) { const c = ch.charCodeAt(0);
  w += ' ,.:;!|il\'ijtf'.includes(ch) ? 278 : 'mwMW'.includes(ch) ? 833 : /[A-Z]/.test(ch) ? 680 : /[0-9]/.test(ch) ? 556 : c > 127 ? 560 : 520; }
  return w * size / 1000 * (bold ? 1.06 : 1); };

export class PDF {
  constructor() { this.paginas = []; this.imgs = []; this.W = 595.28; this.H = 841.89; this.nueva(); }
  nueva() { this.ops = []; this.paginas.push(this.ops); this.y = 0; return this; }
  // Coordenadas en puntos, origen ARRIBA-izquierda (se convierte internamente)
  texto(x, y, s, { size = 10, bold = false, color = [0.1, 0.13, 0.11], align = 'left', maxW = 0 } = {}) {
    let t = String(s ?? '');
    if (maxW) while (t.length > 1 && W(t, size, bold) > maxW) t = t.slice(0, -2) + '…';
    const w = W(t, size, bold); const xx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${xx.toFixed(2)} ${(this.H - y).toFixed(2)} Td (${esc(t)}) Tj ET`);
    return w;
  }
  ancho(s, size = 10, bold = false) { return W(s, size, bold); }
  /** Texto en varias líneas; devuelve la altura usada */
  parrafo(x, y, s, maxW, opts = {}) {
    const size = opts.size || 10; const lh = size * 1.35; const palabras = String(s).split(/\s+/); let linea = ''; let yy = y;
    for (const p of palabras) { const prueba = linea ? linea + ' ' + p : p; if (W(prueba, size, opts.bold) > maxW && linea) { this.texto(x, yy, linea, opts); yy += lh; linea = p; } else linea = prueba; }
    if (linea) { this.texto(x, yy, linea, opts); yy += lh; }
    return yy - y;
  }
  rect(x, y, w, h, { fill = null, stroke = null, lw = 0.6 } = {}) {
    const r = `${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`;
    if (fill) this.ops.push(`${fill.join(' ')} rg ${r} f`);
    if (stroke) this.ops.push(`${lw} w ${stroke.join(' ')} RG ${r} S`);
  }
  linea(x1, y1, x2, y2, { color = [0.85, 0.85, 0.82], lw = 0.6 } = {}) { this.ops.push(`${lw} w ${color.join(' ')} RG ${x1} ${this.H - y1} m ${x2} ${this.H - y2} l S`); }
  /** jpeg: Uint8Array con los bytes del JPEG; ancho/alto en píxeles */
  imagen(jpeg, pxW, pxH, x, y, w, h) {
    const n = this.imgs.push({ jpeg, pxW, pxH }); const name = 'Im' + n;
    this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} cm /${name} Do Q`);
  }
  /** Devuelve un Blob application/pdf */
  blob() {
    const te = new TextEncoder(); const partes = []; let pos = 0; const offs = [];
    const put = (x) => { const b = typeof x === 'string' ? Uint8Array.from(x, c => c.charCodeAt(0) & 255) : x; partes.push(b); pos += b.length; };
    const obj = (n, cuerpo) => { offs[n] = pos; put(`${n} 0 obj\n`); for (const c of [].concat(cuerpo)) put(c); put('\nendobj\n'); };
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const nP = this.paginas.length; const nI = this.imgs.length;
    // 1 catálogo, 2 páginas, 3-4 fuentes, 5.. imágenes, luego páginas+contenidos
    const imgBase = 5, pagBase = 5 + nI;
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${nP} /Kids [${this.paginas.map((_, i) => `${pagBase + i * 2} 0 R`).join(' ')}] >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.imgs.forEach((im, i) => obj(imgBase + i, [`<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`, im.jpeg, '\nendstream']));
    const xo = this.imgs.map((_, i) => `/Im${i + 1} ${imgBase + i} 0 R`).join(' ');
    this.paginas.forEach((ops, i) => {
      const contenido = ops.join('\n');
      obj(pagBase + i * 2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xo} >> >> /Contents ${pagBase + i * 2 + 1} 0 R >>`);
      obj(pagBase + i * 2 + 1, [`<< /Length ${contenido.length} >>\nstream\n`, contenido, '\nendstream']);
    });
    const total = pagBase + nP * 2; const xref = pos;
    put(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let n = 1; n < total; n++) put(String(offs[n]).padStart(10, '0') + ' 00000 n \n');
    put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(partes, { type: 'application/pdf' });
  }
}

/** Convierte una imagen (Blob/URL) a JPEG: devuelve { bytes, w, h, blob } con lado mayor ≤ max */
export async function aJpeg(fuente, max = 1400, calidad = 0.72) {
  const blob = typeof fuente === 'string' ? await (await fetch(fuente)).blob() : fuente;
  let img; try { img = await createImageBitmap(blob); } catch { img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = URL.createObjectURL(blob); }); }
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
  const out = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', calidad));
  return { blob: out, bytes: new Uint8Array(await out.arrayBuffer()), w, h };
}
