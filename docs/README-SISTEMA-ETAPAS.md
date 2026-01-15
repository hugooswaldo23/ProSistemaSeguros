# 📋 Sistema de Etapas - Pólizas y Renovaciones

## 🎯 Flujo Completo de Etapas

### **Flujo Inicial (Nueva Póliza)**
```
1. Emitida
   ↓
2. Enviada al Cliente
   ↓
3. Pagada
   ↓ (automático cuando fecha_aviso_renovacion <= HOY)
4. Por Renovar
```

### **Flujo de Renovación**
```
5. Renovación Emitida
   ↓
6. Renovación Enviada
   ↓
7. Renovación Pagada
   ↓ (vuelve al ciclo)
4. Por Renovar
```

---

## ⚠️ IMPORTANTE: Cambio Automático a "Por Renovar"

### **Problema:**
Con 5000+ pólizas pagadas, es ineficiente calcular manualmente cuándo deben pasar a "Por Renovar".

### **Solución Implementada:**
El **backend** calcula dinámicamente la etapa usando el campo `fecha_aviso_renovacion` (que ya se guarda automáticamente como `termino_vigencia - 30 días`).

### **Frontend - LISTO ✅**
- Archivo: `src/screens/NvoExpedientes.jsx`
- Líneas: ~245-260
- Ya usa `etapa_calculada` si el backend lo proporciona
- Fallback a `etapa_activa` si no existe

```javascript
// El frontend automáticamente usa etapa_calculada del backend
etapa_activa: exp.etapa_calculada || exp.etapa_activa,
_etapa_original: exp.etapa_activa,
_dias_para_vencimiento: exp.dias_para_vencimiento || null
```

### **Backend - PENDIENTE ⏳**
- **Responsable:** Hugo (backend)
- **Archivo:** Endpoint `GET /api/expedientes`
- **Documentación completa:** `docs/BACKEND-CALCULO-DINAMICO-ETAPA-POR-RENOVAR.md`

**Agregar al query SQL:**
```sql
CASE
  WHEN e.etapa_activa = 'Pagada' 
       AND e.fecha_aviso_renovacion <= CURDATE()
       AND e.termino_vigencia > CURDATE()
  THEN 'Por Renovar'
  
  ELSE e.etapa_activa
END as etapa_calculada
```

---

## 📝 Eventos Registrados por Etapa

| **Etapa** | **Evento en Historial** | **Cuándo se Registra** |
|-----------|-------------------------|------------------------|
| Emitida | `POLIZA_EMITIDA` | Al guardar nueva póliza |
| Enviada al Cliente | `POLIZA_ENVIADA_EMAIL` o `POLIZA_ENVIADA_WHATSAPP` | Al compartir póliza |
| Pagada | `POLIZA_PAGADA` | Al aplicar pago (automático) |
| Por Renovar | `POLIZA_POR_RENOVAR` | Al cambiar manualmente o cuando backend lo calcula |
| Renovación Emitida | `RENOVACION_EMITIDA` | Al iniciar renovación |
| Renovación Enviada | `RENOVACION_ENVIADA` | Al enviar renovación al cliente |
| Renovación Pagada | `RENOVACION_PAGADA` | Al aplicar pago de renovación |

---

## 🔧 Archivos Modificados (Enero 2026)

### **Frontend (COMPLETO):**
1. ✅ `src/services/historialExpedienteService.js`
   - Agregados eventos: `POLIZA_PAGADA`, `POLIZA_POR_RENOVAR`, `RENOVACION_ENVIADA`, `RENOVACION_PAGADA`
   - Estilos e iconos configurados

2. ✅ `src/screens/NvoExpedientes.jsx`
   - Función `cambiarEstadoExpediente()` actualizada con switch para nuevas etapas
   - Arrays `etapasActivas` actualizados en ambos formularios
   - **LISTO para usar `etapa_calculada` del backend**

3. ✅ `src/hooks/usePagos.js`
   - Auto-cambio de etapa a "Pagada" después de aplicar pago
   - Registro de evento `PAGO_REGISTRADO`

4. ✅ `src/hooks/useCompartirExpediente.js`
   - Registra evento de envío + cambio de etapa a "Enviada al Cliente"

5. ✅ `src/components/expedientes/FormularioNuevoExpediente.jsx`
   - Tracking de método de captura (manual vs PDF)
   - Detección de campos modificados post-extracción

### **Backend (PENDIENTE):**
1. ⏳ `GET /api/expedientes`
   - Agregar campo `etapa_calculada`
   - Agregar campo `dias_para_vencimiento`
   - Ver: `docs/BACKEND-CALCULO-DINAMICO-ETAPA-POR-RENOVAR.md`

2. ⏳ `GET /api/expedientes/:id`
   - Agregar mismo cálculo de `etapa_calculada`

---

## 🚀 Para Probar Después de Implementación Backend

1. Crear póliza con `termino_vigencia` dentro de 30 días
2. Aplicar pago → debe cambiar a "Pagada"
3. Esperar a que llegue `fecha_aviso_renovacion` → backend debe retornar `etapa_calculada = "Por Renovar"`
4. Verificar que aparece en bandeja "Por Renovar" del dashboard

---

## 📞 Contacto

**Frontend:** Álvaro  
**Backend:** Hugo  
**Documentación:** Ver carpeta `docs/`
