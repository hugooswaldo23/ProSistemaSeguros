# 🚀 Endpoints Necesarios para Módulo de Trámites

## 📋 **CONTEXTO**

Se implementó el selector de clientes y pólizas en el formulario de Trámites. El usuario ahora puede:
1. Seleccionar un cliente de un dropdown
2. Ver automáticamente las pólizas vigentes de ese cliente
3. Seleccionar la póliza específica para el trámite

## 🎯 **ENDPOINTS A IMPLEMENTAR**

### **1. Obtener Pólizas Vigentes de un Cliente**

**Endpoint:** `GET /api/expedientes/vigentes/:clienteId`

**Descripción:** Devuelve todas las pólizas activas y vigentes de un cliente específico.

**Parámetros URL:**
- `clienteId` (int): ID del cliente

**Criterios de Filtrado:**
1. `cliente_id = :clienteId` (debe coincidir con el cliente)
2. `etapa_activa IN ('Emitida', 'Autorizado')` (solo pólizas activas)
3. `termino_vigencia > CURDATE()` (vigencia no vencida)

**Query SQL Sugerido:**
```sql
SELECT 
  e.id,
  e.codigo,
  e.numero_poliza,
  e.cliente_id,
  e.compania,
  e.producto,
  e.etapa_activa,
  e.inicio_vigencia,
  e.termino_vigencia,
  e.prima_pagada,
  e.agente,
  e.agente_id,
  e.aseguradora_id,
  e.producto_id,
  e.marca,
  e.modelo,
  e.anio,
  e.placas,
  e.numero_serie,
  e.total
FROM expedientes e
WHERE e.cliente_id = ?
  AND e.etapa_activa IN ('Emitida', 'Autorizado')
  AND (e.termino_vigencia IS NULL OR e.termino_vigencia > CURDATE())
ORDER BY e.inicio_vigencia DESC;
```

**Respuesta Esperada:**
```json
[
  {
    "id": 15,
    "codigo": "EXP-2025-0015",
    "numero_poliza": "POL-12345",
    "cliente_id": 3,
    "compania": "Qualitasss",
    "producto": "Autos Individual",
    "etapa_activa": "Emitida",
    "inicio_vigencia": "2025-01-15",
    "termino_vigencia": "2026-01-15",
    "prima_pagada": "12500.00",
    "agente": "AG001",
    "agente_id": 5,
    "aseguradora_id": 4,
    "producto_id": 1,
    "marca": "Toyota",
    "modelo": "Corolla",
    "anio": "2023",
    "placas": "ABC-123-XYZ",
    "numero_serie": "JT2BG22K8X0123456",
    "total": "13500.00"
  },
  {
    "id": 28,
    "codigo": "EXP-2025-0028",
    "numero_poliza": "POL-67890",
    "cliente_id": 3,
    "compania": "GNP",
    "producto": "Vida",
    "etapa_activa": "Emitida",
    "inicio_vigencia": "2024-06-01",
    "termino_vigencia": "2025-06-01",
    "prima_pagada": "8500.00",
    "agente": "AG002",
    "agente_id": 7,
    "aseguradora_id": 5,
    "producto_id": 3,
    "marca": null,
    "modelo": null,
    "anio": null,
    "placas": null,
    "numero_serie": null,
    "total": "9200.00"
  }
]
```

**Casos Especiales:**
- Si no hay pólizas vigentes: `[]` (array vacío)
- Si el cliente no existe: `[]` (array vacío)
- Si hay error: 
  ```json
  {
    "error": "Error al consultar pólizas",
    "message": "Descripción del error"
  }
  ```

---

### **2. Modificar Tabla `tramites` (Campos Relacionales)**

**Script SQL:**
```sql
-- Agregar campos relacionales a la tabla tramites
ALTER TABLE tramites 
  ADD COLUMN cliente_id INT COMMENT 'FK al cliente',
  ADD COLUMN poliza_id INT COMMENT 'FK al expediente/póliza',
  ADD COLUMN aseguradora_id INT COMMENT 'ID de la aseguradora',
  ADD COLUMN producto_id INT COMMENT 'ID del tipo de producto',
  ADD COLUMN agente_id INT COMMENT 'ID del agente asignado',
  ADD COLUMN ejecutivo_id INT COMMENT 'ID del ejecutivo supervisor';

-- Agregar foreign keys
ALTER TABLE tramites
  ADD FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY (poliza_id) REFERENCES expedientes(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY (producto_id) REFERENCES tipos_productos(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY (agente_id) REFERENCES equipo_trabajo(id) ON DELETE RESTRICT,
  ADD FOREIGN KEY (ejecutivo_id) REFERENCES equipo_trabajo(id) ON DELETE SET NULL;

-- Crear índices
CREATE INDEX idx_tramites_cliente ON tramites(cliente_id);
CREATE INDEX idx_tramites_poliza ON tramites(poliza_id);
CREATE INDEX idx_tramites_agente ON tramites(agente_id);
CREATE INDEX idx_tramites_ejecutivo ON tramites(ejecutivo_id);
```

---

### **3. Modificar Endpoint POST de Trámites**

**Endpoint:** `POST /api/tramites`

**Body Actualizado:**
```json
{
  "codigo": "TR001",
  "tipoTramite": "Renovación",
  "descripcion": "Renovación de póliza de auto",
  "clienteId": 3,
  "cliente": "Juan Pérez López",
  "polizaId": 15,
  "expediente": "POL-12345",
  "aseguradoraId": 4,
  "productoId": 1,
  "agenteId": 5,
  "ejecutivoId": 2,
  "estatus": "Pendiente",
  "prioridad": "Alta",
  "fechaInicio": "2025-10-20",
  "fechaLimite": "2025-10-30",
  "responsable": "Ejecutivo Principal",
  "departamento": "Renovaciones",
  "observaciones": "Cliente solicitó cotización para renovación anticipada"
}
```

**Query SQL Actualizado:**
```javascript
const query = `
  INSERT INTO tramites (
    codigo, tipo_tramite, descripcion, 
    cliente_id, cliente, 
    poliza_id, expediente,
    aseguradora_id, producto_id, agente_id, ejecutivo_id,
    estatus, prioridad, 
    fecha_inicio, fecha_limite, 
    responsable, departamento, observaciones
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const params = [
  req.body.codigo,
  req.body.tipoTramite,
  req.body.descripcion,
  req.body.clienteId,
  req.body.cliente,
  req.body.polizaId,
  req.body.expediente,
  req.body.aseguradoraId,
  req.body.productoId,
  req.body.agenteId,
  req.body.ejecutivoId,
  req.body.estatus,
  req.body.prioridad,
  req.body.fechaInicio,
  req.body.fechaLimite,
  req.body.responsable,
  req.body.departamento,
  req.body.observaciones
];
```

---

### **4. Modificar Endpoint PUT de Trámites**

**Endpoint:** `PUT /api/tramites/:id`

Incluir los mismos campos nuevos en el UPDATE.

---

### **5. Modificar Endpoint GET de Trámites**

**Endpoint:** `GET /api/tramites`

**Query SQL Mejorado con JOINs:**
```sql
SELECT 
  t.*,
  c.nombre as cliente_nombre,
  c.codigo as cliente_codigo,
  e.numero_poliza,
  a.nombre as aseguradora_nombre,
  tp.nombre as producto_nombre,
  ag.codigo as agente_codigo,
  ag.nombre as agente_nombre,
  ej.codigo as ejecutivo_codigo,
  ej.nombre as ejecutivo_nombre
FROM tramites t
LEFT JOIN clientes c ON t.cliente_id = c.id
LEFT JOIN expedientes e ON t.poliza_id = e.id
LEFT JOIN aseguradoras a ON t.aseguradora_id = a.id
LEFT JOIN tipos_productos tp ON t.producto_id = tp.id
LEFT JOIN equipo_trabajo ag ON t.agente_id = ag.id
LEFT JOIN equipo_trabajo ej ON t.ejecutivo_id = ej.id
ORDER BY t.created_at DESC;
```

---

## 🧪 **TESTING**

### **Caso de Prueba 1: Cliente con Pólizas Vigentes**

1. Seleccionar cliente "Juan Pérez"
2. Verificar que aparezcan sus 2 pólizas vigentes:
   - Qualitasss - Autos Individual
   - GNP - Vida
3. Seleccionar póliza de Autos
4. Verificar que se llenen automáticamente:
   - `polizaId`: 15
   - `expediente`: "POL-12345"
   - `aseguradoraId`: 4
   - `productoId`: 1
   - `agenteId`: 5

### **Caso de Prueba 2: Cliente sin Pólizas**

1. Seleccionar cliente nuevo sin pólizas
2. Verificar mensaje: "Este cliente no tiene pólizas vigentes"

### **Caso de Prueba 3: Guardar Trámite**

1. Crear trámite completo con cliente y póliza
2. Guardar
3. Verificar en BD que se guardaron todos los campos relacionales
4. Consultar `SELECT * FROM tramites WHERE id = ?`

---

## 📊 **PRIORIDAD**

**ALTA** - Este cambio es fundamental para el flujo completo:
1. Cliente → Póliza → Trámite → Ejecutivo asignado

Sin esto, no se puede determinar automáticamente qué ejecutivo debe atender el trámite.

---

## 🔄 **ESTADO ACTUAL DEL FRONTEND**

✅ **YA IMPLEMENTADO:**
- Selector de clientes con búsqueda
- Carga dinámica de pólizas al seleccionar cliente
- Vista de tarjetas con información completa de cada póliza
- Selección de póliza con radio buttons
- Auto-llenado de campos al seleccionar póliza
- Loading states y mensajes de error
- Integración con formulario de trámites

⏳ **ESPERANDO BACKEND:**
- Endpoint `/api/expedientes/vigentes/:clienteId`
- Campos nuevos en tabla `tramites`
- Endpoints POST/PUT actualizados

---

**Fecha:** 20 de Octubre 2025  
**Implementado por:** Copilot  
**Estado:** Frontend completo, esperando backend
