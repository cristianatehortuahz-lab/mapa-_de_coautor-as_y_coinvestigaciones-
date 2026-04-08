#!/bin/bash

# Configuración de Rutas
DIR_JSON="/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz"
URL_JSP="http://localhost:8080/HUBvivo115/coauthorViz"

echo "Iniciando proceso de actualización de JSON: $(date)"

# Entrar al directorio de datos
cd "$DIR_JSON" || { echo "Error: No se pudo acceder a $DIR_JSON"; exit 1; }

# Backup del JSON actual (con timestamp de minuto para evitar colisiones en pruebas)
if [ -f "baseData.json" ]; then
    TIMESTAMP=$(date +'%Y%m%d_%H%M')
    mv baseData.json "baseData.json_$TIMESTAMP"
    echo "Backup creado: baseData.json_$TIMESTAMP"
fi

# Descargar nuevos datos llamando al JSP
# -s (silent), -S (show errors)
curl -sS "$URL_JSP" -o baseData.json

# Verificar si el archivo se creó y no está vacío
if [ -s "baseData.json" ]; then
    # Ajustar permisos para que Tomcat pueda leerlo (lectura global)
    chmod 644 baseData.json
    echo "Carga finalizada satisfactoriamente: baseData.json generado."
else
    echo "Error: El archivo baseData.json está vacío o no se pudo descargar."
    exit 1
fi
