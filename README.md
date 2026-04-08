# 🌐 Mapa de Colaboración y Coinvestigaciones (VIVO)

![Mapa de Colaboración](https://img.shields.io/badge/VIVO-Compatible-brightgreen.svg)
![D3.js](https://img.shields.io/badge/D3.js-v7-F9A03C.svg?logo=d3.js)
![SPARQL](https://img.shields.io/badge/SPARQL-Data-blue.svg)

Este repositorio contiene la implementación nativa y modular del **Mapa de Colaboración e Investigaciones** para la plataforma VIVO (v1.11+). Superando los componentes legacy, esta visualización ofrece una red interactiva, responsiva y de alto rendimiento impulsada por **D3.js** y conectada mediante consultas directas al modelo ontológico RDF de VIVO.

---

## ✨ Características Principales

* **Red Dual Dinámica:** Permite al usuario alternar mediante capas (Toggles) entre la visualización de la **Red de Publicaciones Académicas** y la **Red de Proyectos de Investigación**.
* **Integración Transparente:** Se incrusta directamente en las páginas de VIVO usando FreeMarker (`.ftl`) sin conflicto de dependencias (SPA encapsulada mediante Iframe con `100vw`).
* **Alto Rendimiento en Backend:** Usa un JSP como puente (`coauthorNetwork.jsp`) que resuelve un pesado árbol SPARQL en el backend.
* **Ejecución Síncrona (v4.3):** El JSP ejecuta las 4 consultas SPARQL de forma síncrona y devuelve el JSON completo en una sola respuesta HTTP. Un script Bash nocturno (`carga_mapa.sh`) captura la salida y la guarda como `baseData.json` estático.
* **UI/UX Moderna:** Temas adaptativos Claro/Oscuro (*Dark Mode* respetando jerarquías tonales), Sidebars de estadísticas en vivo (Ego-network), tooltips flotantes e interfaz "Glassmorphism".
* **Filtros Institucionales:** Segmentación interactiva de la red por Facultades y Escuelas.

---

## 🏗️ Arquitectura Técnica

El módulo está fuertemente estructurado para mantener la base lógica separada de la representación:

1. **Backend (El extractor de conocimiento):**
   * Archivo: `coauthorNetwork.jsp` (Situado en `/WEB-INF/custom/coauthorViz/`)
   * Función: Interroga a la ontología mediante 4 consultas SPARQL independientes (nodos internos, nodos externos, aristas internas, aristas externas). Los resultados se fusionan en Java para construir el JSON final. La ejecución es síncrona — el JSP bloquea hasta completar todas las consultas.
2. **Cron Auto-Renovable (El planificador):**
   * Archivo: `carga_mapa.sh`
   * Función: Tarea bash que se ejecuta a la 1:00 AM. Hace `curl` al endpoint JSP, espera la respuesta completa (~30-60 segundos en bases grandes), y escribe el nuevo archivo estático `baseData.json`.
3. **Frontend (La experiencia gráfica D3):**
   * Archivos: `index.html`, `network_logic.js`, `legend_styles.css`
   * Función: Single Page Application encargada de la simulación de fuerzas gravitacionales, posicionamiento espacial y respuesta a clics.

---

## 📂 Estructura del Repositorio

```
deploy_produccion_mapa/          ← Paquete de despliegue en producción
├── coauthorNetwork.jsp          ← Motor SPARQL síncrono (v4.3)
├── coauthorNetworkViz.ftl       ← Wrapper FreeMarker para VIVO
├── index.html                   ← Frontend SPA principal
├── network_logic.js             ← Lógica D3.js y renderizado del grafo
├── legend_styles.css            ← Estilos UI/UX (dark/light mode)
├── carga_mapa.sh                ← Script de regeneración nocturna
├── baseData.json                ← Ejemplo de datos generados
├── GUIA_INSTALACION_FINAL.md    ← Guía paso a paso de despliegue
└── README.md                    ← Este archivo
```

---

## 🚀 Despliegue en Servidor

Esta instalación requiere permisos de Consola (SSH) en el servidor Tomcat/VIVO y permisos de Administrador de Sitio dentro de VIVO (Site Admin).

Para conocer las instrucciones paso a paso, revisión de rutas del servidor, mapeo de plantillas FTL, setup del Crontab y procedimientos de resolución de problemas, consulta el manual detallado de instalación:

👉 **[CONSULTAR LA GUÍA DE INSTALACIÓN FINAL](GUIA_INSTALACION_FINAL.md)**

---

## ⚠️ Notas Importantes (v4.3)

* **Ejecución Síncrona:** A diferencia de versiones anteriores que usaban hilos en background, la v4.3 ejecuta las consultas de forma síncrona. Esto evita que el script Bash guarde respuestas parciales o vacías.
* **Reinicio de Tomcat:** Siempre usar `/etc/rc.d/init.d/tomcat start/stop`. NO usar `startup.sh` directo ni `systemctl` si el servicio SYSV está en estado inconsistente.
* **Primer acceso tras reinicio:** VIVO bloquea la primera petición HTTP con una pantalla "Startup Status". Ejecutar `curl -s -L -o /dev/null http://localhost:8080/HUBvivo115/` antes de generar el JSON.

---

## 🤝 Mantenimiento
Desarrollado para la **Universidad del Rosario**.
Tecnologías núcleo: JavaScript (ES6), D3.js (v7), bash scripting, SPARQL 1.1 y Java Servlets (VIVO framework).
