// Conversión geográfica: WGS84 ⇄ Web Mercator ⇄ metros locales
//   x → este, z → sur, y → arriba  (origen = centro del club)

const R = 6378137;
const D2R = Math.PI / 180;
export const WORLD = 2 * Math.PI * R;

export function lonLatToMerc(lon, lat) {
  return {
    x: R * lon * D2R,
    y: R * Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)),
  };
}

export function mercToLonLat(x, y) {
  return {
    lon: (x / R) / D2R,
    lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / D2R,
  };
}

export class LocalFrame {
  constructor(lat, lon) {
    this.lat = lat;
    this.lon = lon;
    this.origin = lonLatToMerc(lon, lat);
    // factor de escala Mercator en esta latitud
    this.k = Math.cos(lat * D2R);
  }
  // metros locales → Mercator
  toMerc(x, z) {
    return { x: this.origin.x + x / this.k, y: this.origin.y - z / this.k };
  }
  fromMerc(mx, my) {
    return { x: (mx - this.origin.x) * this.k, z: -(my - this.origin.y) * this.k };
  }
  fromLatLon(lat, lon) {
    const m = lonLatToMerc(lon, lat);
    return this.fromMerc(m.x, m.y);
  }
  toLatLon(x, z) {
    const m = this.toMerc(x, z);
    return mercToLonLat(m.x, m.y);
  }
}

// Índices de teselas XYZ
export function mercToTile(mx, my, z) {
  const n = 2 ** z;
  return {
    x: ((mx + WORLD / 2) / WORLD) * n,
    y: ((WORLD / 2 - my) / WORLD) * n,
  };
}

export function tileBoundsMerc(tx, ty, z) {
  const size = WORLD / 2 ** z;
  const minX = -WORLD / 2 + tx * size;
  const maxY = WORLD / 2 - ty * size;
  return { minX, maxX: minX + size, minY: maxY - size, maxY };
}

export function tileUrl(tpl, z, x, y) {
  return tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}
