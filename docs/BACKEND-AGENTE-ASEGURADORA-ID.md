# URGENTE: Backend no respeta aseguradoraId al crear agente desde PDF

## Problema

Cuando el extractor PDF crea un agente automáticamente, envía el siguiente payload al endpoint:

```javascript
POST /api/equipoDeTrabajo/ejecutivosPorProducto

{
  "usuarioId": 49,
  "aseguradoraId": "6ceaa91e-8391-11f0-bef8-0ab39348df91",  // Qualitas
  "productoId": 1,  // Autos Individual
  "ejecutivoId": 49,
  "clave": "25576",
  "comisionPersonalizada": 0
}
```

**Pero el backend guarda HDI Seguros en lugar de Qualitas.**

## Evidencia

- Frontend envía: `aseguradoraId: "6ceaa91e-8391-11f0-bef8-0ab39348df91"` (Qualitas)
- Backend guarda: AS014 - HDI Seguros
- Logs del frontend muestran que encuentra correctamente Qualitas

## Solución Requerida

El endpoint `/api/equipoDeTrabajo/ejecutivosPorProducto` debe:

1. **Aceptar** el campo `aseguradoraId` en el payload
2. **Usar** ese `aseguradoraId` para la asociación en lugar de inferirlo del `productoId`
3. **Insertar** en `ejecutivos_por_producto` la aseguradora enviada por el frontend

## Contexto

Los productos en la BD son **genéricos** (no tienen aseguradora_id):
- Producto ID 1: "Autos Individual" (sin aseguradora asignada)
- Puede usarse con Qualitas, HDI, GNP, etc.

Por eso el frontend **debe especificar** qué aseguradora usar con cada producto.

## Fecha
26 de noviembre de 2025

## Prioridad
ALTA - El extractor PDF crea agentes pero con aseguradora incorrecta
