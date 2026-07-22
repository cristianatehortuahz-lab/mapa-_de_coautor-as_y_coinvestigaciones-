# Despliegue: Mapa de Coautoría

## 📋 Documentos en esta sección

## 🎯 Para desplegar

1. Seguir [`../../DESPLIEGUE_MAESTRO.md`](../../DESPLIEGUE_MAESTRO.md).
2. Validar:
   - [ ] `http://<host>:8080/mapadeCoauthor/` → 200 (SPA carga)
   - [ ] `.../HUBvivo115/js/coauthorNetworkViz/baseData.json` → 200 application/json
   - [ ] `baseData.json` con claves `*Pubs` y `*Grants`
   - [ ] Toggle **Publicaciones** dibuja la red
   - [ ] Toggle **Proyectos** dibuja la red
   - [ ] Zoom / pan / búsqueda / filtros funcionan
   - [ ] Consola sin 404 ni "baseData.json no encontrado"

## ⏱️ Tiempo Estimado
- Deploy con instalador: ~2-5 minutos
- Validación: ~10 minutos

---

**Ver también:**
- `../README.md` (rutas críticas + esquema de datos)
- `../02-structure/` (inventario histórico del build legacy)
- `../04-configuration/` (cambios de config por ambiente)
