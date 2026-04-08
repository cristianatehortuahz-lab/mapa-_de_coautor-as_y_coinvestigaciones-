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
