# 🔄 Backend: Cálculo Dinámico de Etapa "Por Renovar"

> **⚠️ IMPORTANTE - FRONTEND YA ESTÁ LISTO**  
> El código del frontend ya está preparado para recibir y usar el campo `etapa_calculada`.  
> Solo falta implementar este cálculo en el backend (responsable: Hugo).  
> Ver resumen completo: `docs/README-SISTEMA-ETAPAS.md`

---

## 📋 Contexto

Actualmente el frontend guarda `fecha_aviso_renovacion` (calculada como `termino_vigencia - 30 días`) pero la etapa permanece en "Pagada" hasta que se cambie manualmente.

Para 5000+ pólizas pagadas y 15000 renovadas, necesitamos que el backend calcule dinámicamente cuándo una póliza debe cambiar de "Pagada" a "Por Renovar".

---

## ✅ Solución: Vista Calculada SQL

### **Modificar endpoint: `GET /api/expedientes`**

Agregar columna calculada `etapa_calculada` que determine automáticamente si una póliza debe estar en "Por Renovar":

```sql
SELECT 
  e.*,
  c.nombre as cliente_nombre,
  c.apellido_paterno,
  c.apellido_materno,
  c.rfc as cliente_rfc,
  
  -- 🆕 Calcular etapa dinámica basada en fecha_aviso_renovacion
  CASE
    -- Póliza Pagada que llegó a su fecha de aviso → Por Renovar
    WHEN e.etapa_activa = 'Pagada' 
         AND e.fecha_aviso_renovacion IS NOT NULL
         AND e.fecha_aviso_renovacion <= CURDATE()
         AND e.termino_vigencia > CURDATE()
    THEN 'Por Renovar'
    
    -- Póliza Pagada o Por Renovar que ya venció → Vencida
    WHEN e.etapa_activa IN ('Pagada', 'Por Renovar')
         AND e.termino_vigencia < CURDATE()
    THEN 'Vencida'
    
    -- Caso contrario, mantener etapa actual
    ELSE e.etapa_activa
  END as etapa_calculada,
  
  -- 🆕 Días para vencimiento (útil para ordenar en dashboard)
  DATEDIFF(e.termino_vigencia, CURDATE()) as dias_para_vencimiento
  
FROM expedientes e
LEFT JOIN clientes c ON e.cliente_id = c.id
WHERE e.deleted_at IS NULL
ORDER BY e.fecha_creacion DESC;
```

---

## 🎯 Lógica del Cálculo

| **Condición** | **Etapa Calculada** |
|---------------|---------------------|
| `etapa_activa = 'Pagada'` y `fecha_aviso_renovacion <= HOY` y `termino_vigencia > HOY` | **Por Renovar** |
| `etapa_activa IN ('Pagada', 'Por Renovar')` y `termino_vigencia < HOY` | **Vencida** |
| Cualquier otra combinación | Mantener `etapa_activa` original |

---

## 📤 Respuesta Esperada del Endpoint

```json
{
  "data": [
    {
      "id": 123,
      "numero_poliza": "POL-2024-001",
      "etapa_activa": "Pagada",           // ← Etapa guardada en BD
      "etapa_calculada": "Por Renovar",   // ← Etapa calculada dinámicamente
      "fecha_aviso_renovacion": "2026-01-10",
      "termino_vigencia": "2026-02-09",
      "dias_para_vencimiento": 31,
      "cliente_nombre": "Juan Pérez",
      ...
    }
  ]
}
```

---

## 🔧 Endpoints Afectados

### ✅ Modificar (REQUERIDO):

1. **`GET /api/expedientes`** - Listado general
   - Agregar `etapa_calculada` y `dias_para_vencimiento`
   
2. **`GET /api/expedientes/:id`** - Detalle individual
   - Agregar `etapa_calculada` y `dias_para_vencimiento`

### ⚠️ Opcional (mejora futura):

3. **`GET /api/dashboard/estadisticas`** - Si existe endpoint de dashboard
   - Usar `etapa_calculada` en vez de `etapa_activa` para conteos

---

## 🎯 Ventajas de Esta Solución

✅ **Cero overhead** - Solo calcula al consultar  
✅ **Siempre preciso** - Basado en fecha actual del servidor  
✅ **Escala a 50k+ registros** sin problemas  
✅ **No requiere cronjobs** ni procesos batch  
✅ **Dashboard siempre correcto** sin recalcular en frontend  
✅ **Usa campo existente** (`fecha_aviso_renovacion`) que ya se guarda automáticamente  

---

## 🔍 Índices Recomendados (Optimización)

Para mejorar performance con miles de registros:

```sql
-- Índice compuesto para cálculo de etapa
CREATE INDEX idx_etapa_fechas ON expedientes(etapa_activa, fecha_aviso_renovacion, termino_vigencia);

-- Índice para ordenamiento por vencimiento
CREATE INDEX idx_termino_vigencia ON expedientes(termino_vigencia);
```

---

## 🧪 Casos de Prueba

| **Escenario** | **etapa_activa** | **fecha_aviso_renovacion** | **termino_vigencia** | **Hoy** | **etapa_calculada esperada** |
|---------------|------------------|----------------------------|----------------------|---------|------------------------------|
| Póliza recién pagada | Pagada | 2026-02-15 | 2026-03-17 | 2026-01-09 | Pagada |
| Póliza a 30 días de vencer | Pagada | 2026-01-09 | 2026-02-08 | 2026-01-09 | Por Renovar |
| Póliza a 20 días de vencer | Pagada | 2025-12-30 | 2026-01-29 | 2026-01-09 | Por Renovar |
| Póliza ya vencida | Pagada | 2025-11-15 | 2025-12-15 | 2026-01-09 | Vencida |
| Renovación emitida | Renovación Emitida | 2026-02-15 | 2026-03-17 | 2026-01-09 | Renovación Emitida |

---

## 🚀 Implementación en Frontend

El frontend ya consume este campo automáticamente:

```javascript
// src/screens/NvoExpedientes.jsx - recargarExpedientes()
const response = await fetch(`${API_URL}/api/expedientes`);
const data = await response.json();

// Usar etapa_calculada en vez de etapa_activa para mostrar en bandejas
const expedientesConEtapaCalculada = data.data.map(exp => ({
  ...exp,
  etapa_activa: exp.etapa_calculada || exp.etapa_activa // Fallback
}));
```

---

## ❓ Preguntas Frecuentes

### ¿Por qué no actualizar directamente `etapa_activa` en la BD con un cronjob?

**Respuesta:** Porque perdemos trazabilidad. Si el backend actualiza masivamente sin pasar por el frontend, no se registran los eventos en `historial_expedientes`. La vista calculada permite:
- Ver la etapa correcta en tiempo real
- Mantener `etapa_activa` como "fuente de verdad" para auditoría
- Cuando el usuario interactúa con la póliza "Por Renovar", el frontend llama a `cambiarEstadoExpediente()` que SÍ registra el evento

### ¿Qué pasa si una póliza tiene `fecha_aviso_renovacion = NULL`?

**Respuesta:** El `CASE` verifica `IS NOT NULL`, así que simplemente mantendrá `etapa_activa` original. Las pólizas antiguas sin este campo no se verán afectadas.

### ¿Afecta el performance con 20k+ registros?

**Respuesta:** No, el cálculo es instantáneo (comparación de fechas). Con los índices recomendados, el query sigue siendo < 100ms para 50k registros.

---

## ✅ Checklist de Implementación

**Backend:**
- [ ] Modificar `GET /api/expedientes` - agregar `etapa_calculada` y `dias_para_vencimiento`
- [ ] Modificar `GET /api/expedientes/:id` - agregar `etapa_calculada` y `dias_para_vencimiento`
- [ ] Crear índices recomendados en BD
- [ ] Probar con casos de prueba documentados

**Frontend (No requiere cambios adicionales):**
- [x] Ya usa el campo que retorne el backend
- [x] Ya tiene `fecha_aviso_renovacion` calculada automáticamente
- [x] Ya tiene función `cambiarEstadoExpediente()` que registra eventos en historial

**Verificación:**
- [ ] Pólizas pagadas con `fecha_aviso_renovacion <= HOY` aparecen en bandeja "Por Renovar"
- [ ] Pólizas vencidas aparecen en bandeja "Vencidas"
- [ ] Dashboard muestra conteos correctos por etapa
- [ ] Performance < 200ms para listado de 5000+ pólizas

---

## 📞 Dudas o Comentarios

Si hay dudas sobre la implementación, contactar a Hugo (backend) o al equipo de IT.
