<%@ page trimDirectiveWhitespaces="true" %>
<%@ page contentType="application/json; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="java.util.*" %>
<%@ page import="java.io.*" %>
<%@ page import="org.json.*" %>
<%@ page import="org.apache.commons.io.IOUtils" %>

<%@ page import="edu.cornell.mannlib.vitro.webapp.controller.VitroRequest" %>
<%@ page import="edu.cornell.mannlib.vitro.webapp.rdfservice.RDFService" %>

<%-- =====================================================================
  coauthorNetwork.jsp - Backend del Mapa de Coautorias v4.3
  =====================================================================
  PROPOSITO:
    Genera el archivo baseData.json que alimenta la visualizacion D3.js
    del Mapa de Coautorias de la Universidad del Rosario.

  ARQUITECTURA:
    1. Cache-First: Entrega el JSON existente de inmediato para evitar
       timeouts en el navegador.
    2. Background Rebuild: Lanza un hilo Daemon que ejecuta 4 consultas
       SPARQL pesadas contra el triplestore Jena/TDB2 de VIVO.
    3. Dual Layer: Separa datos de Publicaciones y Proyectos (Grants).

  ESTRUCTURA DEL JSON GENERADO (baseData.json):
    {
      "nodesInternal":      [...],  // Investigadores UR (vlocal:UREntity)
      "nodesAll":           [...],  // Todos = internos + externos
      "edgesInternalPubs":  [...],  // Coautorias solo entre internos (pubs)
      "edgesAllPubs":       [...],  // Coautorias internas + externas (pubs)
      "edgesInternalGrants":[...],  // Proyectos conjuntos solo internos
      "edgesAllGrants":     [...]   // Proyectos conjuntos todos
    }

  COMO LO USA EL FRONTEND (network_logic.js):
    - Toggle "Externos OFF" -> usa nodesInternal + edgesInternalPubs
    - Toggle "Externos ON"  -> usa nodesAll + edgesAllPubs
    - Capa "Publicaciones"  -> campos *Pubs
    - Capa "Proyectos"      -> campos *Grants

  ESTRUCTURA DEL CODIGO (FLUJO DE EJECUCION):
    1. INIT: El JSP recibe la peticion HTTP y extrae el RDFService de Vitro.
    2. CACHE CHECK: Verifica si 'baseData.json' existe en disco.
       - Si existe, se lee el archivo y se envia el JSON inmediatamente al Front-End.
       - Si no existe, se responde un JSON '{"status": "building"}' para que D3.js se ponga en carga.
    3. TRIGGER BACKGROUND: Lanza el metodo 'launchRebuild' en un Hilo separado (Thread).
       - Declaracion SPARQL: Se definen 4 variables String con las consultas.
       - Ejecucion: 'runQuery()' ejecuta en VIVO y retorna XML.
       - Parseo XML a JSON: org.json.XML lo convierte y agrupa en JSONArray.
       - Filtrado y Construccion: Se itera nodo a nodo, sumando o restando Grants/Pubs.
       - Merging (FUSION): Se combinan los Arrays de Aristas (Internas + Externas).
       - I/O: Se crea el JSONObject giganta y se sobreescribe físicamente 'baseData.json'.
  ===================================================================== --%>

<%!
    // =================================================================
    // UTILIDADES SPARQL
    // =================================================================

    /**
     * runQuery - Ejecuta una consulta SPARQL SELECT contra el triplestore.
     *
     * @param rdf    Servicio RDF de VIVO (inyectado por VitroRequest)
     * @param query  Consulta SPARQL completa como String
     * @return       Resultado en formato XML como String.
     *               Si falla, retorna "<error>mensaje</error>"
     */
    static String runQuery(RDFService rdf, String query) {
        try {
            InputStream in = rdf.sparqlSelectQuery(query, RDFService.ResultFormat.XML);
            return IOUtils.toString(in, "UTF-8");
        } catch (Exception e) {
            return "<error>" + e.getMessage() + "</error>";
        }
    }

    /**
     * getXMLBinding - Extrae el valor de una variable SPARQL del resultado.
     *
     * El resultado SPARQL en XML se convierte a JSON con org.json.XML.
     * La estructura resultante tiene un array "binding" donde cada elemento
     * tiene "name" (nombre de la variable) y "literal" o "uri" (valor).
     *
     * Esta funcion busca la variable por nombre y retorna su valor.
     *
     * @param result  Objeto JSON de un resultado individual SPARQL
     * @param var     Nombre de la variable a extraer (ej: "id", "name")
     * @return        Valor de la variable como String, o "" si no existe
     */
    static String getXMLBinding(JSONObject result, String var) {
        try {
            Object bindingsObj = result.opt("binding");
            if (bindingsObj == null) return "";

            // Normalizar: puede ser un solo JSONObject o un JSONArray
            JSONArray arr;
            if (bindingsObj instanceof JSONObject) {
                arr = new JSONArray();
                arr.put((JSONObject) bindingsObj);
            } else {
                arr = (JSONArray) bindingsObj;
            }

            // Buscar la variable por nombre
            for (int i = 0; i < arr.length(); i++) {
                JSONObject b = arr.getJSONObject(i);
                if (!b.optString("name").equals(var)) continue;

                // El valor puede estar en "literal" (texto) o "uri" (recurso)
                if (b.has("literal")) {
                    Object lit = b.get("literal");
                    if (lit instanceof String) return (String) lit;
                    if (lit instanceof JSONObject) return ((JSONObject) lit).optString("content", "");
                }
                if (b.has("uri")) return b.getString("uri");
            }
        } catch (Exception e) {}
        return "";
    }

    /**
     * getResultsArray - Obtiene el array de resultados de la estructura
     * JSON convertida desde XML SPARQL.
     *
     * Estructura esperada: { sparql: { results: { result: [...] } } }
     *
     * Maneja el caso donde "result" es un solo objeto (1 resultado)
     * o un array (multiples resultados).
     *
     * @param jo  Objeto JSON raiz del XML convertido
     * @return    JSONArray con los resultados, o array vacio si falla
     */
    static JSONArray getResultsArray(JSONObject jo) {
        try {
            JSONObject sparql = jo.optJSONObject("sparql");
            if (sparql == null) return new JSONArray();
            JSONObject results = sparql.optJSONObject("results");
            if (results == null) return new JSONArray();
            Object result = results.opt("result");
            if (result == null) return new JSONArray();
            if (result instanceof JSONArray) return (JSONArray) result;
            // Caso: un solo resultado viene como objeto, no como array
            JSONArray a = new JSONArray();
            a.put((JSONObject) result);
            return a;
        } catch (Exception e) { return new JSONArray(); }
    }

    // =================================================================
    // SISTEMA DE REBUILD EN BACKGROUND
    // =================================================================

    /**
     * REBUILD_LOCK - Mutex para evitar que multiples peticiones HTTP
     * disparen multiples hilos de recalculo simultaneamente.
     * Solo un rebuild puede estar activo a la vez.
     */
    static String rebuildCache(final RDFService rdf) {
        JSONObject finalData = new JSONObject();
        try {
                    // =========================================================
                    // CONSULTAS SPARQL
                    // =========================================================
                    //
                    // Se ejecutan 4 consultas independientes:
                    //   Q_INTERNAL   -> Nodos internos (investigadores UR)
                    //   Q_EXTERNAL   -> Nodos externos (coautores no-UR)
                    //   Q_EDGES_INT  -> Aristas internas (UR <-> UR)
                    //   Q_EDGES_EXT  -> Aristas externas (UR <-> no-UR)
                    //
                    // Despues en Java se fusionan:
                    //   edgesAllPubs = edgesInternalPubs + edgesExternalPubs
                    //
                    // Esto evita una consulta unica demasiado pesada que
                    // causaria timeout en el triplestore.
                    // =========================================================

                    // ---------------------------------------------------------
                    // Q1: NODOS INTERNOS
                    // Investigadores de la UR (clase vlocal:UREntity).
                    // Cuenta docs via Authorship. Los grants se detectan
                    // porque el doc tambien tiene tipo vivo:Grant.
                    // pubs = totalDocs (todos via Authorship)
                    // grants = docs que ademas son vivo:Grant
                    // ---------------------------------------------------------
                    String Q_INTERNAL =
                        "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n"
                        +"PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
                        +"PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n"
                        +"SELECT ?id ?name (COALESCE(?grp,'Sin facultad') AS ?groupLabel) "
                        +"(COUNT(DISTINCT ?doc) AS ?totalDocs) (COUNT(DISTINCT ?grantDoc) AS ?grants)\n"
                        +"WHERE {\n"
                        +"  ?person a vlocal:UREntity; rdfs:label ?name .\n"
                        +"  OPTIONAL {\n"
                        +"    ?person vivo:relatedBy ?NA.\n"
                        +"    ?NA a vivo:Authorship; vivo:relates ?doc.\n"
                        +"    FILTER(?person != ?doc)\n"
                        +"    OPTIONAL { ?doc a vivo:Grant . BIND(?doc AS ?grantDoc) }\n"
                        +"  }\n"
                        +"  OPTIONAL {\n"
                        +"    VALUES ?posType { vivo:FacultyAdministrativePosition vivo:FacultyPosition vivo:NonFacultyAcademicPosition }\n"
                        +"    VALUES ?orgType { vivo:Division vivo:AcademicDepartment vivo:Library }\n"
                        +"    ?person vivo:relatedBy ?posRel. ?posRel a ?posType; vivo:relates ?orgUnit.\n"
                        +"    ?orgUnit a ?orgType; rdfs:label ?grp.\n"
                        +"  }\n"
                        +"  BIND(REPLACE(STR(?person),'.*/([^/]+)$','$1') AS ?id)\n"
                        +"} GROUP BY ?id ?name ?grp";

                    // ---------------------------------------------------------
                    // Q2: NODOS EXTERNOS
                    // Coautores que NO pertenecen a la UR.
                    // Misma logica que Q1 pero para foaf:Person sin vlocal:UREntity.
                    // ---------------------------------------------------------
                    String Q_EXTERNAL =
                        "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n"
                        +"PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
                        +"PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n"
                        +"PREFIX foaf: <http://xmlns.com/foaf/0.1/>\n"
                        +"SELECT ?id ?name ('external' AS ?groupLabel) "
                        +"(COUNT(DISTINCT ?doc) AS ?totalDocs) (COUNT(DISTINCT ?grantDoc) AS ?grants)\n"
                        +"WHERE {\n"
                        +"  ?person a foaf:Person; rdfs:label ?name .\n"
                        +"  MINUS { ?person a vlocal:UREntity }\n"
                        +"  ?person vivo:relatedBy ?NA.\n"
                        +"  ?NA a vivo:Authorship; vivo:relates ?doc.\n"
                        +"  FILTER(?person != ?doc)\n"
                        +"  OPTIONAL { ?doc a vivo:Grant . BIND(?doc AS ?grantDoc) }\n"
                        +"  BIND(REPLACE(STR(?person),'.*/([^/]+)$','$1') AS ?id)\n"
                        +"} GROUP BY ?id ?name";

                    // ---------------------------------------------------------
                    // Q3: ARISTAS INTERNAS
                    // Coautorias entre dos investigadores UR.
                    // Cuenta docs conjuntos. Los grants se detectan via ?doc a vivo:Grant.
                    // FILTER(STR(?sIID) < STR(?tIID)) evita duplicados (A-B = B-A).
                    // ---------------------------------------------------------
                    String Q_EDGES_INT =
                        "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n"
                        +"PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n"
                        +"SELECT ?sID ?tID (COUNT(DISTINCT ?doc) AS ?jointTotalDocs) (COUNT(DISTINCT ?grantDoc) AS ?jointGrants)\n"
                        +"WHERE {\n"
                        +"  ?p1 a vlocal:UREntity; vivo:relatedBy ?NA1.\n"
                        +"  ?NA1 a vivo:Authorship; vivo:relates ?doc.\n"
                        +"  ?doc vivo:relatedBy ?NA2.\n"
                        +"  ?NA2 a vivo:Authorship; vivo:relates ?p2.\n"
                        +"  ?p2 a vlocal:UREntity.\n"
                        +"  FILTER(?p1 != ?p2 && ?p1 != ?doc && ?p2 != ?doc)\n"
                        +"  OPTIONAL { ?doc a vivo:Grant . BIND(?doc AS ?grantDoc) }\n"
                        +"  BIND(REPLACE(STR(?p1),'.*/([^/]+)$','$1') AS ?sIID)\n"
                        +"  BIND(REPLACE(STR(?p2),'.*/([^/]+)$','$1') AS ?tIID)\n"
                        +"  FILTER(STR(?sIID) < STR(?tIID))\n"
                        +"  BIND(STR(?sIID) AS ?sID)\n"
                        +"  BIND(STR(?tIID) AS ?tID)\n"
                        +"} GROUP BY ?sID ?tID";

                    // ---------------------------------------------------------
                    // Q4: ARISTAS EXTERNAS
                    // Coautorias entre un investigador UR y un externo.
                    // MINUS excluye pares UR-UR (ya cubiertos por Q3).
                    // Se fusionara con Q3 en Java para formar edgesAllPubs.
                    // ---------------------------------------------------------
                    String Q_EDGES_EXT =
                        "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n"
                        +"PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n"
                        +"PREFIX foaf: <http://xmlns.com/foaf/0.1/>\n"
                        +"SELECT ?sID ?tID (COUNT(DISTINCT ?doc) AS ?jointTotalDocs) (COUNT(DISTINCT ?grantDoc) AS ?jointGrants)\n"
                        +"WHERE {\n"
                        +"  ?p1 a vlocal:UREntity; vivo:relatedBy ?NA1.\n"
                        +"  ?NA1 a vivo:Authorship; vivo:relates ?doc.\n"
                        +"  ?doc vivo:relatedBy ?NA2.\n"
                        +"  ?NA2 a vivo:Authorship; vivo:relates ?p2.\n"
                        +"  ?p2 a foaf:Person.\n"
                        +"  MINUS { ?p2 a vlocal:UREntity }\n"
                        +"  FILTER(?p1 != ?p2 && ?p1 != ?doc && ?p2 != ?doc)\n"
                        +"  OPTIONAL { ?doc a vivo:Grant . BIND(?doc AS ?grantDoc) }\n"
                        +"  BIND(REPLACE(STR(?p1),'.*/([^/]+)$','$1') AS ?sIID)\n"
                        +"  BIND(REPLACE(STR(?p2),'.*/([^/]+)$','$1') AS ?tIID)\n"
                        +"  BIND(STR(?sIID) AS ?sID)\n"
                        +"  BIND(STR(?tIID) AS ?tID)\n"
                        +"} GROUP BY ?sID ?tID";

                    // =========================================================
                    // EJECUCION DE LAS 4 CONSULTAS
                    // =========================================================
                    String xmlI  = runQuery(rdf, Q_INTERNAL);
                    String xmlE  = runQuery(rdf, Q_EXTERNAL);
                    String xmlEI = runQuery(rdf, Q_EDGES_INT);
                    String xmlEA = runQuery(rdf, Q_EDGES_EXT);

                    // =========================================================
                    // PROCESAMIENTO DE NODOS
                    // =========================================================
                    // Se procesan en 2 pasadas: internos (pass=0) y externos (pass=1).
                    // Para cada investigador se calcula:
                    //   pubs = totalDocs - grants  (publicaciones puras)
                    //   grants = grants             (proyectos/subvenciones)
                    JSONArray nodesInt = new JSONArray();
                    JSONArray nodesExt = new JSONArray();

                    for (int pass = 0; pass < 2; pass++) {
                        String xml = (pass == 0) ? xmlI : xmlE;
                        boolean isExternal = (pass == 1);
                        if (xml.startsWith("<error>")) {
                            finalData.put((isExternal ? "error_nodesExternal" : "error_nodesInternal"), xml);
                            continue;
                        }

                        try {
                            JSONArray rows = getResultsArray(XML.toJSONObject(xml));
                            for (int i = 0; i < rows.length(); i++) {
                                JSONObject row = rows.getJSONObject(i);

                                int total = 0, gts = 0;
                                try { total = Integer.parseInt(getXMLBinding(row, "totalDocs")); } catch(Exception ex) {}
                                try { gts = Integer.parseInt(getXMLBinding(row, "grants")); } catch(Exception ex) {}

                                // totalDocs = ALL docs via Authorship (pubs + grants)
                                // grants = docs que tambien son vivo:Grant
                                // pubs = total - grants (publicaciones puras)
                                int pubsVal = Math.max(0, total - gts);

                                JSONObject n = new JSONObject();
                                n.put("id",       getXMLBinding(row, "id"));
                                n.put("name",     getXMLBinding(row, "name"));
                                n.put("label",    getXMLBinding(row, "name"));
                                n.put("group",    isExternal ? "external" : getXMLBinding(row, "groupLabel"));
                                n.put("pubs",     pubsVal);
                                n.put("grants",   gts);
                                n.put("external", isExternal);

                                if (isExternal) nodesExt.put(n);
                                else nodesInt.put(n);
                            }
                        } catch(Exception ex) {}
                    }

                    // nodesAll = internos + externos (el frontend lo usa con toggle ON)
                    JSONArray nodesAll = new JSONArray();
                    for (int i = 0; i < nodesInt.length(); i++) nodesAll.put(nodesInt.getJSONObject(i));
                    for (int i = 0; i < nodesExt.length(); i++) nodesAll.put(nodesExt.getJSONObject(i));

                    // =========================================================
                    // PROCESAMIENTO DE ARISTAS
                    // =========================================================
                    // Se procesan en 2 pasadas:
                    //   pass=0: aristas internas (Q3)  -> eIP (pubs), eIG (grants)
                    //   pass=1: aristas externas (Q4)  -> eAP (pubs), eAG (grants)
                    //
                    // Para cada arista se calcula:
                    //   jointPubs   = jointTotalDocs - jointGrants
                    //   jointGrants = jointGrants
                    JSONArray eIP = new JSONArray(), eIG = new JSONArray();
                    JSONArray eAP = new JSONArray(), eAG = new JSONArray();

                    for (int pass = 0; pass < 2; pass++) {
                        String xml = (pass == 0) ? xmlEI : xmlEA;
                        if (xml.startsWith("<error>")) {
                            finalData.put((pass == 0 ? "error_edgesInternal" : "error_edgesAll"), xml);
                            continue;
                        }

                        try {
                            JSONArray rows = getResultsArray(XML.toJSONObject(xml));
                            for (int i = 0; i < rows.length(); i++) {
                                JSONObject row = rows.getJSONObject(i);

                                String s = getXMLBinding(row, "sID");
                                String t = getXMLBinding(row, "tID");
                                int total = 0, jg = 0;
                                try { total = Integer.parseInt(getXMLBinding(row, "jointTotalDocs")); } catch(Exception ex) {}
                                try { jg = Integer.parseInt(getXMLBinding(row, "jointGrants")); } catch(Exception ex) {}

                                // jointTotalDocs = ALL joint docs (pubs + grants)
                                // jointGrants = joint docs que son vivo:Grant
                                // jointPubs = total - grants
                                int jp = Math.max(0, total - jg);

                                // Arista de publicaciones conjuntas
                                if (jp > 0) {
                                    JSONObject e = new JSONObject();
                                    e.put("id", s + ":" + t);
                                    e.put("source", s);
                                    e.put("target", t);
                                    e.put("jointPubs", jp);
                                    if (pass == 0) eIP.put(e); else eAP.put(e);
                                }
                                // Arista de grants conjuntos
                                if (jg > 0) {
                                    JSONObject e = new JSONObject();
                                    e.put("id", s + ":" + t);
                                    e.put("source", s);
                                    e.put("target", t);
                                    e.put("jointGrants", jg);
                                    if (pass == 0) eIG.put(e); else eAG.put(e);
                                }
                            }
                        } catch(Exception ex) {}
                    }

                    // =========================================================
                    // FUSION DE ARISTAS: edgesAll = internas + externas
                    // =========================================================
                    // El frontend necesita TODAS las aristas cuando el toggle
                    // "Perfiles externos" esta activado. En lugar de ejecutar
                    // una unica consulta SPARQL pesada (que causa timeout),
                    // fusionamos las dos consultas rapidas en Java.
                    JSONArray edgesAllPubsMerged = new JSONArray();
                    for (int i = 0; i < eIP.length(); i++) edgesAllPubsMerged.put(eIP.getJSONObject(i));
                    for (int i = 0; i < eAP.length(); i++) edgesAllPubsMerged.put(eAP.getJSONObject(i));

                    JSONArray edgesAllGrantsMerged = new JSONArray();
                    for (int i = 0; i < eIG.length(); i++) edgesAllGrantsMerged.put(eIG.getJSONObject(i));
                    for (int i = 0; i < eAG.length(); i++) edgesAllGrantsMerged.put(eAG.getJSONObject(i));

                    // =========================================================
                    // SERIALIZACION FINAL A DISCO
                    // =========================================================
                    finalData.put("nodesInternal",      nodesInt);           // Solo investigadores UR
                    finalData.put("nodesAll",            nodesAll);           // UR + externos
                    finalData.put("edgesInternalPubs",   eIP);               // Coautorias UR-UR (pubs)
                    finalData.put("edgesAllPubs",        edgesAllPubsMerged); // Todas las coautorias (pubs)
                    finalData.put("edgesInternalGrants", eIG);               // Proyectos UR-UR
                    finalData.put("edgesAllGrants",      edgesAllGrantsMerged); // Todos los proyectos

                } catch(Exception e) {
                    finalData.put("error_global", e.getMessage());
                }
                return finalData.toString();
        }
%>

<%
    // =================================================================
    // LOGICA DE RESPUESTA HTTP
    // =================================================================
    // Ejecucion sincrona: el script de bash es el que hara la espera y guardado
    // =================================================================

    VitroRequest vitroReq = new VitroRequest(request);
    RDFService rdfService = vitroReq.getRDFService();

    String jsonOutput = rebuildCache(rdfService);
    out.print(jsonOutput);
%>