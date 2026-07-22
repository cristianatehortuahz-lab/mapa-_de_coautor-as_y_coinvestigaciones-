# Despliegue Maestro — Mapa de Coautorías

**Mapeo de cada archivo del repositorio a su ruta en el servidor** para el módulo de mapa de colaboración del HUB-UR.

---

> **Sobre las direcciones:** los comandos `curl` y `bash` de esta guía se ejecutan
> **en el servidor**, por eso usan `localhost`. Los pasos de navegador usan
> `<servidor>`, que es la dirección del equipo donde corre Tomcat: en el servidor
> de prácticas, `10.194.194.96` (o `srvcbpbvivo`).

---

## 📍 Ubicaciones

**Contenido del repositorio:**
```
mapa-de-coautorias/
├── index.html              (aplicación de la visualización)
├── network_logic.js        (lógica de la red)
├── legend_styles.css       (estilos)
├── coauthorNetworkViz.ftl  (plantilla que incrusta el mapa en VIVO)
├── coauthorNetwork.jsp     (consulta SPARQL)
├── carga_mapa.sh           (genera el archivo de datos)
├── baseData.json           (datos generados)
└── documentacion/
```

**Rutas en el servidor (`srvcbpbvivo`, Linux):**
```
/opt/tomcat/webapps/
├── mapadeCoauthor/                    (frontend app independiente)
│   ├── index.html
│   ├── network_logic.js
│   └── legend_styles.css
└── HUBvivo115/
    ├── templates/freemarker/body/
    │   └── coauthorNetworkViz.ftl    (wrapper FTL)
    ├── WEB-INF/custom/coauthorViz/
    │   └── coauthorNetwork.jsp        (backend JSP)
    ├── js/coauthorNetworkViz/
    │   ├── baseData.json              (caché JSON)
    │   └── carga_mapa.sh              (script cron)
    └── logs/
        └── catalina.out
```

---

## 🔄 Pasos de despliegue

### PASO 1: Backup en servidor

```bash
# En XShell, servidor prácticas
cd /opt/tomcat/webapps/mapadeCoauthor
tar czf ~/backup_mapa_frontend_$(date +%F_%T).tgz \
  index.html network_logic.js legend_styles.css

cd /opt/tomcat/webapps/HUBvivo115
tar czf ~/backup_mapa_$(date +%F_%T).tgz \
  templates/freemarker/body/coauthorNetworkViz.ftl \
  WEB-INF/custom/coauthorViz/coauthorNetwork.jsp \
  js/coauthorNetworkViz/baseData.json \
  js/coauthorNetworkViz/carga_mapa.sh
```

### PASO 2: Crear carpeta frontend en servidor

```bash
# En XShell
sudo mkdir -p /opt/tomcat/webapps/mapadeCoauthor
sudo chmod 755 /opt/tomcat/webapps/mapadeCoauthor
```

### PASO 3: Subir frontend vía XFTP

**Destino:** `/opt/tomcat/webapps/mapadeCoauthor/`

| Archivo del repositorio | Ruta en el servidor |
|---|---|
| `index.html` | `/opt/tomcat/webapps/mapadeCoauthor/` |
| `network_logic.js` | `/opt/tomcat/webapps/mapadeCoauthor/` |
| `legend_styles.css` | `/opt/tomcat/webapps/mapadeCoauthor/` |

### PASO 4: Crear carpeta backend en servidor

```bash
# En XShell
sudo mkdir -p /opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz
sudo chmod 755 /opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz
```

### PASO 5: Subir JSP backend vía XFTP

**Destino:** `/opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/`

| Archivo del repositorio | Ruta en el servidor |
|---|---|
| `coauthorNetwork.jsp` | `/opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/` |

### PASO 6: Subir FTL wrapper vía XFTP

**Destino:** `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/`

| Archivo del repositorio | Ruta en el servidor |
|---|---|
| `coauthorNetworkViz.ftl` | `/opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/` |

### PASO 7: Subir script cron y caché JSON vía XFTP

**Destino:** `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/`

| Archivo del repositorio | Ruta en el servidor |
|---|---|
| `carga_mapa.sh` | `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/` |
| `baseData.json` | `/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/` |

### PASO 8: Permisos en servidor

```bash
# Frontend
sudo chmod 644 /opt/tomcat/webapps/mapadeCoauthor/index.html
sudo chmod 644 /opt/tomcat/webapps/mapadeCoauthor/network_logic.js
sudo chmod 644 /opt/tomcat/webapps/mapadeCoauthor/legend_styles.css
sudo chown -R root:root /opt/tomcat/webapps/mapadeCoauthor/
sudo chmod 755 /opt/tomcat/webapps/mapadeCoauthor/

# FTL wrapper
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/coauthorNetworkViz.ftl

# JSP backend
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/coauthorNetwork.jsp

# Caché JSON
sudo chmod 644 /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json

# Script cron (DEBE ser ejecutable)
sudo chmod +x /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
```

### PASO 9: Crear página en VIVO (menú admin)

1. Abre `http://<servidor>:8080/` en el navegador
2. Inicia sesión como admin (`root-hub@urosario.edu.co`)
3. En barra superior roja: **"Administrador del sitio"**
4. Haz clic en **"Administración de la página"**
5. Busca "Mapa de Colaboración":
   - Si **NO existe**, haz clic en **"Agregar página"** y completa:
     - **Título:** `Mapa de Colaboración`
     - **URL:** `/coauthorNetwork`
     - **Plantilla personalizada:** `coauthorNetworkViz.ftl`
   - Si **SÍ existe**, verifica que URL sea `/coauthorNetwork` y plantilla sea `coauthorNetworkViz.ftl`

### PASO 10: Agregar al menú principal

1. En **"Administración de la página"**, marca el checkbox **"Página de menú"** en la fila "Mapa de Colaboración"
2. Regresa a **"Administrador del sitio"** > **"Orden del Menú"**
3. Usa **drag & drop** para posicionar "Mapa de Colaboración" donde desees

### PASO 11: Instalar cron job

```bash
# En XShell, editar crontab
sudo crontab -e

# Agregar al final:
# Ejecutar carga_mapa.sh a las 01:00 AM cada día
00 01 * * * /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
```

### PASO 12: Generar el JSON de datos (primera vez)

> `carga_mapa.sh` descarga a un temporal y **solo reemplaza `baseData.json` si la
> descarga es válida** (no vacía y con las claves `edgesAllPubs` / `edgesAllGrants`).
> Si el JSP falla, conserva el JSON anterior y sale con código 2. Guarda las 7
> copias más recientes.

```bash
# En XShell

# Paso 1: Desbloquear pantalla de Startup Status
curl -s -L -o /dev/null http://localhost:8080/HUBvivo115/

# Paso 2: Generar JSON (esperar ~30 segundos en bases grandes)
sudo /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh

# Verificar que se generó
ls -la /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json
file /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json
```

### PASO 13: Reiniciar Tomcat

```bash
# En XShell
sudo /etc/rc.d/init.d/tomcat stop
sleep 5
sudo /etc/rc.d/init.d/tomcat start

# Espera 30-60s a que cargue
tail -f /opt/tomcat/logs/catalina.out | grep -E "Server startup|ERROR"
```

> **No usar** `/opt/tomcat/bin/startup.sh` (arranca sin las variables de entorno
> del sistema y provoca errores de traducción en VIVO) ni `systemctl`: el servicio
> es SysV y el wrapper puede reportar que está vivo cuando en realidad murió.

---

## ✅ Verificación

```bash
# 1. ¿Frontend existe?
ls -la /opt/tomcat/webapps/mapadeCoauthor/index.html

# 2. ¿FTL existe?
ls -la /opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/coauthorNetworkViz.ftl

# 3. ¿JSP existe?
ls -la /opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/coauthorNetwork.jsp

# 4. ¿JSON caché existe y tiene contenido?
ls -la /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json
wc -l /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json
# Debe tener más de 100 líneas si hay datos

# 5. ¿Script cron es ejecutable?
ls -la /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh | grep -q "^-rwxr"
[ $? -eq 0 ] && echo "✅ Permisos OK" || echo "❌ Permisos incorrectos"

# 6. ¿Tomcat arrancó sin errores?
grep ERROR /opt/tomcat/logs/catalina.out | tail -5
```

### En navegador


1. `http://<servidor>:8080/coauthorNetwork` → ¿la página carga sin errores?
2. ¿Ves los botones "Proyectos" y "Publicaciones"?
3. ¿El mapa se expande con datos (nodos y enlaces)?
4. **F12 → Network** → busca requests a `/mapadeCoauthor/` (debe devolver 200)

---

## 🐛 Si el mapa no carga

El frontend lee el JSON desde una ruta **absoluta**, no desde su propia webapp:
`/HUBvivo115/js/coauthorNetworkViz/baseData.json`

```bash
# 1. ¿Responde la aplicación?
curl -s -o /dev/null -w 'SPA: %{http_code}\n' http://localhost:8080/mapadeCoauthor/

# 2. ¿Está el JSON en su ruta absoluta?
curl -s -o /dev/null -w 'datos: %{http_code} %{content_type}\n' \
  http://localhost:8080/HUBvivo115/js/coauthorNetworkViz/baseData.json

# 3. ¿El JSON trae publicaciones y proyectos?
python3 -c "import json; d=json.load(open('/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/baseData.json')); print('Pubs:', len(d.get('edgesAllPubs',[])), '| Grants:', len(d.get('edgesAllGrants',[])))"
```

**Si `carga_mapa.sh` falla con "el JSP reporto un fallo en la consulta SPARQL":**

Un error como `RecordRangeIterator.iterator -- No such block (pageId=...)` indica
que el índice **Jena TDB** de VIVO está corrupto: el JSP responde, pero las
consultas devuelven vacío. El script lo detecta y conserva el JSON anterior, así
que el mapa sigue funcionando con los últimos datos buenos.

Para repararlo, un reinicio limpio de Tomcat (no `startup.sh` ni `systemctl`):

```bash
sudo /etc/rc.d/init.d/tomcat stop
sleep 10
sudo /etc/rc.d/init.d/tomcat start
# esperar a que VIVO cargue del todo antes de reintentar
sleep 60 && curl -s -L -o /dev/null http://localhost:8080/HUBvivo115/
bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
```

Si tras el reinicio persiste, el índice necesita reconstruirse desde VIVO
(Administrador del sitio → *Rebuild Search Index*) o restaurarse de un respaldo.

**Causas frecuentes:**

| Síntoma | Causa |
|---|---|
| Mapa vacío y aviso "no encontrado" en consola | Falta `baseData.json` en la ruta absoluta |
| El botón **Proyectos** no dibuja nada | JSON con esquema antiguo (`edgesAll` / `edgesInternal`) en lugar de `edgesAllPubs` / `edgesAllGrants` |
| Aviso "baseData.json no encontrado" aunque el archivo sí carga | El `.catch()` también atrapa errores de `initNetwork`; el mensaje despista |

Para regenerar el JSON:

```bash
curl -s -L -o /dev/null http://localhost:8080/HUBvivo115/    # desbloquea la pantalla de arranque
sudo /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
tail -100 /opt/tomcat/logs/catalina.out | grep -i "sparql\|coauthor"
```

---

## 📝 Checklist final

- [ ] Backup hecho (`~/backup_mapa_*.tgz`)
- [ ] Carpeta `/opt/tomcat/webapps/mapadeCoauthor/` creada
- [ ] Frontend (`index.html`, `network_logic.js`, `legend_styles.css`) subido
- [ ] Permisos 644 en archivos frontend
- [ ] FTL wrapper (`coauthorNetworkViz.ftl`) subido a `/templates/freemarker/body/`
- [ ] Carpeta `/opt/tomcat/webapps/HUBvivo115/WEB-INF/custom/coauthorViz/` creada
- [ ] JSP backend (`coauthorNetwork.jsp`) subido
- [ ] Script cron (`carga_mapa.sh`) subido con permisos 755
- [ ] JSON caché (`baseData.json`) subido
- [ ] Página "Mapa de Colaboración" creada en VIVO (`/coauthorNetwork`)
- [ ] Página agregada al menú principal (checkbox marcado)
- [ ] Cron job instalado (ejecuta a las 01:00 AM)
- [ ] JSON generado manualmente (sin errores)
- [ ] Tomcat reiniciado y cargó sin ErrorFoundException
- [ ] Verificación en navegador: mapa visible con datos
- [ ] F12 → Network: requests a `/coauthorNetwork` devuelven 200
