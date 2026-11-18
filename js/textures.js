// Texturas procedurales generadas con <canvas> (sin descargar imágenes)
import * as THREE from 'three';

let maxAniso = 8;
export function setMaxAnisotropy(v) { maxAniso = v; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// Pseudoaleatorio determinista
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(ctx, w, h, amount, seed, count = (w * h) / 6) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const v = (r() - 0.5) * amount;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

// Grama sintética con franjas y demarcación de fútbol 7 / fútbol 5
const SURFACES = {
  green: { base: '#2f7d32', a: '#2a7330', b: '#348838', out: '#2f7d32' },
  dark: { base: '#1f3a26', a: '#1b3322', b: '#24432c', out: '#1c3523' },
  blue: { base: '#1d4fa8', a: '#1b489a', b: '#2157b5', out: '#2d6b3a' },
};
export function turfTexture(w, d, format = 'F7', runoff = 2, surface = 'green') {
  const S = SURFACES[surface] || SURFACES.green;
  const ppm = 16;
  const W = Math.round((w + runoff * 2) * ppm);
  const H = Math.round((d + runoff * 2) * ppm);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = S.out;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = S.base;
  ctx.fillRect(runoff * ppm, runoff * ppm, w * ppm, d * ppm);
  const stripes = format === 'F5' ? 8 : 12;
  const sw = (w * ppm) / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? S.a : S.b;
    ctx.fillRect(runoff * ppm + i * sw, surface === 'blue' ? runoff * ppm : 0, sw + 1, surface === 'blue' ? d * ppm : H);
  }
  noise(ctx, W, H, 0.12, 7);
  // líneas
  const ox = runoff * ppm, oy = runoff * ppm, fw = w * ppm, fd = d * ppm;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 0.12 * ppm;
  ctx.strokeRect(ox, oy, fw, fd);
  ctx.beginPath(); ctx.moveTo(ox + fw / 2, oy); ctx.lineTo(ox + fw / 2, oy + fd); ctx.stroke();
  const rc = (format === 'F5' ? 3 : 6) * ppm;
  ctx.beginPath(); ctx.arc(ox + fw / 2, oy + fd / 2, rc, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ox + fw / 2, oy + fd / 2, 0.25 * ppm, 0, Math.PI * 2); ctx.fill();
  const aw = (format === 'F5' ? 12 : 16) * ppm, ad = (format === 'F5' ? 5 : 7) * ppm;
  const spot = (format === 'F5' ? 6 : 9) * ppm;
  for (const side of [0, 1]) {
    const x = side ? ox + fw - ad : ox;
    ctx.strokeRect(x, oy + fd / 2 - aw / 2, ad, aw);
    const sx = side ? ox + fw - spot : ox + spot;
    ctx.beginPath(); ctx.arc(sx, oy + fd / 2, 0.2 * ppm, 0, Math.PI * 2); ctx.fill();
  }
  // esquinas
  for (const [cx, cy, a0] of [[ox, oy, 0], [ox + fw, oy, Math.PI / 2], [ox + fw, oy + fd, Math.PI], [ox, oy + fd, -Math.PI / 2]]) {
    ctx.beginPath(); ctx.arc(cx, cy, 0.8 * ppm, a0, a0 + Math.PI / 2); ctx.stroke();
  }
  return tex(c);
}

// Malla de red (se repite cada metro)
let _net;
export function netTexture() {
  if (_net) return _net;
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(20,20,20,1)';
  ctx.lineWidth = 2.2;
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * 128;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(128, p); ctx.stroke();
  }
  _net = tex(c, { repeat: true });
  return _net;
}

// Asfalto con puestos de estacionamiento
export function parkingTexture(w, d, bands) {
  const ppm = 12;
  const W = Math.round(w * ppm), H = Math.round(d * ppm);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3b3c3f';
  ctx.fillRect(0, 0, W, H);
  noise(ctx, W, H, 0.18, 3);
  ctx.strokeStyle = 'rgba(245,245,240,0.9)';
  ctx.lineWidth = 0.12 * ppm;
  for (const [z0, z1, stall] of bands) {
    const y0 = (z0 + d / 2) * ppm, y1 = (z1 + d / 2) * ppm;
    const n = Math.floor((w - 2) / stall);
    const start = (w - n * stall) / 2;
    for (let i = 0; i <= n; i++) {
      const x = (start + i * stall) * ppm;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    }
  }
  // flechas de circulación
  ctx.fillStyle = 'rgba(245,245,240,0.8)';
  ctx.font = `${2 * ppm}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('➜', W * 0.3, H * 0.86);
  ctx.fillText('➜', W * 0.7, H * 0.86);
  // borde amarillo
  ctx.strokeStyle = '#e8c21a';
  ctx.lineWidth = 0.3 * ppm;
  ctx.strokeRect(0, 0, W, H);
  return tex(c);
}

let _grass;
export function grassTexture() {
  if (_grass) return _grass;
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5d8a3a';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 0.22, 11, 9000);
  _grass = tex(c, { repeat: true });
  return _grass;
}

let _pavers;
export function paversTexture() {
  if (_pavers) return _pavers;
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#cfc6b5';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(5);
  const s = 32;
  for (let y = 0; y < 256; y += s) {
    for (let x = 0; x < 256; x += s) {
      const v = 190 + r() * 30;
      ctx.fillStyle = `rgb(${v + 12},${v + 4},${v - 10})`;
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    }
  }
  noise(ctx, 256, 256, 0.1, 9, 5000);
  _pavers = tex(c, { repeat: true });
  return _pavers;
}

let _wood;
export function woodTexture() {
  if (_wood) return _wood;
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  const r = rng(21);
  for (let y = 0; y < 256; y += 16) {
    const v = 120 + r() * 40;
    ctx.fillStyle = `rgb(${v + 40},${v},${v - 40})`;
    ctx.fillRect(0, y, 256, 15);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + 15, 256, 1);
  }
  noise(ctx, 256, 256, 0.15, 4, 4000);
  _wood = tex(c, { repeat: true });
  return _wood;
}

// Texto sobre un lienzo (letreros)
export function textTexture(text, { width = 1024, height = 256, color = '#d4af37', bg = 'rgba(0,0,0,0)', font = 'bold 150px "Montserrat", Arial, sans-serif' } = {}) {
  const c = canvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2 + 6);
  return tex(c);
}

// Terreno de respaldo si no hay imagen satelital
export function fallbackGroundTexture() {
  const c = canvas(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7d8a64';
  ctx.fillRect(0, 0, 512, 512);
  noise(ctx, 512, 512, 0.25, 31, 40000);
  const r = rng(77);
  for (let i = 0; i < 70; i++) {
    const v = 150 + r() * 60;
    ctx.fillStyle = `rgba(${v},${v - 5},${v - 15},0.55)`;
    ctx.fillRect(r() * 512, r() * 512, 6 + r() * 26, 6 + r() * 26);
  }
  return tex(c, { repeat: true });
}
