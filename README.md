# Dorado Club 3D

Modelo 3D interactivo de **Dorado Club** (C.C. El Dorado), en la Av. Martín Marciales, Pueblo Nuevo, San Cristóbal, estado Táchira, Venezuela. Está detrás del C.C. Baratta.

Funciona en el navegador con **Three.js (WebGL2)**. Usa datos geográficos reales y gratuitos: foto satelital, relieve y edificios vecinos. Como opción, puede mostrar la fotogrametría de **Google Earth** (Photorealistic 3D Tiles).

## ¿Cómo se hizo el modelo?

El club se modeló a partir de lo que se ve hoy desde el aire:

| Fuente | Qué aporta |
|---|---|
| Ortofoto **Esri / Vantor del 1 de noviembre de 2025** (0,34 m/píxel) | Lo que existe hoy y las medidas de cada estructura |
| Imagen de **Bing** (más antigua y más nítida) | Detalles de las estructuras que no han cambiado |
| **OpenStreetMap**: polígono *Centro Comercial El Dorado* (way 437515376) y la vía *Avenida Martín Marciales* | Linderos del terreno y la vía de acceso |
| Reseñas públicas del club | Usos: futbolito, feria de comida, bar, gimnasio, área infantil, locales y estacionamiento |
| **AWS Terrain Tiles** | Relieve real (unos 950 m s. n. m.) |

**Qué está medido:** la posición, el tamaño y la orientación de las canchas, la cancha azul, el arco de la feria de comida, el techo rojo, el galpón del este, los estacionamientos, el muro perimetral y los árboles.

**Qué es interpretación:** las alturas, las fachadas, los interiores y el uso exacto de algunos locales. Por ejemplo, se supone que el galpón del este es el gimnasio. Esto no se ve desde el aire y se puede corregir con el **Modo edición**.

### Lo que hay en el modelo

- **Cancha 1 y Cancha 2**: futbolito de grama sintética oscura, en el lado oeste.
- **Cancha 3**: superficie azul, multiuso o fútbol sala.
- **Cancha 4**: fútbol 7. Es la más grande y la más reciente: en la foto vieja ese espacio todavía era de tierra.
- **Feria de comida**: estructura en arco con techos verdes. Dentro del arco está el **bar o restaurante** de techo rojo.
- **Gimnasio**: galpón de techo verde claro, con **locales comerciales** al lado.
- **Recepción y entrada**: en la esquina noreste, desde la Av. Martín Marciales.
- **Estacionamiento principal** al norte, **estacionamiento lateral** al oeste y **área infantil** con toldo azul.

## Funciones

- **Vista general**, **recorrido automático** y lista de lugares con ficha informativa.
- **Hora del día** con el sol real de San Cristóbal. De noche se encienden los reflectores de las canchas.
- **Caminar** en primera persona: W A S D para moverse, Shift para correr y Esc para salir. Solo en computadora.
- **Capas**: satélite y relieve, edificios vecinos de OSM, etiquetas y modelo del club.
- **Modo edición**: mover, rotar y cambiar el tamaño de cada elemento sobre la foto satelital. Se puede exportar e importar el resultado en JSON.
- **Google 3D (opcional)**: muestra la fotogrametría de Google Earth y aplana el terreno bajo el club.
- **Captura PNG** y **enlace para compartir**.

## Ejecutar en tu computadora

No hace falta instalar nada. Basta con un servidor web estático:

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```

## Publicarlo gratis (GitHub Pages)

El repositorio incluye `.github/workflows/pages.yml`. Para activarlo:

1. En GitHub, ve a **Settings → Pages → Build and deployment → Source** y elige **GitHub Actions**.
2. Haz push a la rama `main`, o ejecuta el workflow a mano desde **Actions**.
3. El sitio queda publicado en `https://<usuario>.github.io/Dorado3D/`.

También sirve cualquier hosting estático gratuito, como Netlify, Cloudflare Pages o Vercel.

## Ajustar el modelo

1. Abre **Herramientas → Modo edición**. La cámara pasa a vista cenital.
2. Baja la *transparencia del césped base* para ver la foto satelital debajo del modelo.
3. Selecciona un elemento, haciendo clic sobre él o desde la lista, y muévelo (T), rótalo (R) o cambia sus medidas.
4. Haz clic en **Exportar JSON** y copia la parte `layout` en `js/layout.js` para que el cambio quede publicado para todos.

## Google Earth 3D (opcional)

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Activa la **Map Tiles API**.
3. Crea una **API key** y restríngela a tu dominio.
4. Pégala en el panel **Google 3D** y pulsa **Activar**.

Google ofrece un cupo mensual gratuito, pero exige una cuenta de facturación. Sin la key, el modelo funciona igual con los datos gratuitos.

## Estructura

```
index.html          interfaz y mapa de importaciones (Three.js por CDN)
css/style.css       estilos
js/config.js        coordenadas, fuentes de datos y anillos de terreno
js/layout.js        distribución real del club (editable)
js/club.js          construcción procedural de cada estructura
js/terrain.js       relieve y ortofoto por anillos de detalle
js/osm.js           edificios y calles de OpenStreetMap (Overpass)
js/environment.js   cielo, sol, día y noche
js/google3d.js      Google Photorealistic 3D Tiles (opcional)
js/main.js          cámara, controles, recorrido, edición y caminar
```

## Créditos y licencias de datos

- Imágenes satelitales © Esri, Vantor/Maxar, Earthstar Geographics. Esri World Imagery se puede usar gratis con atribución. Para un uso comercial intensivo, revisa los términos de Esri.
- Relieve: AWS Terrain Tiles (Mapzen, SRTM y otras fuentes).
- Edificios y calles © colaboradores de OpenStreetMap (ODbL).
- Google 3D Tiles © Google. Las atribuciones se muestran en pantalla cuando el modo está activo.
- Librerías: [Three.js](https://threejs.org) (MIT) y [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS) (Apache-2.0).
