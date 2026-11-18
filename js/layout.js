// ─────────────────────────────────────────────────────────────
//  Distribución REAL de Dorado Club (C.C. El Dorado)
//  Medida sobre la ortofoto Esri/Vantor del 01-11-2025 (0,34 m/px),
//  contrastada con la imagen de Bing (más antigua, más nítida) y con
//  el polígono "Centro Comercial El Dorado" de OpenStreetMap (way 437515376).
//
//  Unidades: metros, sistema local del club
//    x → este     z → sur     rot → grados (sentido horario)
//    origen = lat 7.78615, lon -72.21425
//
//  Lo que se ve desde el aire está medido; lo que NO se ve desde el aire
//  (alturas, fachadas, interiores, uso exacto de cada local) es una
//  interpretación razonable y puede ajustarse en el "Modo edición".
// ─────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT = {
  version: 2,
  site: {
    // Muro perimetral (sentido horario, empezando en la esquina noroeste)
    polygon: [
      [-50, -59], [10, -51], [62, -45.5], [71, -45], [71, -25], [65, -24],
      [65, 46], [32, 48.5], [-12, 54], [-40, 54], [-62, 30], [-57, -16], [-55, -45],
    ],
  },
  elements: [
    // ── Canchas ──────────────────────────────────────────────
    {
      id: 'cancha1', type: 'field', x: -31.5, z: -11.5, rot: 90,
      w: 33, d: 19, format: 'F5', surface: 'dark',
      name: 'Cancha 1 · Futbolito',
      info: 'Cancha de futbolito (fútbol 5) de grama sintética oscura, ~23 × 37 m con bandas. Orientada norte–sur, junto al estacionamiento lateral.',
    },
    {
      id: 'cancha2', type: 'field', x: -30.5, z: 24.5, rot: 90,
      w: 27, d: 17, format: 'F5', surface: 'dark',
      name: 'Cancha 2 · Futbolito',
      info: 'Segunda cancha de futbolito de grama sintética, ~21 × 31 m, al sur de la Cancha 1 y separada por un pasillo.',
    },
    {
      id: 'cancha3', type: 'field', x: -8.5, z: 28, rot: 90,
      w: 24, d: 13, format: 'F5', surface: 'blue',
      name: 'Cancha 3 · Superficie azul',
      info: 'Cancha de superficie azul (~17 × 28 m), multiuso / fútbol sala. Es la de color azul intenso visible en la foto satelital.',
    },
    {
      id: 'cancha4', type: 'field', x: 14, z: 19.5, rot: 90,
      w: 37, d: 22, format: 'F7', surface: 'green',
      name: 'Cancha 4 · Fútbol 7',
      info: 'La cancha más grande (~26 × 41 m). En la imagen antigua (Bing) este espacio era de tierra; en la ortofoto de noviembre de 2025 ya aparece como cancha de grama.',
    },

    // ── Edificaciones ────────────────────────────────────────
    {
      id: 'feria', type: 'arc', x: -5, z: 5, rot: 0,
      r0: 27, r1: 37, a0: -12, a1: 68, segments: 8,
      name: 'Feria de comida',
      info: 'Estructura en arco con techos verdes y borde blanco: locales de comida alrededor de una zona de mesas. Las reseñas del club mencionan feria de comida y bar.',
    },
    {
      id: 'bar', type: 'house', x: -3, z: -13, rot: 0,
      w: 16, d: 12, h: 4.2, roof: 'gable', roofColor: 0xc4432f, wall: 0xefe4cf,
      openSide: 'south',
      name: 'Bar / Restaurante',
      info: 'Edificación de techo rojo a dos aguas dentro del arco de la feria de comida (uso interpretado como bar/restaurante).',
    },
    {
      id: 'kiosco', type: 'house', x: -6.5, z: 5, rot: 0,
      w: 11, d: 10, h: 3.8, roof: 'flat', roofColor: 0x3f7f4d, wall: 0xe9dfca,
      name: 'Local de techo verde',
      info: 'Local de un nivel con techo verde, entre las canchas 1, 3 y la feria de comida.',
    },
    {
      id: 'servicios', type: 'house', x: -7, z: 12, rot: 0,
      w: 10, d: 4, h: 3.2, roof: 'flat', roofColor: 0xf1f1ee, wall: 0xe9dfca,
      name: 'Baños y servicios',
    },
    {
      id: 'vestuario', type: 'house', x: -16.5, z: 1, rot: 0,
      w: 6, d: 8, h: 3.2, roof: 'flat', roofColor: 0xe6e3da, wall: 0xe9dfca,
      name: 'Vestuarios',
    },
    {
      id: 'gimnasio', type: 'house', x: 51.5, z: 17.5, rot: 0,
      w: 17, d: 31, h: 6.5, roof: 'gable', ridge: 'z', roofColor: 0x9fb89a, wall: 0xf0ebe0,
      openSide: 'west', windows: true,
      name: 'Gimnasio',
      info: 'Galpón largo de techo verde claro en el lado este del club (~17 × 31 m). Por su tamaño es la ubicación más probable del gimnasio que anuncia el club.',
    },
    {
      id: 'locales', type: 'shops', x: 61.5, z: 17, rot: 90,
      w: 26, d: 6, units: 5,
      name: 'Locales comerciales',
      info: 'Fila de locales con techo blanco junto al galpón este (las reseñas mencionan, entre otros, una tienda de mascotas).',
    },
    {
      id: 'anexo', type: 'house', x: 46.5, z: 39, rot: 0,
      w: 17, d: 10, h: 3.6, roof: 'flat', roofColor: 0xb9b3a6, wall: 0xe9dfca,
      name: 'Anexo sur',
    },
    {
      id: 'recepcion', type: 'house', x: 67.5, z: -33.5, rot: 180,
      w: 8, d: 12, h: 3.6, roof: 'flat', roofColor: 0xf3f3f1, wall: 0xe9dfca, sign: true,
      name: 'Recepción',
      info: 'Pequeña edificación de techo blanco en la esquina noreste, junto al acceso desde la Av. Martín Marciales.',
    },
    {
      id: 'caseta', type: 'house', x: 54, z: -7, rot: 0,
      w: 8, d: 4.5, h: 3, roof: 'flat', roofColor: 0xf3f3f1, wall: 0xe9dfca,
      name: 'Caseta',
    },
    {
      id: 'infantil', type: 'playground', x: 14, z: -40.5, rot: 7,
      w: 12, d: 10,
      name: 'Área infantil',
      info: 'Toldo azul en el borde sur del estacionamiento; las reseñas mencionan un área de juegos para niños.',
    },

    // ── Estacionamientos, accesos y áreas abiertas ───────────
    {
      id: 'estacionamiento', type: 'parking', x: 6, z: -45.3, rot: 7,
      w: 106, d: 13, rows: 2,
      name: 'Estacionamiento principal',
      info: 'Estacionamiento a lo largo del lindero norte, sobre la Av. Martín Marciales, frente a la parte trasera del C.C. Baratta.',
    },
    {
      id: 'estacionamiento2', type: 'parking', x: -47.5, z: -6, rot: 90,
      w: 66, d: 9, rows: 1,
      name: 'Estacionamiento lateral',
      info: 'Carril de estacionamiento a lo largo del lado oeste, junto a las canchas 1 y 2.',
    },
    {
      id: 'entrada', type: 'gate', x: 60, z: -46.5, rot: 187, w: 8,
      name: 'Entrada · Av. Martín Marciales',
      info: 'Acceso por la Av. Martín Marciales (la vía que bordea el club por el norte y gira hacia el norte en la esquina noreste, detrás del C.C. Baratta).',
    },
    { id: 'carril', type: 'paving', x: 60.5, z: -15, rot: 0, w: 7, d: 52, material: 'asphalt', name: 'Carril de servicio' },
    { id: 'pasillo1', type: 'paving', x: -31, z: 8, rot: 0, w: 24, d: 3, material: 'pavers', name: 'Pasillo entre canchas' },
    { id: 'pasillo2', type: 'paving', x: 37, z: -7, rot: 0, w: 38, d: 3, material: 'pavers', name: 'Pasillo este' },
    { id: 'plaza', type: 'paving', x: -12, z: -2, rot: 0, w: 14, d: 8, material: 'pavers', name: 'Plaza de la feria' },
    {
      id: 'jardin', type: 'green', x: 38, z: -21, rot: 0, w: 34, d: 18,
      name: 'Jardín',
      info: 'Área verde con césped entre el estacionamiento, la feria de comida y el galpón este.',
    },
  ],
  // Árboles (medidos de las copas visibles en la foto)
  trees: [
    { from: [-54, 40], to: [-20, 47], spacing: 7 },
    { from: [-14, 49], to: [28, 46], spacing: 7 },
    { from: [-56, 34], to: [-58, 0], spacing: 9 },
  ],
  treeClusters: [
    [30, 8, 1.4], [33, 18, 1.5], [30, 28, 1.3], [37, 12, 1.2], [-6, 46, 1.4], [3, 44, 1.1],
    [-18, -28, 1.0], [-45, -52, 1.0], [60, 2, 1.0], [26, 36, 1.2],
  ],
  palms: [[-17, -36], [24, -14], [-20, -5]],
};

export function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

// Punto dentro del polígono del club
export function pointInSite(layout, x, z, margin = 0) {
  const p = layout.site.polygon;
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  if (inside || margin <= 0) return inside;
  // cerca del borde
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[j], [bx, bz] = p[i];
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    if (Math.hypot(ax + vx * t - x, az + vz * t - z) < margin) return true;
  }
  return false;
}
