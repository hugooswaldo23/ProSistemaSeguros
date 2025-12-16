# 🚨 URGENTE: Correcciones Backend - Estatus Pago y Recibos

## Problema Actual

El frontend está funcionando correctamente pero el **backend tiene 2 problemas críticos**:

### ❌ Problema 1: `estatus_pago` se guarda en BD en lugar de calcularse

**Situación actual:**
- Cuando se crea una póliza, se guarda `estatus_pago: "Pendiente"` en la tabla `expedientes`
- Este valor NUNCA se actualiza, así que pólizas vencidas siguen mostrando "Pendiente"

**Solución requerida:**
```sql
-- NO guardar estatus_pago en INSERT/UPDATE
-- Calcularlo dinámicamente en el SELECT usando esta lógica:

SELECT 
  e.*,
  CASE
    -- Si ya pagó todos los recibos
    WHEN e.ultimo_recibo_pagado >= (número_total_pagos) THEN 'Pagado'
    
    -- Si la fecha de vencimiento del próximo recibo ya pasó
    WHEN e.fecha_vencimiento_pago < CURDATE() THEN 'Vencido'
    
    -- Si faltan 15 días o menos para vencer
    WHEN DATEDIFF(e.fecha_vencimiento_pago, CURDATE()) <= 15 THEN 'Por Vencer'
    
    -- Más de 15 días
    ELSE 'Pendiente'
  END AS estatus_pago
FROM expedientes e;
```

---

### ❌ Problema 2: NO se generan recibos en tabla `recibos_pago`

**Situación actual:**
- La tabla `recibos_pago` existe (ya la creaste)
- Pero cuando se crea una póliza **NO** se generan los recibos automáticamente
- El frontend usa un fallback temporal para calcularlos, pero esto NO persiste en BD

**Solución requerida:**

#### 1️⃣ Crear TRIGGER o función que genere recibos automáticamente

```sql
DELIMITER $$

CREATE TRIGGER generar_recibos_pago
AFTER INSERT ON expedientes
FOR EACH ROW
BEGIN
  DECLARE num_pagos INT;
  DECLARE meses_entre_pagos INT;
  DECLARE fecha_venc DATE;
  DECLARE i INT DEFAULT 1;
  DECLARE monto_recibo DECIMAL(10,2);
  
  -- Solo para pagos fraccionados
  IF NEW.tipo_pago = 'Fraccionado' THEN
    
    -- Determinar número de pagos según frecuencia
    SET num_pagos = CASE NEW.frecuencia_pago
      WHEN 'Mensual' THEN 12
      WHEN 'Bimestral' THEN 6
      WHEN 'Trimestral' THEN 4
      WHEN 'Cuatrimestral' THEN 3
      WHEN 'Semestral' THEN 2
      ELSE 1
    END;
    
    -- Determinar meses entre pagos
    SET meses_entre_pagos = CASE NEW.frecuencia_pago
      WHEN 'Mensual' THEN 1
      WHEN 'Bimestral' THEN 2
      WHEN 'Trimestral' THEN 3
      WHEN 'Cuatrimestral' THEN 4
      WHEN 'Semestral' THEN 6
      ELSE 12
    END;
    
    -- Generar cada recibo
    WHILE i <= num_pagos DO
      -- Primer recibo: inicio_vigencia + periodo_gracia
      IF i = 1 THEN
        SET fecha_venc = DATE_ADD(NEW.inicio_vigencia, INTERVAL COALESCE(NEW.periodo_gracia, 30) DAY);
        SET monto_recibo = COALESCE(NEW.primer_pago, NEW.total / num_pagos);
      ELSE
        -- Recibos subsecuentes: inicio_vigencia + N meses
        SET fecha_venc = DATE_ADD(NEW.inicio_vigencia, INTERVAL (i - 1) * meses_entre_pagos MONTH);
        SET monto_recibo = COALESCE(NEW.pagos_subsecuentes, NEW.total / num_pagos);
      END IF;
      
      -- Insertar recibo
      INSERT INTO recibos_pago (
        expediente_id,
        numero_recibo,
        fecha_vencimiento,
        monto,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        i,
        fecha_venc,
        monto_recibo,
        NOW(),
        NOW()
      );
      
      SET i = i + 1;
    END WHILE;
    
  -- Para pago anual/contado: un solo recibo
  ELSEIF NEW.tipo_pago IN ('Anual', 'Contado') THEN
    SET fecha_venc = DATE_ADD(NEW.inicio_vigencia, INTERVAL COALESCE(NEW.periodo_gracia, 30) DAY);
    
    INSERT INTO recibos_pago (
      expediente_id,
      numero_recibo,
      fecha_vencimiento,
      monto,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      1,
      fecha_venc,
      NEW.total,
      NOW(),
      NOW()
    );
  END IF;
END$$

DELIMITER ;
```

#### 2️⃣ Calcular estatus de recibos dinámicamente en SELECT

```sql
-- En el endpoint GET /api/expedientes/:id
SELECT 
  r.*,
  CASE
    -- Si tiene fecha_pago_real, está pagado
    WHEN r.fecha_pago_real IS NOT NULL THEN 'Pagado'
    
    -- Si ya venció
    WHEN r.fecha_vencimiento < CURDATE() THEN 'Vencido'
    
    -- Si está por vencer (15 días o menos)
    WHEN DATEDIFF(r.fecha_vencimiento, CURDATE()) <= 15 THEN 'Por Vencer'
    
    -- Más de 15 días
    ELSE 'Pendiente'
  END AS estatus
FROM recibos_pago r
WHERE r.expediente_id = ?
ORDER BY r.numero_recibo;
```

---

## ✅ Checklist de Implementación

### Backend (Hugo)

- [ ] **1. Modificar GET /api/expedientes**
  - [ ] Eliminar `estatus_pago` de la tabla (o ignorarlo en SELECT)
  - [ ] Calcular `estatus_pago` dinámicamente en la consulta SQL
  - [ ] Incluir los recibos en el JOIN

- [ ] **2. Crear TRIGGER o función para generar recibos**
  - [ ] Implementar lógica de generación automática
  - [ ] Probar con pólizas nuevas (Anual, Trimestral, Mensual)

- [ ] **3. Modificar GET /api/expedientes/:id**
  - [ ] Incluir array de recibos con estatus calculado
  - [ ] Asegurar que el JOIN incluya todos los recibos

- [ ] **4. OPCIONAL: Limpiar pólizas existentes**
  - [ ] Ejecutar script para generar recibos de pólizas ya existentes
  - [ ] Actualizar `estatus_pago` calculado

### Frontend (Ya implementado ✅)

- [x] Leer recibos desde `expediente.recibos[]`
- [x] Fallback temporal si no hay recibos (calcularlos)
- [x] Calcular estatus general basado en `fecha_vencimiento_pago`
- [x] Mostrar calendario con estatus correctos

---

## 📝 Ejemplo de Respuesta Esperada del Backend

```json
{
  "id": 477,
  "numero_poliza": "0005161150",
  "tipo_pago": "Fraccionado",
  "frecuencia_pago": "Trimestral",
  "fecha_vencimiento_pago": "2025-08-17T06:00:00.000Z",
  "ultimo_recibo_pagado": 0,
  "estatus_pago": "Vencido",  // ✅ CALCULADO en SQL
  "recibos": [  // ✅ INCLUIR en el JOIN
    {
      "id": 1,
      "expediente_id": "477",
      "numero_recibo": 1,
      "fecha_vencimiento": "2025-08-17",
      "monto": 2033.19,
      "estatus": "Vencido",  // ✅ CALCULADO en SQL
      "fecha_pago_real": null,
      "comprobante_url": null
    },
    {
      "id": 2,
      "expediente_id": "477",
      "numero_recibo": 2,
      "fecha_vencimiento": "2025-11-14",
      "monto": 1290.81,
      "estatus": "Vencido",  // ✅ CALCULADO en SQL
      "fecha_pago_real": null,
      "comprobante_url": null
    },
    {
      "id": 3,
      "expediente_id": "477",
      "numero_recibo": 3,
      "fecha_vencimiento": "2026-02-14",
      "monto": 1290.81,
      "estatus": "Pendiente",  // ✅ CALCULADO en SQL
      "fecha_pago_real": null,
      "comprobante_url": null
    },
    {
      "id": 4,
      "expediente_id": "477",
      "numero_recibo": 4,
      "fecha_vencimiento": "2026-05-14",
      "monto": 1290.81,
      "estatus": "Pendiente",  // ✅ CALCULADO en SQL
      "fecha_pago_real": null,
      "comprobante_url": null
    }
  ]
}
```

---

## ⚠️ Nota Importante

Mientras Hugo implementa esto, el **frontend tiene un FALLBACK temporal** que:
- Calcula los recibos cuando no existen en BD
- Calcula el `estatus_pago` basándose en `fecha_vencimiento_pago`

Este fallback **NO debe ser la solución final**. Es solo temporal hasta que el backend lo implemente correctamente.

---

## 🔗 Referencias

- Documentación completa: `BACKEND-TABLA-RECIBOS-PAGO.md`
- Resumen implementación: `RESUMEN-IMPLEMENTACION-RECIBOS.md`
