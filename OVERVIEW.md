# 🌐 Mapa de Coautorías: Visión General

El **Mapa de Coautorías** es una herramienta de visualización interactiva diseñada para la **Universidad del Rosario**, que permite explorar las redes de colaboración entre sus investigadores. Utiliza el motor gráfico **D3.js** para representar estas relaciones como un grafo dinámico.

---

## ✨ Características Principales

### 1. Dos Capas de Información
El mapa permite alternar entre dos tipos de redes fundamentales:
*   **Publicaciones:** Visualiza quién ha escrito documentos académicos en conjunto.
*   **Proyectos (Grants):** Muestra la colaboración en proyectos de investigación financiados.

### 2. Interactividad Avanzada
*   **Zoom y Paneado:** Explora la red completa o haz zoom para ver detalles específicos.
*   **Buscador Inteligente:** Encuentra rápidamente a cualquier investigador por su nombre con sugerencias automáticas.
*   **Red Personal (Ego-Network):** Al seleccionar un investigador, puedes "entrar" en su red personal para ver exclusivamente sus colaboradores directos.
*   **Dimming (Enfoque):** Al pasar el mouse sobre un nodo, el resto del mapa se atenúa para resaltar las conexiones directas de ese investigador.

### 3. Paneles de Información
*   **Sidebar Detallado:** Al hacer clic en un investigador, se abre un panel con su foto, facultad, estadísticas totales y su top de colaboradores frecuentes.
*   **Filtros por Facultad:** La barra inferior permite filtrar la red para ver solo investigadores de una facultad específica (Medicina, Economía, Jurisprudencia, etc.).
*   **Leyenda Interactiva:** Un panel de ayuda explica cómo leer el tamaño de los nodos (producción) y el grosor de las líneas (intensidad de la colaboración).

---

## 🛠️ Tecnologías Utilizadas

*   **D3.js v7:** Motor principal para la simulación física (fuerzas y colisiones) y renderizado SVG.
*   **HTML5/CSS3:** Estructura y diseño con efectos de **Glassmorphism** (cristal translúcido) y animaciones fluidas.
*   **SPARQL/JSON:** Los datos se extraen de la base de datos de investigación (VIVO/HUB-UR) y se procesan en un archivo `baseData.json` para carga ultrarrápida.

---

## 📖 Cómo Usar el Mapa

1.  **Navegación:** Usa la rueda del ratón para acercarte/alejarte y arrastra el fondo para moverte.
2.  **Exploración:** Pasa el cursor sobre los círculos (nodos) para ver nombres y cantidad de publicaciones/proyectos.
3.  **Filtrado:** Haz clic en los botones de "Facultad" en la parte inferior para aislar grupos de investigación.
4.  **Selección:** Haz clic en un investigador para abrir su perfil y ver su lista de colaboradores destacados.
5.  **Cambio de Vista:** Usa el selector superior para saltar entre la red de **Publicaciones** y la de **Proyectos**.

---

## ⚠️ Nota sobre Externos
El mapa diferencia entre investigadores internos de la UR (coloreados por facultad) e investigadores externos (representados en color gris), permitiendo ver cómo la universidad se conecta con el resto del mundo académico.
