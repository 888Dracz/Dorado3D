// ─────────────────────────────────────────────────────────────
//  Modelo procedural de Dorado Club (Three.js)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import {
  turfTexture, netTexture, parkingTexture, grassTexture, paversTexture,
  woodTexture, textTexture, rng,
} from './textures.js';

const DEG = Math.PI / 180;
const GOLD = 0xd4af37;

// ── Materiales compartidos ───────────────────────────────────
export const M = {};
function initMaterials() {
  if (M.ready) return;
  M.gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.28 });
  M.goldMatte = new THREE.MeshStandardMaterial({ color: 0xc9a43a, metalness: 0.6, roughness: 0.45 });
  M.white = new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.7 });
  M.cream = new THREE.MeshStandardMaterial({ color: 0xe9dfca, roughness: 0.85 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.6, metalness: 0.2 });
  M.metal = new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.4, metalness: 0.8 });
  M.concrete = new THREE.MeshStandardMaterial({ color: 0xb9b5ac, roughness: 0.95 });
  M.boardGreen = new THREE.MeshStandardMaterial({ color: 0x1f4d2b, roughness: 0.8 });
  M.glass = new THREE.MeshStandardMaterial({
    color: 0x9fc3d6, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.38, depthWrite: false,
  });
  M.carGlass = new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: 0.8, roughness: 0.15 });
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6dd, emissiveIntensity: 0.15 });
  M.interiorLight = new THREE.MeshBasicMaterial({ color: 0x8c8a85 });
  M.turfNight = 0;
  M.cone = new THREE.MeshBasicMaterial({
    color: 0xfff2d0, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const nt = netTexture();
  M.net = new THREE.MeshStandardMaterial({
    color: 0x222222, map: nt, alphaMap: nt, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1,
  });
  M.netWhite = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: nt, alphaMap: nt, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1,
  });
  M.grass = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
  M.siteGrass = M.grass.clone();
  M.siteGrass.map = M.grass.map.clone();
  M.siteGrass.map.needsUpdate = true;
  M.wallGray = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.95 });
  M.asphalt = new THREE.MeshStandardMaterial({ color: 0x45464a, roughness: 0.95 });
  M.pavers = new THREE.MeshStandardMaterial({ map: paversTexture(), roughness: 0.95 });
  M.wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 });
  M.felt = new THREE.MeshStandardMaterial({ color: 0x0d6b3a, roughness: 1 });
  M.brown = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 });
  M.trunk = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 1 });
  M.leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  M.palmLeaf = new THREE.MeshStandardMaterial({ color: 0x3e7d2c, roughness: 0.9, side: THREE.DoubleSide });
  M.roofTranslucent = new THREE.MeshStandardMaterial({
    color: 0xe8e2d0, roughness: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  });
  M.ready = true;
}

// ── Utilidades ───────────────────────────────────────────────
function box(w, h, d, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

function cyl(r, h, mat, x = 0, y = 0, z = 0, seg = 12, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function flat(w, d, mat, y = 0.02, uvScale = null) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  if (uvScale) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]);
  }
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

// Panel de malla (largo L, alto H) con UV en metros
function netPanel(L, H, mat = M.net) {
  const g = new THREE.PlaneGeometry(L, H);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L, uv.getY(i) * H);
  return new THREE.Mesh(g, mat);
}

// Fusiona mallas con el mismo material para mejorar rendimiento
function mergeByMaterial(group) {
  const buckets = new Map();
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const toRemove = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.keep || o.isInstancedMesh) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: o.castShadow, receive: o.receiveShadow });
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    buckets.get(key).geos.push(g);
    toRemove.push(o);
  });
  for (const o of toRemove) o.parent.remove(o);
  for (const { mat, geos, cast, receive } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = cast; m.receiveShadow = receive;
    group.add(m);
  }
  return group;
}

let FONT = null;
export function setFont(font) { FONT = font; }

// Letras doradas 3D (o letrero plano si no cargó la fuente)
function signText(text, size, depth = 0.25) {
  if (FONT) {
    const g = new TextGeometry(text, { font: FONT, size, depth, curveSegments: 4, bevelEnabled: true, bevelThickness: depth * 0.2, bevelSize: size * 0.02, bevelSegments: 2 });
    g.computeBoundingBox();
    const bb = g.boundingBox;
    g.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -depth / 2);
    const m = new THREE.Mesh(g, M.gold);
    m.castShadow = true;
    m.userData.keep = true;
    return m;
  }
  const t = textTexture(text);
  const w = size * text.length * 0.75;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.6, roughness: 0.3 }));
  m.userData.keep = true;
  return m;
}

// ── Constructores por tipo ───────────────────────────────────
const nightLights = [];
const lightCones = [];

function buildField(e) {
  const g = new THREE.Group();
  const run = 2;
  const W = e.w + run * 2, D = e.d + run * 2;
  const turf = new THREE.MeshStandardMaterial({ map: turfTexture(e.w, e.d, e.format, run, e.surface), roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0 });
  turf.userData.isTurf = true;
  M.turfs = M.turfs || [];
  M.turfs.push(turf);
  const t = flat(W, D, turf, 0.05);
  t.userData.keep = true;
  g.add(t);

  // muro bajo de rebote + malla perimetral
  const H = 6, board = 1.0;
  const sides = [
    { L: W, x: 0, z: -D / 2, ry: 0 },
    { L: W, x: 0, z: D / 2, ry: 0 },
    { L: D, x: -W / 2, z: 0, ry: Math.PI / 2 },
    { L: D, x: W / 2, z: 0, ry: Math.PI / 2 },
  ];
  for (const s of sides) {
    const b = box(s.L, board, 0.15, M.boardGreen, s.x, board / 2, s.z);
    b.rotation.y = s.ry;
    g.add(b);
    const cap = box(s.L, 0.08, 0.22, M.metal, s.x, board + 0.04, s.z);
    cap.rotation.y = s.ry;
    g.add(cap);
    const n = netPanel(s.L, H - board);
    n.position.set(s.x, board + (H - board) / 2, s.z);
    n.rotation.y = s.ry;
    n.userData.keep = true;
    g.add(n);
    // postes
    const count = Math.ceil(s.L / 5);
    for (let i = 0; i <= count; i++) {
      const p = -s.L / 2 + (i * s.L) / count;
      const px = s.ry ? s.x : s.x + p;
      const pz = s.ry ? s.z + p : s.z;
      g.add(cyl(0.06, H, M.metal, px, H / 2, pz, 8));
    }
    const top = cyl(0.04, s.L, M.metal, s.x, H, s.z, 6);
    top.rotation.z = Math.PI / 2;
    if (s.ry) { top.rotation.set(Math.PI / 2, 0, 0); }
    g.add(top);
  }

  // porterías
  const gw = e.format === 'F5' ? 3 : 6, gh = 2, gd = 1;
  for (const side of [-1, 1]) {
    const gx = side * (e.w / 2);
    const goal = new THREE.Group();
    goal.add(cyl(0.06, gh, M.white, 0, gh / 2, -gw / 2, 10));
    goal.add(cyl(0.06, gh, M.white, 0, gh / 2, gw / 2, 10));
    const bar = cyl(0.06, gw, M.white, 0, gh, 0, 10);
    bar.rotation.x = Math.PI / 2;
    goal.add(bar);
    const back = netPanel(gw, gh, M.netWhite);
    back.position.set(side * gd, gh / 2, 0);
    back.rotation.y = Math.PI / 2;
    back.userData.keep = true;
    goal.add(back);
    for (const zz of [-gw / 2, gw / 2]) {
      const sn = netPanel(gd, gh, M.netWhite);
      sn.position.set(side * gd / 2, gh / 2, zz);
      sn.userData.keep = true;
      goal.add(sn);
    }
    const topNet = netPanel(gd, gw, M.netWhite);
    topNet.rotation.set(-Math.PI / 2, 0, 0);
    topNet.position.set(side * gd / 2, gh, 0);
    topNet.userData.keep = true;
    goal.add(topNet);
    goal.position.x = gx;
    g.add(goal);
  }

  // torres de iluminación LED
  const poleH = 11;
  const target = new THREE.Vector3();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * (W / 4), pz = sz * (D / 2 + 1.2);
      g.add(cyl(0.16, poleH, M.dark, px, poleH / 2, pz, 10, 0.22));
      const head = box(2.2, 0.7, 0.35, M.lamp, px, poleH + 0.2, pz - sz * 0.3, { cast: false });
      head.rotation.x = sz * 0.5;
      head.userData.keep = true;
      g.add(head);
      // cono de luz (solo de noche)
      const from = new THREE.Vector3(px, poleH, pz - sz * 0.4);
      target.set(px * 0.6, 0, -sz * D * 0.15);
      const dir = target.clone().sub(from);
      const len = dir.length();
      const cg = new THREE.ConeGeometry(len * 0.42, len, 28, 1, true);
      cg.translate(0, -len / 2, 0);
      const cone = new THREE.Mesh(cg, M.cone);
      cone.position.copy(from);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
      cone.visible = false;
      cone.userData.keep = true;
      cone.renderOrder = 10;
      lightCones.push(cone);
      g.add(cone);
    }
  }
  const pl = new THREE.PointLight(0xfff4e0, 0, Math.max(W, D) * 1.1, 2);
  pl.position.set(0, 14, 0);
  pl.userData.nightIntensity = 380 + W * D * 0.25;
  nightLights.push(pl);
  g.add(pl);

  // banquillos
  for (const side of [-1, 1]) {
    const bx = side * e.w * 0.18;
    const bz = D / 2 - 1.1;
    const bench = new THREE.Group();
    bench.add(box(4, 0.45, 0.5, M.dark, 0, 0.225, 0));
    bench.add(box(4.2, 0.06, 1.3, M.roofTranslucent, 0, 2.2, -0.1));
    bench.add(box(4.2, 2.2, 0.06, M.glass, 0, 1.1, 0.5, { cast: false }));
    bench.position.set(bx, 0, bz);
    g.add(bench);
  }
  return g;
}

function parkingBands(e) {
  const stall = 2.6, d = e.d;
  if ((e.rows || 2) === 1) return [[-d / 2, -d / 2 + 5, stall]];
  return [[-d / 2, -d / 2 + 5, stall], [d / 2 - 5, d / 2, stall]];
}

function buildParking(e) {
  const g = new THREE.Group();
  const { w, d } = e;
  const stall = 2.6;
  const bands = parkingBands(e);
  const t = flat(w, d, new THREE.MeshStandardMaterial({ map: parkingTexture(w, d, bands), roughness: 0.9 }), 0.03);
  t.userData.keep = true;
  g.add(t);
  // carros (InstancedMesh)
  const slots = [];
  for (const [z0, z1] of bands) {
    const n = Math.floor((w - 2) / stall);
    const start = -w / 2 + (w - n * stall) / 2 + stall / 2;
    for (let i = 0; i < n; i++) slots.push([start + i * stall, (z0 + z1) / 2, z0 < 0 ? 1 : -1]);
  }
  const r = rng(42 + Math.round(w));
  const used = slots.filter(() => r() < 0.55);
  const bodyG = new THREE.BoxGeometry(1.8, 0.75, 4.3); bodyG.translate(0, 0.62, 0);
  const cabG = new THREE.BoxGeometry(1.55, 0.6, 2.2); cabG.translate(0, 1.28, -0.15);
  const wheelG = new THREE.BoxGeometry(1.86, 0.5, 3.0); wheelG.translate(0, 0.3, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 });
  const bodies = new THREE.InstancedMesh(bodyG, bodyMat, used.length);
  const cabs = new THREE.InstancedMesh(cabG, M.carGlass, used.length);
  const wheels = new THREE.InstancedMesh(wheelG, M.dark, used.length);
  const palette = [0xf2f2f2, 0x1d1d1f, 0x9aa0a6, 0xb3261e, 0x1f4e8c, 0xc9c2b0, 0x2e5e3a, 0xe8e8e8];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  used.forEach(([x, z, dir], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dir > 0 ? 0 : Math.PI);
    p.set(x + (r() - 0.5) * 0.2, 0.03, z + (r() - 0.5) * 0.3);
    m4.compose(p, q, s);
    bodies.setMatrixAt(i, m4); cabs.setMatrixAt(i, m4); wheels.setMatrixAt(i, m4);
    bodies.setColorAt(i, new THREE.Color(palette[Math.floor(r() * palette.length)]));
  });
  for (const im of [bodies, cabs, wheels]) { im.castShadow = true; im.receiveShadow = true; g.add(im); }
  // luminarias
  const nl = Math.max(2, Math.round(w / 30));
  for (let i = 0; i < nl; i++) {
    const lx = -w / 2 + w * (i + 0.5) / nl;
    const lz = bands.length > 1 ? 0 : d / 2 - 0.5;
    g.add(cyl(0.08, 7, M.dark, lx, 3.5, lz, 8));
    const h = box(1.2, 0.2, 0.4, M.lamp, lx, 7, lz, { cast: false });
    h.userData.keep = true;
    g.add(h);
  }
  return g;
}

function buildGate(e) {
  const g = new THREE.Group();
  const gw = e.w;
  for (const sx of [-1, 1]) {
    const x = sx * (gw / 2 + 0.6);
    g.add(box(1.2, 4.6, 1.2, M.cream, x, 2.3, 0));
    g.add(box(1.4, 0.25, 1.4, M.dark, x, 4.72, 0));
  }
  g.add(box(gw + 2.4, 1.1, 0.7, M.dark, 0, 5.3, 0));
  g.add(box(gw + 2.4, 0.08, 0.75, M.gold, 0, 4.72, 0));
  const t = signText('DORADO CLUB', 0.62, 0.12);
  t.position.set(0, 5.3, 0.42);
  g.add(t);
  const t2 = signText('DORADO CLUB', 0.62, 0.12);
  t2.rotation.y = Math.PI;
  t2.position.set(0, 5.3, -0.42);
  g.add(t2);
  // portón corredizo abierto
  for (let i = 0; i < Math.floor(gw / 0.25 / 2); i++) g.add(box(0.05, 2.2, 0.05, M.metal, gw / 2 + 1.5 + i * 0.25, 1.1, 0.9, { receive: false }));
  g.add(box(gw / 2, 0.08, 0.08, M.metal, gw / 2 + 1.5 + gw / 4, 2.2, 0.9));
  g.add(box(gw / 2, 0.08, 0.08, M.metal, gw / 2 + 1.5 + gw / 4, 0.1, 0.9));
  // barrera vehicular
  g.add(box(gw * 0.45, 0.1, 0.1, M.white, -gw / 4 + 0.3, 1.0, -1.6));
  g.add(box(0.4, 1.0, 0.4, M.dark, -gw / 2 + 0.3, 0.5, -1.6));
  g.add(flat(gw + 4, 6, M.concrete, 0.04));
  return g;
}

// Estructura en arco (feria de comida): techos verdes + borde blanco
function buildArc(e) {
  const g = new THREE.Group();
  const { r0, r1 } = e;
  const a0 = e.a0 * DEG, a1 = e.a1 * DEG;
  const n = e.segments || 8;
  const h = 4.2;
  // en three: x = sin(t)*r, z = -cos(t)*r (t medido desde el norte, horario)
  const P = (r, t, y = 0) => new THREE.Vector3(Math.sin(t) * r, y, -Math.cos(t) * r);
  const sector = (ra, rb, ta, tb, y, mat, thick = 0.18) => {
    const shape = new THREE.Shape();
    const steps = 6;
    for (let i = 0; i <= steps; i++) { const t = ta + (tb - ta) * i / steps; const p = P(rb, t); i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z); }
    for (let i = steps; i >= 0; i--) { const t = ta + (tb - ta) * i / steps; const p = P(ra, t); shape.lineTo(p.x, -p.z); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y, 0);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const greenA = new THREE.MeshStandardMaterial({ color: 0x4f8f5a, roughness: 0.7 });
  const greenB = new THREE.MeshStandardMaterial({ color: 0x7fae84, roughness: 0.7 });
  const da = (a1 - a0) / n;
  const kioskMats = [M.cream, M.white];
  for (let i = 0; i < n; i++) {
    const ta = a0 + i * da, tb = ta + da;
    // piso de concreto
    g.add(sector(r0, r1, ta, tb, 0.02, M.concrete, 0.05));
    // techo (dos franjas: interior oscura, exterior clara con divisiones)
    g.add(sector(r0 - 1.2, r0 + (r1 - r0) * 0.45, ta, tb, h + 0.25, greenA, 0.16));
    g.add(sector(r0 + (r1 - r0) * 0.45, r1, ta + 0.004, tb - 0.004, h + 0.45, greenB, 0.16));
    // kiosco al fondo (lado exterior)
    const tm = (ta + tb) / 2;
    const kr = r1 - 2.2;
    const len = 2 * kr * Math.sin(da / 2) - 0.4;
    const k = box(len, h, 3.4, kioskMats[i % 2], 0, h / 2, 0);
    const kp = P(kr, tm);
    k.position.set(kp.x, h / 2, kp.z);
    k.rotation.y = -tm;
    g.add(k);
    // mostrador hacia el interior
    const cp = P(kr - 2.1, tm);
    const c = box(len * 0.8, 1.05, 0.6, M.wood, cp.x, 0.52, cp.z);
    c.rotation.y = -tm;
    g.add(c);
    // columnas
    for (const r of [r0 - 0.9]) {
      const cp2 = P(r, ta);
      g.add(cyl(0.14, h + 0.25, M.white, cp2.x, (h + 0.25) / 2, cp2.z, 10));
    }
  }
  const last = P(r0 - 0.9, a1);
  g.add(cyl(0.14, h + 0.25, M.white, last.x, (h + 0.25) / 2, last.z, 10));
  // borde blanco curvo (fachada exterior)
  g.add(sector(r1, r1 + 0.6, a0, a1, 0, M.white, h + 1.2));
  // mesas en la zona interior
  const r = rng(12);
  for (let i = 0; i < 14; i++) {
    const t = a0 + (a1 - a0) * (0.06 + 0.88 * r());
    const rr = r0 - 3.5 - r() * 4;
    const p = P(rr, t);
    g.add(cyl(0.45, 0.05, M.white, p.x, 0.75, p.z, 14));
    g.add(cyl(0.05, 0.72, M.dark, p.x, 0.37, p.z, 6));
    for (let k2 = 0; k2 < 4; k2++) {
      const a = k2 * Math.PI / 2 + r();
      g.add(box(0.42, 0.45, 0.42, M.dark, p.x + Math.cos(a) * 0.85, 0.23, p.z + Math.sin(a) * 0.85));
    }
  }
  // ancla de etiqueta en el centro del arco
  g.userData.labelAt = P((r0 + r1) / 2, (a0 + a1) / 2, 8);
  return g;
}

// Edificación genérica: muros + techo plano o a dos aguas
function buildHouse(e) {
  const g = new THREE.Group();
  const { w, d } = e;
  const h = e.h || 3.5;
  const wall = new THREE.MeshStandardMaterial({ color: e.wall ?? 0xe9dfca, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: e.roofColor ?? 0xdddddd, roughness: 0.6, metalness: e.roof === 'gable' ? 0.35 : 0 });
  g.add(box(w, h, d, wall, 0, h / 2, 0));
  // zócalo
  g.add(box(w + 0.1, 0.4, d + 0.1, M.concrete, 0, 0.2, 0));
  if (e.roof === 'gable') {
    const alongZ = e.ridge === 'z';
    const span = alongZ ? w : d, len = alongZ ? d : w;
    const rise = Math.min(2.2, span * 0.14);
    const shape = new THREE.Shape([
      new THREE.Vector2(-span / 2 - 0.6, 0), new THREE.Vector2(0, rise), new THREE.Vector2(span / 2 + 0.6, 0),
      new THREE.Vector2(span / 2 + 0.6, -0.12), new THREE.Vector2(0, rise - 0.12), new THREE.Vector2(-span / 2 - 0.6, -0.12),
    ]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len + 1.0, bevelEnabled: false });
    geo.translate(0, 0, -(len + 1.0) / 2);
    if (alongZ) { /* perfil en X, extruido en Z */ } else geo.rotateY(Math.PI / 2);
    const roof = new THREE.Mesh(geo, roofMat);
    roof.position.y = h;
    roof.castShadow = roof.receiveShadow = true;
    roof.userData.keep = true;
    g.add(roof);
    // hastiales
    const tri = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(0, rise - 0.1), new THREE.Vector2(span / 2, 0)]);
    for (const sgn of [-1, 1]) {
      const tg = new THREE.ShapeGeometry(tri);
      const m = new THREE.Mesh(tg, wall);
      if (alongZ) { m.position.set(0, h, sgn * d / 2); if (sgn < 0) m.rotation.y = Math.PI; }
      else { m.position.set(sgn * w / 2, h, 0); m.rotation.y = sgn * Math.PI / 2; }
      m.material = wall.clone(); m.material.side = THREE.DoubleSide;
      g.add(m);
    }
  } else {
    g.add(box(w + 0.4, 0.3, d + 0.4, roofMat, 0, h + 0.15, 0));
    g.add(box(w + 0.4, 0.5, 0.15, wall, 0, h + 0.4, d / 2 + 0.13));
    g.add(box(w + 0.4, 0.5, 0.15, wall, 0, h + 0.4, -d / 2 - 0.13));
  }
  // fachada abierta / vitrinas en el lado indicado
  const side = e.openSide || 'south';
  const sideDef = {
    south: { L: w, pos: (u) => [u, d / 2 + 0.03], ry: 0 },
    north: { L: w, pos: (u) => [u, -d / 2 - 0.03], ry: Math.PI },
    east: { L: d, pos: (u) => [w / 2 + 0.03, u], ry: Math.PI / 2 },
    west: { L: d, pos: (u) => [-w / 2 - 0.03, u], ry: -Math.PI / 2 },
  }[side];
  const nOpen = Math.max(1, Math.floor(sideDef.L / 4.5));
  for (let i = 0; i < nOpen; i++) {
    const u = -sideDef.L / 2 + (i + 0.5) * sideDef.L / nOpen;
    const [px, pz] = sideDef.pos(u);
    const win = box(sideDef.L / nOpen - 1.2, Math.min(2.6, h - 0.9), 0.06, M.glass, px, 0.4 + Math.min(2.6, h - 0.9) / 2, pz, { cast: false, receive: false });
    win.rotation.y = sideDef.ry;
    win.userData.keep = true;
    g.add(win);
    const lit = box(sideDef.L / nOpen - 1.3, Math.min(2.5, h - 1), 0.02, M.interiorLight, px, 0.4 + Math.min(2.5, h - 1) / 2, pz, { cast: false, receive: false });
    lit.rotation.y = sideDef.ry;
    lit.position.x -= Math.sin(sideDef.ry) * 0.05; lit.position.z -= Math.cos(sideDef.ry) * 0.05;
    lit.userData.keep = true;
    g.add(lit);
  }
  if (e.windows) {
    // ventanas altas en los laterales largos
    const n = Math.floor(d / 3.5);
    for (let i = 0; i < n; i++) {
      const z = -d / 2 + (i + 0.5) * d / n;
      for (const sx of [-1, 1]) g.add(box(0.06, 0.8, 2.2, M.glass, sx * (w / 2 + 0.03), h - 0.9, z, { cast: false }));
    }
  }
  if (e.sign) {
    const t = signText('DORADO CLUB', 0.45, 0.08);
    t.position.set(0, h + 1.1, d / 2 + 0.3);
    g.add(t);
  }
  return g;
}

// Fila de locales comerciales con santamarías
function buildShops(e) {
  const g = new THREE.Group();
  const { w, d } = e;
  const n = e.units || 4;
  const h = 3.4;
  const uw = w / n;
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xa9adb3, roughness: 0.5, metalness: 0.6 });
  const signColors = [0xd4af37, 0x2f6fb5, 0xc0392b, 0x2e8b57, 0x8e44ad, 0xe67e22];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * uw;
    g.add(box(uw - 0.15, h, d, M.cream, x, h / 2, 0));
    g.add(box(uw - 0.6, 2.6, 0.05, doorMat, x, 1.3, d / 2 + 0.03, { cast: false }));
    g.add(box(uw - 0.4, 0.6, 0.1, new THREE.MeshStandardMaterial({ color: signColors[i % signColors.length], roughness: 0.6 }), x, 3.0, d / 2 + 0.06, { cast: false }));
  }
  g.add(box(w + 0.4, 0.25, d + 1.6, M.white, 0, h + 0.12, 0.6));
  return g;
}

// Área infantil con toldo azul
function buildPlayground(e) {
  const g = new THREE.Group();
  const { w, d } = e;
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f62c8, roughness: 0.8, side: THREE.DoubleSide });
  g.add(flat(w, d, new THREE.MeshStandardMaterial({ color: 0x3a8f63, roughness: 1 }), 0.06));
  // toldo tensado (paraboloide simple)
  const cg = new THREE.PlaneGeometry(w, d, 12, 12);
  cg.rotateX(-Math.PI / 2);
  const pos = cg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (w / 2), v = pos.getZ(i) / (d / 2);
    pos.setY(i, 4.2 - 0.5 * (1 - u * u) * (1 - v * v));
  }
  cg.computeVertexNormals();
  const canopy = new THREE.Mesh(cg, blue);
  canopy.castShadow = true;
  canopy.userData.keep = true;
  g.add(canopy);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.1, 4.3, M.white, sx * w / 2, 2.15, sz * d / 2, 8));
  // juegos
  const red = new THREE.MeshStandardMaterial({ color: 0xd8432f, roughness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
  g.add(box(2, 1.6, 2, yellow, -w / 4, 0.8, 0));
  const slide = box(0.9, 0.08, 3.4, red, -w / 4, 0.85, 2.3);
  slide.rotation.x = 0.45;
  g.add(slide);
  g.add(box(3, 0.1, 0.1, M.metal, w / 4, 2.2, -1));
  for (const sx of [-1.5, 1.5]) g.add(box(0.1, 2.2, 0.1, M.metal, w / 4 + sx, 1.1, -1));
  for (const sx of [-0.6, 0.6]) g.add(box(0.5, 0.06, 0.25, red, w / 4 + sx, 0.6, -1));
  return g;
}

function buildPaving(e) {
  const g = new THREE.Group();
  if (e.material === 'asphalt') {
    g.add(flat(e.w, e.d, M.asphalt, 0.032, [e.w / 8, e.d / 8]));
  } else {
    g.add(flat(e.w, e.d, M.pavers, 0.035, [e.w / 4, e.d / 4]));
  }
  return g;
}

function buildGreen(e) {
  const g = new THREE.Group();
  g.add(flat(e.w, e.d, M.grass, 0.03, [e.w / 6, e.d / 6]));
  for (let i = 0; i < 3; i++) g.add(box(2, 0.45, 0.5, M.wood, -e.w / 3 + i * e.w / 3, 0.25, 0));
  return g;
}

const BUILDERS = {
  field: buildField, parking: buildParking, gate: buildGate, arc: buildArc, house: buildHouse,
  shops: buildShops, playground: buildPlayground, paving: buildPaving, green: buildGreen,
};

// Altura de referencia del marcador de cada tipo de elemento
const LABEL_H = { field: 11, parking: 5, gate: 8, arc: 8, house: 9, shops: 7, playground: 7, paving: 3, green: 4 };

// ── Muro perimetral, árboles y palmeras ──────────────────────
function buildPerimeter(layout) {
  const g = new THREE.Group();
  const poly = layout.site.polygon;
  const h = 2.4;
  const gates = layout.elements.filter((e) => e.type === 'gate');
  const seg = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 0.1) return;
    const m = box(L + 0.3, h, 0.3, M.wallGray, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(m);
    const c = box(L + 0.3, 0.12, 0.4, M.dark, (x0 + x1) / 2, h + 0.06, (z0 + z1) / 2);
    c.rotation.y = m.rotation.y;
    g.add(c);
  };
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const L = Math.hypot(bx - ax, bz - az);
    // huecos donde hay portones sobre este tramo
    const cuts = [];
    for (const gt of gates) {
      const t = ((gt.x - ax) * (bx - ax) + (gt.z - az) * (bz - az)) / (L * L);
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      if (t > 0 && t < 1 && Math.hypot(px - gt.x, pz - gt.z) < 4) {
        const half = (gt.w / 2 + 1.3) / L;
        cuts.push([t - half, t + half]);
      }
    }
    cuts.sort((a, b) => a[0] - b[0]);
    let t0 = 0;
    for (const [c0, c1] of cuts) {
      if (c0 > t0) seg(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * c0, az + (bz - az) * c0);
      t0 = Math.max(t0, c1);
    }
    if (t0 < 1) seg(ax + (bx - ax) * t0, az + (bz - az) * t0, bx, bz);
  }
  // base de césped de todo el terreno
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const bg = new THREE.ShapeGeometry(shape);
  bg.rotateX(-Math.PI / 2);
  const uv = bg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 6);
  const base = new THREE.Mesh(bg, M.siteGrass);
  base.position.y = 0.015;
  base.receiveShadow = true;
  base.userData.keep = true;
  base.userData.siteBase = true;
  g.add(base);
  return g;
}

function buildVegetation(layout) {
  const g = new THREE.Group();
  const pts = [];
  for (const line of layout.trees || []) {
    const [x0, z0] = line.from, [x1, z1] = line.to;
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.floor(L / line.spacing));
    for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]);
  }
  for (const [x, z, k] of layout.treeClusters || []) pts.push([x, z, k]);
  const r = rng(17);
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 7); trunkG.translate(0, 1.6, 0);
  const crownG = new THREE.IcosahedronGeometry(2.3, 1); crownG.translate(0, 4.6, 0);
  const trunks = new THREE.InstancedMesh(trunkG, M.trunk, pts.length);
  const crowns = new THREE.InstancedMesh(crownG, M.leaf, pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const greens = [0x3f7a2e, 0x4c8a33, 0x356b2a, 0x5b9136, 0x2f5f27];
  pts.forEach(([x, z, big], i) => {
    const k = (big || 1) * (0.8 + r() * 0.5);
    s.set(k, k * (0.9 + r() * 0.3), k);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    p.set(x, 0, z);
    m4.compose(p, q, s);
    trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, new THREE.Color(greens[Math.floor(r() * greens.length)]));
  });
  trunks.castShadow = crowns.castShadow = true;
  g.add(trunks, crowns);

  // palmeras
  const palms = layout.palms || [];
  if (palms.length) {
    const tg = new THREE.CylinderGeometry(0.17, 0.24, 7.5, 8); tg.translate(0, 3.75, 0);
    const fronds = [];
    for (let i = 0; i < 9; i++) {
      const f = new THREE.PlaneGeometry(0.9, 4.2, 1, 4);
      const pos = f.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v) + 2.1;
        pos.setXYZ(v, pos.getX(v) * (1 - y / 5), -0.06 * y * y, y);
      }
      f.rotateY((i / 9) * Math.PI * 2);
      f.translate(0, 7.5, 0);
      fronds.push(f);
    }
    const fg = mergeGeometries(fronds);
    fg.computeVertexNormals();
    const pt = new THREE.InstancedMesh(tg, M.trunk, palms.length);
    const pf = new THREE.InstancedMesh(fg, M.palmLeaf, palms.length);
    palms.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6);
      const k = 0.85 + r() * 0.3;
      s.set(k, k, k);
      p.set(x, 0, z);
      m4.compose(p, q, s);
      pt.setMatrixAt(i, m4); pf.setMatrixAt(i, m4);
    });
    pt.castShadow = pf.castShadow = true;
    g.add(pt, pf);
  }
  return g;
}

// ── Clase principal ──────────────────────────────────────────
export class ClubModel {
  constructor(layout) {
    initMaterials();
    this.layout = layout;
    this.root = new THREE.Group();
    this.root.name = 'DoradoClub';
    this.elements = new Map();
    this.build();
  }

  build() {
    nightLights.length = 0;
    lightCones.length = 0;
    M.turfs = [];
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.elements.clear();
    this.perimeter = buildPerimeter(this.layout);
    this.root.add(this.perimeter);
    for (const e of this.layout.elements) this.addElement(e);
    this.vegetation = buildVegetation(this.layout);
    this.root.add(this.vegetation);
    if (this._night !== undefined) this.setNight(this._night);
  }

  addElement(e) {
    const builder = BUILDERS[e.type];
    if (!builder) return;
    const inner = builder(e);
    mergeByMaterial(inner);
    const g = new THREE.Group();
    g.add(inner);
    g.name = e.id;
    g.userData.element = e;
    g.position.set(e.x, 0, e.z);
    g.rotation.y = -(e.rot || 0) * DEG;
    // anclaje para la etiqueta
    const anchor = new THREE.Object3D();
    if (inner.userData.labelAt) anchor.position.copy(inner.userData.labelAt);
    else anchor.position.y = LABEL_H[e.type] || 6;
    anchor.name = 'labelAnchor';
    g.add(anchor);
    this.root.add(g);
    this.elements.set(e.id, g);
  }

  // Sincroniza la posición editada con los datos del layout
  syncFromObject(obj) {
    const e = obj.userData.element;
    if (!e) return;
    e.x = +obj.position.x.toFixed(2);
    e.z = +obj.position.z.toFixed(2);
    e.rot = +(((-obj.rotation.y / DEG) % 360 + 360) % 360).toFixed(1);
  }

  pois() {
    return this.layout.elements.filter((e) => e.info).map((e) => ({ ...e, object: this.elements.get(e.id) }));
  }

  setNight(night) {
    this._night = night;
    M.lamp.emissiveIntensity = night ? 6 : 0.15;
    M.interiorLight.color.set(night ? 0xfff0cf : 0x8c8a85);
    M.glass.opacity = night ? 0.22 : 0.38;
    for (const t of M.turfs) t.emissiveIntensity = night ? 0.05 : 0;
    for (const l of nightLights) l.intensity = night ? l.userData.nightIntensity : 0;
    for (const c of lightCones) c.visible = night;
  }

  setSiteBaseOpacity(alpha) {
    M.siteGrass.transparent = alpha < 1;
    M.siteGrass.opacity = alpha;
    M.siteGrass.depthWrite = alpha >= 1;
    M.siteGrass.needsUpdate = true;
    this.perimeter.traverse((o) => { if (o.userData.siteBase) o.visible = alpha > 0.01; });
  }
}
