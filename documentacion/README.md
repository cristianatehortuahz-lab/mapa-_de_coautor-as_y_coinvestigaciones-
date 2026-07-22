# 🕸️ Mapa de Coautoría y Coinvestigaciones

**Tecnología:** D3.js v7 + SPARQL + JSP (VIVO 1.11+)
**Versión frontend:** v3.17 · **Versión backend/JSP:** v4.3 (síncrono)
**Repositorio oficial:** [mapa-_de_coautor-as_y_coinvestigaciones-](https://github.com/cristianatehortuahz-lab/mapa-_de_coautor-as_y_coinvestigaciones-)
**Última actualización:** 2026-07-17

---

## 📋 Descripción

Visualización interactiva de la red de colaboración académica de la Universidad del Rosario. Ofrece una **red dual** conmutable:

- **Red de Publicaciones** — coautorías (aristas `*Pubs`)
- **Red de Proyectos** — coinvestigaciones/grants (aristas `*Grants`)

Con nodos internos y externos, filtros por facultad/escuela, estadísticas ego-network en vivo, tooltips, zoom/pan, búsqueda y tema claro/oscuro.

---

## 🏗️ Arquitectura (3 capas)

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND — SPA D3.js (webapp independiente)             │
│  Ruta: /opt/tomcat/webapps/mapadeCoauthor/               │
│  ├─ index.html          (cascarón, ~15KB, carga el JS)   │
│  ├─ network_logic.js    (toda la lógica D3, ~67KB, v3.17)│
│  └─ legend_styles.css   (estilos UI, ~40KB)              │
│  Se sirve en:  http://<host>:8080/mapadeCoauthor/        │
└──────────────────────────┬───────────────────────────────┘
                           │ d3.json() a ruta ABSOLUTA:
                           │ /HUBvivo115/js/coauthorNetworkViz/baseData.json
                           ▼
┌──────────────────────────────────────────────────────────┐
│  CACHÉ JSON  (generado por el JSP, servido estático)     │
│  Ruta: /opt/tomcat/webapps/HUBvivo115/js/                │
│        coauthorNetworkViz/baseData.json                  │
└──────────────────────────┬───────────────────────────────┘
                           │ lo regenera de noche carga_mapa.sh
                           ▼
┌──────────────────────────────────────────────────────────┐
│  BACKEND — JSP síncrono (v4.3)                           │
│  Ruta: HUBvivo115/WEB-INF/custom/coauthorViz/            │
│        coauthorNetwork.jsp                                │
│  Endpoint: /HUBvivo115/coauthorViz                       │
│  Ejecuta 4 consultas SPARQL y devuelve el JSON completo  │
└──────────────────────────┬───────────────────────────────┘
                           ▼
              VIVO Triplestore (Jena/TDB2, RDF)
```

**Integración en VIVO:** el mapa se incrusta en la página `/coauthorNetwork`
mediante la plantilla FreeMarker `coauthorNetworkViz.ftl`
(en `HUBvivo115/templates/freemarker/body/`), que embebe la SPA con un iframe `100vw`.

---

## 🔑 Rutas críticas del servidor

| Componente | Ruta absoluta |
|---|---|
| **Frontend (SPA)** | `/opt/tomcat/webapps/mapadeCoauthor/` |
| **Caché JSON** | `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json` |
| **Script Cron** | `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh` |
| **JSP Backend** | `/opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/coauthorNetwork.jsp` |
| **FTL Wrapper** | `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/coauthorNetworkViz.ftl` |
| **Log Tomcat** | `/opt/tomcat/logs/catalina.out` |
| **Log VIVO** | `/opt/tomcat/logs/HUBvivo115.all.log` |

> ⚠️ El frontend NO carga `baseData.json` de su propia carpeta, sino de la ruta
> **absoluta** `/HUBvivo115/js/coauthorNetworkViz/baseData.json` (ver `network_logic.js`).
> Si el mapa carga vacío, casi siempre es que falta ese archivo o está en el esquema equivocado.

---

## 📐 Esquema de datos (`baseData.json`)

El frontend v3.17 espera el **esquema dividido por tipo de red**:

| Clave | Contenido |
|---|---|
| `nodesAll` | Todos los autores (internos + externos) |
| `nodesInternal` | Solo autores internos UR |
| `edgesAllPubs` | Coautorías (red completa) — **Publicaciones** |
| `edgesInternalPubs` | Coautorías (solo internos) — **Publicaciones** |
| `edgesAllGrants` | Coinvestigaciones (red completa) — **Proyectos** |
| `edgesInternalGrants` | Coinvestigaciones (solo internos) — **Proyectos** |

> ⚠️ **Esquema viejo vs. nuevo.** Existen `baseData.json` antiguos con claves
> unificadas (`edgesAll`, `edgesInternal`) que **NO** separan publicaciones de
> proyectos. Con ese esquema el toggle **Proyectos** aparece vacío. Usa siempre
> un JSON con las claves `*Pubs` / `*Grants`.

---

## 🚀 Despliegue

Mapeo de archivos origen → destino, permisos, menú de VIVO, FTL, JSP y cron:
👉 ver [`../DESPLIEGUE_MAESTRO.md`](../DESPLIEGUE_MAESTRO.md) y
[`../GUIA_INSTALACION_FINAL.md`](../GUIA_INSTALACION_FINAL.md), o los pasos
detallados en `03-deployment/`.

---

## 🔄 Regeneración del caché (cron nocturno)

El JSP v4.3 es **síncrono**: al llamar `/HUBvivo115/coauthorViz` bloquea hasta
terminar las 4 consultas SPARQL (15–60 s en bases grandes). El script
`carga_mapa.sh` hace `curl` al JSP y guarda el resultado como `baseData.json`.

```bash
# Crontab (01:00 AM diario)
00 01 * * * /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
```

Generación manual inicial (tras reiniciar Tomcat, desbloquear primero la pantalla
"Startup Status" de VIVO):

```bash
curl -s -L -o /dev/null http://localhost:8080/HUBvivo115/          # desbloquea
sudo /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
```

---

## ✅ Validación

```
[ ] http://<host>:8080/mapadeCoauthor/            → 200 (SPA carga)
[ ] .../network_logic.js                          → 200
[ ] http://<host>:8080/HUBvivo115/js/coauthorNetworkViz/baseData.json → 200 application/json
[ ] baseData.json tiene claves *Pubs y *Grants
[ ] Toggle Publicaciones dibuja la red
[ ] Toggle Proyectos dibuja la red
[ ] Zoom / pan / búsqueda / filtros funcionan
[ ] Consola del navegador sin errores 404 ni "no encontrado"
```

---

## 🌍 Estado por ambiente

| | LOCAL (Windows) | STAGING (Linux) | PROD (Linux) |
|---|:---:|:---:|:---:|
| Frontend (SPA) | ✅ `ROOT/coauthorNetwork/` | ✅ `webapps/mapadeCoauthor/` | ✅ `webapps/mapadeCoauthor/` |
| Caché baseData.json | ✅ | ✅ (v3.17, con proyectos) | ✅ |
| Backend JSP + SPARQL | ✅ | ✅ | ✅ |
| Cron nocturno | ➖ manual | ⚠️ recuperar `carga_mapa.sh` | ✅ |

> Nota: en LOCAL la SPA vive bajo `ROOT/coauthorNetwork/`; en STAGING/PROD es un
> webapp separado `mapadeCoauthor/`. Mismos archivos, distinta ruta de contexto.

---

## 🆘 Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Mapa carga vacío, consola: *"baseData.json no encontrado"* | El `.then(initNetwork).catch()` atrapa también errores de `initNetwork`; suele ser JSON ausente o esquema viejo | Verificar `baseData.json` en la ruta absoluta y con claves `*Pubs`/`*Grants` |
| Toggle **Proyectos** vacío | `baseData.json` con esquema unificado (`edgesAll`) sin `*Grants` | Reemplazar por JSON con `edgesAllGrants`/`edgesInternalGrants` |
| `baseData.json` da HTTP 500 | Archivo corrupto/parcial en la ruta de datos | Regenerar con `carga_mapa.sh` o restaurar un JSON válido |
| JSP da 500 | Error de compilación Java del JSP | `sudo tail -100 /opt/tomcat/logs/catalina.out` |
| JSON generado vacío `[]` o claves `error_*` | SPARQL falla (posible índice Jena TDB corrupto) | Reinicio limpio con `/etc/rc.d/init.d/tomcat stop/start` |

> ⚠️ Para reiniciar Tomcat en STAGING/PROD usar `/etc/rc.d/init.d/tomcat stop/start`,
> **no** `startup.sh` directo. Ver la guía oficial (§5) para el procedimiento completo.

---

## 📚 Referencias

- **Arquitectura general:** `01-architecture/01-HUB-UR-Architecture-Overview.md`
- **Estructura de archivos:** `02-structure/01-Coauthor-Map-Structure-Staging.md`
- **Despliegue paso a paso:** `03-deployment/`
- **Guía oficial del repo:** `GUIA_INSTALACION_FINAL.md` (en el repositorio)
- **Referencia rápida:** `../shared-reference/INDEX.md`
