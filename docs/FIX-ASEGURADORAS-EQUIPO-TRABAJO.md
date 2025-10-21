# 🔧 FIX CRÍTICO: Aseguradoras en Equipo de Trabajo

## 🐛 **PROBLEMA IDENTIFICADO**

Cuando un agente/vendedor tiene el mismo producto de diferentes aseguradoras (ej: "Autos Individual" en Qualitasss Y en GNP), al guardar y recargar el usuario, el sistema muestra la aseguradora incorrecta.

**Ejemplo:**
- Guardo: Qualitasss - Autos Individual + GNP - Autos Individual
- Al recargar: Muestra Qualitasss - Autos Individual + Qualitasss - Autos Individual ❌

## 🎯 **CAUSA RAÍZ**

El endpoint `GET /api/equipoDeTrabajo/ejecutivosPorProducto/:usuarioId` NO está devolviendo el campo `aseguradoraId`, solo devuelve:

```json
[
  {
    "productoId": 1,
    "ejecutivoId": 3,
    "comisionPersonalizada": 12,
    "clave": "aaa"
  }
]
```

El frontend intenta adivinar el `aseguradoraId` buscando en qué aseguradora existe ese producto, pero si el producto existe en múltiples aseguradoras, siempre toma la primera.

## ✅ **SOLUCIÓN**

### **1. Agregar campo `aseguradora_id` a la tabla**

Si la tabla `equipo_productos_ejecutivos` (o como se llame) NO tiene el campo `aseguradora_id`, agregarlo:

```sql
ALTER TABLE equipo_productos_ejecutivos 
ADD COLUMN aseguradora_id INT NOT NULL COMMENT 'ID de la aseguradora';

ALTER TABLE equipo_productos_ejecutivos
ADD FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras(id) ON DELETE RESTRICT;

-- Hacer que la combinación sea única
ALTER TABLE equipo_productos_ejecutivos
ADD UNIQUE KEY unique_usuario_producto_aseguradora (usuario_id, producto_id, aseguradora_id);
```

### **2. Modificar endpoint POST para recibir `aseguradoraId`**

**Endpoint:** `POST /api/equipoDeTrabajo/ejecutivosPorProducto`

**Body actual:**
```json
{
  "usuarioId": 10,
  "productoId": 1,
  "ejecutivoId": 3,
  "comisionPersonalizada": 12,
  "clave": "aaa"
}
```

**Body CORREGIDO:**
```json
{
  "usuarioId": 10,
  "productoId": 1,
  "aseguradoraId": 5,     // ✅ AGREGAR ESTE CAMPO
  "ejecutivoId": 3,
  "comisionPersonalizada": 12,
  "clave": "aaa"
}
```

**Query SQL:**
```javascript
const query = `
  INSERT INTO equipo_productos_ejecutivos 
    (usuario_id, producto_id, aseguradora_id, ejecutivo_id, comision_personalizada, clave)
  VALUES (?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    ejecutivo_id = VALUES(ejecutivo_id),
    comision_personalizada = VALUES(comision_personalizada),
    clave = VALUES(clave)
`;

const params = [
  req.body.usuarioId,
  req.body.productoId,
  req.body.aseguradoraId,  // ✅ AGREGAR
  req.body.ejecutivoId,
  req.body.comisionPersonalizada,
  req.body.clave
];
```

### **3. Modificar endpoint GET para devolver `aseguradoraId`**

**Endpoint:** `GET /api/equipoDeTrabajo/ejecutivosPorProducto/:usuarioId`

**Respuesta actual:**
```json
{
  "success": true,
  "data": [
    {
      "productoId": 1,
      "ejecutivoId": 3,
      "comisionPersonalizada": 12,
      "clave": "aaa"
    }
  ]
}
```

**Respuesta CORREGIDA:**
```json
{
  "success": true,
  "data": [
    {
      "productoId": 1,
      "aseguradoraId": 4,        // ✅ AGREGAR ESTE CAMPO
      "ejecutivoId": 3,
      "comisionPersonalizada": 12,
      "clave": "aaa"
    },
    {
      "productoId": 1,
      "aseguradoraId": 5,        // ✅ Mismo producto, diferente aseguradora
      "ejecutivoId": 3,
      "comisionPersonalizada": 45,
      "clave": "nnnn"
    }
  ]
}
```

**Query SQL:**
```javascript
const query = `
  SELECT 
    producto_id as productoId,
    aseguradora_id as aseguradoraId,   -- ✅ AGREGAR
    ejecutivo_id as ejecutivoId,
    comision_personalizada as comisionPersonalizada,
    clave
  FROM equipo_productos_ejecutivos
  WHERE usuario_id = ?
`;
```

## 📊 **ESTRUCTURA DE TABLA RECOMENDADA**

```sql
CREATE TABLE IF NOT EXISTS equipo_productos_ejecutivos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL COMMENT 'FK al agente/vendedor',
  producto_id INT NOT NULL COMMENT 'FK al tipo de producto',
  aseguradora_id INT NOT NULL COMMENT 'FK a la aseguradora',
  ejecutivo_id INT NULL COMMENT 'FK al ejecutivo supervisor',
  comision_personalizada DECIMAL(5,2) DEFAULT 0 COMMENT 'Comisión custom del agente',
  clave VARCHAR(50) COMMENT 'Clave personalizada agente-aseguradora-producto',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES equipo_trabajo(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES tipos_productos(id) ON DELETE RESTRICT,
  FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras(id) ON DELETE RESTRICT,
  FOREIGN KEY (ejecutivo_id) REFERENCES equipo_trabajo(id) ON DELETE SET NULL,
  
  UNIQUE KEY unique_usuario_producto_aseg (usuario_id, producto_id, aseguradora_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 🧪 **TESTING**

### **Caso de prueba:**
1. Crear agente "Fernando" (AG003)
2. Asignar:
   - Qualitasss (AS004) → Autos Individual (PROD_001) → Ejecutivo: Erika
   - GNP (AS005) → Autos Individual (PROD_001) → Ejecutivo: Alberto
3. Guardar usuario
4. Refrescar página
5. Editar usuario AG003
6. **Verificar:** Debe mostrar ambas aseguradoras correctamente

### **Verificación en BD:**
```sql
SELECT 
  et.codigo as agente_codigo,
  a.nombre as aseguradora,
  tp.nombre as producto,
  eje.codigo as ejecutivo_codigo,
  epe.comision_personalizada,
  epe.clave
FROM equipo_productos_ejecutivos epe
JOIN equipo_trabajo et ON epe.usuario_id = et.id
JOIN aseguradoras a ON epe.aseguradora_id = a.id
JOIN tipos_productos tp ON epe.producto_id = tp.id
LEFT JOIN equipo_trabajo eje ON epe.ejecutivo_id = eje.id
WHERE et.codigo = 'AG003';
```

**Resultado esperado:**
```
agente_codigo | aseguradora | producto        | ejecutivo_codigo | comision | clave
AG003         | Qualitasss  | Autos Individual | AG001           | 0.00     | aaa
AG003         | GNP         | Autos Individual | AG001           | 0.00     | NULL
```

## 🚀 **CAMBIOS EN FRONTEND (YA APLICADOS)**

✅ Los siguientes archivos ya fueron modificados en el frontend:
- `src/screens/EquipoDeTrabajo.jsx`

Ahora todos los endpoints envían `aseguradoraId` correctamente. Solo falta que el backend:
1. Guarde el campo
2. Lo devuelva en las consultas

---

## ⚠️ **PRIORIDAD: ALTA**

Este bug afecta la integridad de los datos del sistema. Sin esto, no se puede implementar correctamente el módulo de Trámites que depende de saber qué ejecutivo supervisa cada combinación agente-producto-aseguradora.

---

**Fecha:** 20 de Octubre 2025  
**Reportado por:** Copilot  
**Estado:** Pendiente implementación backend
