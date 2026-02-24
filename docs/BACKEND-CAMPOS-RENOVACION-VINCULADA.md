# Backend: Campos para Vinculación de Renovaciones

## Fecha: 24 de Febrero 2026 (actualizado)
## Prioridad: 🔴 CRÍTICA

## Descripción

El frontend crea un **NUEVO expediente** cuando se registra una póliza renovada. Para mantener la trazabilidad completa, se necesitan **3 campos** en la tabla `expedientes`. Actualmente **ninguno se persiste en la BD** — el frontend los envía correctamente pero el backend los ignora.

### ¿Por qué es crítico ahora?

Sin estos campos:
- ❌ Los reportes (Salud de Cartera, Producción) no detectan renovaciones por campo directo → usan fallback por matching de vehículo
- ❌ Al eliminar una renovación, no se puede identificar con certeza cuál era la póliza anterior
- ❌ En la pantalla de clientes, los indicadores de renovación dependen de matching indirecto
- ❌ No hay cadena de renovaciones histórica

## Campos Requeridos en tabla `expedientes`

```sql
-- ⚠️ HACER BACKUP PRIMERO
CREATE TABLE expedientes_backup_renovacion AS SELECT * FROM expedientes;

-- 1. Campo tipo_movimiento (NUEVA, RENOVACION, ENDOSO)
ALTER TABLE expedientes 
ADD COLUMN tipo_movimiento VARCHAR(20) NULL DEFAULT NULL 
COMMENT 'Tipo: NUEVA, RENOVACION, ENDOSO';

-- 2. Campo renovacion_de (ID del expediente anterior)
ALTER TABLE expedientes 
ADD COLUMN renovacion_de INT NULL 
COMMENT 'ID del expediente anterior que esta póliza renueva';

-- 3. Campo renovada_por (ID del expediente nuevo)
ALTER TABLE expedientes 
ADD COLUMN renovada_por INT NULL 
COMMENT 'ID del expediente nuevo que renovó esta póliza';

-- Índices para búsquedas rápidas
CREATE INDEX idx_tipo_movimiento ON expedientes(tipo_movimiento);
CREATE INDEX idx_renovacion_de ON expedientes(renovacion_de);
CREATE INDEX idx_renovada_por ON expedientes(renovada_por);

-- Foreign keys (opcional pero recomendado)
ALTER TABLE expedientes 
ADD CONSTRAINT fk_renovacion_de 
FOREIGN KEY (renovacion_de) REFERENCES expedientes(id) ON DELETE SET NULL;

ALTER TABLE expedientes 
ADD CONSTRAINT fk_renovada_por 
FOREIGN KEY (renovada_por) REFERENCES expedientes(id) ON DELETE SET NULL;
```

## Endpoints que deben aceptar/devolver estos campos

### POST /api/expedientes (crear)
- Aceptar: `tipo_movimiento`, `renovacion_de`
- Ejemplo del JSON que el frontend YA envía:
```json
{
  "tipo_movimiento": "RENOVACION",
  "renovacion_de": 456,
  "numero_poliza": "0971462991",
  "etapa_activa": "Emitida",
  ...
}
```

### PUT /api/expedientes/:id (actualizar)
- Aceptar: `tipo_movimiento`, `renovacion_de`, `renovada_por`
- Ejemplo al marcar póliza anterior como renovada:
```json
{
  "etapa_activa": "Renovada",
  "renovada_por": 789
}
```
- Ejemplo al revertir (cuando se elimina la renovación):
```json
{
  "etapa_activa": "Por Renovar",
  "renovada_por": null
}
```

### GET /api/expedientes y GET /api/expedientes/:id
- Devolver los 3 campos en la respuesta:
```json
{
  "id": 789,
  "tipo_movimiento": "RENOVACION",
  "renovacion_de": 456,
  "renovada_por": null,
  ...
}
```

## Flujo Completo

```
┌─────────────────────┐      renovacion_de: 456        ┌─────────────────────┐
│ Póliza Anterior (456)│ ◄─────────────────────────────  │ Póliza Nueva (789)  │
│ etapa: Renovada      │                                 │ etapa: Emitida      │
│ renovada_por: 789    │ ────────────────────────────► │ tipo_mov: RENOVACION│
└─────────────────────┘      renovada_por: 789          └─────────────────────┘
```

Cuando se elimina la póliza 789:
- Frontend envía PUT a 456: `{ etapa_activa: "Por Renovar", renovada_por: null }`
- Frontend envía DELETE a 789

## Verificación Post-Implementación

```sql
-- Verificar que los campos existen
SHOW COLUMNS FROM expedientes LIKE 'tipo_movimiento';
SHOW COLUMNS FROM expedientes LIKE 'renovacion_de';
SHOW COLUMNS FROM expedientes LIKE 'renovada_por';

-- Insertar un registro de prueba
UPDATE expedientes SET tipo_movimiento = 'NUEVA' WHERE id = 1;
SELECT id, tipo_movimiento, renovacion_de, renovada_por FROM expedientes WHERE id = 1;

-- Verificar que el API los devuelve (probar con curl/Postman)
-- GET https://apiseguros.proordersistem.com.mx/api/expedientes/1
-- Debe incluir tipo_movimiento, renovacion_de, renovada_por en la respuesta
```

## Rollback

```sql
ALTER TABLE expedientes DROP FOREIGN KEY fk_renovacion_de;
ALTER TABLE expedientes DROP FOREIGN KEY fk_renovada_por;
ALTER TABLE expedientes DROP INDEX idx_tipo_movimiento;
ALTER TABLE expedientes DROP INDEX idx_renovacion_de;
ALTER TABLE expedientes DROP INDEX idx_renovada_por;
ALTER TABLE expedientes DROP COLUMN tipo_movimiento;
ALTER TABLE expedientes DROP COLUMN renovacion_de;
ALTER TABLE expedientes DROP COLUMN renovada_por;
```
