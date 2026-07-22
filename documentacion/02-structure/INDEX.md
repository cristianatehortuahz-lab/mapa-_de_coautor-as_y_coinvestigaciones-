# Mapa de Coautoría

> ⚠️ **Inventario histórico (build legacy).** Esta sección describe el mapa tal
> como estaba antes de la migración del 2026-07-17. STAGING ya usa el frontend
> v3.17 (`network_logic.js`, `coauthorNetworkViz.ftl`). Componentes y rutas
> actuales: ver `../README.md` y `../01-architecture/`.

## 📊 Documentos en esta sección

### 01-Coauthor-Map-Structure-Staging.md
**Estructura real del mapa en STAGING - Extraído 2026-07-17**
- Estructura completa mapeada (83 archivos)
- 53M totales (6.0M comprimido)
- Qué archivos son necesarios para despliegue
- Qué archivos limpiar (backups, obsoletos)
- Checklist para despliegue a PROD
- Validaciones post-despliegue
- Tamaños reales de cada componente
- Consideraciones de seguridad

👉 **Empezar aquí si:** Necesitas desplegar el mapa a producción

---

## 🎯 Componentes del Mapa

```
BACKEND (JSP + SPARQL)
├── coauthorNetwork.jsp     - Genera JSON con nodos/aristas
├── *.rq files              - Queries SPARQL al triplestore

FRONTEND (D3.js)
├── main.js                 - Motor D3.js (17K líneas)
├── baseData.json           - Datos (35-40MB)
└── coauthorship-personlevel.js

TEMPLATES (Freemarker)
├── coauthorMaps.ftl        - Página principal
├── coAuthorshipDynamicActivator.ftl
├── coAuthorshipSparklineContent.ftl
└── coAuthorshipStandaloneActivator.ftl

ESTILOS (CSS)
├── main.css                - Estilos principales
├── autocomplete.css        - Búsqueda
└── style.css               - D3 estilos

IMÁGENES
├── co_author_icon.png
├── co_investigator_icon.png
└── VIVO_COAUTHOR_PUBS_*.png
```

---

## 📁 Ubicación en STAGING

```
/opt/tomcat/webapps/HUBvivo115/
├── WEB-INF/custom/coauthorViz/coauthorNetwork.jsp
├── WEB-INF/classes/dataservice/coauthorViz/*.rq
├── js/coauthorNetworkViz/
├── css/coauthorNetworkViz/
├── themes/wilma/templates/coauthorMaps.ftl
├── templates/freemarker/visualization/coauthorship/
└── images/visualization/coauthorship/
```

---

## 🚀 Próximos Pasos

1. **Para desplegar** → Ver: ../../DESPLIEGUE_MAESTRO.md
2. **Para entender arquitectura** → Ver: ../01-architecture/02-Architecture-Diagram-and-Flow.md
3. **Para cambios de config** → Ver: ../04-configuration/01-Configuration-Changes-Local-to-Staging.md

---

**Última actualización:** 2026-07-17  
**Datos extraídos de:** STAGING
**Tamaño total:** 53M (funcionales) / 6.0M (comprimido)
