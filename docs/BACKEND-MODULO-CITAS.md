# Módulo de Citas / Agenda - Requerimientos Backend

**Fecha:** 2026-02-16  
**Prioridad:** Alta  
**Frontend:** Ya implementado con fallback a localStorage

---

## 1. Tabla SQL `citas`

```sql
CREATE TABLE IF NOT EXISTS citas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  tipo ENUM('presencial', 'web', 'llamada') NOT NULL DEFAULT 'presencial',
  fecha DATE NOT NULL,
  hora_inicio VARCHAR(5) NOT NULL DEFAULT '09:00',
  hora_fin VARCHAR(5) NOT NULL DEFAULT '10:00',
  cliente VARCHAR(255) DEFAULT NULL,
  ubicacion TEXT DEFAULT NULL,
  notas TEXT DEFAULT NULL,
  estatus ENUM('pendiente', 'atendida', 'reagendada') NOT NULL DEFAULT 'pendiente',
  asignado_a VARCHAR(255) DEFAULT NULL,
  asignado_a_id INT DEFAULT NULL,
  historial JSON DEFAULT NULL,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fecha (fecha),
  INDEX idx_estatus (estatus),
  INDEX idx_asignado (asignado_a_id),
  INDEX idx_fecha_estatus (fecha, estatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2. Endpoints REST (4)

Base: `/api/citas`

### GET `/api/citas`
Listar todas las citas.

**Query params opcionales (futuro):**
- `fecha_desde` — filtrar desde fecha
- `fecha_hasta` — filtrar hasta fecha
- `estatus` — filtrar por estatus
- `asignado_a_id` — filtrar por responsable

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "titulo": "Revisión póliza GMM",
    "tipo": "presencial",
    "fecha": "2026-02-17",
    "hora_inicio": "09:00",
    "hora_fin": "10:00",
    "cliente": "Juan Pérez",
    "ubicacion": "Oficina centro",
    "notas": "",
    "estatus": "pendiente",
    "asignado_a": "María López",
    "asignado_a_id": 5,
    "historial": [],
    "fecha_creacion": "2026-02-16T10:00:00.000Z",
    "fecha_modificacion": "2026-02-16T10:00:00.000Z"
  }
]
```

---

### POST `/api/citas`
Crear nueva cita.

**Body:**
```json
{
  "titulo": "Revisión póliza GMM",
  "tipo": "presencial",
  "fecha": "2026-02-17",
  "hora_inicio": "09:00",
  "hora_fin": "10:00",
  "cliente": "Juan Pérez",
  "ubicacion": "Oficina centro",
  "notas": "",
  "estatus": "pendiente",
  "asignado_a": "María López",
  "asignado_a_id": 5,
  "historial": []
}
```

**Response:** `201 Created` — devuelve el objeto creado con `id` asignado.

---

### PUT `/api/citas/:id`
Actualizar cita existente (editar, reagendar, marcar atendida).

**Body:** Objeto completo de la cita con los campos actualizados.  
**Nota importante:** El campo `historial` es un JSON array que el frontend envía completo (append-only). El backend solo debe guardarlo tal cual.

**Response:** `200 OK` — devuelve el objeto actualizado.

---

### DELETE `/api/citas/:id`
Eliminar una cita.

**Response:** `200 OK`
```json
{ "message": "Cita eliminada correctamente" }
```

---

## 3. Estructura del campo `historial` (JSON)

Es un array de objetos. Cada entrada se agrega cuando se reagenda o se marca como atendida.

```json
[
  {
    "accion": "reagendada",
    "fecha_anterior": "2026-02-15",
    "hora_anterior": "09:00 - 10:00",
    "fecha_nueva": "2026-02-20",
    "hora_nueva": "14:00 - 15:00",
    "comentario": "Cliente pidió cambio por viaje",
    "fecha_accion": "2026-02-16T08:30:00.000Z"
  },
  {
    "accion": "atendida",
    "comentario": "Se revisó póliza y se firmó renovación",
    "fecha_accion": "2026-02-20T15:00:00.000Z"
  }
]
```

---

## 4. Notas técnicas

- El frontend ya hace las llamadas a estos endpoints y cae automáticamente a localStorage si no responden. En cuanto existan, funciona sin cambios en front.
- El servicio está en `src/services/citasService.js`.
- Los tipos son fijos: `presencial`, `web`, `llamada`.
- Los estatus son fijos: `pendiente`, `atendida`, `reagendada`.
- `asignado_a_id` puede ser FK a la tabla `equipo_de_trabajo` pero no es obligatorio.
- El campo `historial` se maneja como JSON — el frontend envía el array completo, el backend solo lo almacena.

---

## 5. Prioridad de implementación

1. **Crear tabla** `citas`
2. **GET** `/api/citas` — para que se carguen las citas reales
3. **POST** `/api/citas` — para crear nuevas
4. **PUT** `/api/citas/:id` — para editar/reagendar/atendida
5. **DELETE** `/api/citas/:id` — para eliminar
