/**
 * ═══════════════════════════════════════════════════════════════
 * network_logic.js  —  Motor de Visualización D3.js
 * Mapa de Colaboración · Universidad del Rosario
 * ═══════════════════════════════════════════════════════════════
 *
 * PUNTO DE ENTRADA:
 *   initNetwork(data)  ← llamada desde index.html con el JSON del JSP
 *
 * ESTRUCTURA GENERAL:
 *   1. Configuración del SVG y utilidades de color/escala
 *   2. Estado global de la aplicación
 *   3. Zoom y pan del canvas
 *   4. Simulación de fuerzas físicas (D3 Force)
 *   5. Overlay de carga (revelar el mapa por ticks)
 *   6. Sidebar lateral de perfil de nodo
 *   7. Desvanecimiento (dimming) al hacer hover
 *   8. Barra de filtros por facultad (legend bar)
 *   9. Función render() — dibuja nodos y aristas en el SVG
 *  10. Pipeline principal updateGraph() — filtra y llama a render()
 *  11. Modo detallado (ego-network)
 *  12. Buscador con autocompletado
 *  13. Panel de detalle de arista (coautoría)
 *  14. Controles varios y listeners responsivos
 *
 * DEPENDENCIAS:
 *   - D3.js v7 (cargado antes que este archivo en index.html)
 *   - legend_styles.css (clases CSS que usa este archivo)
 *   - HTML con los IDs: #network-graph, #hover-tooltip, #info-panel,
 *     #node-sidebar, #controls, #legend-panel, #cinematic-overlay, etc.
 */

/**
 * initNetwork — Inicializa toda la aplicación de red.
 *
 * @param {Object} data - JSON con la estructura:
 *   {
 *     nodesInternal: [{ id, name, group, pubs, external:false }],
 *     nodesAll:      [{ id, name, group:'external', pubs, external:true }],
 *     edgesInternal: [{ id, source, target, jointPubs }],
 *     edgesAll:      [{ id, source, target, jointPubs }]
 *   }
 */
function initNetwork(data) {

    // =========================================================
    // 0. GESTIÓN DE CAPAS (Dual Layer: Pubs vs Grants)
    // =========================================================

    // Estado global de la capa activa: 'pubs' (Publicaciones) o 'grants' (Proyectos)
    window.currentLayer = 'pubs';

    /**
     * getMetric — Retorna el valor numérico según la capa activa.
     */
    function getMetric(d) {
        return window.currentLayer === 'pubs' ? (d.pubs || 0) : (d.grants || 0);
    }

    /**
     * getLayerLabels — Retorna las etiquetas de texto según la capa activa.
     */
    function getLayerLabels() {
        if (window.currentLayer === 'pubs') {
            return { node: 'coautorías', edge: 'docs compartidos', title: 'Publicaciones' };
        } else {
            return { node: 'proyectos', edge: 'proyectos conjuntos', title: 'Proyectos' };
        }
    }

    /**
     * applyLayerToData — Intercambia los pools de aristas según la capa elegida.
     * Esto permite que updateGraph siga funcionando con edgesInternal/edgesAll.
     */
    function applyLayerToData() {
        // Preservamos las listas originales si no existen para evitar contaminación
        if (!data.edgesInternalPubs) data.edgesInternalPubs = data.edgesInternal || [];
        if (!data.edgesAllPubs) data.edgesAllPubs = data.edgesAll || [];

        if (window.currentLayer === 'pubs') {
            data.edgesInternal = data.edgesInternalPubs;
            data.edgesAll = data.edgesAllPubs;
        } else {
            data.edgesInternal = data.edgesInternalGrants || [];
            data.edgesAll = data.edgesAllGrants || [];
        }
    }

    // Ejecución inicial del mapeo de datos
    applyLayerToData();

    // =========================================================
    // 1. CONFIGURACIÓN DEL SVG
    // =========================================================

    // Tomamos el tamaño actual de la ventana para centrar las fuerzas
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Seleccionamos el elemento SVG vacío definido en index.html
    // D3 dibujará dentro de él todos los nodos y aristas
    const svg = d3.select("#network-graph");

    // Grupo contenedor dentro del SVG que se transformará con zoom/pan.
    // Todo lo que dibuja D3 va dentro de este <g>, no directo en el SVG
    const container = svg.append("g");

    // Referencias a elementos de UI que se usarán frecuentemente
    const hoverTooltip = d3.select("#hover-tooltip"); // tooltip que sigue al mouse
    const infoPanelEl = d3.select("#info-panel");     // panel inferior extra (si se usa)
    const infoOverlay = d3.select("#info-overlay");   // panel central de leyenda

    // Cerrar paneles con la "X" / botones
    d3.select("#info-close").on("click", () => infoPanelEl.style("display", "none"));
    d3.select("#info-toggle-btn").on("click", () => infoOverlay.classed("visible", true));

    // FIX: Asegurar que el label de coautores sea consistente desde el inicio
    d3.select("#label-stat-connections").text("Coautores");

    // El info-overlay se cierra haciendo click en sí mismo (ver CSS pointer-events o eventos abajo)
    infoOverlay.on("click", () => infoOverlay.classed("visible", false));

    // =========================================================
    // 2. PALETA DE COLORES Y ESCALAS
    // =========================================================

    /**
     * Paleta de 20 colores de alto contraste visual ("Sasha Trubetskoy 20").
     * Garantiza que cada facultad tenga un color perfectamente distinguible.
     */
    const FACULTY_COLORS = [
        "#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
        "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4",
        "#469990", "#dcbeff", "#9A6324", "#fffac8", "#800000",
        "#aaffc3", "#808000", "#ffd8b1", "#000075", "#a9a9a9"
    ];
    const colorScale = d3.scaleOrdinal(FACULTY_COLORS);

    /**
     * Calcula el máximo global considerando ambas capas para mantener una escala estable.
     */
    const maxGlobal = Math.max(1,
        d3.max(data.nodesAll || [], d => Math.max(d.pubs || 0, d.grants || 0)) || 0,
        d3.max(data.nodesInternal || [], d => Math.max(d.pubs || 0, d.grants || 0)) || 0
    );

    // Factor base para escalar: Math.pow(x, 0.35) aplana la curva mucho más que Raiz Cuadrada
    const MAX_DESIRED_RADIUS = 45;  // Radio máximo del nodo más grande (antes: 35)
    const MIN_DESIRED_RADIUS = 12;  // Radio mínimo del nodo más pequeño (antes: 8)
    const scaleFactor = (MAX_DESIRED_RADIUS - MIN_DESIRED_RADIUS) / Math.pow(maxGlobal, 0.35);

    /**
     * nodeSize — Radio del círculo de cada nodo.
     * Al usar una potencia baja (0.35), la diferencia visual entre alguien con
     * mucha producción (300 pubs) y alguien con poca (1 pub) es clara pero 
     * no astronómicamente desproporcionada.
     */
    function nodeSize(d) {
        return MIN_DESIRED_RADIUS + Math.pow(getMetric(d) || 1, 0.35) * scaleFactor;
    }

    /**
     * linkWidth — Grosor de la línea entre dos nodos.
     * A más publicaciones conjuntas, más gruesa la arista.
     *
     * @param {Object} d - Datum de la arista D3
     * @returns {number} Grosor en píxeles SVG
     */
    function linkWidth(d) {
        const val = window.currentLayer === 'pubs' ? (d.jointPubs || 1) : (d.jointGrants || 1);
        return Math.max(1, Math.sqrt(val) * 2);
    }

    /**
     * nodeColor — Color de relleno del círculo.
     * Los investigadores externos son siempre grises (#64748b).
     * Los internos reciben un color según su facultad (colorScale).
     *
     * @param {Object} d - Datum del nodo D3
     * @returns {string} Color hexadecimal
     */
    function nodeColor(d) {
        if (d.external === true) return "#64748b";
        return colorScale(d.group || "Sin grupo");
    }

    // =========================================================
    // 3. ESTADO GLOBAL DE LA APLICACIÓN
    // =========================================================

    let allData = data;    // Referencia al JSON original completo
    let currentNodes = [];      // Nodos actualmente renderizados
    let currentLinks = [];      // Aristas actualmente renderizadas
    let detailedMode = false;   // ¿Estamos en modo red personal (ego-network)?
    let detailedNodeId = null;  // ID del nodo central de la red personal
    let activeGroupFilter = null; // Grupo/facultad activo en el filtro
    let simFrozen = false;   // ¿La simulación se detuvo sola?
    let selectedNodeId = null;    // ID del nodo seleccionado (sidebar abierto)
    let showExternal = false; // Toggle: mostrar/ocultar externos globalmente

    // =========================================================
    // 4. ZOOM Y PAN
    // =========================================================

    /**
     * LABEL_ZOOM_THRESHOLD: A qué nivel de zoom se hacen visibles
     * las etiquetas de nombre. Por debajo de 1.1x quedan ocultas
     * para no crear ruido visual cuando hay muchos nodos juntos.
     */
    const LABEL_ZOOM_THRESHOLD = 1.1;

    /**
     * d3.zoom() crea un comportamiento de zoom/pan que se aplica al SVG.
     * scaleExtent([min, max]) limita el rango de zoom permitido.
     *
     * En el evento "zoom":
     * - Aplicamos la transformación (translate + scale) al <g> contenedor
     * - Ajustamos dinámicamente el tamaño de fuente de las etiquetas
     *   para que siempre se lean bien independientemente del zoom
     * - Ocultamos las etiquetas cuando el zoom es muy bajo (visión general)
     */
    const zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
            const scale = event.transform.k;
            if (nodeG) {
                nodeG.selectAll(".node-label, .node-label-shadow")
                    .style("font-size", `${Math.min(14, 10 / scale + 4)}px`)
                    .style("opacity", scale >= LABEL_ZOOM_THRESHOLD ? 1 : 0);
            }
        });

    // Conecta el comportamiento de zoom al SVG (escucha rueda del mouse y drag)
    svg.call(zoom);

    // =========================================================
    // 5. SIMULACIÓN DE FUERZAS FÍSICAS
    // =========================================================

    /**
     * D3 Force Simulation: motor de física que calcula
     * las posiciones (x, y) de cada nodo en cada "tick" (fotograma).
     */
    /**
     * Configuración central de la simulación.
     */
    let simulation = d3.forceSimulation()
        .alphaMin(0.04) // Se apaga dinámicamente al enfriarse
        .alphaDecay(0.02) // Slower decay so it has time to spread out completely
        .velocityDecay(0.4) // Más fricción para reducir jitter
        .force("link", d3.forceLink().id(d => d.id).distance(450).strength(0.35)) // Much longer links
        .force("charge", d3.forceManyBody().strength(-1400)) // Push nodes away from each other much harder
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.01))
        .force("forceX", d3.forceX(width / 2).strength(0.12)) // Stronger pull to bring outer nodes in
        .force("forceY", d3.forceY(height / 2).strength(0.12)) // Stronger pull to bring outer nodes in
        .force("collide", d3.forceCollide(d => nodeSize(d) + 55).strength(1))
        .on("tick", ticked);

    /**
     * ticked — Función que D3 llama en cada fotograma físico.
     * Actualiza la posición visual (DOM) de las líneas y los círculos.
     */
    function ticked() {
        if (!nodeG || !linkG) return;

        // Actualizar posiciones de las líneas (aristas)
        linkG.selectAll(".link")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        // Actualizar posiciones de los grupos (nodos + textos)
        nodeG.selectAll(".node-group")
            .attr("transform", d => `translate(${d.x},${d.y})`);
    }

    // =========================================================
    // 6. OVERLAY DE CARGA — Revelar el mapa por ticks
    // =========================================================

    /**
     * En vez de esperar que la simulación TERMINE para mostrar el mapa
     * (lo que podría tardar mucho con datos grandes), revelamos el mapa
     * cuando han pasado REVEAL_TICK fotogramas de física.
     *
     * De esta manera el usuario ve el mapa mientras aún se está moviendo
     * y asentando, lo que da una sensación dinámica y viva.
     *
     * TOTAL_EST: estimación de ticks totales, usada solo para la barra de progreso.
     */
    const REVEAL_TICK = 60;
    const TOTAL_EST = 60;
    let tickCount = 0;
    let overlayDone = false;

    /**
     * "tick.loader" es un listener que se ejecuta en cada fotograma
     * de la simulación (antes de que D3 actualice las posiciones SVG).
     *
     * Aquí controlamos:
     * 1. La barra de progreso del overlay de carga
     * 2. El texto de estado del overlay
     * 3. La ocultación del overlay cuando llega al tick límite
     */
    simulation.on("tick.loader", () => {
        tickCount++;

        // Avanzamos la barra de progreso (máximo 92% hasta que el overlay desaparezca)
        const pct = Math.min(92, Math.round((tickCount / TOTAL_EST) * 100));
        const bar = document.getElementById("loading-bar");
        if (bar) bar.style.width = pct + "%";

        // Actualizamos el texto de estado con mensajes más descriptivos
        const statusEl = document.getElementById("loading-status");
        if (statusEl) {
            if (tickCount < 15) statusEl.textContent = "Cargando investigadores…";
            else if (tickCount < 30) statusEl.textContent = "Construyendo conexiones…";
            else statusEl.textContent = "Estabilizando red…";
        }

        // ¿Ya llegamos al tick de revelación?
        if (!overlayDone && tickCount >= REVEAL_TICK) {
            overlayDone = true;

            // Barra al 100% y ocultar con CSS transition (definida en legend_styles.css)
            if (bar) bar.classList.add("bar-full");
            document.querySelectorAll("#cinematic-overlay, #loading-overlay").forEach(function (ov) {
                ov.classList.add("overlay-hidden");                          // Opacity 0 con transición
                setTimeout(function () { ov.classList.add("overlay-gone"); }, 900); // display:none después de la transición
            });

            // Desconectamos este listener para no seguir ejecutando en cada tick
            simulation.on("tick.loader", null);
        }
    });

    /**
     * "end" se dispara cuando la simulación se detiene sola (alpha < alphaMin).
     * Esto es el fallback: si el overlay no se ocultó por ticks, lo ocultamos aquí.
     */
    simulation.on("end", () => {
        if (!overlayDone) {
            overlayDone = true;
            document.querySelectorAll("#cinematic-overlay, #loading-overlay").forEach(function (ov) {
                ov.classList.add("overlay-hidden");
                setTimeout(function () { ov.classList.add("overlay-gone"); }, 900);
            });
        }
        if (!simFrozen) {
            simFrozen = true;
            d3.select("#btn-freeze").text("▶ Reanudar").classed("frozen", true);
        }
    });

    // Grupos SVG para aristas y nodos.
    // Es importante que linkG esté ANTES que nodeG en el DOM
    // para que las aristas queden detrás de los nodos visualmente.
    let linkG = container.append("g").attr("class", "links");
    let nodeG = container.append("g").attr("class", "nodes");

    // Zoom inicial: alejar la vista para ver toda la red desde el principio
    svg.call(zoom.transform, d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.35)
        .translate(-width / 2, -height / 2)
    );

    // =========================================================
    // 7. SIDEBAR LATERAL — Perfil del investigador
    // =========================================================

    /**
     * openSidebar — Abre el panel lateral con el perfil del investigador.
     * Se llama cuando el usuario hace clic en un nodo.
     *
     * Muestra:
     * - Avatar con la inicial del nombre (coloreado con el color de la facultad)
     * - Nombre completo y badge de facultad
     * - Número de coautorías (publicaciones) y número de colaboradores únicos
     * - Lista de hasta 8 coautores más frecuentes (ordenados por jointPubs)
     * - Botón para activar el ego-network
     *
     * @param {Object} d - Datum D3 del nodo clickeado
     */
    function openSidebar(d) {
        selectedNodeId = d.id;
        const color = nodeColor(d);

        // Cerrar el panel de coautoría si estaba abierto
        infoPanelEl.style("display", "none");

        // Avatar: inicial del nombre con el fondo del color de la facultad
        d3.select("#node-avatar")
            .style("background", color)
            .text((d.name || "?")[0].toUpperCase());

        d3.select("#node-name").text(d.name || "\u2014");

        // Badge de facultad: texto color fuerte del tema, fondo translúcido del color de la facultad
        d3.select("#node-faculty-badge")
            .text(d.group || "Externo")
            .style("background", color + "22") // 22 en hex = 13% opacidad
            .style("color", "var(--text)");

        // N\u00famero de production totales del investigador
        const labels = getLayerLabels();
        const val = getMetric(d);

        d3.select("#stat-pubs").text(val);
        d3.select("#label-stat-pubs").text(labels.title);

        // Contamos las aristas donde participa este nodo en los datos completos
        // (no solo los actualmente visibles en el SVG)
        const edgesForNode = (window.currentLayer === 'pubs') ? (allData.edgesAllPubs || []) : (allData.edgesAllGrants || []);

        const neighbors = edgesForNode.filter(e => {
            const s = typeof e.source === "object" ? e.source.id : e.source;
            const t = typeof e.target === "object" ? e.target.id : e.target;
            return s === d.id || t === d.id;
        });
        d3.select("#stat-connections").text(neighbors.length);

        // ===== FILTRO: SOLO COLABORADORES INTERNOS DE LA UR =====
        const internalNodeIds = new Set((allData.nodesInternal || []).map(n => n.id));

        const internalNeighbors = neighbors.filter(edge => {
            const s = typeof edge.source === "object" ? edge.source.id : edge.source;
            const t = typeof edge.target === "object" ? edge.target.id : edge.target;
            const neighborId = s === d.id ? t : s;
            return internalNodeIds.has(neighborId);
        });

        // ===== DEDUPLICACI\u00d3N POR NOMBRE =====
        // En VIVO puede haber m\u00faltiples registros con el mismo nombre pero IDs distintos.
        // Agrupamos por nombre y sumamos sus publicaciones conjuntas para evitar duplicados.
        const byName = {};
        internalNeighbors.forEach(edge => {
            const s = typeof edge.source === "object" ? edge.source.id : edge.source;
            const t = typeof edge.target === "object" ? edge.target.id : edge.target;
            const neighborId = s === d.id ? t : s;
            // Buscar nombre del vecino en nodesInternal
            const neighborNode = (allData.nodesInternal || []).find(n => n.id === neighborId);
            if (!neighborNode) return;
            // Normalizar el nombre eliminando espacios extra para evitar duplicados
            const name = (neighborNode.name || "").trim().replace(/\s+/g, " ");
            if (!byName[name]) {
                byName[name] = { node: neighborNode, totalJointVal: 0 };
            }
            const edgeVal = (window.currentLayer === 'pubs') ? (edge.jointPubs || 1) : (edge.jointGrants || 1);
            byName[name].totalJointVal += edgeVal;
        });

        // Top 8 coautores internos DEDUPLICADOS, ordenados por colaboraciones conjuntas
        const sorted = Object.values(byName)
            .sort((a, b) => b.totalJointVal - a.totalJointVal)
            .slice(0, 8);

        const list = d3.select("#coauthor-list");
        const sectionTitle = d3.select("#node-sidebar .sidebar-section-title");
        list.selectAll(".coauthor-item").remove();

        if (sorted.length === 0) {
            // ===== NUEVA FILOSOFIA: OCULTAMIENTO TOTAL =====
            // Si el perfil virtualmente no tiene conexiones en la capa actual,
            // eliminamos graficamente la seccion completa en vez de mostrar ruido.
            sectionTitle.style("display", "none");
            list.style("display", "none");
        } else {
            sectionTitle.style("display", "block");
            list.style("display", "block");
            
            sorted.forEach(entry => {
                const neighborNode = entry.node;
                const totalVal = entry.totalJointVal;
                list.append("div").attr("class", "coauthor-item")
                    .on("click", () => {
                        openSidebar(neighborNode);
                        enterDetailedMode(neighborNode.id);
                    })
                    .html(`
                        <span class="coauthor-name">${neighborNode.name}</span>
                        <span class="coauthor-count">${totalVal} ${totalVal !== 1 ? (window.currentLayer === 'pubs' ? 'docs' : 'proy') : (window.currentLayer === 'pubs' ? 'doc' : 'proy')}</span>
                    `);
            });
        }

        // Muestra el sidebar (CSS: display:none → display:flex via .visible)
        d3.select("#node-sidebar").classed("visible", true);

        // Actualiza el botón de acción según el modo actual
        updateEgoNetButton();
    }

    /**
     * updateEgoNetButton — Actualiza el texto y estilo del botón #btn-ego-net
     * según si estamos en detailedMode o no.
     * En modo detallado: "⬅ Volver a la red"
     * En modo general:   "🔍 Ver red personal"
     */
    function updateEgoNetButton() {
        const btn = d3.select("#btn-ego-net");
        if (detailedMode) {
            btn.html("&#x2B05; Volver a la red")
               .style("background", "var(--accent)")
               .style("color", "#fff");
        } else {
            btn.html("&#x1F50D; Ver red personal")
               .style("background", null)
               .style("color", null);
        }
    }

    /**
     * closeSidebar — Cierra y resetea el sidebar lateral.
     */
    function closeSidebar() {
        selectedNodeId = null;
        d3.select("#node-sidebar").classed("visible", false);
    }

    // Listeners de los botones de cierre del sidebar
    d3.select("#sidebar-close").on("click", closeSidebar);
    d3.select("#btn-ego-net").on("click", () => {
        if (detailedMode) {
            // Ya en red personal → salir
            exitDetailedMode();
        } else if (selectedNodeId) {
            // Vista general → entrar a red personal
            enterDetailedMode(selectedNodeId);
        }
    });

    // =========================================================
    // 8. DIMMING — Desvanecimiento al hacer hover
    // =========================================================

    /**
     * dimAll — Desvanece todos los nodos y aristas EXCEPTO los
     * vecinos directos del nodo indicado.
     *
     * Algoritmo:
     * 1. Construye un Set con el nodo mismo y sus vecinos directos
     * 2. Aplica la clase CSS "dimmed" a todo lo que NO está en ese Set
     *
     * La clase .dimmed en el CSS reduce opacity a 0.07 (casi invisible),
     * haciendo que el subgrafo del hover resalte claramente.
     *
     * @param {string} exceptNodeId - ID del nodo sobre el que se hace hover
     */
    function dimAll(exceptNodeId) {
        const neighborIds = new Set([exceptNodeId]);

        // Recolecta todos los nodos conectados directamente al nodo de hover
        linkG.selectAll(".link").each(function (d) {
            const s = typeof d.source === "object" ? d.source.id : d.source;
            const t = typeof d.target === "object" ? d.target.id : d.target;
            if (s === exceptNodeId || t === exceptNodeId) {
                neighborIds.add(s);
                neighborIds.add(t);
            }
        });

        // Aplica dimmed a nodos que no son vecinos
        nodeG.selectAll(".node-group").classed("dimmed", nd => !neighborIds.has(nd.id));

        // Aplica dimmed a aristas donde NINGUNO de sus extremos es vecino
        linkG.selectAll(".link").classed("dimmed", d => {
            const s = typeof d.source === "object" ? d.source.id : d.source;
            const t = typeof d.target === "object" ? d.target.id : d.target;
            return !neighborIds.has(s) || !neighborIds.has(t);
        });
    }

    /**
     * undimAll — Quita el dimming de todos los elementos.
     * Se llama cuando el cursor sale de un nodo (mouseout).
     */
    function undimAll() {
        nodeG.selectAll(".node-group").classed("dimmed", false);
        linkG.selectAll(".link").classed("dimmed", false);
    }

    // =========================================================
    // 9. BARRA DE FILTROS POR FACULTAD (Legend Bar)
    // =========================================================

    /**
     * updateFilterBar — Regenera los botones de facultad en la barra inferior.
     * Se llama cada vez que cambia el conjunto de nodos visibles.
     *
     * Ordena las facultades de mayor a menor cantidad de investigadores
     * para que las más representadas aparezcan primero.
     *
     * @param {Array} nodesArray - Array de nodos actualmente en el gráfico
     */
    function updateFilterBar(nodesArray) {
        // Cuenta cuántos investigadores tiene cada grupo/facultad
        const groupCounts = {};
        nodesArray.forEach(n => {
            const grp = n.group || "Sin grupo";
            groupCounts[grp] = (groupCounts[grp] || 0) + 1;
        });

        // Ordenar de mayor a menor cantidad
        const sortedGroups = Object.keys(groupCounts).sort((a, b) => groupCounts[b] - groupCounts[a]);

        // Elimina los botones anteriores para redibujar desde cero
        d3.select("#legend-content").selectAll(".legend-btn").remove();
        const resetBtn = d3.select("#legend-reset-btn");

        // Crea un botón para cada facultad
        sortedGroups.forEach(grp => {
            const color = colorScale(grp);
            const btn = d3.select("#legend-content").insert("button", "#legend-reset-btn")
                .attr("class", "legend-btn")
                .attr("data-group", grp)
                .on("click", function () {
                    const clicked = d3.select(this).attr("data-group");

                    if (activeGroupFilter === clicked) {
                        // Si ya estaba activo este filtro, deselecciona (toggle off)
                        activeGroupFilter = null;
                        applyGroupFilter(null);
                        d3.selectAll(".legend-btn").classed("active", false).style("box-shadow", null);
                        resetBtn.style("display", "none");
                    } else {
                        // Nuevo filtro activo
                        activeGroupFilter = clicked;
                        applyGroupFilter(clicked);
                        d3.selectAll(".legend-btn").classed("active", false).style("box-shadow", null);
                        // Glow al botón activo con el color de la facultad
                        d3.select(this).classed("active", true)
                            .style("box-shadow", `0 0 10px ${color}88, 0 0 20px ${color}44`);
                        resetBtn.style("display", "inline-flex");
                    }
                });

            // Punto de color + texto "Facultad (N)" — traducir 'external' a español
            btn.append("span").attr("class", "legend-color-dot").style("background", color);
            const displayName = grp === "external" ? "Externos" : grp;
            btn.append("span").text(`${displayName} (${groupCounts[grp]})`);
        });

        // Botón "Ver todas" para limpiar el filtro
        resetBtn.on("click", () => {
            activeGroupFilter = null;
            applyGroupFilter(null);
            d3.selectAll(".legend-btn").classed("active", false).style("box-shadow", null);
            resetBtn.style("display", "none");
        });
    }

    /**
     * applyGroupFilter — Aplica visualmente el filtro de facultad.
     * No modifica los datos, solo cambia la opacidad de elementos SVG.
     *
     * @param {string|null} group - Nombre del grupo a destacar, o null para ver todos
     */
    function applyGroupFilter(group) {
        nodeG.selectAll(".node-group").transition().duration(300)
            .style("opacity", d => !group ? 1 : (d.group || "Sin grupo") === group ? 1 : 0.06);

        linkG.selectAll(".link").transition().duration(300)
            .style("opacity", d => {
                if (!group) return 0.2; // Vista general: aristas semi-transparentes
                const sg = typeof d.source === "object" ? d.source.group : null;
                const tg = typeof d.target === "object" ? d.target.group : null;
                return (sg === group || tg === group) ? 0.75 : 0.03;
            });
    }

    // =========================================================
    // 10. FUNCIÓN RENDER — Dibujo de nodos y aristas en el SVG
    // =========================================================

    /**
     * render — Actualiza el SVG con el conjunto de nodos y aristas dado.
     *
     * Usa el patrón "enter/update/exit" de D3:
     * - ENTER: elementos nuevos que no existían antes → se crean y animan
     * - UPDATE: elementos que ya existían → se actualizan sus atributos
     * - EXIT: elementos que ya no están en los datos → se eliminan con animación
     *
     * El "key" (identificador) de cada elemento es su ID, así D3 sabe
     * qué elemento es qué nodo aunque hayan cambiado de posición en el array.
     *
     * @param {Array} newNodes - Array de objetos nodo a renderizar
     * @param {Array} newLinks - Array de objetos arista a renderizar
     */
    function render(newNodes, newLinks) {
        currentNodes = newNodes;
        currentLinks = newLinks;

        // ── ARISTAS ──────────────────────────────────────────────

        // Selección con key (id único de cada arista: "sourceId-targetId")
        let link = linkG.selectAll(".link")
            .data(currentLinks, d => d.id || (
                (typeof d.source === "object" ? d.source.id : d.source) + "-" +
                (typeof d.target === "object" ? d.target.id : d.target)
            ));

        // EXIT: aristas que ya no están en los datos desaparecen
        link.exit().transition().duration(250).style("opacity", 0).remove();

        // ENTER: nuevas aristas se crean como líneas SVG
        let linkEnter = link.enter().append("line")
            .attr("class", "link")
            .attr("stroke", "var(--link-stroke)")                   // Color adaptativo según tema
            .attr("stroke-width", d => linkWidth(d))     // Grosor proporcional a jointPubs
            .style("opacity", 0)                         // Invisible inicialmente (animación de entrada)
            .on("click", (e, d) => showEdgeInfo(d))      // Clic → panel de detalle de arista
            .on("mouseover", function (event, d) {
                // Al hover: resalta la arista con color azul claro
                d3.select(this).attr("stroke", "#38bdf8").style("stroke-opacity", "1").style("opacity", 1);

                const labels = getLayerLabels();
                const val = (window.currentLayer === 'pubs') ? (d.jointPubs || 0) : (d.jointGrants || 0);

                hoverTooltip.transition().duration(150).style("opacity", 1);
                hoverTooltip.html(`<strong>${val}</strong> ${labels.edge}`)
                    .style("left", event.pageX + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mousemove", event => {
                // Sigue al cursor
                hoverTooltip.style("left", event.pageX + "px").style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function () {
                // Restaura el estilo original
                d3.select(this).attr("stroke", "var(--link-stroke)").style("stroke-opacity", null).style("opacity", 0.2);
                hoverTooltip.transition().duration(400).style("opacity", 0);
            });

        // Animación de entrada: aparece con transición de opacidad
        linkEnter.transition().duration(400).style("opacity", 0.2);

        // Merge: combina enter + update para las siguientes operaciones
        link = linkEnter.merge(link);

        // ── NODOS ────────────────────────────────────────────────

        // Cada "nodo visual" en realidad es un grupo <g> que contiene:
        // 1. Un <circle> (el nodo propiamente)
        // 2. Un <text> con el número de pubs (centrado en el círculo)
        // 3. Un <text> sombra del nombre (stroke blanco o negro según tema)
        // 4. Un <text> del nombre
        let node = nodeG.selectAll(".node-group").data(currentNodes, d => d.id);

        // EXIT: nodos que salen del grafo se encojen y desaparecen
        node.exit().transition().duration(250)
            .style("opacity", 0).attr("transform", "scale(0)").remove();

        // ENTER: nuevos nodos como grupos <g>
        let nodeEnter = node.enter().append("g")
            .attr("class", "node-group")
            .style("opacity", 0)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("click", (event, d) => {
                if (event.defaultPrevented) return; // Ignora clic si fue un drag
                infoPanelEl.style("display", "none");
                hoverTooltip.style("opacity", 0);
                openSidebar(d);
            })
            .on("mouseover", function (event, d) {
                dimAll(d.id);
                const labels = getLayerLabels();
                const val = getMetric(d);

                hoverTooltip.transition().duration(150).style("opacity", 1);
                hoverTooltip.html(`<strong>${d.name}</strong><br><span class="tooltip-meta">${val} ${labels.node}</span>`)
                    .style("left", event.pageX + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mousemove", event => {
                hoverTooltip.style("left", event.pageX + "px").style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function () {
                undimAll();
                hoverTooltip.transition().duration(400).style("opacity", 0);
            });

        // Animación escalonada de entrada: cada nodo aparece con un pequeño delay
        // basado en su índice, creando un efecto de cascada visual
        nodeEnter.transition().duration(600)
            .delay((d, i) => Math.min(i * 2, 400))
            .style("opacity", 1);

        // Círculo del nodo: radio y color según los datos
        nodeEnter.append("circle").attr("class", "node")
            .attr("r", d => nodeSize(d))
            .attr("fill", d => nodeColor(d));

        // Número de producción centrado dentro del círculo
        nodeEnter.append("text").attr("class", "node-pubs-label")
            .text(d => getMetric(d));

        // Sombra del nombre: stroke blanco grueso para legibilidad sobre cualquier fondo
        nodeEnter.append("text").attr("class", "node-label-shadow").text(d => d.name);

        // Etiqueta del nombre: texto real encima de la sombra
        nodeEnter.append("text").attr("class", "node-label").text(d => d.name);

        // Merge enter + update
        node = nodeEnter.merge(node);

        // UPDATE: actualiza radio y color de todos los nodos (por si cambiaron los datos)
        node.select("circle").attr("r", d => nodeSize(d)).attr("fill", d => nodeColor(d));
        node.select(".node-pubs-label").text(d => getMetric(d));

        // Posición de la etiqueta: a la derecha del borde del círculo, un poco arriba del centro
        const nameXOffset = d => nodeSize(d) + 4;
        node.select(".node-label-shadow").attr("dx", nameXOffset).attr("dy", -4);
        node.select(".node-label").attr("dx", nameXOffset).attr("dy", -4);

        // Visibilidad de etiquetas según el zoom actual
        const currentZoom = d3.zoomTransform(svg.node()).k;
        node.selectAll(".node-label,.node-label-shadow")
            .style("opacity", currentZoom >= LABEL_ZOOM_THRESHOLD ? 1 : 0);

        // Tamaño de fuente del número de pubs y color contrastante automático
        // Usamos la fórmula de luminancia YIQ perceptual para decidir si el fondo es claro u oscuro.
        node.select(".node-pubs-label")
            .style("fill", d => {
                const bgColor = nodeColor(d);
                const rgb = d3.color(bgColor).rgb();
                // Cálculo YIQ: da más peso al verde, medio al rojo, bajo al azul
                const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
                // Si YIQ < 128 (oscuro), texto blanco. Si >= 128 (claro/amarillo), texto oscuro.
                return yiq < 128 ? "#ffffff" : "#0f172a";
            })
            .style("font-size", d => {
                const r = nodeSize(d);
                const chars = String(d.pubs || 0).length;
                return `${Math.max(9, Math.min(24, (r * 1.6) / chars, r * 0.85))}px`;
            });

        // ── TICK DE FÍSICA ───────────────────────────────────────
        // En cada fotograma de la simulación, actualiza las posiciones SVG
        // con las coordenadas (x, y) calculadas por la física
        simulation.nodes(currentNodes).on("tick", () => {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
        simulation.force("link").links(currentLinks);
        simulation.alpha(1).restart(); // Reinicia la simulación con temperatura máxima

        // ── ZOOM AUTOMÁTICO ──────────────────────────────────────
        // En modo detallado (red personal): centra la vista en el nodo principal
        // Al salir del modo detallado: restaura la vista general
        if (detailedMode && detailedNodeId) {
            setTimeout(() => {
                const cn = currentNodes.find(n => n.id === detailedNodeId);
                if (cn && !isNaN(cn.x) && !isNaN(cn.y)) {
                    svg.transition().duration(800).call(zoom.transform,
                        d3.zoomIdentity.translate(width / 2, height / 2).scale(1.0).translate(-cn.x, -cn.y)
                    );
                }
            }, 800); // Esperamos 800ms para que la física haya movido los nodos a sus posiciones
        } else if (!detailedMode && !detailedNodeId && currentNodes.length > 0) {
            svg.transition().duration(800).call(zoom.transform,
                d3.zoomIdentity.translate(width / 2, height / 2).scale(0.3).translate(-width / 2, -height / 2)
            );
        }
    }

    // =========================================================
    // 11. PIPELINE PRINCIPAL — updateGraph()
    // =========================================================

    /**
     * updateGraph — Función central que determina qué nodos y aristas
     * mostrar según el estado actual de la aplicación, y llama a render().
     *
     * Se ejecuta en estos casos:
     * - Carga inicial de la app
     * - Al activar/desactivar "investigadores externos"
     * - Al entrar/salir del modo detallado (ego-network)
     *
     * Flujo:
     * 1. Si showExternal=true → incluye nodos externos (limitado al Top 100
     *    por peso de colaboración con investigadores UR para no sobrecargar)
     * 2. Si showExternal=false → solo nodos internos UR
     * 3. Si detailedMode=true → filtra al ego-network (nodo + vecinos directos)
     * 4. Llama a render() con los datos filtrados
     * 5. Actualiza la barra de filtros de facultad
     */
    function updateGraph() {
        // Actualizar los arrays globales de aristas según la capa activa
        applyLayerToData();
        let nodesData, linksData;

        // 1. Decidir qué nodos incluir A NIVEL GLOBAL según el toggle (como estaba antes)
        if (showExternal) {

            if (detailedMode && detailedNodeId) {
                // MODO RED PERSONAL CON EXTERNOS ACTIVADOS:
                // Obtenemos los coautores directos del investigador seleccionado.
                const allNodesMap = {};
                // Incluir AMBOS pools: internos primero, luego externos
                // para que el nodo central (interno) y sus vecinos internos
                // también estén en el mapa y no se descarten silenciosamente
                (allData.nodesInternal || []).forEach(n => { allNodesMap[n.id] = n; });
                (allData.nodesAll || []).forEach(n => { allNodesMap[n.id] = n; });

                const neighborIds = new Set([detailedNodeId]);

                // Recorremos TODAS las aristas para encontrar los vecinos directos (internos y externos)
                (allData.edgesAll || []).forEach(e => {
                    const s = typeof e.source === "object" ? e.source.id : e.source;
                    const t = typeof e.target === "object" ? e.target.id : e.target;
                    if (s === detailedNodeId) neighborIds.add(t);
                    if (t === detailedNodeId) neighborIds.add(s);
                });

                // Construimos los nodos (marcamos los externos)
                nodesData = Array.from(neighborIds).map(id => {
                    const node = allNodesMap[id];
                    if (!node) return null;
                    const isInternal = (allData.nodesInternal || []).some(n => n.id === node.id);
                    const nCopy = JSON.parse(JSON.stringify(node));
                    nCopy.external = !isInternal;
                    delete nCopy.fx;
                    delete nCopy.fy;
                    return nCopy;
                }).filter(Boolean);

                // Solo aristas que conecten DIRECTAMENTE con el nodo central (hub & spoke)
                // Excluimos aristas entre otros nodos para evitar caos visual
                const nodeIdSet = new Set(nodesData.map(n => n.id));
                linksData = JSON.parse(JSON.stringify(allData.edgesAll)).filter(l => {
                    const s = typeof l.source === "object" ? l.source.id : l.source;
                    const t = typeof l.target === "object" ? l.target.id : l.target;
                    return (s === detailedNodeId || t === detailedNodeId) &&
                        nodeIdSet.has(s) && nodeIdSet.has(t);
                });

            } else {
                // VISTA GLOBAL CON EXTERNOS: TOP 100 (para no reventar D3)
                const MAX_EXTERNAL_NODES = 100;
                const internalIds = new Set((allData.nodesInternal || []).map(n => n.id));
                const nodesAllMap = {};
                (allData.nodesAll || []).forEach(n => { nodesAllMap[n.id] = n; });

                // Cuenta aristas internas para pesos
                const extWeight = {};
                (allData.edgesAll || []).forEach(e => {
                    const s = typeof e.source === "object" ? e.source.id : e.source;
                    const t = typeof e.target === "object" ? e.target.id : e.target;
                    if (internalIds.has(s) && !internalIds.has(t)) {
                        extWeight[t] = (extWeight[t] || 0) + (e.jointPubs || 1);
                    }
                    if (internalIds.has(t) && !internalIds.has(s)) {
                        extWeight[s] = (extWeight[s] || 0) + (e.jointPubs || 1);
                    }
                });

                // Tomar los 100 con más conexiones
                const topExternalIds = Object.entries(extWeight)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, MAX_EXTERNAL_NODES)
                    .map(([id]) => id);

                const internalNodes = JSON.parse(JSON.stringify(allData.nodesInternal)).map(n => {
                    n.external = false; delete n.fx; delete n.fy; return n;
                });
                const externalNodes = topExternalIds
                    .map(id => nodesAllMap[id])
                    .filter(Boolean)
                    .map(n => { const c = JSON.parse(JSON.stringify(n)); c.external = true; return c; });

                nodesData = [...internalNodes, ...externalNodes];

                // Solo aristas donde AMBOS nodos estén en el JSON
                const nodeIdSet = new Set(nodesData.map(n => n.id));
                linksData = JSON.parse(JSON.stringify(allData.edgesAll)).filter(l => {
                    const s = typeof l.source === "object" ? l.source.id : l.source;
                    const t = typeof l.target === "object" ? l.target.id : l.target;
                    return nodeIdSet.has(s) && nodeIdSet.has(t);
                });
            }

        } else {
            // Vista pura interna
            nodesData = JSON.parse(JSON.stringify(allData.nodesInternal)).map(n => {
                n.external = false; delete n.fx; delete n.fy; return n;
            });
            linksData = JSON.parse(JSON.stringify(allData.edgesInternal)).filter(l => {
                const s = typeof l.source === "object" ? l.source.id : l.source;
                const t = typeof l.target === "object" ? l.target.id : l.target;
                return nodesData.some(n => n.id === s) && nodesData.some(n => n.id === t);
            });
        }

        // 2. Comprobación y activación de UI para detallado
        if (detailedMode && detailedNodeId) {
            d3.select("#btn-close-detail").style("display", "block");
            d3.select("#toggle-external-wrapper").style("display", "flex");

            // Si NO está activo showExternal, aún necesitamos filtrar el ego-network
            // (Si showExternal ESTABA activo, ya se filtró en el bloque if de arriba)
            if (!showExternal) {
                const neighborIds = new Set([detailedNodeId]);
                const detailedLinks = linksData.filter(l => {
                    const s = typeof l.source === "object" ? l.source.id : l.source;
                    const t = typeof l.target === "object" ? l.target.id : l.target;
                    return s === detailedNodeId || t === detailedNodeId;
                });

                detailedLinks.forEach(l => {
                    const s = typeof l.source === "object" ? l.source.id : l.source;
                    const t = typeof l.target === "object" ? l.target.id : l.target;
                    neighborIds.add(s);
                    neighborIds.add(t);
                });

                nodesData = nodesData.filter(n => neighborIds.has(n.id));
                linksData = detailedLinks;
            }
        } else {
            d3.select("#btn-close-detail").style("display", "none");
            // OCULTAR en vista general por pedido del usuario
            d3.select("#toggle-external-wrapper").style("display", "none");
        }

        // ===== NUEVA FILOSOFIA: PODA ESTRICTA DE NODOS HUERFANOS =====
        // Conservar exclusivamente los nodos que participen en al menos una
        // arista de la vista/capa actual (Fidelidad Absoluta de Datos).
        const activeNodeIds = new Set();
        linksData.forEach(l => {
            const s = typeof l.source === "object" ? l.source.id : l.source;
            const t = typeof l.target === "object" ? l.target.id : l.target;
            activeNodeIds.add(s);
            activeNodeIds.add(t);
        });
        
        // Excepcion UX: En modo red personal, conservamos al menos el nodo
        // central para que no desaparezca inexplicablemente dejandolo en blanco.
        if (detailedMode && detailedNodeId) {
            activeNodeIds.add(detailedNodeId);
        }

        // Filtramos masivamente la data que va hacia D3
        nodesData = nodesData.filter(n => activeNodeIds.has(n.id));
        // ==============================================================

        render(nodesData, linksData);
        updateFilterBar(nodesData);
    }

    // =========================================================
    // 12. MODO DETALLADO — Red Personal
    // =========================================================

    /**
     * enterDetailedMode — Activa la red personal o mapa ego de un nodo.
     * Guarda el ID del nodo central y llama updateGraph() para re-filtrar
     * incluyendo los coautores externos de ese investigador en particular.
     *
     * @param {string} nodeId - ID del nodo que será el centro
     */
    function enterDetailedMode(nodeId) {
        detailedMode = true;
        detailedNodeId = nodeId;

        // Verifica si el nodo seleccionado es externo a la UR
        const isExternalNode = (allData.nodesInternal || []).findIndex(n => n.id === nodeId) === -1;

        // Si el nodo es externo, obligatoriamente debemos mostrar perfiles externos en su red
        if (isExternalNode) {
            showExternal = true;
        }

        d3.select("#toggle-external").property("checked", showExternal);
        updateEgoNetButton();
        updateGraph();
    }

    /**
     * exitDetailedMode — Sale de la red personal y vuelve a la vista completa.
     */
    function exitDetailedMode() {
        detailedMode = false;
        detailedNodeId = null;
        showExternal = false;
        d3.select("#toggle-external").property("checked", false);
        updateEgoNetButton();
        closeSidebar();
        updateGraph();
    }

    d3.select("#btn-close-detail").on("click", exitDetailedMode);

    // =========================================================
    // 13. BUSCADOR CON AUTOCOMPLETADO
    // =========================================================

    const searchInput = d3.select("#search-input");
    const suggestionsBox = d3.select("#search-suggestions");
    let highlightedIndex = -1; // Índice del ítem resaltado con teclado (-1 = ninguno)

    /**
     * getAllSearchableNodes — Devuelve el pool de nodos sobre los que podemos buscar.
     * Siempre permite buscar en todos los nodos (internos y externos) para poder
     * navegar directamente a la red personal de un externo aunque no esté en el grafo general.
     */
    function getAllSearchableNodes() {
        // ===== NUEVA FILOSOFIA: BUSCADOR CONTEXTUAL =====
        // Restringimos las opciones del buscador unica y exclusivamente a los 
        // investigadores que estan siendo renderizados visualmente en este 
        // preciso instante (capa activa de Pubs/Proyectos).
        // Si el investigador no esta en la pantalla, no existe en la barra.
        return currentNodes;
    }

    /**
     * renderSuggestions — Dibuja la lista desplegable de sugerencias.
     *
     * @param {Array} matches - Nodos que coinciden con la búsqueda
     */
    function renderSuggestions(matches) {
        suggestionsBox.selectAll(".suggestion-item").remove();
        if (!matches.length) { suggestionsBox.style("display", "none"); return; }
        suggestionsBox.style("display", "block");
        highlightedIndex = -1;

        matches.slice(0, 10).forEach(n => {
            suggestionsBox.append("div").attr("class", "suggestion-item")
                .html(`<strong>${n.name}</strong><br><small class="suggestion-group">${n.group || ""}</small>`)
                .on("mousedown", e => { e.preventDefault(); selectSuggestion(n); });
            // mousedown en vez de click para que se ejecute antes del blur del input
        });
    }

    /**
     * selectSuggestion — Selecciona un nodo del dropdown.
     * Rellena el input, cierra el dropdown, abre sidebar y activa red personal.
     *
     * @param {Object} node - Datum del nodo seleccionado
     */
    function selectSuggestion(node) {
        searchInput.property("value", node.name);
        suggestionsBox.style("display", "none");
        highlightedIndex = -1;
        openSidebar(node);
        enterDetailedMode(node.id);
    }

    // Evento al escribir en el buscador
    searchInput.on("input", function () {
        const q = this.value.trim().toLowerCase();
        if (!q) { suggestionsBox.style("display", "none"); return; }

        // Filtra y ordena: primero los que empiezan con la query (más relevante)
        const matches = getAllSearchableNodes()
            .filter(n => n.name && n.name.toLowerCase().includes(q))
            .sort((a, b) =>
                (b.name.toLowerCase().startsWith(q) ? 1 : 0) -
                (a.name.toLowerCase().startsWith(q) ? 1 : 0)
            );
        renderSuggestions(matches);
    });

    // Navegación con teclado por las sugerencias
    searchInput.on("keydown", function (event) {
        const items = suggestionsBox.selectAll(".suggestion-item").nodes();
        if (event.key === "ArrowDown") {
            event.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle("active", i === highlightedIndex));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            items.forEach((el, i) => el.classList.toggle("active", i === highlightedIndex));
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) {
                items[highlightedIndex].dispatchEvent(new Event("mousedown"));
            } else {
                const q = this.value.trim().toLowerCase();
                const found = getAllSearchableNodes().find(n => n.name && n.name.toLowerCase().includes(q));
                if (found) selectSuggestion(found); else alert("Investigador no encontrado.");
            }
        } else if (event.key === "Escape") {
            suggestionsBox.style("display", "none");
        }
    });

    // Cierra el dropdown cuando el usuario hace clic fuera (200ms delay para permitir mousedown)
    searchInput.on("blur", () => setTimeout(() => suggestionsBox.style("display", "none"), 200));

    // Botón de búsqueda manual (↵)
    d3.select("#search-btn").on("click", () => {
        const q = searchInput.property("value").trim().toLowerCase();
        if (!q) return;
        const found = getAllSearchableNodes().find(n => n.name && n.name.toLowerCase().includes(q));
        found ? selectSuggestion(found) : alert("Investigador no encontrado.");
    });

    // =========================================================
    // 14. PANEL DE DETALLE DE ARISTA
    // =========================================================

    /**
     * showEdgeInfo — Muestra el panel inferior con el detalle de una coautoría.
     * Se activa al hacer clic en una arista (línea entre dos nodos).
     *
     * d.source y d.target pueden ser:
     * - Strings (el ID) antes de que D3 los "resuelva"
     * - Objetos nodo completos después de que la simulación está corriendo
     * Por eso usamos typeof para manejar ambos casos.
     *
     * @param {Object} d - Datum D3 de la arista clickeada
     */
    function showEdgeInfo(d) {
        const src = typeof d.source === "object" ? d.source.name : d.source;
        const tgt = typeof d.target === "object" ? d.target.name : d.target;

        const val = (window.currentLayer === 'pubs') ? (d.jointPubs || 0) : (d.jointGrants || 0);
        const labels = getLayerLabels();

        d3.select("#info-title").text(labels.title + " Conjuntos");
        d3.select("#info-content").html(`
            <p class="edge-label">Entre:</p>
            <p class="edge-name">${src}</p>
            <p class="edge-label">y</p>
            <p class="edge-name">${tgt}</p>
            <hr>
            <p class="edge-value"><strong>${val}</strong> ${labels.edge}</p>
        `);
        infoPanelEl.style("display", "block");
    }

    // =========================================================
    // 15. CONTROLES VARIOS
    // =========================================================

    // Event Listeners para el cambio de capas (Pubs/Grants)
    d3.selectAll(".layer-btn").on("click", function () {
        const btn = d3.select(this);
        const layer = btn.attr("data-layer");

        if (layer === window.currentLayer) return;

        // Actualizar UI de los botones
        d3.selectAll(".layer-btn").classed("active", false);
        btn.classed("active", true);

        // Actualizar estado global
        window.currentLayer = layer;

        // Mostrar velo de cálculo brevemente para suavizar la transición visual
        d3.select("#recalc-overlay").classed("visible", true);

        setTimeout(() => {
            updateGraph();

            // FIX: Refrescar el Sidebar si hay un nodo seleccionado para evitar desincronización de datos
            if (selectedNodeId) {
                const currentNode = currentNodes.find(n => n.id === selectedNodeId);
                if (currentNode) {
                    openSidebar(currentNode);
                }
            }

            d3.select("#recalc-overlay").classed("visible", false);
        }, 300);
    });

    // ── Toggle de perfiles externos (modo general) ───
    d3.select("#toggle-external").on("change", function () {
        showExternal = this.checked;

        // Mostrar mini-overlay de recálculo mientras D3 estabiliza
        const recalcOv = document.getElementById('recalc-overlay');
        if (recalcOv) {
            recalcOv.classList.remove('fade-out');
            recalcOv.classList.add('visible');
        }

        // Reset the active filter when toggling external profiles
        activeGroupFilter = null;
        d3.selectAll(".legend-btn").classed("active", false).style("box-shadow", null);
        d3.select("#legend-reset-btn").style("display", "none");

        updateGraph();

        // Ocultar el overlay tras 1.5s (suficiente para que D3 estabilice)
        setTimeout(function () {
            if (recalcOv) {
                recalcOv.classList.add('fade-out');
                setTimeout(function () {
                    recalcOv.classList.remove('visible', 'fade-out');
                }, 350); // Espera a que termine la transición CSS de fade-out
            }
        }, 1500);
    });

    // ── Drag de nodos ─────────────────────────────────────────
    // Permite al usuario arrastrar nodos para reposicionarlos manualmente.
    // fx/fy "fijan" el nodo en esa posición (la simulación no lo moverá más).
    // Al soltar, borramos fx/fy para que la física vuelva a actuar sobre él.
    function dragstarted(event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }

    // ── Toggle de la barra de leyenda ─────────────────────────
    let legendBarOpen = true;
    d3.select("#legend-toggle").on("click", function () {
        legendBarOpen = !legendBarOpen;
        d3.select("#legend-panel").classed("collapsed", !legendBarOpen);
        d3.select(this).text(legendBarOpen ? "⌄ Ocultar" : "⌃ Mostrar");
    });

    // ── Responsive: colapsar leyenda en móvil ─────────────────
    // En pantallas pequeñas la barra ocupa demasiado espacio,
    // la colapsamos automáticamente al cargar
    if (window.matchMedia("(max-width: 768px)").matches) {
        legendBarOpen = false;
        d3.select("#legend-panel").classed("collapsed", true);
        d3.select("#legend-toggle").text("⌃ Mostrar");
    }

    // ── Resize de ventana ────────────────────────────────────
    // Si el usuario cambia el tamaño de la ventana, recalculamos
    // el centro de las fuerzas para que la red siga centrada
    window.addEventListener("resize", () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        simulation
            .force("center", d3.forceCenter(w / 2, h / 2).strength(0.01))
            .force("forceX", d3.forceX(w / 2).strength(0.12))
            .force("forceY", d3.forceY(h / 2).strength(0.12))
            .alpha(0.3).restart(); // Suave reinicio de la física
    });

    // ── ARRANQUE ──────────────────────────────────────────────
    // Llama al pipeline principal por primera vez para dibujar la red inicial
    updateGraph();

} // Fin de initNetwork()


// ═══════════════════════════════════════════════════════════════
// ARRANQUE AUTOMÁTICO
// ═══════════════════════════════════════════════════════════════
//
// Este bloque se ejecuta automáticamente al cargar el archivo.
// Antes estaba repartido en scripts inline del FTL/HTML — ahora
// todo el JavaScript vive en este único archivo.
//
// Responsabilidades:
//   1. Garantiza el cierre del overlay de carga tras 7 s máximo
//   2. Carga los datos (cache → JSP) y arranca la visualización
//
// Rutas absolutas (/coauthorNetwork/...) porque este JS se sirve
// desde el contexto de VIVO, no desde la carpeta coauthorNetwork.
//
// IMPORTANTE: Usamos un IIFE (función auto-ejecutable) en vez de
// DOMContentLoaded porque todos los elementos HTML (#network-graph,
// #cinematic-overlay, etc.) están definidos ANTES de este <script>
// en el FTL, garantizando que ya existen en el DOM al ejecutarse.
// ───────────────────────────────────────────────────────────────

(function () {

    // ── 1. Auto-cierre del overlay ─────────────────────────────
    // Seguro de fallo: si initNetwork nunca llega a los REVEAL_TICK
    // ticks (datos vacíos, error de red, etc.), el overlay igual
    // desaparece después de 7 segundos para no bloquear la UI.
    var MAX_OVERLAY_WAIT_MS = 7000;
    setTimeout(function () {
        var overlay = document.getElementById('cinematic-overlay');
        if (overlay) {
            overlay.classList.add('overlay-hidden');    // opacity 0 con transición CSS
            setTimeout(function () {
                overlay.classList.add('overlay-gone'); // display:none tras la transición
            }, 900);
        }
    }, MAX_OVERLAY_WAIT_MS);

    // ── 2. Carga de datos: estrategia cache-first ──────────────
    //
    // INTENTO 1 — baseData.json (caché en disco)
    //   Generado por coauthorNetwork.jsp en la última ejecución.
    //   Si existe, carga instantánea sin consultas SPARQL.
    //
    // INTENTO 2 — coauthorNetwork.jsp (generación SPARQL)
    //   Ejecuta 4 consultas SPARQL en el Triplestore de VIVO,
    //   construye el JSON y lo guarda como nueva caché.
    //   Puede tardar varios segundos dependiendo del servidor.
    //
    // FALLO TOTAL — Muestra mensaje de error en el overlay.

    // Usamos RUTAS RELATIVAS (./) para que funcione independiente
    // Ruta absoluta confirmada que sí funciona en el servidor de prácticas
    d3.json("/HUBvivo115/js/coauthorNetworkViz/baseData.json")
        .then(function (data) {
            // Caché encontrada: dibuja el mapa al instante
            initNetwork(data);
        })
        .catch(function () {
            console.warn('[CoauthorMap] baseData.json no encontrado — generando desde SPARQL...');

            // Informa al usuario que la carga tardará más de lo normal
            var statusEl = document.getElementById('loading-status');
            if (statusEl) statusEl.textContent = 'Generando datos desde la base de datos…';

            // Activa la animación de barra lenta (definida en legend_styles.css)
            var barEl = document.getElementById('loading-bar');
            if (barEl) barEl.classList.add('bar-generating');

            // Al fallar la ruta principal, no intentaremos compilar el JSP
            // porque en entornos aislados esto genera Error 500.
            document.querySelectorAll('#cinematic-overlay, #loading-overlay').forEach(function (ov) {
                ov.innerHTML = '<p class="error-message">Error general al cargar los datos desde HUBvivo115.<br>Asegúrate de que el archivo baseData.json exista en esa ruta.</p>';
            });
        });

}()); // Fin del bloque de arranque automático



// ── Theme toggle ─────────────────────────────
// Alterna entre tema claro (default) y oscuro
const themeBtn = document.getElementById("btn-theme");
if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        const html = document.documentElement;
        const isDark = html.getAttribute("data-theme") === "dark";
        html.setAttribute("data-theme", isDark ? "light" : "dark");
    });
}

// ── Help overlay toggle ───────────────────────
const helpBtn = document.getElementById("btn-help");
const infoOverlayEl = document.getElementById("info-overlay");
helpBtn.addEventListener("click", () => {
    const open = infoOverlayEl.classList.toggle("visible");
    helpBtn.classList.toggle("active", open);
    // Close sidebar if open
    if (open) document.getElementById("node-sidebar").classList.remove("visible");
});
// Close overlay when clicking outside
document.addEventListener("click", e => {
    if (!infoOverlayEl.contains(e.target) && e.target !== helpBtn) {
        infoOverlayEl.classList.remove("visible");
        helpBtn.classList.remove("active");
    }
});

// ── Ocultar "Vista completa" si ya estamos en vista standalone ──
// Cuando el mapa se carga dentro de un iframe (desde VIVO/mapaCoautores),
// el botón permite abrir la vista independiente. Pero si ya estamos
// en la vista completa (no hay iframe padre), el botón no tiene sentido.
if (window === window.top) {
    const btnFs = document.getElementById('btn-fullscreen');
    if (btnFs) btnFs.style.display = 'none';
}
