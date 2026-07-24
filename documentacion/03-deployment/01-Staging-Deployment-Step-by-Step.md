# Guía de Despliegue a PRÁCTICAS (Staging) - Paso a Paso

## 📋 Tabla de Contenidos
1. [Pre-Requisitos](#pre-requisitos)
2. [Preparación del Código](#preparación-del-código)
3. [Flujo de Despliegue a Staging](#flujo-de-despliegue-a-staging)
4. [Validación en Staging](#validación-en-staging)
5. [Promoción a Producción](#promoción-a-producción)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Pre-Requisitos

### Infraestructura Staging Requerida

```
STAGING ENVIRONMENT (Servidor Linux)
═════════════════════════════════════════════════════════════════

Hostname: staging-vivo.urosario.edu.co  (o IP interna)
Sistema Operativo: Ubuntu 20.04 LTS
Arquitectura: x86_64
Acceso: SSH con key-based authentication

┌─────────────────────────────────────────────────────────────────┐
│  SERVICIOS EN STAGING                                           │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Tomcat 9          → http://staging-vivo:8080                │
│ ✓ MySQL 5.7+        → staging-db:3306 (BD espejo de PROD)     │
│ ✓ Apache Solr       → http://staging-solr:8983                │
│ ✓ Nginx (Reverse Proxy) → https://staging-hub.urosario.edu.co│
└─────────────────────────────────────────────────────────────────┘
```

### Acceso Requerido

```bash
# SSH al servidor staging
ssh deploy@staging-vivo.urosario.edu.co

# Credenciales necesarias
├─ SSH Key: ~/.ssh/id_rsa_staging (o similar)
├─ Git: Permisos de push a rama staging
├─ DB: Acceso a MySQL staging
├─ Archivo: Permisos de escritura en /opt/vivo
└─ Sudo: Permisos para reiniciar servicios (systemctl)
```

---

## 💾 Preparación del Código

### Paso 1: Verificar Estado en LOCAL

```bash
# En tu máquina local (Nuevo_entorno_local)
cd C:\Users\cristian.atehortua\Desktop\HUB-UR\Nuevo_entorno_local

# 1. Verificar rama actual
git status
# Debe mostrar: On branch feat/cv-download-widget

# 2. Ver cambios a desplegar
git log --oneline -5
# f7af4e9 feat(cv): widget de descarga de hoja de vida seguro y accesible
# 051ca5a Initial commit: HUB-UR VIVO customizations

# 3. Ver archivos modificados
git diff main feat/cv-download-widget --name-status
# M  tomcat/tomcat9/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl
# A  tomcat/tomcat9/webapps/ROOT/themes/wilma/css/hub-cv-widget.css

# 4. Ver contenido específico
git diff main feat/cv-download-widget -- tomcat/tomcat9/webapps/ROOT/themes/wilma/css/hub-cv-widget.css
```

### Paso 2: Validar Cambios Localmente

```bash
# Ejecutar test local
./iniciar_vivo.bat

# Validar en navegador
URL: http://localhost:8080/individual/[personURI]
✓ Widget CV visible
✓ Estilos cargados correctamente
✓ Dropdown funciona
✓ Descarga PDF responde

# Validar mapa coautoría no está roto
URL: http://localhost:8080/mapadeCoauthor/
✓ Visualización D3.js carga
✓ Datos JSON generados
✓ Sin errores en consola
```

### Paso 3: Commit y Push a Rama Feature

```bash
# Asegurar que todo está commiteado
git status
# On branch feat/cv-download-widget
# nothing to commit, working tree clean

# Hacer push a repositorio remoto
git push origin feat/cv-download-widget

# Verificar en GitHub/GitLab
# https://github.com/cristianatehortuahz-lab/lithouse/tree/feat/cv-download-widget
```

---

## 🚀 Flujo de Despliegue a Staging

### Paso 1: Conectar al Servidor Staging

```bash
# SSH al servidor
ssh deploy@staging-vivo.urosario.edu.co

# Cambiar a usuario de aplicación
su - vivo_app

# Verificar variable VIVO_HOME
echo $VIVO_HOME
# Debe mostrar: /opt/vivo-home/HUBvivo115

# Cambiar a directorio de aplicación
cd /opt/vivo-app
pwd
# /opt/vivo-app (raíz del repositorio clonado)
```

### Paso 2: Actualizar Código desde GitHub

```bash
# Traer cambios del branch feature
git fetch origin feat/cv-download-widget

# Ver cambios antes de aplicar
git log -p origin/feat/cv-download-widget --oneline -5 -- \
    tomcat/tomcat9/webapps/ROOT/themes/wilma/

# Checkout a la rama
git checkout feat/cv-download-widget
git pull origin feat/cv-download-widget

# Verificar archivos modificados
git status
# On branch feat/cv-download-widget
# nothing to commit, working tree clean

git ls-files -m
# tomcat/tomcat9/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl
# tomcat/tomcat9/webapps/ROOT/themes/wilma/css/hub-cv-widget.css
```

### Paso 3: Backup de Configuración Actual

```bash
# Crear backup antes de cambios
BACKUP_DIR="/opt/vivo-backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup de templates
cp -r /opt/tomcat/webapps/ROOT/themes/wilma/templates \
      $BACKUP_DIR/templates_backup

# Backup de CSS
cp -r /opt/tomcat/webapps/ROOT/themes/wilma/css \
      $BACKUP_DIR/css_backup

# Backup de configuración VIVO
cp -r $VIVO_HOME/config $BACKUP_DIR/vivo_config_backup

# Backup de base de datos
mysqldump -h staging-db -u vivo_user -p vitrodb > \
          $BACKUP_DIR/vitrodb_backup_$(date +%Y%m%d_%H%M%S).sql

echo "✓ Backups creados en: $BACKUP_DIR"
```

### Paso 4: Desplegar Templates y CSS

```bash
# Copiar archivo Freemarker modificado
cp tomcat/tomcat9/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl \
   /opt/tomcat/webapps/ROOT/themes/wilma/templates/

# Copiar nuevo archivo CSS
cp tomcat/tomcat9/webapps/ROOT/themes/wilma/css/hub-cv-widget.css \
   /opt/tomcat/webapps/ROOT/themes/wilma/css/

# Verificar permisos
ls -la /opt/tomcat/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl
ls -la /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css

# Deben estar con permisos: -rw-r--r-- (644)
# Si no, cambiar:
chmod 644 /opt/tomcat/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl
chmod 644 /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css

# Verificar integridad de archivos (validar sintaxis)
# Para Freemarker: buscar `<#` y `>` balanceados
grep -c '<#' /opt/tomcat/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl
grep -c '>'  /opt/tomcat/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl

# Para CSS: verificar que no haya errores de sintaxis
head -20 /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css
tail -5  /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css
```

### Paso 5: Validar Archivos Desplegados

```bash
# Comparar archivos (verificar que se copió correctamente)
diff -u $BACKUP_DIR/templates_backup/individual--foaf-person.ftl \
        /opt/tomcat/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl

# Debe mostrar cambios en líneas 55-200 (CV Widget)

# Verificar que archivo CSS nuevo existe
test -f /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css && \
  echo "✓ hub-cv-widget.css existe" || \
  echo "✗ ERROR: hub-cv-widget.css NO existe"

# Ver tamaño de archivos
du -h /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css
# Debe ser ~3-5 KB aproximadamente
```

### Paso 6: Reiniciar Tomcat (Graceful Reload)

```bash
# Opción A: Restart completo (recomendado para cambios de templates)
sudo systemctl restart tomcat

# Esperar a que levante (~30-60 segundos)
sleep 30

# Verificar que Tomcat levantó sin errores
sudo systemctl status tomcat
# ● tomcat.service - Apache Tomcat Web Application Server
#    Loaded: loaded (/etc/systemd/system/tomcat.service; enabled; vendor preset: enabled)
#    Active: active (running) since [fecha]...

# Ver logs de startup
tail -50 /opt/tomcat/logs/catalina.out | grep -i "error\|warning\|started"

# Opción B: Hot reload (si solo son cambios de CSS/templates)
# VIVO puede cachear templates, forzar actualización:
curl -X POST http://staging-vivo:8080/admin/FreeMarkerCache/clear
```

### Paso 7: Validación Post-Despliegue

```bash
# 1. Health check básico
curl -s http://staging-vivo:8080 | head -20
# Debe retornar HTML (no error)

# 2. Verificar que templates se cargan
curl -s "http://staging-vivo:8080/individual/http%3A%2F%2Fresearch-hub.urosario.edu.co%2Findividual%2Fperson123" \
  | grep -c "cv-download-widget"
# Debe retornar > 0 (significa widget está en HTML)

# 3. Verificar CSS cargando
curl -s "http://staging-vivo:8080/themes/wilma/css/hub-cv-widget.css" \
  | head -5
# Debe mostrar CSS (no error 404)

# 4. Verificar JavaScript funciona
curl -s "http://staging-vivo:8080/themes/wilma/css/hub-cv-widget.css" \
  | grep -c "\.cv-btn"
# Debe retornar > 0 (verificar clases CSS existen)

# 5. Revisar logs de errores
tail -100 /opt/tomcat/logs/catalina.out | grep -i "error"
# No debe haber errores relacionados a FreeMarker o archivos

# 6. Verificar acceso a endpoints API
curl -s "http://staging-vivo:8080/api/cv/generate" -X POST \
  -H "Content-Type: application/json" \
  -d '{"format":"harvard-pdf","personURI":"test"}' \
  -w "\nStatus: %{http_code}\n"
# Debe retornar 200 o error controlado (no 500)
```

---

## ✅ Validación en Staging

### Lista de Verificación Técnica

```bash
# Script de validación automática
cat > /opt/vivo-app/validate_staging.sh << 'EOF'
#!/bin/bash

echo "=== VALIDACIÓN DE DESPLIEGUE EN STAGING ==="

VIVO_URL="http://staging-vivo:8080"
ERRORS=0

# Test 1: Widget CV carga en perfil
echo "Test 1: Verificando CV Widget en HTML..."
WIDGET_CHECK=$(curl -s "$VIVO_URL/individual/test" | grep -c "cv-download-widget" || echo 0)
if [ "$WIDGET_CHECK" -gt 0 ]; then
  echo "✓ CV Widget HTML presente"
else
  echo "✗ CV Widget NO encontrado en HTML"
  ERRORS=$((ERRORS+1))
fi

# Test 2: CSS carga correctamente
echo "Test 2: Verificando CSS carga..."
CSS_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$VIVO_URL/themes/wilma/css/hub-cv-widget.css")
if [ "$CSS_STATUS" = "200" ]; then
  echo "✓ hub-cv-widget.css HTTP 200"
else
  echo "✗ hub-cv-widget.css HTTP $CSS_STATUS"
  ERRORS=$((ERRORS+1))
fi

# Test 3: Mapa coautoría sigue funcionando
# El frontend consume el JSON desde la ruta ABSOLUTA (no /mapadeCoauthor/baseData.json)
echo "Test 3: Verificando Mapa de Coautoría..."
MAP_CHECK=$(curl -s "$VIVO_URL/HUBvivo115/js/coauthorNetworkViz/baseData.json" | grep -c "edgesAllGrants" || echo 0)
if [ "$MAP_CHECK" -gt 0 ]; then
  echo "✓ Mapa coautoría: baseData.json con proyectos (esquema *Grants)"
else
  echo "✗ Mapa coautoría FALLO (falta baseData.json o esquema viejo sin *Grants)"
  ERRORS=$((ERRORS+1))
fi

# Test 4: API CV endpoint responde
echo "Test 4: Verificando API /api/cv/generate..."
API_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$VIVO_URL/api/cv/generate" -X POST \
  -H "Content-Type: application/json" \
  -d '{"format":"harvard-pdf"}')
if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "400" ] || [ "$API_STATUS" = "401" ]; then
  echo "✓ CVProxyServlet responde ($API_STATUS)"
else
  echo "✗ CVProxyServlet ERROR ($API_STATUS)"
  ERRORS=$((ERRORS+1))
fi

# Test 5: Logs sin errores críticos
echo "Test 5: Verificando logs de Tomcat..."
ERROR_COUNT=$(grep -c "ERROR\|CRITICAL" /opt/tomcat/logs/catalina.out || echo 0)
if [ "$ERROR_COUNT" -eq 0 ]; then
  echo "✓ Sin errores críticos en logs"
else
  echo "✗ $ERROR_COUNT errores encontrados en logs"
  ERRORS=$((ERRORS+1))
fi

echo ""
echo "=== RESULTADO ==="
if [ "$ERRORS" -eq 0 ]; then
  echo "✓ VALIDACIÓN COMPLETADA EXITOSAMENTE"
  exit 0
else
  echo "✗ $ERRORS TEST(S) FALLARON"
  exit 1
fi
EOF

chmod +x /opt/vivo-app/validate_staging.sh

# Ejecutar validación
/opt/vivo-app/validate_staging.sh
```

### Pruebas Manuales en Navegador

```
URL Base Staging: https://staging-hub.urosario.edu.co (o HTTP según config)

✓ TEST 1: Perfil de Persona
  URL: https://staging-hub.urosario.edu.co/individual/[personURI]
  Validar:
    □ Foto de perfil carga
    □ Widget "Descargar CV" visible
    □ Widget está abajo de foto (posición correcta)
    □ Colores UR (rojo #b91c2e) aparecen
    □ Sin errores en consola (F12 → Console)

✓ TEST 2: Descarga CV - Formato Harvard
  Acción: Click en dropdown → Seleccionar "Harvard PDF"
  Validar:
    □ Dropdown se abre suavemente
    □ Botón "Harvard PDF" visible
    □ Al hacer click, muestra loading
    □ PDF descarga correctamente
    □ Filename: {nombre}_CV_harvard_{fecha}.pdf

✓ TEST 3: Descarga CV - Formato Europass
  Acción: Click en dropdown → Seleccionar "Europass PDF"
  Validar:
    □ Dropdown se abre
    □ Botón "Europass PDF" visible
    □ Al hacer click, muestra loading
    □ PDF descarga correctamente
    □ Filename: {nombre}_CV_europass_{fecha}.pdf

✓ TEST 4: Mapa de Coautoría
  URL: https://staging-hub.urosario.edu.co/mapadeCoauthor/
  Validar:
    □ Visualización D3.js carga
    □ Se ven nodos (círculos = autores)
    □ Se ven aristas (líneas = colaboraciones)
    □ Puedo hacer zoom/pan
    □ Búsqueda por nombre funciona
    □ Sin errores en consola

✓ TEST 5: Responsive Design
  En Chrome DevTools (F12):
  
  Móvil (375px):
    □ Widget CV se ve completo
    □ Dropdown no se corta
    □ Estilos responsivos se aplican
  
  Tablet (768px):
    □ Widget se ve bien
    □ Buttons legibles
  
  Desktop (1280px):
    □ Layout normal funciona

✓ TEST 6: Búsqueda General
  URL: https://staging-hub.urosario.edu.co/search
  Validar:
    □ Motor Solr responde
    □ Autocomplete funciona
    □ Resultados cargan sin CV Widget roto
    □ Performance aceptable (<2s)

✓ TEST 7: Sin Romper Otras Funciones
  Validar que cambios NO afectaron:
    □ Login/Logout
    □ Administración de datos
    □ Búsqueda avanzada
    □ Exportación de datos
    □ APIs de terceros
```

---

## 🎯 Promoción a Producción

### Paso 1: Aprobación de QA

```bash
# QA debe confirmar:
# ✓ Todos los tests en Staging PASARON
# ✓ Performance aceptable
# ✓ Sin regresiones
# ✓ Documentación actualizada
# ✓ Rollback plan revisado

# Crear checklist en ticket/issue:
# [ ] CV Widget funciona (Harvard + Europass)
# [ ] Mapa coautoría sin cambios
# [ ] Responsive en móvil/tablet/desktop
# [ ] Sin errores en logs
# [ ] Performance: response time < 500ms
# [ ] Aprobado por QA Lead
# [ ] Aprobado por DevOps Lead
```

### Paso 2: Merge a Main

```bash
# En máquina local o servidor CI/CD

# 1. Ir a rama main
git checkout main
git pull origin main

# 2. Hacer merge de feature branch
git merge feat/cv-download-widget

# 3. Verificar merge sin conflictos
git status
# On branch main
# nothing to commit, working tree clean

# 4. Ver cambios finales
git log --oneline -3

# 5. Push a repositorio remoto
git push origin main

# Crear TAG de versión
git tag -a v1.1.0 -m "Release: CV Download Widget + Mapa Coautoría Optimizado"
git push origin v1.1.0
```

### Paso 3: Despliegue a Producción

```bash
# SSH a servidor PRODUCCIÓN
ssh deploy@prod-vivo.urosario.edu.co
su - vivo_app

# Verificar que estamos en PROD (¡¡¡IMPORTANTE!!!)
hostname
# prod-vivo (debe ser diferente a staging)

# Ir a directorio de aplicación
cd /opt/vivo-app

# Actualizar código
git fetch origin main
git checkout main
git pull origin main

# Crear BACKUP COMPLETO (antes de cualquier cambio)
BACKUP_DIR="/opt/vivo-backups/PROD_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup BD completa
mysqldump -h prod-db -u vivo_user -p vitrodb > \
          $BACKUP_DIR/vitrodb_backup.sql
          
# Backup configuración
cp -r /opt/tomcat/webapps/ROOT/themes $BACKUP_DIR/themes_backup
cp -r $VIVO_HOME/config $BACKUP_DIR/vivo_config_backup

echo "Backup en: $BACKUP_DIR"

# Desplegar (igual que en staging)
cp tomcat/tomcat9/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl \
   /opt/tomcat/webapps/ROOT/themes/wilma/templates/

cp tomcat/tomcat9/webapps/ROOT/themes/wilma/css/hub-cv-widget.css \
   /opt/tomcat/webapps/ROOT/themes/wilma/css/

# Permisos
chmod 644 /opt/tomcat/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl
chmod 644 /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css

# Rolling restart (sin downtime)
sudo systemctl restart tomcat

# Esperar
sleep 60

# Validar
curl -s https://research-hub.urosario.edu.co | head -5

# Ver logs
tail -50 /opt/tomcat/logs/catalina.out | grep -i error
```

---

## 🔄 Rollback si Falla

### Plan de Rollback (Emergencia)

```bash
# Si algo falla CRÍTICAMENTE en STAGING:

BACKUP_DIR="/opt/vivo-backups/[FECHA_BACKUP]"

# 1. Restaurar archivos
cp $BACKUP_DIR/templates_backup/individual--foaf-person.ftl \
   /opt/tomcat/webapps/ROOT/themes/wilma/templates/

rm /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css

# 2. Restaurar DB si es necesario
mysql -h staging-db -u vivo_user -p vitrodb < $BACKUP_DIR/vitrodb_backup.sql

# 3. Reiniciar
sudo systemctl restart tomcat

# 4. Verificar
curl -s http://staging-vivo:8080 | head -5

# 5. Volver a rama anterior
git checkout main
git pull origin main
```

### Rollback en Producción

```bash
# ⚠️ SOLO si falla CRÍTICAMENTE en PROD

# 1. Notificar al equipo INMEDIATAMENTE
# 2. Activar plan de contingencia

# Revertir commit en main
git revert HEAD --no-edit
git push origin main

# Restaurar desde backup
BACKUP_DIR="/opt/vivo-backups/PROD_[TIMESTAMP]"
cp $BACKUP_DIR/themes_backup/individual--foaf-person.ftl \
   /opt/tomcat/webapps/ROOT/themes/wilma/templates/
rm /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css

# Restart
sudo systemctl restart tomcat

# Comunicar a usuarios
# Crear incidente en monitoring (Grafana, PagerDuty, etc.)
```

---

## 🐛 Troubleshooting

### Problema 1: Widget CV no aparece en perfil

```bash
# Verificar que template se copió
cat /opt/tomcat/webapps/ROOT/themes/wilma/templates/individual--foaf-person.ftl \
  | grep -n "cv-download-widget" | head -3
# Debe mostrar líneas ~55-200

# Si no aparece:
# - Verificar permisos: ls -la [archivo]
# - Verificar Tomcat leyendo el archivo: 
#   strace -e open,openat tomcat [PID]
# - Limpiar cache Tomcat: rm -rf /opt/tomcat/work/*
# - Restart Tomcat

# Revisar logs de Freemarker
tail -50 /opt/tomcat/logs/catalina.out | grep -i "freemarker\|ftl"
```

### Problema 2: CSS no carga (404)

```bash
# Verificar archivo existe
test -f /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css && \
  echo "✓ Archivo existe" || echo "✗ NO existe"

# Verificar permisos de lectura
ls -la /opt/tomcat/webapps/ROOT/themes/wilma/css/hub-cv-widget.css
# Debe tener -r-- para owner

# Si 404: revisar si Tomcat sirviendo estáticos
curl -v http://staging-vivo:8080/themes/wilma/css/main.css
# Debe retornar 200

# Si hub-cv-widget.css falla pero main.css funciona:
# - Verificar ruta exacta
# - Verificar caracteres especiales en nombre
# - Limpiar browser cache (Ctrl+Shift+Del)
```

### Problema 3: PDF no descarga

```bash
# Verificar que CVProxyServlet está registrado
curl -v -X POST http://staging-vivo:8080/api/cv/generate \
  -H "Content-Type: application/json" \
  -d '{"format":"harvard-pdf","personURI":"test"}'

# Ver response headers
# Si retorna 404: servlet NO está registrado en web.xml
# Si retorna 403: API Key inválida
# Si retorna 500: error en backend

# Revisar logs
tail -100 /opt/tomcat/logs/catalina.out | grep -i "CVProxyServlet\|api"

# Verificar variable de entorno
echo $HUB_CV_API_KEY
# Si vacío: setear en systemd service o .env

# Reiniciar Tomcat con variables
export HUB_CV_API_KEY="tu-key"
sudo systemctl restart tomcat
```

### Problema 4: Mapa Coautoría no carga

El frontend (v3.17) lee el JSON de la ruta **absoluta**, no de su webapp:
`/HUBvivo115/js/coauthorNetworkViz/baseData.json`

```bash
# 1. Verificar que el frontend (SPA) responde
curl -s -o /dev/null -w "SPA: %{http_code}\n" http://localhost:8080/mapadeCoauthor/

# 2. Verificar el JSON de datos en su ruta absoluta correcta
curl -s -o /dev/null -w "datos: %{http_code} %{content_type}\n" \
  http://localhost:8080/HUBvivo115/js/coauthorNetworkViz/baseData.json

# 3. Confirmar que el JSON trae proyectos (esquema *Grants, no unificado)
python3 -c "import json; d=json.load(open('/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json')); \
print('Pubs:', len(d.get('edgesAllPubs',[])), '| Grants:', len(d.get('edgesAllGrants',[])))"
```

**Causas frecuentes** (ver `02-Deploy-Real-y-Lecciones-2026-07-17.md`):
- Falta el `baseData.json` en la ruta absoluta → mapa vacío + consola "no encontrado"
- JSON con esquema viejo (`edgesAll`/`edgesInternal`) → toggle **Proyectos** vacío
- Mensaje "baseData.json no encontrado" engañoso: el `.catch()` también atrapa
  errores de `initNetwork` aunque el archivo sí cargue

```bash
# Si hay que regenerar el JSON desde SPARQL (JSP v4.3 síncrono):
curl -s -L -o /dev/null http://localhost:8080/HUBvivo115/       # desbloquea Startup Status
sudo /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
tail -100 /opt/tomcat/logs/catalina.out | grep -i "sparql\|coauthor"
```

### Problema 5: Performance lenta en Staging

```bash
# Medir tiempo de respuesta
time curl -s http://staging-vivo:8080/individual/test > /dev/null

# Ver uso de memoria
free -h
df -h

# Ver logs de Tomcat
tail -50 /opt/tomcat/logs/catalina.out | grep -i "memory\|gc\|heap"

# Si Tomcat usa mucha memoria:
# - Verificar CATALINA_OPTS
# - Aumentar -Xmx (máximo heap)
# - Reiniciar Tomcat

# Ver conexiones a BD
mysql -h staging-db -u vivo_user -p -e "SHOW PROCESSLIST;"
```

---

## ✨ Checklist Final Staging → Producción

```
ANTES DE DESPLEGAR A PRODUCCIÓN:

CÓDIGO:
☐ Rama feat/cv-download-widget mergeada a main
☐ Todos los commits tienen mensaje descriptivo
☐ SIN archivos secrets (.env, passwords)
☐ SIN debug code o console.log()
☐ Tags de versión creados (v1.1.0)

TESTING:
☐ Todos los tests de QA pasaron en staging
☐ Performance validado (< 500ms response time)
☐ Responsive design en móvil/tablet/desktop
☐ SIN regresiones en funcionalidad anterior
☐ Backup de BD en staging ejecutado y testeado

INFRAESTRUCTURA:
☐ Variables de entorno configuradas en PROD
☐ API Keys válidas (HUB_CV_API_KEY)
☐ Conexión a BD PROD validada
☐ Permisos de archivo correctos en PROD
☐ Nginx/Reverse Proxy configurado en PROD

ROLLBACK:
☐ Backup COMPLETO creado en PROD
☐ Procedimiento de rollback documentado
☐ Equipo de ops sabe cómo ejecutar rollback
☐ Comunicación a usuarios planificada

MONITOREO:
☐ Alertas en Grafana/Datadog configuradas
☐ Logs enviados a ELK Stack
☐ Métricas de aplicación siendo monitoreadas
☐ On-call engineer disponible post-deploy

COMUNICACIÓN:
☐ Stakeholders notificados de fecha/hora de deploy
☐ Ventana de despliegue programada (off-peak)
☐ Plan de comunicación en caso de issue
☐ Post-deploy validation checklist preparada

→ SI TODO ESTÁ ✓, PROCEDER CON CONFIANZA
```

---

**Última actualización:** 2026-07-17  
**Ambiente enfoque:** STAGING (Prácticas) → PRODUCCIÓN  
**Estado:** Guía completa v1.0
