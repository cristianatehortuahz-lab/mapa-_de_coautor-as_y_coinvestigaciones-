# Archivos que CAMBIAN entre LOCAL (Windows) y STAGING (Linux)

## 🔍 Identificación de Cambios de Configuración

### ✅ Archivos que NO CAMBIAN (Mismo contenido)
```
✓ tomcat/tomcat9/webapps/HUBvivo115/themes/wilma/templates/individual--foaf-person.ftl
  - Mismo contenido en LOCAL y STAGING
  - Solo copiar tal cual

✓ tomcat/tomcat9/webapps/HUBvivo115/themes/wilma/css/hub-cv-widget.css
  - Mismo contenido en LOCAL y STAGING
  - Solo copiar tal cual

✓ HUBvivo115/WEB-INF/custom/coauthorViz/coauthorNetwork.jsp  (JSP backend v4.3)
  - Mismo contenido entre ambientes
  - Solo copiar tal cual

✓ Frontend del mapa (SPA v3.17): index.html + network_logic.js + legend_styles.css
  - En STAGING/PROD viven en webapps/mapadeCoauthor/
  - En LOCAL viven en ROOT/coauthorNetwork/ (mismo contenido, otra ruta)
  - NOTA: el motor D3 es network_logic.js (v3.17), NO el antiguo main.js
```

---

## 🔴 Archivos que SÍ CAMBIAN (Configuración específica por entorno)

### 1. RUNTIME.PROPERTIES (VIVO Configuration)

**LOCAL (Windows):**
```properties
# tomcat/tomcat9/vivo-home/HUBvivo115/config/runtime.properties

# Base de datos LOCAL
VitroConnection.DataSource.url = jdbc:mysql://localhost:3306/vitrodb
VitroConnection.DataSource.username = root
VitroConnection.DataSource.password = 

# Solr LOCAL
search.url = http://localhost:8983/solr/vivocore

# Namespace
vitro.baseURI = http://localhost:8080/individual/
vitro.localNamespace = http://localhost:8080/

# Email (local relay)
mail.smtp.host = localhost
```

**STAGING (Linux):**
```properties
# /opt/vivo-home/HUBvivo115/config/runtime.properties

# Base de datos STAGING (BD separada, posiblemente diferente host)
VitroConnection.DataSource.url = jdbc:mysql://staging-db.internal:3306/vitrodb
VitroConnection.DataSource.username = vivo_staging_user
VitroConnection.DataSource.password = [STAGING_DB_PASSWORD]

# Solr STAGING (podría estar en host diferente)
search.url = http://staging-solr.internal:8983/solr/vivocore

# Namespace
vitro.baseURI = https://staging-hub.urosario.edu.co/individual/
vitro.localNamespace = https://staging-hub.urosario.edu.co/

# Email (relay corporativo)
mail.smtp.host = relay.staging.urosario.edu.co
```

**🔑 Parámetros que cambian:**
- `VitroConnection.DataSource.url` - Host DB y puerto
- `VitroConnection.DataSource.username` - Usuario staging
- `VitroConnection.DataSource.password` - Contraseña staging
- `search.url` - URL Solr staging
- `vitro.baseURI` - URL base pública
- `vitro.localNamespace` - Namespace RDF
- `mail.smtp.host` - Servidor email staging

---

### 2. SERVER.XML (Tomcat Configuration)

**LOCAL (Windows):**
```xml
<!-- tomcat/tomcat9/conf/server.xml -->

<!-- HTTP Connector -->
<Connector port="8080"
           protocol="HTTP/1.1"
           connectionTimeout="20000"
           redirectPort="8443" />

<!-- Shutdown port -->
<Server port="9005" shutdown="HUB_SHUTDOWN_x7k9m2">

<!-- Host local -->
<Host name="localhost" appBase="webapps" />

<!-- Logs locales -->
<!-- Escritos en: tomcat/tomcat9/logs/ -->
```

**STAGING (Linux):**
```xml
<!-- /opt/tomcat/conf/server.xml -->

<!-- HTTP Connector (mismo puerto si es interno) -->
<Connector port="8080"
           protocol="HTTP/1.1"
           connectionTimeout="20000"
           redirectPort="8443"
           address="127.0.0.1" />  <!-- ← Solo localhost interno

<!-- Shutdown port (cambiar clave de seguridad) -->
<Server port="9005" shutdown="STAGING_SECURE_KEY_xyz">

<!-- Host configurado -->
<Host name="staging-vivo" appBase="/opt/tomcat/webapps" />

<!-- Logs remotos o ELK -->
<!-- Enviados a: /var/log/tomcat/ o syslog -->
```

**🔑 Parámetros que cambian:**
- Clave de shutdown (security)
- Nombre de host
- Directorios de logs
- Address/binding (si está detrás de nginx)

---

### 3. WEB.XML (Servlet Mappings - Con URLs de Backend)

> Nota: el mapa **no** usa ningún servlet propio en `web.xml`. Este apartado
> documenta el `CVProxyServlet` (descarga de CV), incluido solo como referencia
> del entorno; no afecta al mapa.

**LOCAL (Windows):**
```xml
<!-- tomcat/tomcat9/webapps/HUBvivo115/WEB-INF/web.xml -->

<!-- CVProxyServlet -->
<servlet>
  <servlet-name>CVProxyServlet</servlet-name>
  <servlet-class>co.edu.urosario.hubur.CVProxyServlet</servlet-class>
  <init-param>
    <param-name>target-url</param-name>
    <param-value>http://localhost:3001</param-value>  <!-- ← LOCAL -->
  </init-param>
  <init-param>
    <param-name>api-key-env</param-name>
    <param-value>HUB_CV_API_KEY</param-value>
  </init-param>
</servlet>
```

**STAGING (Linux):**
```xml
<!-- /opt/tomcat/webapps/HUBvivo115/WEB-INF/web.xml -->

<!-- CVProxyServlet -->
<servlet>
  <servlet-name>CVProxyServlet</servlet-name>
  <servlet-class>co.edu.urosario.hubur.CVProxyServlet</servlet-class>
  <init-param>
    <param-name>target-url</param-name>
    <param-value>http://staging-api.internal:3001</param-value>  <!-- ← STAGING -->
  </init-param>
  <init-param>
    <param-name>api-key-env</param-name>
    <param-value>HUB_CV_API_KEY</param-value>
  </init-param>
</servlet>
```

**🔑 Parámetros que cambian:**
- `target-url` en CVProxyServlet - Host del backend de CV
- Posiblemente timeouts según performance

---

### 4. INICIAR_VIVO.BAT → SYSTEMD SERVICE (Script de Inicio)

**LOCAL (Windows):**
```batch
REM iniciar_vivo.bat

@echo off
setlocal enabledelayedexpansion

SET BASE_DIR=%CD%
SET JAVA_HOME=C:\Program Files\Microsoft\jdk-11.0.30.7-hotspot
SET CATALINA_HOME=%BASE_DIR%\tomcat\tomcat9
SET CATALINA_BASE=%CATALINA_HOME%
SET VIVO_HOME=%CATALINA_HOME%\vivo-home\HUBvivo115
SET SOLR_DIR=%BASE_DIR%\solr

SET HUB_CV_API_KEY=tu-api-key

REM Iniciar MySQL (XAMPP)
start xampp_control.exe

REM Iniciar Solr
cd %SOLR_DIR%
solr.cmd start -p 8983

REM Iniciar Tomcat
cd %CATALINA_HOME%\bin
catalina.bat run
```

**STAGING (Linux - systemd):**
```ini
# /etc/systemd/system/tomcat.service

[Unit]
Description=Apache Tomcat Web Application Server
After=network.target
Wants=mysql.service solr.service

[Service]
Type=forking
User=tomcat
Group=tomcat
WorkingDirectory=/opt/tomcat

# Variables de entorno
EnvironmentFile=/etc/environment
EnvironmentFile=/opt/tomcat/.env.staging
Environment="JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64"
Environment="CATALINA_HOME=/opt/tomcat"
Environment="CATALINA_BASE=/opt/tomcat"
Environment="VIVO_HOME=/opt/vivo-home/HUBvivo115"
Environment="HUB_CV_API_KEY=${HUB_CV_API_KEY}"

# Ejecutable
ExecStart=/opt/tomcat/bin/catalina.sh start
ExecStop=/opt/tomcat/bin/catalina.sh stop
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**🔑 Parámetros que cambian:**
- Rutas absolutas Linux (`/opt/` en lugar de `C:\`)
- Usuario/grupo (tomcat en Linux)
- JAVA_HOME path
- Variables de entorno (fromArchivo .env)
- Dependencias de servicios

---

### 5. .ENV O VARIABLES DE ENTORNO

**LOCAL (Windows - en batch):**
```batch
SET HUB_CV_API_KEY=dev-key-local
SET VIVO_HOME=C:\Users\cristian.atehortua\Desktop\HUB-UR\Nuevo_entorno_local\tomcat\tomcat9\vivo-home\HUBvivo115
SET CATALINA_OPTS=-Xmx512m -XX:MaxMetaspaceSize=128m
```

**STAGING (Linux - en .env):**
```bash
# /opt/tomcat/.env.staging

HUB_CV_API_KEY=staging-api-key-xxx
VIVO_HOME=/opt/vivo-home/HUBvivo115
CATALINA_OPTS="-Xmx1024m -XX:MaxMetaspaceSize=256m -Dfile.encoding=UTF-8"
JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
SOLR_URL=http://staging-solr.internal:8983/solr/vivocore
MYSQL_HOST=staging-db.internal
MYSQL_USER=vivo_staging_user
MYSQL_PASSWORD=[ENCRYPTED]
```

**🔑 Parámetros que cambian:**
- API Keys (staging vs local)
- Rutas absolutas
- Memoria JVM (más en staging)
- URLs de servicios (staging-db, staging-solr, etc.)

---

## 📊 TABLA RESUMEN DE CAMBIOS

| Archivo | LOCAL | STAGING | Cambio |
|---------|-------|---------|--------|
| `runtime.properties` | jdbc:mysql://localhost:3306 | jdbc:mysql://staging-db:3306 | Host DB |
| `runtime.properties` | http://localhost:8983/solr | http://staging-solr:8983/solr | Host Solr |
| `runtime.properties` | http://localhost:8080/individual/ | https://staging-hub.urosario.edu.co/individual/ | URL base |
| `server.xml` | port=8080 | port=8080 (mismo) | Mismo puerto interno |
| `server.xml` | shutdown="HUB_SHUTDOWN_x7k9m2" | shutdown="STAGING_KEY_xyz" | Clave segura |
| `web.xml` | target=http://localhost:3001 | target=http://staging-api:3001 | Host backend de CV |
| `.env` / `iniciar_vivo.bat` | LOCAL paths | /opt/ paths | Rutas absolutas Linux |
| `.env` / `iniciar_vivo.bat` | JAVA_HOME=C:\Program Files\... | JAVA_HOME=/usr/lib/jvm/... | JAVA_HOME path |
| `.env` / variables | HUB_CV_API_KEY=dev-local | HUB_CV_API_KEY=staging-xxx | API Key |

---

## 🎯 ARCHIVOS QUE DEBES MODIFICAR EN STAGING

### Orden de Prioridad:

**1️⃣ CRÍTICO - Sin esto no funciona:**
- [ ] `runtime.properties` - BD, Solr, URLs base
- [ ] `.env` o `tomcat.service` - Variables de entorno (API keys, paths)

**2️⃣ IMPORTANTE - Para seguridad/operación:**
- [ ] `server.xml` - Clave de shutdown, configuración host
- [ ] `web.xml` - URL del proxy de CV (CVProxyServlet)

**3️⃣ OPCIONAL - Mejora operativa:**
- [ ] `catalina.properties` - Logs, encoding
- [ ] `logging.properties` - Nivel de logs (DEBUG vs INFO)

---

## 📋 CHECKLIST: Qué Cambiar en Staging

```
ANTES DE DESPLEGAR A STAGING:

CONFIGURACIÓN (cambiar valores)
☐ runtime.properties
  ☐ VitroConnection.DataSource.url → staging-db host
  ☐ VitroConnection.DataSource.username → staging user
  ☐ VitroConnection.DataSource.password → staging password
  ☐ search.url → staging-solr host
  ☐ vitro.baseURI → https://staging-hub.urosario.edu.co/
  ☐ mail.smtp.host → staging relay

☐ .env o systemd service (variables entorno)
  ☐ HUB_CV_API_KEY → staging key
  ☐ JAVA_HOME → /usr/lib/jvm/java-11-openjdk-amd64
  ☐ VIVO_HOME → /opt/vivo-home/HUBvivo115
  ☐ CATALINA_HOME → /opt/tomcat
  ☐ SOLR_URL → http://staging-solr:8983/solr/vivocore
  ☐ MYSQL_HOST → staging-db
  ☐ MYSQL_USER → vivo_staging_user
  ☐ MYSQL_PASSWORD → [staging password]

☐ server.xml (seguridad y config)
  ☐ Shutdown clave (cambiar a algo seguro)
  ☐ Host name (configurar como staging-vivo)
  ☐ Logs path (cambiar a /var/log/tomcat/)

☐ web.xml (proxy de CV)
  ☐ CVProxyServlet target-url → http://staging-api:3001

CÓDIGO (Copiar tal cual, SIN cambios)
☐ individual--foaf-person.ftl → Copiar igual
☐ hub-cv-widget.css → Copiar igual
☐ coauthorNetwork.jsp (WEB-INF/custom/coauthorViz/) → Copiar igual
☐ Frontend mapa: index.html + network_logic.js + legend_styles.css → Copiar igual
☐ baseData.json → usar esquema *Pubs/*Grants (ver README del mapa)
```

---

**Última actualización:** 2026-07-17  
**Ambiente:** LOCAL (Windows) vs STAGING (Linux)  
