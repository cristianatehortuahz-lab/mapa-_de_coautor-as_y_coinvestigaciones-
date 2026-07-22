# Configuración: Mapa de Coautoría

## 📋 Documentos en esta sección

### 01-Configuration-Changes-Local-to-Staging.md
**Identificación exacta de qué archivos cambian entre LOCAL y STAGING**

Explica:
1. **Archivos que NO cambian** - Copiar tal cual
2. **Archivos que SÍ cambian** - Modificar valores
3. **Tabla de cambios específicos** - Mapeo exacto
4. **Checklist de cambios** - Orden de aplicación

## ⚙️ Cambios Principales

| Componente | LOCAL | STAGING |
|-----------|-------|---------|
| Database | localhost:3306 | staging-db:3306 |
| Solr | localhost:8983 | staging-solr:8983 |
| SPARQL | localhost/sparql | staging/sparql |
| Base URL | localhost:8080 | staging-hub.urosario.edu.co |

## 🔑 Variables de Entorno
- VIVO_HOME (ruta a configuración VIVO)
- CATALINA_HOME (ruta a Tomcat)
- JAVA_HOME (ruta a JDK 11)
- MYSQL_HOST, SOLR_URL, etc.

---

**Ver también:** 
- `../02-structure/` (estructura del mapa)
- `../03-deployment/` (guía de despliegue)
