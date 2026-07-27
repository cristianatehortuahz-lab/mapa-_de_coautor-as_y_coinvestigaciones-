# Inventario — Mapa de Coautorías y Coinvestigaciones HUB-UR

Todos los archivos del repositorio, agrupados por función, con una línea de qué
hace cada uno. Para el flujo completo ver [`README.md`](README.md).

**Estado**, columna derecha: ✅ verificado contra el servidor de prácticas
(julio 2026) · ⚠️ diferencia detectada, pendiente de revisar cuál va adelante ·
— no aplica (doc / dato generado).

---

## Backend — Precálculo (webapp `HUBvivo115`)

| Archivo | Qué hace | Estado |
|---|---|---|
| [`coauthorNetwork.jsp`](coauthorNetwork.jsp) | Motor SPARQL síncrono (v4.3). Ejecuta 4 consultas (nodos internos, nodos externos, aristas internas, aristas externas), las fusiona en Java y devuelve el JSON completo en una sola respuesta. Se sirve en `/coauthorViz`. | ⚠️ el contenido difiere del servidor (444 líneas de diferencia); no se ha determinado cuál va adelante — pendiente de comparación dirigida |
| [`carga_mapa.sh`](carga_mapa.sh) | Script de cron: respalda el `baseData.json` anterior, pide el JSON al JSP y lo guarda como archivo estático. Se ejecuta una vez al día (la hora se fija en el crontab de root, no en este script). | — |
| [`baseData.json`](baseData.json) | Ejemplo/snapshot de los datos generados. Es un **dato**, no código: nunca va a coincidir exacto con el del servidor porque cambia cada noche. | ➖ dato generado, no aplica comparación |

## Frontend — Webapp propia `/mapadeCoauthor/` (aislada de VIVO)

| Archivo | Qué hace | Estado |
|---|---|---|
| [`index.html`](index.html) | Punto de entrada de la SPA del mapa. Se carga dentro del `<iframe>` que inyecta `coauthorNetworkViz.ftl`. | ⚠️ difiere del servidor (196 líneas) — pendiente de comparación dirigida |
| [`network_logic.js`](network_logic.js) | Motor de visualización D3.js: simulación de fuerzas, lectura de `baseData.json`, toggles Publicaciones/Proyectos, Ego-network, dark mode. | ⚠️ difiere del servidor (89 líneas) — pendiente de comparación dirigida |
| [`legend_styles.css`](legend_styles.css) | Estilos de la SPA: temas claro/oscuro, sidebars de estadísticas, tooltips, interfaz "Glassmorphism". | ⚠️ el servidor tiene **más** contenido que el repo (40237 vs. 35589 bytes) — el repo probablemente está desactualizado |

## Integración con VIVO

| Archivo | Qué hace | Estado |
|---|---|---|
| [`coauthorNetworkViz.ftl`](coauthorNetworkViz.ftl) | Plantilla FreeMarker de la ruta `/coauthorNetwork` (enlazada desde el menú en `header.ftl`, que **no** pertenece a este repo). Rompe el layout central de VIVO e incrusta la SPA en un `<iframe src="/mapadeCoauthor/">`, para que D3.js no choque con las dependencias de VIVO. | — |

## Documentación

| Archivo | Qué hace |
|---|---|
| [`README.md`](README.md) | Punto de entrada: características, flujo en tiempo de ejecución (precálculo nocturno + visita en vivo). |
| [`GUIA_INSTALACION_FINAL.md`](GUIA_INSTALACION_FINAL.md) | Instalación paso a paso en producción. |
| [`documentacion/README.md`](documentacion/README.md) | Índice: rutas críticas, esquema de datos, troubleshooting. |
| [`documentacion/01-architecture/`](documentacion/01-architecture/) | Arquitectura de 3 capas (SPA → JSON → JSP). |
| [`documentacion/02-structure/`](documentacion/02-structure/) | Estructura de datos del mapa. |
| [`documentacion/03-deployment/01-Staging-Deployment-Step-by-Step.md`](documentacion/03-deployment/01-Staging-Deployment-Step-by-Step.md) | Guía genérica de despliegue a prácticas. ⚠️ **Ojo:** aunque vive en este repo, sus ejemplos son mayoritariamente del **widget de CV** (44 menciones) y no del mapa (23). Sirve como procedimiento general de despliegue, no como guía específica de este módulo. |
| [`documentacion/03-deployment/02-Deploy-Real-y-Lecciones-2026-07-17.md`](documentacion/03-deployment/02-Deploy-Real-y-Lecciones-2026-07-17.md) | Bitácora del despliegue real del mapa (2026-07-17) y lecciones aprendidas. Este sí es específico del mapa. |
| [`documentacion/04-configuration/`](documentacion/04-configuration/) | Configuración por ambiente (LOCAL/STAGING/PROD). |

---

## Pendientes conocidos (a resolver en el servidor)

El servidor confirmó que **sí existe una webapp propia** `/opt/tomcat/webapps/mapadeCoauthor/`
(no está bajo `HUBvivo115`, a diferencia de los otros dos módulos), y sus 3
archivos de frontend **difieren en contenido** de los del repo — no solo en
saltos de línea. El JSP también difiere, y bastante (444 líneas).

**No se determinó todavía si el repo va adelante o atrás del servidor** en
ninguno de los 4 archivos. Para resolverlo sin necesidad de descargar los
archivos completos, la vía es comparar por bloques (hashes de tramos de ~150
líneas) hasta localizar las secciones exactas que cambiaron, y decidir
archivo por archivo cuál versión es la correcta antes de sincronizar.

Hasta que se resuelva, **no asumir que el repo del mapa es desplegable tal
cual**: verificar contra el servidor antes de usarlo en una evaluación.
