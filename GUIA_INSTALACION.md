# 📘 Guía de Instalación: Mapa de Coautorías (Versión Prácticas UR)

Carpeta dedicada al despliegue de la visualización interactiva de la red de investigadores y coautorías (basada en D3.js).

---

## 📁 Archivos y Responsabilidades

### 1. `index.html`
- **Contenido**: Estructura principal, paneles de información (sidebar, leyenda, tooltip flotante) y el contenedor SVG principal para el grafo.
- **Detalle**: Incluye las llamadas a los CDNs de fuentes (Google Fonts) y D3.js, además de incluir la barra de búsqueda y el toggle de capas (Proyectos vs Publicaciones).

### 2. `network_logic.js`
- **Contenido**: Motor interactivo de D3.js v7.
- **Detalle**: Maneja toda la simulación física de nodos (fuerzas, colisiones, centro), el dimming en el hover, el filtrado dinámico por facultades y la renderización del sidebar con estadísticas de cada investigador. Además, se encarga de cargar `baseData.json`.

### 3. `legend_styles.css`
- **Contenido**: Hoja de estilos dedicada a la apariencia del mapa interactivo.
- **Detalle**: Controla las transiciones fluidas, el diseño de cristal (glassmorphism) de las tarjetas de información y la pantalla cinemática de carga inicial.

### 4. `baseData.json`
- **Contenido**: Datos estáticos pre-calculados (nodos y aristas, tanto para publicaciones como para proyectos) extraídos de HUB-UR / VIVO mediante SPARQL.
- **Detalle**: Funciona como caché para que la visualización sea instantánea y no requiera procesamiento en tiempo de ejecución de consultas pesadas en el triplestore.

---

## 🚀 Pasos para la Instalación

1. **Ubicación en el Entorno**: En el servidor donde corre el HUB, identifica la carpeta donde se alojan los archivos estáticos de este mapa (por ejemplo, dentro de `webapps/ROOT/mapadeCoauthor/` o similar, según la configuración del entorno local/servidor).
2. **Copia de Seguridad**: Realiza una copia de seguridad de los archivos anteriores si ya existía una versión de este mapa.
3. **Despliegue**: Copia los 4 archivos (`index.html`, `network_logic.js`, `legend_styles.css`, `baseData.json`) reemplazando los existentes en el servidor.
4. **Verificación en el Navegador**:
   - Acceder a la URL donde se haya mapeado el archivo HTML del mapa (generalmente `/mapadeCoauthor/index.html` o incrustado en otra página).
   - Presionar **Ctrl + Shift + R** (Hard Refresh) para evadir la caché del navegador y obligar la descarga del JS/CSS actualizados.
   - Verificar la consola de desarrollador (F12) para asegurarse de que no haya errores 404 ni problemas de CORS al intentar solicitar `baseData.json`.

---

## ⚠️ Notas Importantes
- **CDNs Externos**: El mapa requiere conexión a internet por parte del usuario final para cargar `d3.v7.min.js` y las tipografías de Google Fonts (`Inter`).
- **Actualización de Datos**: Si a futuro se requiere actualizar los datos que muestra el mapa, basta con reemplazar el archivo `baseData.json` por uno nuevo con la misma estructura JSON, sin necesidad de tocar `network_logic.js` ni `index.html`.
