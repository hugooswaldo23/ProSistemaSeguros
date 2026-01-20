# Backend: Columnas Faltantes en Tabla Trámites

## Error Actual

```
Error al crear trámite: {"error":"Unknown column 'ejecutivo_asignado' in 'field list'"}
```

## Solución

La tabla `tramites` necesita tener las siguientes columnas que el frontend está enviando:

### Columnas Requeridas

```sql
ALTER TABLE tramites 
ADD COLUMN ejecutivo_asignado VARCHAR(100) NULL COMMENT 'Nombre del ejecutivo asignado al trámite';
```

### Estructura Completa Esperada

El frontend envía estos campos al crear/actualizar un trámite:

| Campo | Tipo Sugerido | Descripción |
|-------|---------------|-------------|
| `codigo` | VARCHAR(50) | Código único del trámite (ej: TRA-00001) |
| `tipo_tramite` | VARCHAR(100) | Tipo de trámite |
| `descripcion` | TEXT | Descripción del trámite |
| `estatus` | VARCHAR(50) | Estado: Pendiente, En Proceso, Completado, Cancelado |
| `prioridad` | VARCHAR(20) | Alta, Media, Baja |
| `fecha_inicio` | DATE | Fecha de inicio del trámite |
| `fecha_limite` | DATE | Fecha límite del trámite |
| `ejecutivo_asignado` | VARCHAR(100) | **FALTANTE** - Ejecutivo responsable |
| `cliente` | VARCHAR(100) | Código o ID del cliente relacionado |
| `expediente` | VARCHAR(100) | Número de expediente relacionado |
| `observaciones` | TEXT | Observaciones adicionales |

### SQL Completo (si la tabla no existe)

```sql
CREATE TABLE IF NOT EXISTS tramites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  tipo_tramite VARCHAR(100) NOT NULL,
  descripcion TEXT,
  estatus VARCHAR(50) DEFAULT 'Pendiente',
  prioridad VARCHAR(20) DEFAULT 'Media',
  fecha_inicio DATE,
  fecha_limite DATE,
  ejecutivo_asignado VARCHAR(100),
  cliente VARCHAR(100),
  expediente VARCHAR(100),
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tramites_codigo (codigo),
  INDEX idx_tramites_estatus (estatus),
  INDEX idx_tramites_ejecutivo (ejecutivo_asignado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Prioridad

🔴 **CRÍTICO** - Sin esta columna no se pueden crear trámites.
