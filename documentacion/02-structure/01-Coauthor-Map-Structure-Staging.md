# Estructura Real del Mapa de Coautoría en STAGING
**Extraído de: `/opt/tomcat/webapps/HUBvivo115/` en servidor staging**  
**Fecha: 2026-07-17**  
**Tamaño total: 53M (176 archivos funcionales)**

> ⚠️ **INVENTARIO HISTÓRICO (build legacy).** Este documento refleja el estado
> del mapa *tal como se encontró* en STAGING (motor `main.js`, plantilla
> `coauthorMaps.ftl`, caché con daemon). El **2026-07-17 STAGING se migró a la
> versión oficial del repo (frontend v3.17 / JSP v4.3)**: el motor pasó a ser
> `network_logic.js`, la plantilla a `coauthorNetworkViz.ftl`, y el caché a un
> archivo estático regenerado por cron (no daemon).
>
> Para los **nombres, rutas y esquema de datos actuales**, ver:
> `../README.md` y `../01-architecture/`.
> Conserva este archivo como referencia de lo que había antes de la migración.

---

## 📊 RESUMEN EJECUTIVO

```
MAPA DE COAUTORÍA EN STAGING
═════════════════════════════════════════════════════════════════

Backend:      4.8M   - JSP + SPARQL queries
Frontend:    48M     - D3.js + JSON data
Templates:   60K     - Freemarker
Styles:      44K     - CSS
Java:        20K     - SPARQL query files (.rq)
Images:     112K     - Icons/UI images
─────────────────────
Total:       53M     - 176 archivos funcionales
```

---

## 🏗️ ESTRUCTURA DETALLADA

### 1. BACKEND - JSP + SPARQL (4.8M)

#### Ubicación: `/opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/`

```
backend/
├── coauthorNetwork.jsp                     ⭐ PRINCIPAL
│   └── Ejecuta 4 SPARQL queries
│   └── Genera baseData.json
│   └── Implementa cache (24h)
│
├── backup/
│   ├── coauthorNetwork.jspRev2             (Versión anterior)
│   ├── index.html                          (HTML backup)
│   ├── legend_styles.css                   (CSS backup)
│   ├── network_logic.js                    (JS backup)
│   ├── baseData.json                       (JSON backup)
│   └── WEB-INF/web.xml                     (Config backup)
```

**Archivos SPARQL queries** (ubicación: `/opt/tomcat/webapps/HUBvivo115/WEB-INF/classes/dataservice/coauthorViz/`)

```
java/
├── allNodes.rq                             - Query: Todos los nodos
├── edges.rq                                - Query: Aristas
├── internalNodes.rq                        - Query: Nodos internos
├── nodes.rq                                - Query: Nodos base
└── sampleCopubs.rq                         - Query: Ejemplo copublicaciones
```

---

### 2. FRONTEND - JavaScript + D3.js (48M)

#### Ubicación: `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/` + `/js/visualization/coauthorship/`

```
frontend/
├── main.js                                 ⭐ D3.js motor principal
│   └── Force simulation
│   └── Zoom/Pan
│   └── Renderizado de nodos/aristas
│   └── 17K líneas aprox
│
├── coauthorship-personlevel.js             - Visualización por persona
├── AC_OETags.js                            - Flash (OBSOLETO)
│
├── DATA FILES - JSON (principal)
│   ├── baseData.json                       ⭐ ACTUAL (datos vivos)
│   ├── baseData1.json                      (Versión alternativa)
│   ├── baseData2.json
│   ├── baseData3.json
│   ├── baseData4.json
│   ├── baseDataNew.json
│   ├── baseDataVicerectoria.json
│   ├── baseData.json-inicial
│   ├── baseData.json-funcionOk
│   ├── baseData.json-Ori
│   ├── baseData.json-creado
│   ├── baseData.json-Alex
│   ├── baseData.jsonpruebas
│   ├── baseData.json070426
│   ├── baseData.json18112025
│   └── baseData (sin extensión)
│
├── SCRIPTS - Shell (actualizaciones)
│   ├── actualizar_mapa.sh                  - Script actualizar mapa
│   └── carga_mapa.sh                       - Script cargar datos
│
├── BACKUPS - Archivos históricos
│   └── main.js.ORI.2025090401              - Backup main.js
│
└── DIAGNÓSTICO
    └── diagnostico.jsp                     - JSP diagnóstico
```

**Tamaño detallado de baseData.json:**
- Cada archivo JSON: ~1-2MB
- Total JSONs: ~35-40MB (es lo que ocupa la mayoría)

---

### 3. ESTILOS CSS (44K)

#### Ubicación: `/opt/tomcat/webapps/HUBvivo115/css/coauthorNetworkViz/` + `/css/visualization/coauthorship/`

```
styles/
├── main.css                                ⭐ PRINCIPAL
│   ├── .cv-download-widget estilos
│   ├── .cv-btn
│   ├── .cv-dropdown-menu
│   └── Colores UR (#b91c2e)
│
├── main.css_bk                             (Backup)
├── main.css.ORI.2025090401                 (Backup histórico)
│
├── autocomplete.css                        - Búsqueda autocompletada
│   └── Estilos input + suggestions
│
└── style.css                               - Estilos generales visualización
    ├── .node (estilos nodos)
    ├── .link (estilos aristas)
    └── .tooltip
```

---

### 4. TEMPLATES FREEMARKER (60K)

#### Ubicación: `/opt/tomcat/webapps/HUBvivo115/themes/wilma/templates/` + `/templates/freemarker/visualization/coauthorship/`

```
templates/
├── coauthorMaps.ftl                        ⭐ PRINCIPAL
│   ├── Renderiza página /mapadeCoauthor/
│   ├── Incluye D3.js + main.js
│   ├── Carga baseData.json
│   └── Estilos CSS
│
├── coAuthorshipDynamicActivator.ftl        - Activador dinámico
│   └── Carga mapa en contexto dinámico
│
├── coAuthorshipSparklineContent.ftl        - Mini visualización
│   └── Sparkline de coautoría en perfiles
│
└── coAuthorshipStandaloneActivator.ftl     - Activador standalone
    └── Mapa como componente independiente
```

---

### 5. ARCHIVOS JAVA COMPILADOS (20K)

#### Ubicación: `/opt/tomcat/webapps/HUBvivo115/WEB-INF/classes/dataservice/coauthorViz/`

```
java/
├── allNodes.rq                             - SPARQL query
├── edges.rq
├── internalNodes.rq
├── nodes.rq
└── sampleCopubs.rq

[Nota: Los .class compilados están en directorio padre]
```

---

### 6. IMÁGENES (112K)

#### Ubicación: `/opt/tomcat/webapps/HUBvivo115/images/visualization/coauthorship/`

```
images/
├── co_author_icon.png                      - Icono coautor
├── co_investigator_icon.png                - Icono coinvestigador
├── VIVO_COAUTHOR_PUBS_100x100.png          - Logo 100x100
├── VIVO_COAUTHOR_PUBS_200x200.png          - Logo 200x200
└── [otros assets UI]
    ├── bg.gif
    ├── boeder.gif
    ├── bottom_shadow.gif
    ├── contact_*.gif
    ├── event_link_bg.gif
    ├── newsletter_*.gif
    ├── submit_bg.gif
    ├── top_*.gif
    └── red_*.gif
```

---

## 🔄 FLUJO DE DATOS EN VIVO

```
Usuario accede: /mapadeCoauthor/
    ↓
coauthorMaps.ftl renderiza HTML
    ├─ Incluye: main.js (D3.js)
    ├─ Incluye: main.css, autocomplete.css
    └─ Carga: baseData.json vía fetch()
    ↓
JSP Backend (coauthorNetwork.jsp) responde:
    ├─ Ejecuta allNodes.rq (SPARQL)
    ├─ Ejecuta internalNodes.rq
    ├─ Ejecuta edges.rq
    ├─ Ejecuta sampleCopubs.rq
    └─ Retorna JSON
    ↓
D3.js (main.js) renderiza:
    ├─ Crea nodos (circles) de autores
    ├─ Crea aristas (lines) de colaboraciones
    ├─ Aplica CSS estilos
    └─ Permite interacción (zoom, pan, hover)
```

---

## 📋 ARCHIVOS PARA DESPLIEGUE

### ✅ NECESARIOS (copiar siempre a STAGING/PROD)

```
BACKEND:
├── coauthorNetwork.jsp                     ⭐ CRÍTICO
└── *.rq (SPARQL queries)                   ⭐ CRÍTICO

FRONTEND:
├── main.js                                 ⭐ CRÍTICO
├── coauthorship-personlevel.js             ✓ Importante
└── baseData.json                           ✓ Importante (datos actuales)

TEMPLATES:
├── coauthorMaps.ftl                        ⭐ CRÍTICO
├── coAuthorshipDynamicActivator.ftl        ✓ Importante
├── coAuthorshipSparklineContent.ftl        ✓ Importante
└── coAuthorshipStandaloneActivator.ftl     ✓ Importante

STYLES:
├── main.css                                ⭐ CRÍTICO
├── autocomplete.css                        ✓ Importante
└── style.css                               ✓ Importante

IMAGES:
└── /images/visualization/coauthorship/*    ✓ Importante

QUERIES:
└── *.rq files                              ⭐ CRÍTICO
```

### ❌ NO NECESARIOS (limpiar antes de desplegar)

```
OBSOLETO:
├── AC_OETags.js                            - Flash (no usar)

BACKUPS:
├── coauthorNetwork.jspRev*                 - Versiones viejas
├── main.js.ORI.*                           - Backups
├── main.css.*                              - Backups
├── baseData*.json (todas las variantes)    - Solo mantener baseData.json
├── carga_mapa.sh                           - Script local
├── actualizar_mapa.sh                      - Script local
└── diagnostico.jsp                         - Debug

BACKUP/
├── baseData.json                           - Versión backup
├── index.html                              - HTML backup
└── WEB-INF/web.xml                         - Config backup
```

---

## 🎯 CHECKLIST PARA DESPLIEGUE A PRODUCCIÓN

```
ANTES DE COPIAR A PRODUCCIÓN:

BACKEND
☐ coauthorNetwork.jsp → /WEB-INF/custom/coauthorViz/
☐ *.rq files → /WEB-INF/classes/dataservice/coauthorViz/

FRONTEND
☐ main.js → /js/coauthorNetworkViz/
☐ coauthorship-personlevel.js → /js/visualization/coauthorship/
☐ baseData.json → /js/coauthorNetworkViz/
  ⚠️ NO copiar: baseData*.json (variantes numeradas)
  ⚠️ NO copiar: AC_OETags.js (Flash obsoleto)

TEMPLATES
☐ coauthorMaps.ftl → /themes/wilma/templates/
☐ coAuthorshipDynamicActivator.ftl → /templates/freemarker/visualization/coauthorship/
☐ coAuthorshipSparklineContent.ftl → /templates/freemarker/visualization/coauthorship/
☐ coAuthorshipStandaloneActivator.ftl → /templates/freemarker/visualization/coauthorship/

STYLES
☐ main.css → /css/coauthorNetworkViz/
☐ autocomplete.css → /css/coauthorNetworkViz/
☐ style.css → /css/visualization/coauthorship/

IMAGES
☐ /images/visualization/coauthorship/* → /images/visualization/coauthorship/

CLEANUP (ELIMINAR)
☐ Borrar: baseData*.json (variantes)
☐ Borrar: main.js.ORI.*, main.css.*
☐ Borrar: coauthorNetwork.jspRev*
☐ Borrar: carga_mapa.sh, actualizar_mapa.sh
☐ Borrar: diagnostico.jsp
☐ Borrar: AC_OETags.js

VERIFICAR POST-DESPLIEGUE
☐ URL: /mapadeCoauthor/ carga correctamente
☐ D3.js visualiza nodos y aristas
☐ Zoom/Pan funciona
☐ Búsqueda autocompletada funciona
☐ Sin errores en consola (F12)
☐ Performance: carga en < 3 segundos
```

---

## 📐 TAMAÑOS REALES

```
Componente          Tamaño      % Total
────────────────────────────────────────
baseData.json       ~35-40MB    75%
main.js + otros JS  ~8MB        15%
Imágenes            ~112KB      0.2%
CSS                 ~44KB       0.1%
Templates FTL       ~60KB       0.1%
Backend JSP/rq      ~4.8MB      9.6%
────────────────────────────────────────
TOTAL               ~53MB       100%
```

**Observación:** El 75% del tamaño es baseData.json (datos de caché).  
Para producción, se puede optimizar comprimiendo este JSON.

---

## 🔐 SEGURIDAD

```
REVISIONES NECESARIAS:

☐ CVE-2019-17558 (Velocity RCE) - ¿Habilitado?
☐ Autenticación de acceso a /mapadeCoauthor/
☐ Rate limiting en SPARQL queries
☐ Permisos de archivo (644 para .js, .css, .ftl)
☐ No exponer baseData.json si contiene datos sensibles
```

---

**Última actualización:** 2026-07-17  
**Extraído de:** STAGING (`/opt/tomcat/webapps/HUBvivo115/`)  
**Estado:** Estructura verificada y documentada
