# Despliegue real en STAGING y lecciones aprendidas

**Fecha:** 2026-07-17
**Ambiente:** STAGING (`srvcbpbvivo`, Linux)
**Resultado:** Mapa alineado al repo v3.17, publicaciones y proyectos operativos

---

## Contexto

Durante una limpieza de configuración en STAGING, el mapa dejó de cargar datos.
La investigación cruzó **tres fuentes** (entorno LOCAL, repositorio GitHub y
STAGING) y reveló varias causas encadenadas. Este documento las registra para
no repetirlas.

---

## Causas encontradas (en orden)

### 1. Error de `web.xml` al editar servlets
Al eliminar un `<servlet>` quedó un `<servlet-mapping>` vacío
(`<servlet-mapping></servlet-mapping>`), XML inválido, que impedía el arranque
del contexto (`SEVERE ... parseWebXml`). Tomcat quedaba `active (exited)` sin
escuchar en 8080.

- **Lección:** el mapa **no depende de `web.xml`**. Cualquier error ahí es ajeno
  al mapa. Validar el XML tras editarlo.
- **Fix:** eliminar por completo el bloque vacío (no basta con cerrarlo).

### 2. El frontend carga los datos desde una ruta ABSOLUTA
`network_logic.js` (v3.17) hace:
```js
d3.json("/HUBvivo115/js/coauthorNetworkViz/baseData.json")
```
No lee un `baseData.json` relativo a `/mapadeCoauthor/`. Colocar el JSON dentro
del webapp del frontend **no** sirve con la versión del repo.

### 3. Mensaje de consola engañoso
El código encadena `d3.json(...).then(initNetwork).catch(...)`. Si `initNetwork`
**lanza una excepción** (p. ej. esquema de datos incompatible), cae al mismo
`.catch()` que imprime **"baseData.json no encontrado"** — aunque el archivo sí
cargó. No fiarse literalmente de ese mensaje.

### 4. Dos esquemas de `baseData.json` incompatibles
| Esquema | Claves de aristas | Proyectos |
|---|---|---|
| Viejo (unificado) | `edgesAll`, `edgesInternal` | ❌ no |
| Nuevo (dividido) | `edgesAllPubs`, `edgesInternalPubs`, `edgesAllGrants`, `edgesInternalGrants` | ✅ sí |

El `baseData.json` de ejemplo del repo trae el esquema **viejo** → el toggle
Proyectos sale vacío. El dato correcto (con `*Grants`) estaba en LOCAL:
`ROOT/mapadeCoauthor/baseData.json` (8.4M, `edgesAllGrants: 3544`,
`edgesInternalGrants: 801`).

### 5. Frontend desplegado ≠ frontend del repo
STAGING tenía un build viejo (`index.html` 38KB con fetch embebido +
`network_logic.js` 31KB) distinto del repo (`index.html` 15KB +
`network_logic.js` 67KB v3.17). Se alineó STAGING al repo.

### 6. `carga_mapa.sh` borrado por error
En la limpieza se eliminó `carga_mapa.sh` creyéndolo "script de dev". En realidad
es el **refresco nocturno de producción**. Recuperable desde el repo.

---

## Solución aplicada

1. Reparado `web.xml` (bloque `<servlet-mapping>` vacío eliminado).
2. Reinicio limpio de Tomcat (parar, confirmar puerto libre, arrancar).
3. Instalador `instalar_mapa.sh` que despliega el repo v3.17:
   - Frontend → `/opt/tomcat/webapps/mapadeCoauthor/`
   - Datos → `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json`
4. Reemplazo del `baseData.json` del repo (esquema viejo) por el de LOCAL
   (esquema con `*Grants`) para habilitar el toggle Proyectos.

---

## Pendientes tras este despliegue

- [ ] Recuperar `carga_mapa.sh` desde el repo a
      `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/` y reinstalar el cron.
- [ ] Verificar que el JSP `coauthorNetwork.jsp` genera un `baseData.json` con
      esquema `*Pubs`/`*Grants` (no el unificado), para que el cron produzca datos
      con proyectos.
- [ ] Considerar publicar `instalar_mapa.sh` en el repo (`deploy_produccion_mapa/`).

---

## Checklist de verificación rápida

```bash
# Frontend y datos responden
curl -s -o /dev/null -w "index: %{http_code}\n"  http://localhost:8080/mapadeCoauthor/
curl -s -o /dev/null -w "js:    %{http_code}\n"  http://localhost:8080/mapadeCoauthor/network_logic.js
curl -s -o /dev/null -w "datos: %{http_code} %{content_type}\n" \
  http://localhost:8080/HUBvivo115/js/coauthorNetworkViz/baseData.json

# El JSON tiene proyectos
python3 -c "import json; d=json.load(open('/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json')); \
print('Grants:', len(d.get('edgesAllGrants',[])), len(d.get('edgesInternalGrants',[])))"
```
