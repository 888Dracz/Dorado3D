// ─────────────────────────────────────────────────────────────
//  Terreno real: relieve (AWS Terrain Tiles) + ortofoto (Esri)
//  Todo se descarga en el navegador del visitante, sin API keys.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mercToTile, tileBoundsMerc, tileUrl, WORLD } from './geo.js';
import { fallbackGroundTexture } from './textures.js';

function loadImage(url, timeout = 15000) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => { img.src = ''; resolve(null); }, timeout);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });
}

// Descarga con concurrencia limitada
async function pool(tasks, limit, onDone) {
  const results = new Array(tasks.length);
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
      onDone?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function tileRange(bounds, z) {
  const a = mercToTile(bounds.minX, bounds.maxY, z);
  const b = mercToTile(bounds.maxX, bounds.minY, z);
  return { x0: Math.floor(a.x), y0: Math.floor(a.y), x1: Math.floor(b.x), y1: Math.floor(b.y) };
}

// Mosaico de teselas en un <canvas>
async function mosaic(tpl, bounds, z, onTile) {
  const r = tileRange(bounds, z);
  const nx = r.x1 - r.x0 + 1, ny = r.y1 - r.y0 + 1;
  const c = document.createElement('canvas');
  c.width = nx * 256; c.height = ny * 256;
  const ctx = c.getContext('2d', { willReadFrequently: false });
  const tasks = [];
  let ok = 0;
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      tasks.push(async () => {
        const img = await loadImage(tileUrl(tpl, z, tx, ty));
        if (img) { ctx.drawImage(img, (tx - r.x0) * 256, (ty - r.y0) * 256, 256, 256); ok++; }
      });
    }
  }
  await pool(tasks, 8, onTile);
  const tl = tileBoundsMerc(r.x0, r.y0, z), br = tileBoundsMerc(r.x1, r.y1, z);
  return {
    canvas: c, count: tasks.length, ok,
    bounds: { minX: tl.minX, maxY: tl.maxY, maxX: br.maxX, minY: br.minY },
  };
}

export function countTiles(bounds, z) {
  const r = tileRange(bounds, z);
  return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
}

// Modelo de elevación muestreable
class DEM {
  constructor(m) {
    this.ok = m.ok > 0;
    this.bounds = m.bounds;
    this.w = m.canvas.width; this.h = m.canvas.height;
    this.data = new Float32Array(this.w * this.h);
    if (!this.ok) return;
    const px = m.canvas.getContext('2d').getImageData(0, 0, this.w, this.h).data;
    for (let i = 0; i < this.w * this.h; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3];
      this.data[i] = a === 0 ? NaN : r * 256 + g + b / 256 - 32768;
    }
    // rellenar huecos con la media
    let sum = 0, n = 0;
    for (const v of this.data) if (!Number.isNaN(v)) { sum += v; n++; }
    const mean = n ? sum / n : 0;
    for (let i = 0; i < this.data.length; i++) if (Number.isNaN(this.data[i])) this.data[i] = mean;
  }
  sample(mx, my) {
    if (!this.ok) return 0;
    const { minX, maxX, minY, maxY } = this.bounds;
    const fx = ((mx - minX) / (maxX - minX)) * this.w - 0.5;
    const fy = ((maxY - my) / (maxY - minY)) * this.h - 0.5;
    const x0 = Math.max(0, Math.min(this.w - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(this.h - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
    const d = this.data, w = this.w;
    const a = d[y0 * w + x0], b = d[y0 * w + x0 + 1], c = d[(y0 + 1) * w + x0], e = d[(y0 + 1) * w + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
  }
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Terrain {
  constructor(frame, config, renderer) {
    this.frame = frame;
    this.cfg = config;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'Terreno';
    this.h0 = 0;
    this.dem = null;
    this.imageryOk = false;
    this.meshes = [];
  }

  // altura relativa al club (m) en coordenadas locales
  heightAt(x, z) {
    if (!this.dem) return 0;
    const m = this.frame.toMerc(x, z);
    const h = this.dem.sample(m.x, m.y) - this.h0;
    const r = Math.hypot(x, z);
    const t = this.cfg.terrain;
    return h * smooth(t.flattenInner, t.flattenOuter, r);
  }

  async load(onProgress = () => {}) {
    const { terrain, sources } = this.cfg;
    const big = terrain.rings[0].size / 2;
    const b = (half) => {
      const a = this.frame.toMerc(-half, half), c = this.frame.toMerc(half, -half);
      return { minX: a.x, minY: a.y, maxX: c.x, maxY: c.y };
    };
    let total = countTiles(b(big), terrain.demZoom);
    for (const ring of terrain.rings) total += countTiles(b(ring.size / 2), ring.zoom);
    let done = 0;
    const tick = () => onProgress(++done / total);

    // 1) relieve
    const demM = await mosaic(sources.elevation, b(big), terrain.demZoom, tick);
    try { this.dem = new DEM(demM); } catch (e) { console.warn('DEM no disponible', e); this.dem = null; }
    if (this.dem?.ok) this.h0 = this.dem.sample(this.frame.origin.x, this.frame.origin.y);

    // 2) ortofotos por anillos (de lejos a cerca)
    const maxTex = this.renderer.capabilities.maxTextureSize;
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const results = await Promise.all(terrain.rings.map((ring) => mosaic(sources.imagery, b(ring.size / 2), ring.zoom, tick)));
    terrain.rings.forEach((ring, idx) => {
      const m = results[idx];
      const okImg = m.ok > m.count * 0.5;
      if (okImg) this.imageryOk = true;
      const mesh = this._ringMesh(ring, idx, okImg ? m : null, maxTex, aniso);
      this.meshes.push(mesh);
      this.group.add(mesh);
    });
    return { dem: !!this.dem?.ok, imagery: this.imageryOk, elevation: this.h0 };
  }

  _ringMesh(ring, idx, m, maxTex, aniso) {
    const n = ring.segments;
    const g = new THREE.PlaneGeometry(ring.size, ring.size, n, n);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    // El anillo grueso se hunde bajo el área que cubre el anillo más fino
    // (si no, sus triángulos grandes asoman por encima en zonas convexas).
    const rings = this.cfg.terrain.rings;
    const finer = rings[idx + 1];
    const spacing = ring.size / n;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let y = this.heightAt(x, z);
      if (finer) {
        const half = finer.size / 2;
        const mAbs = Math.max(Math.abs(x), Math.abs(z));
        const k = smooth(half - spacing * 0.6, half - spacing * 2.2, mAbs);
        y -= k * (idx === 0 ? 14 : 5);
      }
      pos.setY(i, y);
      if (m) {
        const mc = this.frame.toMerc(x, z);
        uv.setXY(i, (mc.x - m.bounds.minX) / (m.bounds.maxX - m.bounds.minX), (mc.y - m.bounds.minY) / (m.bounds.maxY - m.bounds.minY));
      } else {
        uv.setXY(i, x / 60, z / 60);
      }
    }
    g.computeVertexNormals();
    let map;
    if (m) {
      let src = m.canvas;
      if (src.width > maxTex || src.height > maxTex) {
        const s = maxTex / Math.max(src.width, src.height);
        const c = document.createElement('canvas');
        c.width = Math.floor(src.width * s); c.height = Math.floor(src.height * s);
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
        src = c;
      }
      map = new THREE.CanvasTexture(src);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = aniso;
    } else {
      map = fallbackGroundTexture();
    }
    const level = this.cfg.terrain.rings.length - 1 - idx;
    const mat = new THREE.MeshStandardMaterial({
      map, roughness: 1, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: 1 + level * 2, polygonOffsetUnits: 1 + level * 2,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = idx === this.cfg.terrain.rings.length - 1;
    mesh.renderOrder = idx;
    mesh.name = `anillo-${ring.zoom}`;
    return mesh;
  }

  // Terreno plano de respaldo (sin conexión)
  buildFallback() {
    const ring = this.cfg.terrain.rings[0];
    const mesh = this._ringMesh({ ...ring, segments: 4 }, 0, null, 4096, 8);
    this.group.add(mesh);
    this.meshes.push(mesh);
  }
}

export { WORLD };
