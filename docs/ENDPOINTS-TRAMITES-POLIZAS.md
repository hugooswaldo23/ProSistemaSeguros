# 📑 Especificación de Endpoints - Módulo Trámites

Fecha: 12 Nov 2025  
Estado Frontend: 100% funcional (usa fetch directa)  
Estado Backend: Falta formalizar endpoints y validar columnas

## 🎯 Objetivo
Definir claramente los endpoints, payloads y columnas requeridas para el módulo de Trámites, evitando inconsistencias (ej. uso de `fecha_creacion` inexistente vs `created_at`).

## 🧱 Tabla `tramites` (propuesta mínima)
```sql
CREATE TABLE tramites (
	id INT AUTO_INCREMENT PRIMARY KEY,
	codigo VARCHAR(20) NOT NULL UNIQUE,
	tipo_tramite VARCHAR(100) NOT NULL,
	descripcion TEXT NOT NULL,
	cliente VARCHAR(100) NULL,          -- Código o ID externo del cliente
	expediente VARCHAR(100) NULL,       -- Número de póliza o ID del expediente
	estatus VARCHAR(30) NOT NULL DEFAULT 'Pendiente', -- Pendiente | En proceso | Completado | Cancelado | Rechazado
	prioridad VARCHAR(20) NOT NULL DEFAULT 'Media',   -- Alta | Media | Baja
	fecha_inicio DATE NOT NULL,
	fecha_limite DATE NULL,
	responsable VARCHAR(150) NULL,
	departamento VARCHAR(150) NULL,
	observaciones TEXT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	INDEX idx_tramites_estatus (estatus),
	INDEX idx_tramites_prioridad (prioridad),
	INDEX idx_tramites_fecha_inicio (fecha_inicio),
	INDEX idx_tramites_fecha_limite (fecha_limite)
);
```

### Notas
- NO crear columna `fecha_creacion`: se usa `created_at` ya existente. El frontend debe dejar de enviar `fecha_creacion` (ya se ajustó).
- `codigo` se genera secuencialmente en frontend (TR001, TR002...). Puede duplicarse si dos usuarios guardan simultáneo → opcional endpoint para reservar código.

## 🔄 Mapeo Frontend → Backend
| Frontend key          | Backend columna     | Observaciones |
|-----------------------|---------------------|---------------|
| codigo                | codigo              | Generado en FE si no existe |
| tipoTramite           | tipo_tramite        | FE envía ambas: `tipo_tramite` y `tipoTramite` (compatibilidad) |
| descripcion           | descripcion         | Texto libre |
| cliente               | cliente             | Código/ID del cliente; puede ser NULL |
| expediente            | expediente          | Número póliza o ID; puede ser NULL |
| estatus               | estatus             | Ciclo de vida del trámite |
| prioridad             | prioridad           | Alta/Media/Baja |
| fechaInicio           | fecha_inicio        | Obligatoria (DATE) |
| fechaLimite           | fecha_limite        | Permite nulo |
| responsable           | responsable         | Ejecutiva/o asignado |
| departamento          | departamento        | Texto corto |
| observaciones         | observaciones       | Texto libre |
| fechaCreacion (FE)    | created_at          | Solo lectura; eliminar del POST/PUT |

## 🚀 Endpoints

### 1. GET `/api/tramites`
Retorna todos los trámites ordenados por `created_at` desc.
```jsonc
[
	{
		"id": 12,
		"codigo": "TR012",
		"tipo_tramite": "Endoso",
		"descripcion": "Cambiar uso de vehículo",
		"cliente": "CLI-00001",
		"expediente": "0971452556",
		"estatus": "Pendiente",
		"prioridad": "Alta",
		"fecha_inicio": "2025-11-12",
		"fecha_limite": "2025-11-20",
		"responsable": "Erika Olivares",
		"departamento": "Operaciones",
		"observaciones": "Urgente por renovación",
		"created_at": "2025-11-12T15:03:22.000Z"
	}
]
```

### 2. POST `/api/tramites`
Body esperado (sin `fecha_creacion`):
```jsonc
{
	"codigo": "TR013",        // Opcional: si se omite, backend podría generar
	"tipo_tramite": "Reembolso",
	"descripcion": "Reembolso gastos grúa",
	"cliente": "CLI-00002",
	"expediente": "0971451980",
	"estatus": "Pendiente",
	"prioridad": "Media",
	"fecha_inicio": "2025-11-12",
	"fecha_limite": "2025-11-25",
	"responsable": "Juan Pérez",
	"departamento": "Siniestros",
	"observaciones": "Folio externo SIN-5566"
}
```
Respuesta:
```jsonc
{
	"success": true,
	"data": { "id": 13, "codigo": "TR013" }
}
```

### 3. PUT `/api/tramites/:id`
Campos actualizables (todos menos id/created_at). Ejemplo:
```jsonc
{
	"tipo_tramite": "Reembolso",
	"descripcion": "Reembolso gastos grúa y corralón",
	"estatus": "En proceso",
	"prioridad": "Alta",
	"fecha_inicio": "2025-11-12",
	"fecha_limite": "2025-11-27",
	"responsable": "Juan Pérez",
	"departamento": "Siniestros",
	"observaciones": "Se solicitó factura adicional"
}
```

### 4. DELETE `/api/tramites/:id`
Elimina registro. Respuesta mínima:
```json
{ "success": true }
```

### 5. GET `/api/tramites/:id`
Retorna un trámite específico (mismo formato que listado).

### 6. GET `/api/tramites?estatus=Pendiente`
Filtro por estatus (usar WHERE estatus = ?).

### 7. GET `/api/tramites?vencidos=1`
Regresa trámites con `fecha_limite < CURDATE()` y `estatus NOT IN ('Completado','Cancelado')`.

### 8. GET `/api/tramites?prioridad=Alta`
Filtro por prioridad.

## 🔐 Validaciones recomendadas backend
- Rechazar códigos duplicados (UNIQUE).
- Limitar longitud de `descripcion` si se requiere (p.e. TEXT normal está bien hasta 64KB).
- Validar que `fecha_inicio <= fecha_limite` (cuando existe).
- Normalizar `estatus` y `prioridad` contra listas permitidas.

## ⚠️ Diferencias detectadas y ya corregidas en FE
| Tema | Situación previa | Corrección |
|------|------------------|-----------|
| Campo fecha_creacion | Se enviaba en POST | Eliminado, usar created_at automático |
| Doble keys tipo_tramite/tipoTramite | Frontend enviaba ambas | Backend puede ignorar la camelCase si desea |
| Generación de código | Sólo FE | Opcionalmente backend puede validar/crear secuencia |

## 🧪 Consultas de verificación
```sql
-- Últimos 10 trámites
SELECT id, codigo, tipo_tramite, estatus, prioridad, fecha_inicio, fecha_limite, created_at
FROM tramites ORDER BY created_at DESC LIMIT 10;

-- Vencidos hoy
SELECT codigo, descripcion, fecha_limite FROM tramites 
WHERE fecha_limite < CURDATE() AND estatus NOT IN ('Completado','Cancelado');

-- Por prioridad
SELECT prioridad, COUNT(*) FROM tramites GROUP BY prioridad;
```

## ✅ Checklist implementación backend
- [ ] Confirmar estructura real de tabla `tramites`
- [ ] Ajustar INSERT y UPDATE para recibir sólo columnas definidas
- [ ] Añadir índices (estatus, prioridad, fechas)
- [ ] Implementar filtros por query params (estatus, prioridad, vencidos)
- [ ] Probar creación simultánea (código único)
- [ ] Retornar `created_at` en todas las respuestas

## 📌 Próximas mejoras (opcional)
- Audit log (tabla `tramites_historial` con cambios de estatus / prioridad).
- Campo `origen` (manual, automático, derivado de siniestro). 
- Integración con notificaciones (al pasar a "Vencido" o "Completado").

---
Documento generado para alinear con tareas de `PENDIENTES-HUGO-BACKEND.md`.

