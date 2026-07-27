<!--
  ============================================================================
  coauthorNetworkViz.ftl — Wrapper del Mapa de Coautorías
  ============================================================================

  QUE HACE
    Plantilla FreeMarker que VIVO renderiza para la ruta /coauthorNetwork (ver
    el enlace del menu en header.ftl). Rompe los limites del layout central de
    VIVO (100vw) e incrusta la aplicacion del mapa, que es una SPA AISLADA, en
    un <iframe src="/mapadeCoauthor/">.

  POR QUE UN IFRAME
    El mapa usa D3.js y su propio CSS/JS. Encapsularlo en un iframe evita que
    esas dependencias choquen con las de VIVO (jQuery, Bootstrap, etc.) que
    conviven en la misma pagina.

  DE QUE DEPENDE
    - La webapp /mapadeCoauthor/ (index.html, network_logic.js, legend_styles.css)
      debe existir como aplicacion separada en el servidor.
    - Esa app lee /HUBvivo115/js/coauthorNetworkViz/baseData.json, que genera
      carga_mapa.sh por cron (ver ese archivo para el flujo completo).

  DONDE VA EN EL SERVIDOR
    /opt/tomcat/webapps/HUBvivo115/templates/freemarker/body/coauthorNetworkViz.ftl
-->

<!-- Cargar estilos unificados del frontend para expandir el Layout VIVO -->
<style>
  /* Forzar al contenedor a romper los limites de la plantilla de VIVO */
  #mapa-coautores-container {
    width: 100vw !important;
    height: 90vh !important;
    max-width: 100vw !important;
    margin-left: calc(-50vw + 50%); /* Truco para salir del div central */
    position: relative;
    overflow: hidden;
    background: #f8f8f8;
    border: none;
  }
  #mapa-coautores-container iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
    position: absolute;
    top: 0;
    left: 0;
  }
</style>

<div id="mapa-coautores-container">
  <iframe
    src="/mapadeCoauthor/"
    title="Mapa de Colaboración"
    allowfullscreen
    loading="eager"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  ></iframe>
</div>
