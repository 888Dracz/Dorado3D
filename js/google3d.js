// ─────────────────────────────────────────────────────────────
//  Modo opcional: Google Photorealistic 3D Tiles (lo que se ve en
//  Google Earth), renderizado con 3d-tiles-renderer sobre Three.js.
//  Requiere una API key de Google Maps Platform con "Map Tiles API"
//  habilitada (Google ofrece un cupo mensual gratuito).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const D2R = Math.PI / 180;

export class Google3D {
  constructor({ scene, camera, renderer, lat, lon, onAttribution }) {
    Object.assign(this, { scene, camera, renderer, lat, lon, onAttribution });
    this.root = new THREE.Group();
    this.root.name = 'Google3DTiles';
    this.tiles = null;
    this.groundY = null;
    this._ray = new THREE.Raycaster();
    this._calib = 0;
  }

  async start(apiKey) {
    const [{ TilesRenderer }, plugins] = await Promise.all([
      import('3d-tiles-renderer'),
      import('3d-tiles-renderer/plugins'),
    ]);
    const { GoogleCloudAuthPlugin, ReorientationPlugin, TileCompressionPlugin, TilesFadePlugin, TileFlatteningPlugin } = plugins;
    const tiles = new TilesRenderer();
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new TilesFadePlugin());
    tiles.registerPlugin(new ReorientationPlugin({ lat: this.lat * D2R, lon: this.lon * D2R, height: 0, recenter: true }));
    this.flattening = TileFlatteningPlugin ? new TileFlatteningPlugin() : null;
    if (this.flattening) tiles.registerPlugin(this.flattening);
    tiles.errorTarget = 6;
    tiles.setCamera(this.camera);
    tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.root.add(tiles.group);
    this.scene.add(this.root);
    this.tiles = tiles;

    let failed = null;
    tiles.addEventListener('load-error', (e) => { failed = e?.error || e; console.warn('Google 3D', e); });
    this._failed = () => failed;
    return tiles;
  }

  // Encuentra la altura del suelo bajo el club y ajusta el conjunto
  _calibrate() {
    this._ray.set(new THREE.Vector3(0, 3000, 0), new THREE.Vector3(0, -1, 0));
    this._ray.far = 6000;
    const prev = this.root.position.y;
    const hits = this._ray.intersectObject(this.tiles.group, true);
    if (hits.length) {
      // altura del punto más bajo cercano al centro (para evitar techos/árboles)
      const pts = [];
      for (const [dx, dz] of [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30], [45, 35], [-45, -35]]) {
        this._ray.set(new THREE.Vector3(dx, 3000, dz), new THREE.Vector3(0, -1, 0));
        const h = this._ray.intersectObject(this.tiles.group, true)[0];
        if (h) pts.push(h.point.y - prev);
      }
      pts.sort((a, b) => a - b);
      const ground = pts[Math.floor(pts.length * 0.25)];
      this.groundY = ground;
      this.root.position.y = -ground;
      return true;
    }
    return false;
  }

  // Aplana la malla de Google dentro del terreno del club para asentar el modelo
  flattenSite(siteMesh) {
    if (!this.flattening || !this.tiles) return;
    try {
      this.flattening.clearShapes();
      if (!siteMesh) return;
      this.tiles.group.updateMatrixWorld(true);
      const inv = this.tiles.group.matrixWorld.clone().invert();
      const shape = siteMesh.clone();
      siteMesh.updateMatrixWorld(true);
      shape.matrix.copy(inv).multiply(siteMesh.matrixWorld);
      shape.matrix.decompose(shape.position, shape.quaternion, shape.scale);
      const dir = new THREE.Vector3(0, -1, 0).transformDirection(inv);
      this.flattening.addShape(shape, dir, { threshold: 60 });
    } catch (e) {
      console.warn('No se pudo aplanar', e);
    }
  }

  update() {
    if (!this.tiles) return;
    this.camera.updateMatrixWorld();
    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.tiles.update();
    // recalibrar la altura durante los primeros segundos mientras cargan teselas
    const now = performance.now();
    if (now - this._calib > 1500 && (this._calibCount ?? 0) < 12) {
      this._calib = now;
      if (this._calibrate()) {
        this._calibCount = (this._calibCount ?? 0) + 1;
        this.onCalibrated?.(this.groundY);
      }
    }
    if (this.onAttribution && now - (this._attrT || 0) > 2000) {
      this._attrT = now;
      const a = this.tiles.getAttributions?.() || [];
      this.onAttribution(a.filter((x) => x.type === 'string').map((x) => x.value).join(' · '));
    }
  }

  get error() { return this._failed?.(); }

  dispose() {
    if (!this.tiles) return;
    this.scene.remove(this.root);
    this.tiles.dispose();
    this.tiles = null;
  }
}
