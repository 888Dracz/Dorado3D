// ─────────────────────────────────────────────────────────────
//  Dorado Club 3D — aplicación principal
//  Three.js (WebGL2) + ortofoto Esri + relieve AWS + OpenStreetMap
//  + (opcional) Google Photorealistic 3D Tiles
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

import { CONFIG } from './config.js';
import { DEFAULT_LAYOUT, cloneLayout, pointInSite } from './layout.js';
import { LocalFrame } from './geo.js';
import { Terrain } from './terrain.js';
import { loadOSM, roadRibbons } from './osm.js';
import { ClubModel, setFont } from './club.js';
import { Environment } from './environment.js';
import { setMaxAnisotropy } from './textures.js';

const DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const store = {
  get(k, def = null) { try { const v = localStorage.getItem('doradoClub.' + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem('doradoClub.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem('doradoClub.' + k); } catch { /* */ } },
};

// ── Ubicación (URL > guardado > config) ──────────────────────
const urlParams = new URLSearchParams(location.search);
const savedGeo = store.get('geo');
if (savedGeo && !urlParams.has('lat')) Object.assign(CONFIG, savedGeo);
const frame = new LocalFrame(CONFIG.lat, CONFIG.lon);

// ── Renderer WebGL2 ──────────────────────────────────────────
const app = $('app');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('loader').querySelector('p').textContent = 'Tu navegador no soporta WebGL2. Prueba con Chrome, Edge, Firefox o Safari actualizados.';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 40000);
camera.position.set(150, 115, 175);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = 88 * DEG;
controls.minDistance = 6;
controls.maxDistance = 4500;
controls.target.set(0, 0, 0);
controls.screenSpacePanning = false;

const env = new Environment(scene, renderer, CONFIG.lat);

// ── Estado ───────────────────────────────────────────────────
let layout = store.get('layout') || cloneLayout(DEFAULT_LAYOUT);
if (layout.version !== DEFAULT_LAYOUT.version || !Array.isArray(layout.elements)) layout = cloneLayout(DEFAULT_LAYOUT);
const clubRoot = new THREE.Group();
clubRoot.name = 'ClubRoot';
clubRoot.rotation.y = -CONFIG.heading * DEG;
scene.add(clubRoot);
let club = null;
let terrain = null;
let osm = null;
let google = null;
const labels = [];

function setStatus(text, ms = 0) {
  const s = $('status');
  if (!text) { s.classList.add('hidden'); return; }
  s.textContent = text;
  s.classList.remove('hidden');
  clearTimeout(setStatus._t);
  if (ms) setStatus._t = setTimeout(() => s.classList.add('hidden'), ms);
}

// ── Etiquetas ────────────────────────────────────────────────
function makeLabel(text, cls, onClick) {
  const div = document.createElement('div');
  div.className = 'poi-label ' + (cls || '');
  div.textContent = text;
  if (onClick) div.addEventListener('click', (ev) => { ev.stopPropagation(); onClick(); });
  const obj = new CSS2DObject(div);
  labels.push(obj);
  return obj;
}

function clearClubLabels() {
  for (let i = labels.length - 1; i >= 0; i--) {
    if (labels[i].userData.club) { labels[i].removeFromParent(); labels.splice(i, 1); }
  }
}

// ── Modelo del club ──────────────────────────────────────────
function buildClub() {
  clearClubLabels();
  if (club) clubRoot.remove(club.root);
  club = new ClubModel(layout);
  clubRoot.add(club.root);
  club.setNight(env.night);
  // logotipo flotante sobre el club
  const brand = makeLabel('DORADO CLUB', 'brand-label', () => overview());
  brand.userData.club = true;
  brand.position.set(5, 30, -2);
  club.root.add(brand);
  for (const poi of club.pois()) {
    const anchor = poi.object.getObjectByName('labelAnchor');
    const l = makeLabel(poi.name, '', () => focusPOI(poi.id));
    l.userData.club = true;
    anchor.add(l);
  }
  renderPOIList();
  if (editing) { populateEditorSelect(); setSiteBase(+$('ed-base').value); }
}

function renderPOIList() {
  const ul = $('poi-list');
  ul.innerHTML = '';
  for (const poi of club.pois()) {
    const li = document.createElement('li');
    li.dataset.id = poi.id;
    li.innerHTML = `<span class="dot"></span>${poi.name}`;
    li.addEventListener('click', () => { stopTour(); focusPOI(poi.id); });
    ul.appendChild(li);
  }
}

// ── Cámara: animaciones ──────────────────────────────────────
let anim = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(pos, target, dur = 1.8) {
  anim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), dur: dur * 1000 };
}

function overview() {
  stopTour();
  const off = new THREE.Vector3(-95, 110, 150).applyAxisAngle(new THREE.Vector3(0, 1, 0), clubRoot.rotation.y);
  flyTo(off, new THREE.Vector3(0, 0, 0));
  showInfo(CONFIG.name, `${CONFIG.address}. Complejo deportivo y comercial (C.C. El Dorado) con canchas de futbolito de grama sintética, cancha azul, cancha de fútbol 7, feria de comida, bar, gimnasio, locales, área infantil y estacionamiento.${terrain?.h0 ? ` Altitud aprox.: ${Math.round(terrain.h0)} m s. n. m.` : ''}`);
}

function viewpointFor(id) {
  const obj = club.elements.get(id);
  const e = obj.userData.element;
  const size = e.type === 'arc' ? 30 : Math.max(e.w || 20, e.d || 12);
  const center = new THREE.Vector3();
  obj.getObjectByName('labelAnchor').getWorldPosition(center);
  center.y = 0;
  const q = new THREE.Quaternion();
  obj.getWorldQuaternion(q);
  const dist = size * 0.95 + 16;
  const off = new THREE.Vector3(0.45, 0.62, 1).normalize().multiplyScalar(dist).applyQuaternion(q);
  return { pos: center.clone().add(off), target: center.clone().add(new THREE.Vector3(0, e.type === 'house' || e.type === 'arc' ? 2.5 : 1, 0)) };
}

function focusPOI(id) {
  const vp = viewpointFor(id);
  flyTo(vp.pos, vp.target);
  const e = club.elements.get(id).userData.element;
  showInfo(e.name, e.info || '');
  document.querySelectorAll('#poi-list li').forEach((li) => li.classList.toggle('active', li.dataset.id === id));
}

function showInfo(title, text) {
  $('info-title').textContent = title;
  $('info-text').textContent = text;
  $('info').classList.remove('hidden');
}
$('info-close').onclick = () => $('info').classList.add('hidden');

// ── Recorrido automático ─────────────────────────────────────
let tour = null;
function startTour() {
  const ids = club.pois().map((p) => p.id);
  let i = 0;
  const next = () => {
    focusPOI(ids[i % ids.length]);
    i++;
    tour.timer = setTimeout(next, 7000);
  };
  tour = { timer: null };
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.8;
  $('btn-tour').textContent = '■ Detener';
  next();
}
function stopTour() {
  if (!tour) return;
  clearTimeout(tour.timer);
  tour = null;
  controls.autoRotate = false;
  $('btn-tour').textContent = '▶ Recorrido';
}
$('btn-tour').onclick = () => (tour ? stopTour() : startTour());
$('btn-overview').onclick = overview;
renderer.domElement.addEventListener('pointerdown', () => { stopTour(); anim = null; });
renderer.domElement.addEventListener('wheel', () => { anim = null; }, { passive: true });

// ── Selección por clic ───────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5 || walk.isLocked) return;
  if (editing && tcontrols.dragging) return;
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(club.root, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.element) o = o.parent;
    if (o) {
      const el = o.userData.element;
      if (editing) selectElement(el.id);
      else if (el.info) { showInfo(el.name, el.info); }
      return;
    }
  }
});

// ── Hora del día ─────────────────────────────────────────────
function fmtHour(h) {
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function setTime(h) {
  env.setTime(h);
  env.focus(controls.target.clone().setY(0));
  $('time').value = h;
  $('time-label').textContent = fmtHour(h);
}
env.onChange((night) => club?.setNight(night));
$('time').addEventListener('input', (e) => setTime(+e.target.value));
document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => setTime(+b.dataset.time)));

// ── Capas ────────────────────────────────────────────────────
$('lyr-terrain').onchange = (e) => { if (terrain) terrain.group.visible = e.target.checked && !google; };
$('lyr-osm').onchange = (e) => { if (osm?.mesh) osm.mesh.visible = e.target.checked && !google; };
$('lyr-labels').onchange = (e) => document.body.classList.toggle('labels-off', !e.target.checked);
$('lyr-club').onchange = (e) => { clubRoot.visible = e.target.checked; };
$('panel-toggle').onclick = () => $('panel').classList.toggle('collapsed');
if (innerWidth < 720) $('panel').classList.add('collapsed');

// ── Captura y compartir ──────────────────────────────────────
$('btn-shot').onclick = () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dorado-club-3d.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
};
$('btn-share').onclick = async () => {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('lat', CONFIG.lat.toFixed(6));
  u.searchParams.set('lon', CONFIG.lon.toFixed(6));
  u.searchParams.set('heading', String(CONFIG.heading));
  try { await navigator.clipboard.writeText(u.toString()); setStatus('Enlace copiado al portapapeles', 2500); } catch { prompt('Copia este enlace:', u.toString()); }
};
$('compass').onclick = () => {
  const d = camera.position.distanceTo(controls.target);
  flyTo(controls.target.clone().add(new THREE.Vector3(0, d * 0.7, d * 0.7)), controls.target.clone(), 1);
};

// ── Caminar (primera persona) ────────────────────────────────
const walk = new PointerLockControls(camera, document.body);
const keys = {};
let orbitBackup = null;
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
$('btn-walk').onclick = () => {
  stopTour(); anim = null;
  orbitBackup = { p: camera.position.clone(), t: controls.target.clone() };
  const gate = club.elements.get('entrada');
  const start = new THREE.Vector3(0, 0, 30);
  if (gate) {
    gate.updateMatrixWorld(true);
    start.set(0, 0, -8).applyMatrix4(gate.matrixWorld);
  }
  camera.position.set(start.x, 1.7, start.z);
  const look = new THREE.Vector3(0, 1.7, 0);
  club.root.localToWorld(look.set(0, 1.7, 0));
  camera.lookAt(look);
  walk.lock();
};
walk.addEventListener('lock', () => { controls.enabled = false; $('walk-help').classList.remove('hidden'); });
walk.addEventListener('unlock', () => {
  controls.enabled = true;
  $('walk-help').classList.add('hidden');
  if (orbitBackup) { camera.position.copy(orbitBackup.p); controls.target.copy(orbitBackup.t); camera.lookAt(orbitBackup.t); }
});
const tmpV = new THREE.Vector3();
function updateWalk(dt) {
  if (!walk.isLocked) return;
  const speed = keys.ShiftLeft || keys.ShiftRight ? 9 : 4;
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (f) walk.moveForward(f * speed * dt);
  if (r) walk.moveRight(r * speed * dt);
  // altura del suelo
  tmpV.copy(camera.position);
  clubRoot.worldToLocal(tmpV);
  const inside = pointInSite(layout, tmpV.x, tmpV.z);
  const ground = inside || !terrain ? 0 : terrain.heightAt(camera.position.x, camera.position.z);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, ground + 1.7, 0.25);
}

// ── Modo edición ─────────────────────────────────────────────
let editing = false;
let selected = null;
const tcontrols = new TransformControls(camera, renderer.domElement);
tcontrols.setTranslationSnap(0.5);
tcontrols.setRotationSnap(5 * DEG);
tcontrols.showY = false;
const tHelper = tcontrols.getHelper();
tHelper.visible = false;
scene.add(tHelper);
tcontrols.addEventListener('dragging-changed', (e) => {
  controls.enabled = !e.value;
  if (!e.value && selected) {
    club.syncFromObject(selected);
    saveLayout();
    if (selected.userData.element.type === 'gate') { const id = selected.userData.element.id; buildClub(); selectElement(id); }
  }
});
tcontrols.addEventListener('objectChange', () => {
  if (!selected) return;
  selected.position.y = 0;
  club.syncFromObject(selected);
  fillEditorFields(selected.userData.element);
});

function setSiteBase(alpha) { club?.setSiteBaseOpacity(alpha); }
function saveLayout() { store.set('layout', layout); }

function populateEditorSelect() {
  const sel = $('ed-select');
  sel.innerHTML = layout.elements.map((e) => `<option value="${e.id}">${e.name || e.id}</option>`).join('');
  if (selected) sel.value = selected.userData.element.id;
}
function fillEditorFields(e) {
  $('ed-x').value = e.x; $('ed-z').value = e.z; $('ed-rot').value = e.rot || 0;
  $('ed-w').value = e.w ?? ''; $('ed-d').value = e.d ?? '';
  $('ed-d').disabled = e.d === undefined;
}
function selectElement(id) {
  const obj = club.elements.get(id);
  if (!obj) return;
  selected = obj;
  tcontrols.attach(obj);
  $('ed-select').value = id;
  fillEditorFields(obj.userData.element);
}
function openEditor() {
  editing = true;
  stopTour();
  document.body.classList.add('editing');
  $('editor').classList.remove('hidden');
  $('btn-edit').classList.add('active');
  tHelper.visible = true;
  populateEditorSelect();
  $('geo-lat').value = CONFIG.lat; $('geo-lon').value = CONFIG.lon; $('geo-heading').value = CONFIG.heading;
  setSiteBase(+$('ed-base').value);
  selectElement($('ed-select').value || layout.elements[0].id);
  // vista cenital para alinear con la foto satelital
  flyTo(new THREE.Vector3(5, 210, 20), new THREE.Vector3(5, 0, -2), 1.4);
}
function closeEditor() {
  editing = false;
  document.body.classList.remove('editing');
  $('editor').classList.add('hidden');
  $('btn-edit').classList.remove('active');
  tcontrols.detach();
  tHelper.visible = false;
  selected = null;
  setSiteBase(1);
}
$('btn-edit').onclick = () => (editing ? closeEditor() : openEditor());
$('edit-close').onclick = closeEditor;
$('ed-select').onchange = (e) => selectElement(e.target.value);
$('ed-move').onclick = () => { tcontrols.setMode('translate'); tcontrols.showX = tcontrols.showZ = true; tcontrols.showY = false; $('ed-move').classList.add('gold'); $('ed-rotate').classList.remove('gold'); };
$('ed-rotate').onclick = () => { tcontrols.setMode('rotate'); tcontrols.showX = tcontrols.showZ = false; tcontrols.showY = true; $('ed-rotate').classList.add('gold'); $('ed-move').classList.remove('gold'); };
addEventListener('keydown', (e) => {
  if (!editing || e.target.tagName === 'INPUT') return;
  if (e.key === 't' || e.key === 'T') $('ed-move').click();
  if (e.key === 'r' || e.key === 'R') $('ed-rotate').click();
});
$('ed-apply').onclick = () => {
  if (!selected) return;
  const e = selected.userData.element;
  e.x = +$('ed-x').value; e.z = +$('ed-z').value; e.rot = +$('ed-rot').value;
  if ($('ed-w').value !== '') e.w = +$('ed-w').value;
  if (e.d !== undefined && $('ed-d').value !== '') e.d = +$('ed-d').value;
  saveLayout();
  const id = e.id;
  buildClub();
  selectElement(id);
};
$('ed-base').oninput = (e) => setSiteBase(+e.target.value);
$('geo-heading').oninput = (e) => {
  CONFIG.heading = +e.target.value || 0;
  clubRoot.rotation.y = -CONFIG.heading * DEG;
};
$('geo-apply').onclick = () => {
  const lat = +$('geo-lat').value, lon = +$('geo-lon').value, heading = +$('geo-heading').value || 0;
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return setStatus('Coordenadas no válidas', 2500);
  store.set('geo', { lat, lon, heading });
  const u = new URL(location.href);
  u.search = '';
  location.href = u.toString();
};
$('ed-export').onclick = () => {
  const data = JSON.stringify({ geo: { lat: CONFIG.lat, lon: CONFIG.lon, heading: CONFIG.heading }, layout }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = 'dorado-club-layout.json';
  a.click();
};
$('ed-import').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const l = data.layout || data;
    if (!Array.isArray(l.elements)) throw new Error('JSON sin elementos');
    layout = l;
    saveLayout();
    if (data.geo) { store.set('geo', data.geo); location.reload(); return; }
    buildClub();
    setStatus('Distribución importada', 2500);
  } catch (err) { setStatus('No se pudo importar: ' + err.message, 4000); }
};
$('ed-reset').onclick = () => {
  if (!confirm('¿Restablecer la distribución y la ubicación originales?')) return;
  store.del('layout'); store.del('geo');
  location.href = location.pathname;
};

// ── Google Photorealistic 3D Tiles ───────────────────────────
$('g-key').value = CONFIG.googleApiKey || store.get('googleKey', '');
let siteShape = null;
function getSiteShape() {
  if (!siteShape) {
    const shape = new THREE.Shape(layout.site.polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    siteShape = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    siteShape.position.y = -0.5;
  }
  siteShape.rotation.y = clubRoot.rotation.y;
  siteShape.updateMatrixWorld(true);
  return siteShape;
}
$('btn-google').onclick = async () => {
  if (google) {
    google.dispose();
    google = null;
    $('btn-google').textContent = 'Activar';
    $('g-attrib').textContent = '';
    $('g-status').textContent = '';
    if (terrain) terrain.group.visible = $('lyr-terrain').checked;
    if (osm?.mesh) osm.mesh.visible = $('lyr-osm').checked;
    return;
  }
  const key = $('g-key').value.trim();
  if (!key) { $('g-status').textContent = 'Pega primero tu API key de Google Maps Platform.'; return; }
  store.set('googleKey', key);
  $('g-status').textContent = 'Cargando teselas 3D de Google…';
  try {
    const { Google3D } = await import('./google3d.js');
    google = new Google3D({
      scene, camera, renderer, lat: CONFIG.lat, lon: CONFIG.lon,
      onAttribution: (t) => { $('g-attrib').textContent = t ? ' · Google 3D: ' + t : ' · Google'; },
    });
    google.onCalibrated = () => {
      $('g-status').textContent = 'Google 3D activo. Puedes ocultar el modelo del club en “Capas” para ver solo la fotogrametría.';
      if ($('g-flatten').checked) google.flattenSite(getSiteShape());
    };
    await google.start(key);
    $('btn-google').textContent = 'Desactivar';
    if (terrain) terrain.group.visible = false;
    if (osm?.mesh) osm.mesh.visible = false;
    setTimeout(() => {
      if (google && google.groundY === null) $('g-status').textContent = 'No llegan teselas. Revisa que la API key tenga “Map Tiles API” habilitada y facturación activa.' + (google.error ? ` (${google.error.message || google.error})` : '');
    }, 12000);
  } catch (err) {
    console.error(err);
    $('g-status').textContent = 'Error al iniciar Google 3D: ' + err.message;
    google = null;
  }
};
$('g-flatten').onchange = (e) => { if (google) google.flattenSite(e.target.checked ? getSiteShape() : null); };

// ── Brújula ──────────────────────────────────────────────────
const compassEl = $('compass');
function updateCompass() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const az = Math.atan2(dir.x, -dir.z); // 0 = mirando al norte
  compassEl.style.transform = `rotate(${-az}rad)`;
}

// ── Etiquetas: ocultar las que se superponen ────────────────
let lastDeclutter = 0;
const _lp = new THREE.Vector3();
function declutterLabels() {
  const rects = [];
  const W = innerWidth, H = innerHeight;
  for (const l of labels) {
    const el = l.element;
    if (!l.parent || !el.isConnected) continue;
    l.getWorldPosition(_lp);
    _lp.project(camera);
    const x = (_lp.x * 0.5 + 0.5) * W, y = (-_lp.y * 0.5 + 0.5) * H;
    const w = el.offsetWidth || 80, h = el.offsetHeight || 22;
    const r = [x - w / 2 - 3, y - h - 3, x + w / 2 + 3, y + 3];
    const hit = rects.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
    el.style.visibility = hit ? 'hidden' : '';
    if (!hit) rects.push(r);
  }
}

// ── Bucle ────────────────────────────────────────────────────
const clock = new THREE.Clock();
let lastFocus = new THREE.Vector3(1e9, 0, 0);
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (anim) {
    const t = Math.min(1, (performance.now() - anim.start) / anim.dur);
    const k = ease(t);
    camera.position.lerpVectors(anim.p0, anim.p1, k);
    controls.target.lerpVectors(anim.t0, anim.t1, k);
    if (t >= 1) anim = null;
  }
  if (walk.isLocked) updateWalk(dt);
  else controls.update(dt);
  // la sombra sigue a lo que se mira (dentro del área del club)
  const focus = (walk.isLocked ? camera.position : controls.target).clone().setY(0).clampLength(0, 400);
  if (focus.distanceToSquared(lastFocus) > 25) { env.focus(focus); lastFocus.copy(focus); }
  google?.update();
  updateCompass();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (performance.now() - lastDeclutter > 150) { lastDeclutter = performance.now(); declutterLabels(); }
  requestAnimationFrame(loop);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

// ── Arranque ─────────────────────────────────────────────────
function loadFont() {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 7000);
    new FontLoader().load(
      'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/helvetiker_bold.typeface.json',
      (f) => { clearTimeout(t); resolve(f); },
      undefined,
      () => { clearTimeout(t); resolve(null); },
    );
  });
}

function insideClub(x, z) {
  const p = new THREE.Vector3(x, 0, z);
  clubRoot.worldToLocal(p);
  return pointInSite(layout, p.x, p.z, 4);
}

async function loadSurroundings() {
  terrain = new Terrain(frame, CONFIG, renderer);
  scene.add(terrain.group);
  setStatus('Descargando satélite y relieve… 0%');
  let info;
  try {
    info = await terrain.load((p) => setStatus(`Descargando satélite y relieve… ${Math.round(p * 100)}%`));
  } catch (err) {
    console.warn(err);
    terrain.buildFallback();
    info = { imagery: false, dem: false };
  }
  terrain.group.visible = $('lyr-terrain').checked && !google;
  if (!info.imagery) setStatus('Sin conexión con el servidor de imágenes satelitales: se muestra un terreno genérico.', 6000);
  else setStatus('');

  // Puntos de referencia
  for (const lm of CONFIG.landmarks) {
    const p = frame.fromLatLon(lm.lat, lm.lon);
    const l = makeLabel(lm.name, 'landmark');
    l.position.set(p.x, terrain.heightAt(p.x, p.z) + 25, p.z);
    scene.add(l);
  }

  // Edificios y calles de OSM
  setStatus('Cargando edificios del entorno (OpenStreetMap)…');
  try {
    osm = await loadOSM(frame, CONFIG, (x, z) => terrain.heightAt(x, z), insideClub);
  } catch (err) { console.warn(err); osm = null; }
  if (osm?.mesh) {
    osm.mesh.visible = $('lyr-osm').checked && !google;
    scene.add(osm.mesh);
  }
  if (osm?.roads?.length) {
    for (const r of osm.roads.slice(0, 6)) {
      const l = makeLabel(r.name, 'road');
      l.position.set(r.x, terrain.heightAt(r.x, r.z) + 4, r.z);
      scene.add(l);
    }
    if (!info.imagery) {
      const ribbons = roadRibbons(osm.roads, (x, z) => terrain.heightAt(x, z));
      if (ribbons) terrain.group.add(ribbons);
    }
  }
  if (osm?.dorado?.length) console.info('OSM: elementos llamados "Dorado" cerca:', osm.dorado);
  setStatus(osm ? `Listo · ${osm.count} edificios vecinos cargados` : 'No se pudo conectar con OpenStreetMap (se omiten edificios vecinos).', 4000);
}

(async function init() {
  const bar = $('loader-bar');
  bar.style.width = '25%';
  const font = await loadFont();
  setFont(font);
  bar.style.width = '60%';
  setTime(10);
  buildClub();
  bar.style.width = '100%';
  loop();
  setTimeout(() => $('loader').classList.add('fade'), 250);
  setTimeout(() => $('loader').remove(), 1000);
  overview();
  loadSurroundings();
  // exponer para depuración
  Object.assign(window, { THREE, scene, camera, controls, renderer, getClub: () => club, getTerrain: () => terrain });
})();
