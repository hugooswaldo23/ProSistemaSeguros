# 🐛 BUG: Recibo Fantasma con Monto $0.00

**Fecha:** 16 de febrero de 2026  
**Prioridad:** Alta  
**Asignado a:** Hugo  

---

## 📋 Descripción del Problema

El backend está generando un **recibo extra con monto $0.00** en pólizas fraccionadas trimestrales.

Una póliza **Trimestral** debería tener **4 recibos** (12 meses ÷ 3 meses = 4), pero el backend está creando **5 recibos**, donde el #5 tiene monto $0.00.

---

## 🔍 Ejemplo: Póliza de OSCAR GREGORIO (Expediente 818)

```
GET /api/recibos/818

Recibo #1 | monto = $2,584.40 | fecha = 2026-02-05 | estatus = Pagado    ✅
Recibo #2 | monto = $1,743.40 | fecha = 2026-04-06 | estatus = Pendiente ✅
Recibo #3 | monto = $1,743.40 | fecha = 2026-07-06 | estatus = Pendiente ✅
Recibo #4 | monto = $1,743.40 | fecha = 2026-10-06 | estatus = Pendiente ✅
Recibo #5 | monto = $0.00     | fecha = 2027-01-06 | estatus = Pendiente ❌ FANTASMA
```

**Esperado:** Solo 4 recibos (Trimestral = 4 pagos al año)  
**Actual:** 5 recibos, el último con monto $0.00  

---

## 📊 Expedientes Afectados

Se encontraron **3 expedientes** con este problema:

| Expediente ID | Recibo Fantasma (DB id) | Número Recibo | Monto |
|---------------|------------------------|---------------|-------|
| 808           | id=1215                | #5            | $0.00 |
| 818           | id=1233                | #5            | $0.00 |
| 820           | id=1240                | #5            | $0.00 |

Los 3 son trimestrales con los mismos montos ($2,584.40 primer pago, $1,743.40 subsecuentes).

---

## 🔧 Qué Revisar en el Backend

### 1. Lógica de cálculo de número de recibos

El número de recibos debe calcularse así:

```javascript
const PAGOS_POR_FRECUENCIA = {
  'Mensual': 12,
  'Bimestral': 6,
  'Trimestral': 4,    // ← Debe ser 4, NO 5
  'Cuatrimestral': 3,
  'Semestral': 2
};

const numeroPagos = PAGOS_POR_FRECUENCIA[expediente.frecuencia_pago];
```

**Verificar que el `for` loop use `<=` correctamente:**

```javascript
// ✅ CORRECTO: genera exactamente numeroPagos recibos
for (let i = 1; i <= numeroPagos; i++) { ... }

// ❌ INCORRECTO: si numeroPagos ya incluye +1, genera uno de más
for (let i = 0; i <= numeroPagos; i++) { ... }  // Genera numeroPagos + 1
```

### 2. Posibles causas del bug

- El loop empieza en `i = 0` en vez de `i = 1` (genera N+1 recibos)
- Se usa `Trimestral: 5` en vez de `Trimestral: 4` en la tabla de frecuencias
- El monto del último recibo se calcula como `total - sumaPagosAnteriores` y si ya se cubrió el total, queda en $0
- Se está sumando un recibo adicional por alguna lógica de "recibo final" o "recibo de cierre"

### 3. Asignación de montos

Parece que la lógica de montos es:
- Recibo 1: `primer_pago` ($2,584.40)
- Recibos 2-4: `pagos_subsecuentes` ($1,743.40)
- Recibo 5: Lo que sobra = $0.00 ← **Este no debería existir**

Si se usa la fórmula `monto = total - sumaPagosAnteriores`, esta fórmula agrega recibos hasta cubrir el total. Cuando ya se cubrió, genera uno en $0.

---

## ✅ Acciones Requeridas

### Acción 1: Corregir la lógica de generación de recibos
Asegurar que para frecuencia Trimestral solo se generen **4 recibos**, no 5.

### Acción 2: Eliminar los recibos fantasma existentes

```sql
-- Eliminar los 3 recibos fantasma con monto $0.00
DELETE FROM recibos_pago WHERE id IN (1215, 1233, 1240);

-- Verificar que se eliminaron
SELECT * FROM recibos_pago WHERE monto = 0;
```

### Acción 3: Verificar que no haya más recibos en $0

```sql
-- Buscar TODOS los recibos con monto 0 en la BD
SELECT rp.id, rp.expediente_id, rp.numero_recibo, rp.monto, rp.fecha_vencimiento
FROM recibos_pago rp
WHERE rp.monto = 0 OR rp.monto IS NULL
ORDER BY rp.expediente_id, rp.numero_recibo;
```

---

## 🧪 Cómo Verificar que se Corrigió

Después de aplicar el fix, verificar con:

```bash
# Debe devolver exactamente 4 recibos para expediente trimestral
GET /api/recibos/818
# Esperado: 4 recibos, todos con monto > 0

# Verificar en la BD que no hay recibos en 0
SELECT COUNT(*) FROM recibos_pago WHERE monto = 0;
# Esperado: 0
```

---

## 💡 Impacto en el Frontend

En el frontend ya se aplicó un workaround temporal:
- Se calcula `totalRecibos` basado en la **frecuencia de pago** (no en `recibos.length`)
- Se filtran recibos con `monto > 0` como fallback

Pero el **fix real debe ser en el backend** para que no se generen recibos fantasma.

---
---

# 🐛 BUG 2: Eliminar Expediente NO borra archivos de S3

**Prioridad:** Media-Alta  

---

## 📋 Descripción del Problema

Cuando se elimina un expediente desde el listado (`DELETE /api/expedientes/:id`), solo se borra el registro de la base de datos, pero **NO se eliminan los archivos asociados en S3**.

Esto causa que se acumulen archivos huérfanos en el bucket `prosistema-polizas` que ya no están asociados a ningún expediente.

---

## 📁 Archivos S3 que un expediente puede tener

Cada expediente puede tener hasta **4 tipos de archivos** en S3:

| Tipo de Archivo | Endpoint de Subida | Ruta S3 aproximada |
|----------------|-------------------|-------------------|
| PDF de Póliza | `POST /api/expedientes/:id/pdf` | `polizas/{expedienteId}/...` |
| Recibos de Pago | `POST /api/expedientes/:id/recibo-pago/:numero` | `recibos/{expedienteId}/...` |
| Comprobantes de Pago | `POST /api/expedientes/:id/comprobante` | `comprobantes/{expedienteId}/...` |
| Cotizaciones PDF | `POST /api/expedientes/:id/cotizacion` | `cotizaciones/{expedienteId}/...` |

---

## 🔍 Estado Actual del DELETE

El frontend hace:
```javascript
// Solo borra el registro en la BD, NO toca S3
const response = await fetch(`${API_URL}/api/expedientes/${id}`, {
  method: 'DELETE'
});
```

El backend (probablemente) hace:
```sql
-- Solo borra de la BD
DELETE FROM expedientes WHERE id = ?;
-- Los recibos se borran por CASCADE, pero los archivos S3 quedan huérfanos
```

**Ningún archivo S3 se elimina.**

---

## ✅ Solución Requerida

### Opción A: Limpiar S3 en el endpoint DELETE del backend (RECOMENDADA)

Modificar `DELETE /api/expedientes/:id` para que **antes de borrar el registro**, elimine todos los archivos S3 asociados:

```javascript
// En el handler de DELETE /api/expedientes/:id
router.delete('/api/expedientes/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Obtener info del expediente antes de borrar
    const expediente = await db.query('SELECT * FROM expedientes WHERE id = ?', [id]);
    if (!expediente.length) return res.status(404).json({ error: 'No encontrado' });
    
    // 2. Obtener recibos asociados (para sus archivos S3)
    const recibos = await db.query('SELECT * FROM recibos_pago WHERE expediente_id = ?', [id]);
    
    // 3. Eliminar archivos de S3
    const s3 = new AWS.S3();
    const bucket = 'prosistema-polizas';
    
    // 3a. Eliminar PDF de póliza
    if (expediente[0].pdf_url) {
      const key = extraerKeyDeURL(expediente[0].pdf_url);
      await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    }
    
    // 3b. Eliminar comprobantes y recibos de pago
    for (const recibo of recibos) {
      if (recibo.comprobante_url) {
        const key = extraerKeyDeURL(recibo.comprobante_url);
        await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
      }
      if (recibo.recibo_pago_url) {
        const key = extraerKeyDeURL(recibo.recibo_pago_url);
        await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
      }
    }
    
    // 3c. Eliminar cotizaciones
    const cotizaciones = await db.query('SELECT * FROM documentos_expediente WHERE expediente_id = ? AND tipo = "cotizacion"', [id]);
    for (const cot of cotizaciones) {
      if (cot.url) {
        const key = extraerKeyDeURL(cot.url);
        await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
      }
    }
    
    // 3d. Otra opción más limpia: borrar todo el "folder" del expediente en S3
    // await borrarCarpetaS3(bucket, `polizas/${id}/`);
    // await borrarCarpetaS3(bucket, `recibos/${id}/`);
    // await borrarCarpetaS3(bucket, `comprobantes/${id}/`);
    
    // 4. Ahora sí, borrar de la BD (CASCADE borra recibos)
    await db.query('DELETE FROM expedientes WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Expediente y archivos eliminados' });
  } catch (error) {
    console.error('Error al eliminar expediente:', error);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});
```

### Función helper para borrar carpeta S3 completa:

```javascript
async function borrarCarpetaS3(bucket, prefix) {
  const s3 = new AWS.S3();
  
  // Listar todos los objetos con ese prefijo
  const listParams = { Bucket: bucket, Prefix: prefix };
  const listedObjects = await s3.listObjectsV2(listParams).promise();
  
  if (listedObjects.Contents.length === 0) return;
  
  // Borrar todos los objetos encontrados
  const deleteParams = {
    Bucket: bucket,
    Delete: {
      Objects: listedObjects.Contents.map(({ Key }) => ({ Key }))
    }
  };
  
  await s3.deleteObjects(deleteParams).promise();
  console.log(`🗑️ Eliminados ${listedObjects.Contents.length} archivos de S3: ${prefix}`);
}
```

---

## 🧹 Limpieza de archivos huérfanos existentes

Para limpiar archivos S3 que ya están huérfanos (de expedientes eliminados anteriormente):

```sql
-- Ver todos los expedientes que se han eliminado pero pueden tener archivos en S3
-- (Si tienes soft-delete o logs de eliminación)

-- Opción: Listar todos los prefijos en S3 y cruzar con expedientes existentes
-- Esto se haría con un script que:
-- 1. Liste todos los folders en s3://prosistema-polizas/polizas/
-- 2. Verifique cuáles IDs ya no existen en la tabla expedientes
-- 3. Elimine esos folders
```

---

## 🧪 Cómo Verificar

1. Subir un PDF a un expediente de prueba
2. Verificar que existe en S3
3. Eliminar el expediente
4. Verificar que el archivo ya **NO** existe en S3
