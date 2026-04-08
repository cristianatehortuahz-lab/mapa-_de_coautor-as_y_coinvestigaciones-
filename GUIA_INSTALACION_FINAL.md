# Guía de Despliegue en Producción: Mapa de Coautorías Interactivo

Este documento detalla los pasos definitivos para instalar y configurar el Mapa de Coautorías Interactivo v4.3 (con la red dividida por Publicaciones y Proyectos) en un servidor de Producción VIVO, incluyendo la configuración de la Caché automatizada nocturna y procedimientos de recuperación ante fallos.

---

## 1. Creación del apartado en el menú (Site Admin)
Antes de lidiar con archivos, debe existir el acceso en la plataforma.

**1.1 Verificar/Crear la Página:**
* Ingresa a VIVO con permisos de administrador (`root-hub@urosario.edu.co`).
* En la barra superior roja, haz clic en **"Administrador del sitio"**.
* En la sección **"Configuración de la plataforma"** (columna derecha), haz clic en **"Administración de la página"**.
* Verás una tabla con columnas: **Título | URL | Plantilla personalizada | Página de menú | Controles**.
* Busca la fila **"Mapa de Coautores"**. Si ya existe, verifica que tenga:
  * **URL:** `/coauthorNetwork`
  * **Plantilla personalizada:** `coauthorNetworkViz.ftl`
* Si NO existe, haz clic en el botón azul **"Agregar página"** (abajo de la tabla) y completa:
  * **Título:** `Mapa de Coautorías`
  * **URL:** `/coauthorNetwork`
  * **Plantilla:** Selecciona *"Plantilla personalizada, con todo el contenido"* y escribe `coauthorNetworkViz.ftl`.

**1.2 Agregar al Menú Principal (Opción A — Menú estándar VIVO):**
* En **"Administración de la página"**, marca el checkbox de la columna **"Página de menú"** en la fila de *Mapa de Coautores*.
* Regresa a **"Administrador del sitio"** > **"Orden del Menú"**.
* Verifica que el ítem "Mapa de Coautores" aparezca en la lista (junto a Inicio, Comunidad UR, Áreas UR, Laboratorios).
* Usa **drag & drop** para posicionarlo donde desees. VIVO pedirá que actualices la página después de reordenar.

**1.3 Agregar al dropdown "Mapas" (Opción B — Menú personalizado del tema):**
* Si prefieres que el mapa aparezca dentro del dropdown **"Mapas"** que ya existe en la barra de navegación, debes editar manualmente el archivo de plantilla del menú en el servidor:
  * Localiza `menu.ftl` o `navigation.ftl` en el tema activo de VIVO (ej: `themes/hub-ur/templates/`).
  * Busca el bloque `<li>` que contiene "Mapas".
  * Agrega dentro del dropdown:
    ```html
    <a class="dropdown-item" href="${urls.base}/coauthorNetwork">Mapa de Coautorías</a>
    ```

---

## 2. Copiar el Frontend (Aplicación Reactiva Independiente)
Toda la lógica visual gráfica se aloja separada del núcleo de VIVO para no interferir en sus librerías base.
* Se debe crear la carpeta `mapadeCoauthor` dentro de `webapps` genérico de Tomcat.
* **Archivos a copiar:** `index.html`, `network_logic.js`, `legend_styles.css`
* **Ruta Destino Estricta:**
  `👉 /opt/tomcat/webapps/mapadeCoauthor/`

---

## 3. Copiar el FTL a la ruta correcta (Envoltorio)
El encargado debe copiar el archivo FreeMarker maestro que incrustará el mapa dentro del ecosistema VIVO.
* **Archivo a copiar:** `coauthorNetworkViz.ftl`
* **Ruta Destino Estricta:**
  `👉 /opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/`
* *(Nota Especializada: Dentro de este FTL existe un `<link>` que invoca dinámicamente al archivo `legend_styles.css` alojado en el frontend, unificando todo el CSS de VIVO y del Mapa en un solo archivo físico sin romper la modularidad, y maneja los estilos en línea que fuerzan la pantalla 100vw para romper el wrapper genérico de VIVO).*

---

## 4. FASE BACKEND: El JSP y el Archivo Caché JSON
El motor de generación de la red de datos debe ubicarse en su entorno de ejecución segura de VIVO. El JSON antiguo del mapa no servirá porque no permite la visualización de relaciones complejas.

**4.1. Copiar el JSP y prepararlo:**
* **Archivo a copiar:** `coauthorNetwork.jsp`
* **Ruta Destino Recomendada:**
  `👉 /opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/`
  *(Nota: Se utiliza esta carpeta protegida para ocultar el script de escaneos públicos de seguridad).*

> **⚠️ IMPORTANTE — Arquitectura Síncrona (v4.3):**
> A partir de la versión 4.3, el JSP ejecuta las consultas SPARQL de forma **síncrona** (sin hilos en background). Esto significa que al acceder al endpoint `/coauthorViz`, el servidor NO responde hasta que las 4 consultas SPARQL terminen de ejecutarse contra el Triplestore. En bases de datos grandes (26+ GB), esto puede tomar de 15 a 60 segundos. El script `carga_mapa.sh` se encarga de esperar pacientemente y guardar el resultado.

**4.2. Automatización del Crontab y Script de Carga:**
Para que el entorno actualice el `baseData.json` constantemente y sin ahogar la base de datos de VIVO cuando entren usuarios simultáneos, se automatiza en la noche mediante bash.

Sube tu script de respaldo `carga_mapa.sh` a la misma ruta donde quieres que se aloje el Caché:
`👉 /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh`

El contenido del `carga_mapa.sh` que instalamos hace la magia así:
```bash
#!/bin/bash
# Entra a la ruta del caché y hace el cruce con el JSP 
DIR_JSON="/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz"
URL_JSP="http://localhost:8080/HUBvivo115/coauthorViz"

cd "$DIR_JSON" || exit 1

if [ -f "baseData.json" ]; then
    mv baseData.json "baseData.json_$(date +'%Y%m%d_%H%M')"
fi

curl -sS "$URL_JSP" -o baseData.json
chmod 644 baseData.json
```

**4.3. Instalar la Tarea Programada (CRON):**
Ingresa a la consola SSH del servidor y ejecuta:

```bash
# Otorgar permisos de ejecución al script que acabas de subir
sudo chmod +x /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh

# Editar el programador de tareas
sudo crontab -e
```

**Agrega al final del archivo esta línea para que corra a las 01:00 AM diario:**
```bash
00 01 * * * /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
```

**4.4. Lanzamiento Inicial Manual:**
Si acabas de instalar todo, no puedes esperar a mañana a las 01:00 AM. Genera el caché manualmente por primera vez:

> **⚠️ IMPORTANTE:** Si acabas de reiniciar Tomcat, VIVO intercepta la PRIMERA petición HTTP con una pantalla de "Startup Status". Debes desbloquearla antes de generar el JSON:

```bash
# Paso 1: Desbloquear la pantalla de Startup Status
curl -s -L -o /dev/null http://localhost:8080/HUBvivo115/

# Paso 2: Generar el JSON (esperar ~30 segundos en bases grandes)
sudo /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
```

---

## 5. Solución de Problemas

### 5.1. El JSON se genera vacío (`[]`)
**Causa:** Las consultas SPARQL fallan silenciosamente. El JSP v4.3 inyecta claves de error en el JSON (`error_nodesInternal`, `error_edgesInternal`, etc.) para diagnóstico.

**Diagnóstico:** Accede directamente al endpoint JSP desde un navegador:
`http://[IP_SERVIDOR]:8080/HUBvivo115/coauthorViz`

Si ves claves `error_*` en el JSON, el Triplestore tiene un problema (ver 5.3).

### 5.2. Error 500 al acceder al JSP
**Causa:** Error de compilación Java en el JSP.

**Diagnóstico:** Revisa el log de Tomcat:
```bash
sudo tail -100 /opt/tomcat/logs/catalina.out
```

### 5.3. Error "RecordRangeIterator — No such block"
**Causa:** Corrupción del índice Jena TDB (la base de datos RDF de VIVO). Ocurre por apagados bruscos del servidor o falta de espacio en disco.

**Solución — Reinicio Limpio de Tomcat:**
```bash
# 1. Detener Tomcat usando el script oficial de init.d
/etc/rc.d/init.d/tomcat stop

# 2. Verificar que no haya procesos zombie de Java
ps -ef | grep java | grep tomcat

# 3. Si hay procesos zombie, matarlos
sudo kill -9 [PID_DEL_PROCESO]

# 4. Limpiar archivos huérfanos de PID
sudo rm -f /opt/tomcat/temp/tomcat.pid
sudo rm -f /var/run/tomcat.pid

# 5. Reiniciar usando el script oficial (NO usar startup.sh directo)
/etc/rc.d/init.d/tomcat start

# 6. Monitorear el arranque (esperar "Server startup in XXX ms")
tail -f /opt/tomcat/logs/catalina.out
```

> **⚠️ NO usar `sudo /opt/tomcat/bin/startup.sh` directamente.** Esto arranca Tomcat sin las variables de entorno del sistema (JAVA_HOME, traducciones, etc.) y causa errores de traducción en VIVO. Siempre usar `/etc/rc.d/init.d/tomcat start`.

> **⚠️ NO usar `sudo systemctl restart tomcat` si el servicio SYSV se quedó en estado inconsistente.** El systemctl SYSV wrapper puede creer que Tomcat está vivo cuando en realidad murió. Usar directamente `/etc/rc.d/init.d/tomcat stop/start`.

### 5.4. Tomcat no arranca (Connection Refused en puerto 8080)
**Causa:** Un proceso zombie de Java anterior bloquea el puerto o un archivo PID huérfano engaña al sistema.

**Solución:** Seguir los pasos de la sección 5.3.

### 5.5. El script `carga_mapa.sh` termina instantáneamente
**Causa anterior (v4.2):** El JSP usaba un hilo asíncrono que respondía inmediatamente con `{"status":"building"}` y arreglos vacíos. El script de Bash guardaba esta respuesta falsa como `baseData.json`.

**Solución:** El JSP v4.3 eliminó la lógica asíncrona. Ahora las consultas se ejecutan de forma síncrona. El script debería tardar entre 15 y 60 segundos en bases grandes.

---

## 6. Rutas Críticas del Servidor de Producción

| Componente | Ruta Absoluta |
|---|---|
| **JSP Backend** | `/opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/coauthorNetwork.jsp` |
| **JSON Caché** | `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json` |
| **Script Cron** | `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh` |
| **Frontend App** | `/opt/tomcat/webapps/mapadeCoauthor/` (index.html, network_logic.js, legend_styles.css) |
| **FTL Wrapper** | `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/coauthorNetworkViz.ftl` |
| **Log Tomcat** | `/opt/tomcat/logs/catalina.out` |
| **Log VIVO** | `/opt/tomcat/logs/HUBvivo115.all.log` |
| **Repositorio** | [GitHub - Mapa de Coautorías](https://github.com/cristianatehortuahz-lab/mapa-_de_coautor-as_y_coinvestigaciones-.git) |

### FIN. Validación Visual
Refresca VIVO en `https://[TuSitio]/coauthorNetwork` -> Verás los botones "Proyectos" y "Publicaciones" y el mapa expandiéndose por completo con base en el JSON recién generado en el Paso 4.4.
