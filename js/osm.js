// ─────────────────────────────────────────────────────────────
//  Edificios y calles del entorno desde OpenStreetMap (Overpass)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PALETTE = [0xe3d7c3, 0xd6c8af, 0xece3d3, 0xc8b394, 0xc4896a, 0xb7b1a7, 0xdcd0bd, 0xd9a882];

function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function buildingHeight(tags, id) {
  const h = parseFloat(tags.height);
  if (!Number.isNaN(h) && h > 1) return h;
  const lv = parseFloat(tags['building:levels']);
  if (!Number.isNaN(lv) && lv > 0) return lv * 3.2 + 0.6;
  const r = hash(id);
  switch (tags.building) {
    case 'apartments': return 12 + r * 18;
    case 'commercial': case 'retail': case 'office': return 7 + r * 8;
    case 'industrial': case 'warehouse': return 7 + r * 4;
    case 'church': return 12 + r * 6;
    case 'roof': return 4;
    case 'house': case 'residential': case 'detached': return 4 + r * 4;
    default: return 4.5 + r * 5;
  }
}

async function overpass(endpoints, query) {
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 35000);
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return await res.json();
    } catch (e) { console.warn('Overpass falló', url, e.message); }
  }
  return null;
}

/**
 * @param frame   LocalFrame
 * @param cfg     CONFIG
 * @param heightAt (x,z) => altura del terreno
 * @param exclude  (x,z) => true si el punto está dentro del club
 */
export async function loadOSM(frame, cfg, heightAt, exclude) {
  const R = cfg.osm.buildingRadius;
  const q = `[out:json][timeout:40];
(
  way["building"](around:${R},${cfg.lat},${cfg.lon});
  way["highway"]["name"](around:${R + 300},${cfg.lat},${cfg.lon});
  nwr["name"~"Dorado",i](around:900,${cfg.lat},${cfg.lon});
);
out geom;`;
  const data = await overpass(cfg.sources.overpass, q);
  if (!data) return null;

  const geos = [];
  const roads = new Map();
  const dorado = [];
  for (const el of data.elements) {
    const tags = el.tags || {};
    if (tags.name && /dorado/i.test(tags.name)) dorado.push(el);
    if (el.type !== 'way' || !el.geometry) continue;
    if (tags.building) {
      const pts = el.geometry.map((p) => frame.fromLatLon(p.lat, p.lon));
      if (pts.length < 4) continue;
      let cx = 0, cz = 0;
      for (const p of pts) { cx += p.x; cz += p.z; }
      cx /= pts.length; cz /= pts.length;
      if (exclude(cx, cz)) continue;
      const shape = new THREE.Shape(pts.slice(0, -1).map((p) => new THREE.Vector2(p.x, -p.z)));
      const h = buildingHeight(tags, el.id);
      let g;
      try {
        g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
      } catch { continue; }
      g.rotateX(-Math.PI / 2);
      let base = Infinity;
      for (const p of pts) base = Math.min(base, heightAt(p.x, p.z));
      g.translate(0, base - 0.4, 0);
      const color = new THREE.Color(PALETTE[Math.floor(hash(el.id + 7) * PALETTE.length)]);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      const nrm = g.attributes.normal;
      for (let i = 0; i < n; i++) {
        // techos un poco más oscuros
        const k = nrm.getY(i) > 0.5 ? 0.82 : 1;
        col[i * 3] = color.r * k; col[i * 3 + 1] = color.g * k; col[i * 3 + 2] = color.b * k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.deleteAttribute('uv');
      geos.push(g);
    } else if (tags.highway && tags.name) {
      if (!roads.has(tags.name)) roads.set(tags.name, { name: tags.name, type: tags.highway, lines: [] });
      roads.get(tags.name).lines.push(el.geometry.map((p) => frame.fromLatLon(p.lat, p.lon)));
    }
  }

  let mesh = null;
  if (geos.length) {
    const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'EdificiosOSM';
  }

  // punto de cada calle más cercano al club (para la etiqueta)
  const roadLabels = [];
  for (const r of roads.values()) {
    let best = null, bd = Infinity;
    for (const line of r.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1];
        const vx = b.x - a.x, vz = b.z - a.z;
        const L2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, -(a.x * vx + a.z * vz) / L2));
        const p = { x: a.x + vx * t, z: a.z + vz * t };
        const d = Math.hypot(p.x, p.z);
        if (d < bd) { bd = d; best = p; }
      }
    }
    if (best) roadLabels.push({ name: r.name, type: r.type, x: best.x, z: best.z, dist: bd, lines: r.lines });
  }
  roadLabels.sort((a, b) => {
    const pa = /mart[ií]n marciales/i.test(a.name) ? -1e6 : 0;
    const pb = /mart[ií]n marciales/i.test(b.name) ? -1e6 : 0;
    return a.dist + pa - (b.dist + pb);
  });

  return { mesh, count: geos.length, roads: roadLabels, dorado };
}

// Cintas de calles (solo si no hay imagen satelital)
export function roadRibbons(roads, heightAt) {
  const geos = [];
  for (const r of roads) {
    const width = /primary|trunk/.test(r.type) ? 14 : /secondary|tertiary/.test(r.type) ? 10 : 6;
    for (const line of r.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1];
        const L = Math.hypot(b.x - a.x, b.z - a.z);
        if (L < 0.5) continue;
        const g = new THREE.PlaneGeometry(L + width * 0.5, width);
        g.rotateX(-Math.PI / 2);
        g.rotateY(-Math.atan2(b.z - a.z, b.x - a.x));
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        g.translate(mx, heightAt(mx, mz) + 0.08, mz);
        geos.push(g);
      }
    }
  }
  if (!geos.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0x45474b, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.receiveShadow = true;
  return m;
}
