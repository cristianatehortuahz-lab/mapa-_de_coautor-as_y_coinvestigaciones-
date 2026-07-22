#!/bin/bash
# =============================================================================
# carga_mapa.sh - Regeneracion del archivo de datos del Mapa de Colaboracion
# =============================================================================
#
# QUE HACE
#   Pide al JSP (coauthorNetwork.jsp) que ejecute las consultas SPARQL contra
#   VIVO y guarda el resultado como baseData.json, que es el archivo que lee
#   la visualizacion.
#
# CUANDO SE EJECUTA
#   Desde cron, una vez al dia. Entrada tipica en el crontab de root:
#     00 01 * * * /bin/bash /opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz/carga_mapa.sh
#   Tambien puede lanzarse a mano tras un despliegue.
#
# SEGURIDAD ANTE FALLOS
#   Descarga primero a un archivo temporal y solo reemplaza el JSON en
#   produccion si la descarga es valida. Asi un fallo del JSP o de la red
#   nunca deja el mapa sin datos.
#
# CODIGOS DE SALIDA
#   0  el JSON se regenero correctamente
#   1  no se pudo acceder al directorio de datos
#   2  la descarga fallo o devolvio contenido invalido
# =============================================================================

set -uo pipefail

# --- Configuracion ------------------------------------------------------------
# Directorio donde vive el JSON que consume la visualizacion.
DIR_JSON="/opt/tomcat/webapps/HUBvivo115/js/coauthorNetworkViz"
# Endpoint del JSP que ejecuta las consultas SPARQL y devuelve el JSON.
URL_JSP="http://localhost:8080/HUBvivo115/coauthorViz"
# Cuantas copias de seguridad conservar.
RETENER=7
# Segundos maximos de espera (las consultas SPARQL pueden tardar).
TIMEOUT=300
# Tamano minimo aceptable. Un JSON correcto pesa varios MB; uno de pocos KB
# significa que la consulta devolvio vacio (indice TDB corrupto, por ejemplo).
MIN_BYTES=1000000

ARCHIVO="baseData.json"
TEMPORAL="${ARCHIVO}.descarga.$$"

echo "[$(date '+%F %T')] Iniciando regeneracion del mapa"

cd "$DIR_JSON" || { echo "ERROR: no se pudo acceder a $DIR_JSON"; exit 1; }

# --- Descarga a un temporal ---------------------------------------------------
# El JSP no responde hasta terminar las consultas, de ahi el timeout amplio.
if ! curl -sS --max-time "$TIMEOUT" "$URL_JSP" -o "$TEMPORAL"; then
    echo "ERROR: la peticion a $URL_JSP fallo"
    rm -f "$TEMPORAL"
    exit 2
fi

# --- Validacion ---------------------------------------------------------------
# No basta con que existan las claves: si la consulta SPARQL falla, el JSP
# devuelve la estructura correcta pero con los arrays vacios. Por eso se exige
# ademas un tamano y un numero de nodos minimos.

if [ ! -s "$TEMPORAL" ]; then
    echo "ERROR: la descarga quedo vacia; se conserva el JSON anterior"
    rm -f "$TEMPORAL"
    exit 2
fi

# 1) Estructura: deben estar las claves que consume la visualizacion.
if ! grep -q '"edgesAllPubs"' "$TEMPORAL" || ! grep -q '"edgesAllGrants"' "$TEMPORAL"; then
    echo "ERROR: el JSON no trae las claves esperadas"
    echo "       (pagina de error, o esquema antiguo edgesAll/edgesInternal)"
    echo "       se conserva el JSON anterior"
    rm -f "$TEMPORAL"
    exit 2
fi

# 2) El JSP puede senalar el fallo con claves de error en lugar de datos.
if grep -q '"error' "$TEMPORAL"; then
    echo "ERROR: el JSP reporto un fallo en la consulta SPARQL:"
    grep -o '"error[^,}]*' "$TEMPORAL" | head -5 | sed 's/^/       /'
    echo "       se conserva el JSON anterior"
    rm -f "$TEMPORAL"
    exit 2
fi

# 3) Volumen: un JSON correcto pesa varios MB. Uno de unos pocos KB significa
#    que la consulta devolvio vacio aunque la estructura sea valida.
TAM_NUEVO=$(stat -c%s "$TEMPORAL")
if [ "$TAM_NUEVO" -lt "$MIN_BYTES" ]; then
    echo "ERROR: el JSON pesa $TAM_NUEVO bytes, por debajo del minimo ($MIN_BYTES)"
    echo "       la consulta SPARQL devolvio pocos datos o ninguno"
    echo "       se conserva el JSON anterior"
    echo "       revisar: tail -50 /opt/tomcat/logs/catalina.out"
    rm -f "$TEMPORAL"
    exit 2
fi

# 4) Cotejo con el JSON vigente: una caida brusca indica un problema de datos.
if [ -f "$ARCHIVO" ]; then
    TAM_ACTUAL=$(stat -c%s "$ARCHIVO")
    UMBRAL=$(( TAM_ACTUAL / 2 ))
    if [ "$TAM_NUEVO" -lt "$UMBRAL" ]; then
        echo "ERROR: el JSON nuevo ($TAM_NUEVO bytes) es menos de la mitad que"
        echo "       el vigente ($TAM_ACTUAL bytes); se conserva el anterior"
        echo "       si la caida es legitima, borra $ARCHIVO y vuelve a ejecutar"
        rm -f "$TEMPORAL"
        exit 2
    fi
fi

# --- Reemplazo -----------------------------------------------------------------
# Solo se llega aqui si la descarga es valida.
if [ -f "$ARCHIVO" ]; then
    cp -p "$ARCHIVO" "${ARCHIVO}.$(date +'%Y%m%d_%H%M')"
fi

mv "$TEMPORAL" "$ARCHIVO"
chmod 644 "$ARCHIVO"   # Tomcat debe poder leerlo

# --- Limpieza de copias antiguas ------------------------------------------------
ls -1t "${ARCHIVO}."[0-9]* 2>/dev/null | tail -n +$((RETENER + 1)) | xargs -r rm -f

TAM=$(stat -c%s "$ARCHIVO" 2>/dev/null || echo '?')
echo "[$(date '+%F %T')] Listo: $ARCHIVO regenerado ($TAM bytes)"
exit 0
