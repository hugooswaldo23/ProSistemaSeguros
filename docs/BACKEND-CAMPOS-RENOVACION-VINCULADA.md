# Backend: Campos para Vinculación de Renovaciones

## Fecha: 19 de Enero 2026
## Prioridad: ALTA

## Descripción

El frontend ahora crea un **NUEVO expediente** cuando se registra una póliza renovada, en lugar de actualizar el mismo expediente. Esto permite mantener el historial completo y la trazabilidad.

## Nuevos Campos Requeridos en tabla `expedientes`

```sql
-- Agregar campos de vinculación de renovaciones
ALTER TABLE expedientes 
ADD COLUMN renovacion_de INT NULL COMMENT 'ID del expediente anterior que esta póliza renueva',
ADD COLUMN renovada_por INT NULL COMMENT 'ID del expediente nuevo que renovó esta póliza';

-- Índices para búsquedas
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

## Flujo de Datos

### Cuando se crea una póliza renovada:

1. **Nuevo Expediente** (la renovación):
   ```json
   {
     "cliente_id": 123,
     "numero_poliza": "0971462991",
     "renovacion_de": 456,  // <-- ID de la póliza anterior
     "etapa_activa": "Emitida",
     "tipo_movimiento": "RENOVACION",
     ...
   }
   ```

2. **Expediente Anterior** (se actualiza):
   ```json
   {
     "id": 456,
     "etapa_activa": "Renovada",
     "renovada_por": 789  // <-- ID de la nueva póliza
   }
   ```

## Endpoints Afectados

### POST /api/expedientes
- Debe aceptar el campo `renovacion_de` (INT, opcional)
- Si viene `renovacion_de`, validar que el expediente exista

### PUT /api/expedientes/:id
- Debe aceptar el campo `renovada_por` (INT, opcional)

### GET /api/expedientes/:id
- Incluir campos `renovacion_de` y `renovada_por` en la respuesta

### GET /api/expedientes (listado)
- Incluir campos en el listado para poder mostrar indicadores visuales

## Consultas Útiles

```sql
-- Ver historial de renovaciones de un cliente
SELECT e.*, 
       anterior.numero_poliza as poliza_anterior,
       siguiente.numero_poliza as poliza_siguiente
FROM expedientes e
LEFT JOIN expedientes anterior ON e.renovacion_de = anterior.id
LEFT JOIN expedientes siguiente ON e.renovada_por = siguiente.id
WHERE e.cliente_id = ?
ORDER BY e.inicio_vigencia;

-- Ver cadena completa de renovaciones de una póliza
WITH RECURSIVE cadena_renovaciones AS (
  SELECT *, 1 as nivel FROM expedientes WHERE id = ?
  UNION ALL
  SELECT e.*, cr.nivel + 1 
  FROM expedientes e
  JOIN cadena_renovaciones cr ON e.renovacion_de = cr.id
)
SELECT * FROM cadena_renovaciones ORDER BY nivel;
```

## Notas

- Si los campos no existen en la BD, el frontend enviará los datos pero serán ignorados
- El flujo funciona aunque no se guarden estos campos, pero se pierde la vinculación
- Priorizar la implementación para tener trazabilidad completa
