# 🌐 Mapa de Coautorías y Coinvestigaciones (VIVO)

![Mapa de Coautorías](https://img.shields.io/badge/VIVO-Compatible-brightgreen.svg)
![D3.js](https://img.shields.io/badge/D3.js-v7-F9A03C.svg?logo=d3.js)
![SPARQL](https://img.shields.io/badge/SPARQL-Data-blue.svg)

Este repositorio contiene la implementación nativa y modular del **Mapa de Coautorías e Investigaciones** para la plataforma VIVO (v1.11+). Superando los componentes legacy, esta visualización ofrece una red interactiva, responsiva y de alto rendimiento impulsada por **D3.js** y conectada mediante consultas directas al modelo ontológico RDF de VIVO.

---

## ✨ Características Principales

* **Red Dual Dinámica:** Permite al usuario alternar mediante capas (Toggles) entre la visualización de la **Red de Publicaciones Académicas** y la **Red de Proyectos de Investigación**.
* **Integración Transparente:** Se incrusta directamente en las páginas de VIVO usando FreeMarker (`.ftl`) sin conflicto de dependencias (SPA encapsulada mediante Iframe con `100vw`).
* **Alto Rendimiento en Backend:** Usa un JSP como puente (`coauthorNetwork.jsp`) que resuelve un pesado árbol SPARQL en el backend. 
* **Caché Asíncrona (Cron):** No castiga a la base de datos de VIVO con el tráfico concurrente. Un script de Bash nocturno extrae un `baseData.json` que el frontend consume instántaneamente de un caché en memoria/disco.
* **UI/UX Moderna:** Temas adaptativos Claro/Oscuro (*Dark Mode* respetando jerarquías tonales), Sidebars de estadísticas en vivo (Ego-network), tooltips flotantes e interfaz "Glassmorphism".
* **Filtros Institucionales:** Segmentación interactiva de la red por Facultades y Escuelas.

---

## 🏗️ Arquitectura Técnica

El módulo está fuertemente estructurado para mantener la base lógica separada de la representación:

1. **Backend (El extractor de conocimiento):**
   * Archivo: `coauthorNetwork.jsp` (Situado en `/WEB-INF/custom/`)
   * Función: Interroga a la ontología mediante SPARQL deduplicando nodos (investigadores URosario y perfiles externos) calculando el volumen de publicaciones y proyectos conjuntos.
2. **Cron Auto-Renovable (El planificador):**
   * Archivo: `carga_mapa.sh`
   * Función: Tarea bash que se ejecuta a la 1:00 AM. Genera versiones con `timestamp` del backup anterior y escribe el nuevo archivo estático `baseData.json` accesible para los motores JS.
3. **Frontend (La experiencia gráfica D3):**
   * Archivos: `index.html`, `network_logic.js`, `legend_styles.css`
   * Función: Single Page Application encargada de la simulación de fuerzas gravitacionales, posicionamiento espacial y respuesta a clics. 

---

## 🚀 Despliegue en Servidor

Esta instalación requiere permisos de Consola (SSH) en el servidor Tomcat/VIVO y permisos de Administrador de Sitio dentro de VIVO (Site Admin).

Para conocer las instrucciones paso a paso, revisión de rutas del servidor, mapeo de plantillas FTL y setup del Crontab, consulta el manual detallado de instalación:

👉 **[CONSULTAR LA GUÍA DE INSTALACIÓN FINAL](GUIA_INSTALACION_FINAL.md)**

---

## 🤝 Mantenimiento
Desarrollado para la **Universidad del Rosario**.
Tecnologías núcleo: JavaScript (ES6), D3.js (v7), bash scripting, SPARQL 1.1 y Java Servlets (VIVO framework).
