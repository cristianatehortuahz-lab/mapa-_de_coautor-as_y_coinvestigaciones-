<%@ page trimDirectiveWhitespaces="true" %>
<%@ page contentType="application/json; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="java.util.*, java.io.*, org.json.*, org.apache.commons.io.IOUtils" %>
<%@ page import="edu.cornell.mannlib.vitro.webapp.controller.VitroRequest" %>
<%@ page import="edu.cornell.mannlib.vitro.webapp.rdfservice.RDFService" %>
<%!
String runQuery(RDFService rdf, String query) { try { InputStream in = rdf.sparqlSelectQuery(query, RDFService.ResultFormat.XML); return IOUtils.toString(in, "UTF-8"); } catch (Exception e) { return "<error>" + e.getMessage() + "</error>"; } }
String getXMLBinding(JSONObject result, String var) { try { Object bindingsObj = result.opt("binding"); if (bindingsObj == null) return ""; JSONArray arr; if (bindingsObj instanceof JSONObject) { arr = new JSONArray(); arr.put((JSONObject) bindingsObj); } else { arr = (JSONArray) bindingsObj; } for (int i = 0; i < arr.length(); i++) { JSONObject b = arr.getJSONObject(i); if (b.optString("name").equals(var)) { if (b.has("literal") && b.get("literal") instanceof String) return b.getString("literal"); if (b.has("literal") && b.get("literal") instanceof JSONObject) return b.getJSONObject("literal").optString("content", ""); if (b.has("uri")) return b.getString("uri"); } } } catch (Exception e) { return ""; } return ""; }
JSONArray getResultsArray(JSONObject jo) { JSONObject sparql = jo.optJSONObject("sparql"); if (sparql == null) return new JSONArray(); Object resultsObj = sparql.opt("results"); if (!(resultsObj instanceof JSONObject)) return new JSONArray(); JSONObject results = (JSONObject) resultsObj; Object result = results.opt("result"); if (result == null) return new JSONArray(); if (result instanceof JSONArray) return (JSONArray) result; if (result instanceof JSONObject) { JSONArray resArr = new JSONArray(); resArr.put((JSONObject) result); return resArr; } return new JSONArray(); }
static final Object REBUILD_LOCK = new Object();
static volatile boolean isBuilding = false;
String rebuildCache(RDFService rdf, String basePath) throws Exception {
    JSONObject finalJson = new JSONObject();
    String qNodesInternal = "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n" + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n" + "PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n" + "PREFIX bibo: <http://purl.org/ontology/bibo/>\n" + "PREFIX fabio: <http://purl.org/spar/fabio/>\n" + "PREFIX obo: <http://purl.obolibrary.org/obo/>\n" + "SELECT ?id ?name (COALESCE(?grp, 'Sin facultad') AS ?groupLabel)\n" + " (COUNT(DISTINCT ?doc) AS ?totalDocs) (COUNT(DISTINCT ?grantDoc) AS ?grants) WHERE {\n" + " ?person a vlocal:UREntity; rdfs:label ?name; vivo:relatedBy ?NA.\n" + " ?NA a vivo:Authorship; vivo:relates ?doc.\n" + " VALUES ?publi { bibo:AcademicArticle bibo:Book bibo:Chapter fabio:Comment vivo:EditorialArticle vivo:Grant vivo:WorkingPaper vivo:Abstract vivo:ConferencePaper vivo:ConferencePoster bibo:Letter bibo:Report vivo:Review obo:ERO_0000071 vivo:Speech bibo:Thesis vivo:Video }\n" + " ?doc a ?publi; rdfs:label ?lDoc.\n" + " FILTER(LANGMATCHES(LANG(?lDoc),'es') || LANG(?lDoc)='')\n" + " OPTIONAL { ?doc a vivo:Grant. BIND(?doc AS ?grantDoc) }\n" + " OPTIONAL {\n" + "   VALUES ?posType { vivo:FacultyAdministrativePosition vivo:FacultyPosition vivo:NonFacultyAcademicPosition }\n" + "   VALUES ?orgUnitType { vivo:Division vivo:AcademicDepartment vivo:Library }\n" + "   ?person vivo:relatedBy ?posRel. ?posRel a ?posType; vivo:relates ?orgUnit. ?orgUnit a ?orgUnitType; rdfs:label ?grp.\n" + " }\n" + " BIND(REPLACE(STR(?person),'.*/([^/]+)','$1') AS ?id)\n" + "} GROUP BY ?id ?name ?grp";
    
    String qNodesAll = "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n" + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n" + "PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n" + "PREFIX bibo: <http://purl.org/ontology/bibo/>\n" + "PREFIX fabio: <http://purl.org/spar/fabio/>\n" + "PREFIX obo: <http://purl.obolibrary.org/obo/>\n" + "SELECT ?id ?name ('external' AS ?groupLabel) (COUNT(DISTINCT ?doc) AS ?totalDocs) (COUNT(DISTINCT ?grantDoc) AS ?grants) WHERE {\n" + " ?p1 a vlocal:UREntity; vivo:relatedBy ?NA1.\n" + " ?NA1 a vivo:Authorship; vivo:relates ?doc.\n" + " VALUES ?publi { bibo:AcademicArticle bibo:Book bibo:Chapter fabio:Comment vivo:EditorialArticle vivo:Grant vivo:WorkingPaper vivo:Abstract vivo:ConferencePaper vivo:ConferencePoster bibo:Letter bibo:Report vivo:Review obo:ERO_0000071 vivo:Speech bibo:Thesis vivo:Video }\n" + " ?doc a ?publi; rdfs:label ?lDoc; vivo:relatedBy ?NA2.\n" + " FILTER(LANGMATCHES(LANG(?lDoc),'es') || LANG(?lDoc)='')\n" + " ?NA2 a vivo:Authorship; vivo:relates ?person.\n" + " ?person a <http://xmlns.com/foaf/0.1/Person>; rdfs:label ?name.\n" + " FILTER NOT EXISTS { ?person a vlocal:UREntity }\n" + " OPTIONAL { ?doc a vivo:Grant. BIND(?doc AS ?grantDoc) }\n" + " BIND(REPLACE(STR(?person),'.*/([^/]+)','$1') AS ?id)\n" + "} GROUP BY ?id ?name LIMIT 1000";

    String qEdgesInternal = "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n" + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n" + "PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n" + "PREFIX bibo: <http://purl.org/ontology/bibo/>\n" + "PREFIX fabio: <http://purl.org/spar/fabio/>\n" + "PREFIX obo: <http://purl.obolibrary.org/obo/>\n" + "SELECT ?sID ?tID (COUNT(DISTINCT ?doc) AS ?jointTotalDocs) (COUNT(DISTINCT ?grantDoc) AS ?jointGrants) WHERE {\n" + " VALUES ?publi { bibo:AcademicArticle bibo:Book bibo:Chapter fabio:Comment vivo:EditorialArticle vivo:Grant vivo:WorkingPaper vivo:Abstract vivo:ConferencePaper vivo:ConferencePoster bibo:Letter bibo:Report vivo:Review obo:ERO_0000071 vivo:Speech bibo:Thesis vivo:Video }\n" + " ?p1 a vlocal:UREntity; vivo:relatedBy ?NA.\n" + " ?NA a vivo:Authorship; vivo:relates ?doc.\n" + " ?doc a ?publi; vivo:relatedBy ?NA1; rdfs:label ?lDoc.\n" + " FILTER(LANGMATCHES(LANG(?lDoc),'es') || LANG(?lDoc)='')\n" + " ?NA1 a vivo:Authorship; vivo:relates ?p2.\n" + " ?p2 a vlocal:UREntity.\n" + " FILTER(?p1 < ?p2)\n" + " OPTIONAL { ?doc a vivo:Grant. BIND(?doc AS ?grantDoc) }\n" + " BIND(REPLACE(STR(?p1),'.*/([^/]+)','$1') AS ?sID)\n" + " BIND(REPLACE(STR(?p2),'.*/([^/]+)','$1') AS ?tID)\n" + "} GROUP BY ?sID ?tID";

    String qEdgesAll = "PREFIX vivo: <http://vivoweb.org/ontology/core#>\n" + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n" + "PREFIX vlocal: <http://research-hub.urosario.edu.co/ontology/vlocal#>\n" + "PREFIX bibo: <http://purl.org/ontology/bibo/>\n" + "PREFIX fabio: <http://purl.org/spar/fabio/>\n" + "PREFIX obo: <http://purl.obolibrary.org/obo/>\n" + "PREFIX foaf: <http://xmlns.com/foaf/0.1/>\n" + "SELECT ?sID ?tID (COUNT(DISTINCT ?doc) AS ?jointTotalDocs) (COUNT(DISTINCT ?grantDoc) AS ?jointGrants) WHERE {\n" + " VALUES ?publi { bibo:AcademicArticle bibo:Book bibo:Chapter fabio:Comment vivo:EditorialArticle vivo:Grant vivo:WorkingPaper vivo:Abstract vivo:ConferencePaper vivo:ConferencePoster bibo:Letter bibo:Report vivo:Review obo:ERO_0000071 vivo:Speech bibo:Thesis vivo:Video }\n" + " ?p1 a vlocal:UREntity; vivo:relatedBy ?NA.\n" + " ?NA a vivo:Authorship; vivo:relates ?doc.\n" + " ?doc a ?publi; rdfs:label ?lDoc; vivo:relatedBy ?NA2.\n" + " FILTER(LANGMATCHES(LANG(?lDoc),'es') || LANG(?lDoc)='')\n" + " ?NA2 a vivo:Authorship; vivo:relates ?p2.\n" + " ?p2 a foaf:Person.\n" + " FILTER(?p1 != ?p2)\n" + " OPTIONAL { ?doc a vivo:Grant. BIND(?doc AS ?grantDoc) }\n" + " BIND(REPLACE(STR(?p1),'.*/([^/]+)$','$1') AS ?sID)\n" + " BIND(REPLACE(STR(?p2),'.*/([^/]+)$','$1') AS ?tID)\n" + "} GROUP BY ?sID ?tID LIMIT 5000";

    String xmlNI = runQuery(rdf, qNodesInternal);
    String xmlNE = runQuery(rdf, qNodesAll);
    String xmlEI = runQuery(rdf, qEdgesInternal);
    String xmlEA = runQuery(rdf, qEdgesAll);
    JSONArray nodesInt = new JSONArray(), nodesExt = new JSONArray();
    for (int pass = 0; pass < 2; pass++) {
        String xml = (pass == 0) ? xmlNI : xmlNE;
        boolean isExternal = (pass == 1);
        if (xml.startsWith("<error>")) continue;
        try {
            JSONArray rows = getResultsArray(XML.toJSONObject(xml));
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                int total = 0, gts = 0;
                try { total = Integer.parseInt(getXMLBinding(row, "totalDocs")); } catch(Exception ex){}
                try { gts = Integer.parseInt(getXMLBinding(row, "grants")); } catch(Exception ex){}
                int pubsVal = Math.max(0, total - gts);
                JSONObject n = new JSONObject();
                n.put("id", getXMLBinding(row, "id"));
                n.put("name", getXMLBinding(row, "name"));
                n.put("label", getXMLBinding(row, "name"));
                n.put("group", isExternal ? "external" : getXMLBinding(row, "groupLabel"));
                n.put("pubs", pubsVal);
                n.put("grants", gts);
                n.put("external", isExternal);
                if (isExternal) nodesExt.put(n); else nodesInt.put(n);
            }
        } catch(Exception ex){}
    }
    JSONArray nodesAll = new JSONArray();
    for (int i = 0; i < nodesInt.length(); i++) nodesAll.put(nodesInt.getJSONObject(i));
    for (int i = 0; i < nodesExt.length(); i++) nodesAll.put(nodesExt.getJSONObject(i));
    finalJson.put("nodesInternal", nodesInt);
    finalJson.put("nodesAll", nodesAll);
    JSONArray eIP = new JSONArray(), eIG = new JSONArray(), eAP = new JSONArray(), eAG = new JSONArray();
    for (int pass = 0; pass < 2; pass++) {
        String xml = (pass == 0) ? xmlEI : xmlEA;
        if (xml.startsWith("<error>")) continue;
        try {
            JSONArray rows = getResultsArray(XML.toJSONObject(xml));
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                String s = getXMLBinding(row, "sID"), t = getXMLBinding(row, "tID");
                int total = 0, jg = 0;
                try { total = Integer.parseInt(getXMLBinding(row, "jointTotalDocs")); } catch(Exception ex){}
                try { jg = Integer.parseInt(getXMLBinding(row, "jointGrants")); } catch(Exception ex){}
                int jp = Math.max(0, total - jg);
                if (jp > 0) {
                    JSONObject e = new JSONObject();
                    e.put("id", s + ":" + t); e.put("source", s); e.put("target", t); e.put("jointPubs", jp);
                    if (pass == 0) eIP.put(e); else eAP.put(e);
                }
                if (jg > 0) {
                    JSONObject e = new JSONObject();
                    e.put("id", s + ":" + t); e.put("source", s); e.put("target", t); e.put("jointGrants", jg);
                    if (pass == 0) eIG.put(e); else eAG.put(e);
                }
            }
        } catch(Exception ex){}
    }
    finalJson.put("edgesInternalPubs", eIP);
    finalJson.put("edgesAllPubs", eAP);
    finalJson.put("edgesInternalGrants", eIG);
    finalJson.put("edgesAllGrants", eAG);
    String jsonOutput = finalJson.toString();
    return jsonOutput;
}
%>
<%
try {
    VitroRequest vreq = new VitroRequest(request);
    RDFService rdf = vreq.getRDFService();
    
    // Ejecutamos las consultas y construimos el JSON en tiempo real.
    // El script de Bash será el encargado de guardarlo físicamente.
    String jsonOutput = rebuildCache(rdf, "");
    out.print(jsonOutput);
    
} catch (Throwable t) {
    response.setStatus(200);
    out.print("{\"status\":\"error\",\"message\":\"" + t.toString().replace("\"","'") + "\"}");
}
%>