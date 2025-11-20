# 📋 RECORDATORIOS Y PENDIENTES

## 🗓️ Para Mañana (21 de Noviembre, 2025)

### ⚠️ PRIORIDAD ALTA

#### 1. Revisar Cancelaciones en Pólizas
- **Tarea**: Revisar el sistema de cancelación de pólizas
- **Ubicación**: `src/screens/Expedientes.jsx` - Modal de cancelación
- **Verificar**:
  - ✅ Campo `fecha_cancelacion` se está guardando correctamente
  - ✅ Estatus de pago cambia a "Cancelado"
  - ✅ Historial registra evento de cancelación
  - ❓ Dashboard muestra correctamente cancelaciones por periodo
  - ❓ Motivos de cancelación están completos
  - ❓ Notificaciones/alertas de cancelación

#### 2. Revisar Sistema de Comentarios en Pólizas
- **Tarea**: Implementar o revisar comentarios en pólizas
- **Verificar**:
  - ❓ ¿Existe tabla de comentarios en BD?
  - ❓ ¿Se pueden agregar notas/comentarios a las pólizas?
  - ❓ ¿Los comentarios se muestran en el historial?
  - ❓ ¿Hay seguimiento de quién comenta?

---

## 📝 Cambios Realizados Hoy (20 de Noviembre)

### ✅ Dashboard
- Filtrado por rangos de fechas (mes actual + mes anterior)
- Tarjetas clickeables para ver detalles
- Mejorado cálculo de primas emitidas, pagadas, vencidas y canceladas
- Fechas de emisión, pago y cancelación en modales de desglose

### ✅ Extractor PDF Chubb
- Agregados campos: `capacidad` y `motor`
- Mejorada extracción de datos de vehículo
- Logs más claros y organizados

### ✅ Extractor PDF Qualitas
- Mejorada extracción de agente (acepta nombres completos con puntos, comas, paréntesis)
- Detecta personas morales (empresas) en nombres de agentes

### ✅ Sistema de Expedientes
- Modal de selección de método de captura (manual vs PDF)
- Mejorado manejo de estatus de pago
- Sincronización entre periodo de gracia y fecha de vencimiento

---

## 🚀 Próximas Mejoras Sugeridas

1. **Notificaciones de Cancelación**
   - Email/WhatsApp automático al cliente
   - Notificación interna al equipo

2. **Reportes de Cancelaciones**
   - Dashboard con motivos más frecuentes
   - Análisis de tendencias

3. **Comentarios/Notas**
   - Sistema de comentarios por póliza
   - Timeline de interacciones
   - Tags/etiquetas para clasificar

---

**Fecha de creación**: 20 de Noviembre, 2025  
**Actualizado por**: Sistema
