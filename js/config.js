// ─────────────────────────────────────────────────────────────
//  Configuración general del modelo 3D de Dorado Club
// ─────────────────────────────────────────────────────────────
//  Coordenadas del centro del terreno del club (C.C. El Dorado, OSM way
//  437515376), Av. Martín Marciales, detrás del C.C. Baratta, Pueblo Nuevo,
//  San Cristóbal, Táchira. Se pueden ajustar desde el "Modo edición" o con
//  parámetros en la URL:  index.html?lat=7.78615&lon=-72.21425&heading=0
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  name: 'Dorado Club',
  address: 'Av. Martín Marciales, Pueblo Nuevo · San Cristóbal, Táchira, Venezuela',

  // Centro del terreno del club (WGS84)
  lat: 7.78615,
  lon: -72.21425,
  // Rotación del club respecto al norte (grados, sentido horario)
  heading: 0,

  // Fuentes de datos gratuitas (sin API key)
  sources: {
    // Ortofoto satelital Esri World Imagery (uso no comercial / con atribución)
    imagery: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // Modelo digital de elevación (AWS Terrain Tiles, formato Terrarium)
    elevation: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    // Edificios y calles de OpenStreetMap vía Overpass API
    overpass: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ],
  },

  // Anillos de imagen satelital (tamaño en metros y nivel de zoom)
  terrain: {
    demZoom: 14,
    rings: [
      { size: 12000, zoom: 14, segments: 160 },
      { size: 3200, zoom: 16, segments: 160 },
      { size: 900, zoom: 18, segments: 160 },
    ],
    // Radio (m) alrededor del club que se aplana para asentar el modelo
    flattenInner: 95,
    flattenOuter: 190,
  },

  osm: {
    buildingRadius: 850,
  },

  // Puntos de referencia cercanos (para orientarse)
  landmarks: [
    { name: 'C.C. Baratta', lat: 7.78714, lon: -72.21457 },
    { name: 'Estadio Polideportivo de Pueblo Nuevo', lat: 7.78639, lon: -72.19778 },
  ],

  // Google Photorealistic 3D Tiles (opcional). Se puede escribir aquí o
  // pegar en la interfaz (se guarda solo en el navegador del usuario).
  googleApiKey: '',
};

// Permite sobrescribir lat/lon/heading desde la URL
const params = new URLSearchParams(location.search);
for (const k of ['lat', 'lon', 'heading']) {
  if (params.has(k) && !Number.isNaN(parseFloat(params.get(k)))) CONFIG[k] = parseFloat(params.get(k));
}
if (params.has('key')) CONFIG.googleApiKey = params.get('key');
