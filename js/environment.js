// Cielo, sol real según hora/fecha en San Cristóbal, día/noche
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const D2R = Math.PI / 180;

// Posición solar aproximada (precisión suficiente para visualización)
export function sunDirection(latDeg, date, hour) {
  const start = new Date(date.getFullYear(), 0, 0);
  const doy = Math.floor((date - start) / 86400000);
  const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (doy + 10)) * D2R;
  const lat = latDeg * D2R;
  const H = (hour - 12) * 15 * D2R;
  const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H));
  // acimut desde el sur, positivo hacia el oeste
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
  const azN = azS + Math.PI; // desde el norte, sentido horario
  return {
    elevation: el,
    vector: new THREE.Vector3(Math.sin(azN) * Math.cos(el), Math.sin(el), -Math.cos(azN) * Math.cos(el)),
  };
}

export class Environment {
  constructor(scene, renderer, lat) {
    this.scene = scene;
    this.renderer = renderer;
    this.lat = lat;

    this.sky = new Sky();
    this.sky.scale.setScalar(40000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
    this.sun.castShadow = true;
    const isMobile = matchMedia('(pointer: coarse)').matches;
    this.sun.shadow.mapSize.set(isMobile ? 2048 : 4096, isMobile ? 2048 : 4096);
    const s = this.sun.shadow.camera;
    s.left = -110; s.right = 110; s.top = 110; s.bottom = -110; s.near = 10; s.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b5d45, 0.9);
    scene.add(this.hemi);

    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();

    scene.fog = new THREE.FogExp2(0xc8d6e3, 0.00016);

    this._stars();
    this.night = false;
    this.listeners = [];
  }

  _stars() {
    const n = 2500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.05;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 15000;
      pos[i * 3 + 1] = Math.cos(ph) * 15000;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 15000;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  onChange(fn) { this.listeners.push(fn); }

  // hour: 0–24
  setTime(hour, date = new Date()) {
    this.hour = hour;
    const { elevation, vector } = sunDirection(this.lat, date, hour);
    const day = THREE.MathUtils.smoothstep(elevation / D2R, -6, 8);
    const night = elevation / D2R < -2;

    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(vector);
    u.rayleigh.value = THREE.MathUtils.lerp(0.4, 1.6, day);

    // de noche la "luz del sol" pasa a ser luz de luna
    this.sunVec = night ? new THREE.Vector3(-120, 260, 90).normalize() : vector;
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunVec, 400);
    if (night) {
      this.sun.color.set(0x9db4ff);
      this.sun.intensity = 0.25;
    } else {
      const warm = THREE.MathUtils.smoothstep(elevation / D2R, 0, 25);
      this.sun.color.setRGB(1, 0.75 + 0.22 * warm, 0.55 + 0.38 * warm);
      this.sun.intensity = 3.2 * THREE.MathUtils.smoothstep(elevation / D2R, -2, 12);
    }
    this.hemi.intensity = 0.12 + 0.8 * day;
    this.hemi.color.set(night ? 0x3a4a70 : 0xcfe3ff);
    this.scene.environmentIntensity = 0.08 + 0.55 * day;
    this.scene.fog.color.set(night ? 0x0d1220 : 0xc8d6e3).lerp(new THREE.Color(0xe8b48a), (1 - day) * (night ? 0 : 0.6));
    this.renderer.toneMappingExposure = night ? 0.7 : 0.62;
    this.stars.visible = night;
    this.sky.visible = !night;
    this.scene.background = night ? new THREE.Color(0x060a16) : null;

    if (night !== this.night) {
      this.night = night;
      for (const fn of this.listeners) fn(night);
    }
  }

  // la sombra sigue al punto de interés
  focus(target) {
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(this.sunVec, 400);
  }
}
