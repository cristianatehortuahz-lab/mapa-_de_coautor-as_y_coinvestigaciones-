# Arquitectura HUB-UR: Mapa de Coautoría (D3.js)

**Proyecto:** Mapa de Coautoría y Coinvestigaciones  
**Tecnología:** D3.js v7 + SPARQL + JSP (VIVO 1.11+)  
**Versión:** frontend v3.17 · JSP v4.3 (síncrono)  
**Estado:** ✅ Desplegado en STAGING y alineado con el repositorio oficial  
**Última actualización:** 2026-07-17

---

## 🎯 Resumen Ejecutivo

El **Mapa de Coautoría** es una visualización interactiva D3.js que muestra:

- **Nodos:** Autores (internos y externos)
- **Aristas:** Colaboraciones (publicaciones, grants)
- **Interactividad:** Zoom, pan, búsqueda, exportación

**Versión desplegada:** frontend **v3.17** · JSP backend **v4.3 (síncrono)**

**Arquitectura de 3 capas:**

```
┌───────────────────────────────────────────────┐
│  FRONTEND — SPA D3.js v3.17                    │
│  (webapp /mapadeCoauthor/ ; en LOCAL:          │
│   ROOT/coauthorNetwork/)                       │
│  ├─ index.html        (cascarón, carga el JS)  │
│  ├─ network_logic.js  (lógica D3, v3.17)       │
│  └─ legend_styles.css (estilos UI)             │
│  Envuelto en VIVO por coauthorNetworkViz.ftl   │
└──────────────┬────────────────────────────────┘
               │ d3.json() a ruta ABSOLUTA:
               │ /HUBvivo115/js/coauthorNetworkViz/baseData.json
               ▼
┌───────────────────────────────────────────────┐
│  CACHÉ JSON estático (esquema *Pubs/*Grants)   │
│  HUBvivo115/js/coauthorNetworkViz/baseData.json│
└──────────────┬────────────────────────────────┘
               │ lo regenera de noche carga_mapa.sh (cron)
               ▼
┌───────────────────────────────────────────────┐
│  BACKEND — coauthorNetwork.jsp (v4.3 síncrono) │
│  endpoint /HUBvivo115/coauthorViz              │
│  └─ 4 consultas SPARQL                         │
└──────────────┬────────────────────────────────┘
               │ SPARQL
               ▼
┌───────────────────────────────────────────────┐
│  VIVO Triplestore (Jena/TDB2, RDF)             │
└───────────────────────────────────────────────┘
```

---

## 📦 Componentes Técnicos

### 1. Plantilla Freemarker: coauthorNetworkViz.ftl

**Ubicación:** `HUBvivo115/templates/freemarker/body/coauthorNetworkViz.ftl`

- Registra la página VIVO `/coauthorNetwork`
- Incrusta la SPA del mapa mediante iframe `100vw`
- Unifica el CSS de VIVO con `legend_styles.css`

### 2. Frontend SPA: index.html + network_logic.js (v3.17)

**Ubicación:** `mapadeCoauthor/` (webapp independiente en STAGING/PROD)

- `index.html` — cascarón que carga `network_logic.js?v=3.17`
- `network_logic.js` — toda la lógica D3: force simulation, zoom/pan,
  búsqueda, filtros, temas, y **fetch a la ruta absoluta** del `baseData.json`
- `legend_styles.css` — estilos UI (glassmorphism, dark/light)

> En LOCAL la SPA vive bajo `ROOT/coauthorNetwork/` (mismo contenido, otra ruta).

### 3. Backend JSP: coauthorNetwork.jsp (v4.3 síncrono)

**Ubicación:** `HUBvivo115/WEB-INF/custom/coauthorViz/coauthorNetwork.jsp`
**Endpoint:** `/HUBvivo115/coauthorViz`

**Responsabilidades:**
1. Ejecutar 4 consultas SPARQL de forma **síncrona** (bloquea hasta terminar)
2. Fusionar resultados en Java
3. Retornar el JSON completo en una sola respuesta HTTP
4. (El almacenamiento en `baseData.json` lo hace `carga_mapa.sh`, no el JSP)

### 4. SPARQL Queries

**Ubicación en STAGING:** `WEB-INF/classes/dataservice/coauthorViz/`

**4 queries:**
- `allNodes.rq` - Todos los autores
- `internalNodes.rq` - Autores internos
- `edges.rq` - Colaboraciones
- `sampleCopubs.rq` - Muestra

### 5. Estilos CSS

**Archivo:** `legend_styles.css` (~40KB, en el webapp del frontend)

- Nodos (círculos rojos UR #b91c2e) y aristas
- Tooltips, sidebar de estadísticas ego-network
- Tema claro/oscuro (glassmorphism), diseño responsive

### 6. Datos JSON: baseData.json (esquema v3.17)

**Ruta servida:** `/HUBvivo115/js/coauthorNetworkViz/baseData.json`

**Estructura (dividida por tipo de red):**
```json
{
  "nodesAll":            [ ...todos los autores... ],
  "nodesInternal":       [ ...autores internos UR... ],
  "edgesAllPubs":        [ ...coautorías (red completa)... ],
  "edgesInternalPubs":   [ ...coautorías (solo internos)... ],
  "edgesAllGrants":      [ ...coinvestigaciones (red completa)... ],
  "edgesInternalGrants": [ ...coinvestigaciones (solo internos)... ]
}
```

> ⚠️ El toggle **Proyectos** usa `edgesAllGrants` / `edgesInternalGrants`.
> Un JSON con esquema viejo (`edgesAll` / `edgesInternal`) deja Proyectos vacío.

**Tamaño:** ~6–8 MB (JSON estático regenerado por cron nocturno)

---

## 🔌 Flujo de Datos (v3.17 / JSP v4.3)

```
1. Usuario accede a la página VIVO /coauthorNetwork
2. La plantilla coauthorNetworkViz.ftl incrusta la SPA (iframe 100vw)
   servida desde el webapp /mapadeCoauthor/
3. network_logic.js hace fetch a la ruta ABSOLUTA:
   /HUBvivo115/js/coauthorNetworkViz/baseData.json   (JSON estático)
4. D3.js renderiza la red y habilita el toggle Publicaciones/Proyectos
5. Usuario interactúa (zoom, pan, búsqueda, filtros, temas)

El JSON estático lo regenera de noche el cron:
6. carga_mapa.sh hace curl a /HUBvivo115/coauthorViz (el JSP)
7. El JSP v4.3 ejecuta 4 consultas SPARQL de forma SÍNCRONA
8. Guarda la salida completa como baseData.json (esquema *Pubs/*Grants)
```

> ⚠️ El frontend **no** genera datos en caliente ni lee un JSON relativo:
> consume el archivo estático de la ruta absoluta anterior. Ver README §"Rutas críticas".

---

## 💾 Regeneración del caché (cron nocturno, no daemon)

- El `baseData.json` es **estático**; se regenera 1 vez/día vía `carga_mapa.sh` (01:00 AM).
- El JSP v4.3 es **síncrono**: bloquea 15–60 s hasta terminar las 4 consultas SPARQL.
- No hay hilo daemon en background (eso era de versiones previas v4.2).
- Sirve siempre desde el archivo estático → respuesta <1 s al usuario.

---

## 🚀 Despliegue por Ambiente

El mapa solo necesita **Tomcat/VIVO, la base de datos (MySQL) y Solr**.
Funciona igual en los tres ambientes (LOCAL, STAGING, PRODUCCIÓN).

```
Servicios que usa el mapa (LOCAL / STAGING / PRODUCCIÓN):
├─ Tomcat/VIVO (8080)   ← sirve el frontend y ejecuta el JSP/SPARQL
├─ MySQL (3306)         ← base de datos VIVO
└─ Solr (8983)          ← búsqueda de VIVO

URL del frontend:  http://<host>:8080/mapadeCoauthor/
Página en VIVO:    http://<host>:8080/coauthorNetwork
```

> El único origen de datos del mapa es el `baseData.json`, generado por el JSP
> vía SPARQL contra el triplestore. No depende de ningún otro servicio externo.

---

**Documentación específica para Mapa de Coautoría**  
**Última actualización: 2026-07-17**

**Ver también:**
- `../README.md` → Resumen, rutas críticas y troubleshooting del mapa
- `02-structure/` → Inventario histórico del build legacy (pre-migración)
- `04-configuration/` → Cambios de configuración por ambiente
- `../../shared-reference/00-ARCHITECTURE-CHANGES.md` → Cambios arquitectónicos globales
