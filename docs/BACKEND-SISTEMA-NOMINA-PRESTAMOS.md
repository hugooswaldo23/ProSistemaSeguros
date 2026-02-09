# Backend: Sistema de Nómina y Préstamos

## Fecha: 2 de febrero de 2026

## Descripción General

Se requiere implementar un sistema completo de nómina que incluya:
1. Generación de nómina quincenal/mensual
2. Cálculo de comisiones (sin duplicar pagos)
3. Control de préstamos a empleados
4. Historial de nóminas generadas

---

## Nuevas Tablas Requeridas

### 1. `nominas` - Registro de nóminas generadas

```sql
CREATE TABLE nominas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,  -- Ej: NOM-2026-02-Q1
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo_periodo ENUM('Quincenal', 'Mensual') DEFAULT 'Quincenal',
  total_sueldos DECIMAL(12,2) DEFAULT 0,
  total_comisiones DECIMAL(12,2) DEFAULT 0,
  total_descuentos DECIMAL(12,2) DEFAULT 0,
  total_prestamos_otorgados DECIMAL(12,2) DEFAULT 0,
  total_prestamos_cobrados DECIMAL(12,2) DEFAULT 0,
  total_neto DECIMAL(12,2) DEFAULT 0,
  estatus ENUM('Borrador', 'Cerrada', 'Pagada') DEFAULT 'Borrador',
  creado_por INT,  -- usuario_id que generó
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por) REFERENCES equipo_trabajo(id)
);
```

### 2. `nomina_detalles` - Detalle por empleado en cada nómina

```sql
CREATE TABLE nomina_detalles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nomina_id INT NOT NULL,
  empleado_id INT NOT NULL,  -- equipo_trabajo.id
  
  -- Ingresos
  sueldo DECIMAL(12,2) DEFAULT 0,
  comisiones DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) GENERATED ALWAYS AS (sueldo + comisiones) STORED,
  
  -- Descuentos
  descuentos DECIMAL(12,2) DEFAULT 0,
  motivo_descuento VARCHAR(255),
  
  -- Préstamos
  saldo_prestamo_anterior DECIMAL(12,2) DEFAULT 0,
  prestamo_nuevo DECIMAL(12,2) DEFAULT 0,
  cobro_prestamo DECIMAL(12,2) DEFAULT 0,
  saldo_prestamo_actual DECIMAL(12,2) DEFAULT 0,
  
  -- Total a pagar
  total_pagar DECIMAL(12,2) GENERATED ALWAYS AS (sueldo + comisiones - descuentos - cobro_prestamo) STORED,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (nomina_id) REFERENCES nominas(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES equipo_trabajo(id)
);
```

### 3. `prestamos` - Control de préstamos activos

```sql
CREATE TABLE prestamos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL,
  monto_original DECIMAL(12,2) NOT NULL,
  saldo_pendiente DECIMAL(12,2) NOT NULL,
  fecha_prestamo DATE NOT NULL,
  fecha_liquidacion DATE,  -- NULL si no está liquidado
  motivo VARCHAR(255),
  estatus ENUM('Activo', 'Liquidado', 'Cancelado') DEFAULT 'Activo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empleado_id) REFERENCES equipo_trabajo(id)
);
```

### 4. `movimientos_prestamo` - Historial de movimientos de préstamos

```sql
CREATE TABLE movimientos_prestamo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prestamo_id INT NOT NULL,
  nomina_id INT,  -- NULL si es préstamo inicial
  tipo ENUM('Prestamo', 'Cobro', 'Ajuste') NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  saldo_anterior DECIMAL(12,2),
  saldo_nuevo DECIMAL(12,2),
  observaciones VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (prestamo_id) REFERENCES prestamos(id),
  FOREIGN KEY (nomina_id) REFERENCES nominas(id)
);
```

### 5. `comisiones_pagadas` - Para evitar duplicar pagos de comisiones

```sql
CREATE TABLE comisiones_pagadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expediente_id VARCHAR(36) NOT NULL,  -- expedientes.id (UUID)
  recibo_id INT,  -- recibos_pago.id (si aplica por recibo)
  empleado_id INT NOT NULL,  -- equipo_trabajo.id
  nomina_id INT NOT NULL,
  monto_comision DECIMAL(12,2) NOT NULL,
  porcentaje_aplicado DECIMAL(5,2),
  es_comision_compartida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empleado_id) REFERENCES equipo_trabajo(id),
  FOREIGN KEY (nomina_id) REFERENCES nominas(id),
  
  -- Índice único para evitar duplicados
  UNIQUE KEY unique_comision (expediente_id, recibo_id, empleado_id)
);
```

---

## Endpoints Requeridos

### Nóminas

#### `GET /api/nominas`
Lista todas las nóminas generadas (historial)

**Response:**
```json
[
  {
    "id": 1,
    "codigo": "NOM-2026-02-Q1",
    "fecha_inicio": "2026-02-01",
    "fecha_fin": "2026-02-15",
    "tipo_periodo": "Quincenal",
    "total_sueldos": 45000,
    "total_comisiones": 12500,
    "total_descuentos": 1200,
    "total_neto": 56300,
    "estatus": "Pagada",
    "created_at": "2026-02-15T10:30:00Z"
  }
]
```

#### `GET /api/nominas/:id`
Obtiene el detalle de una nómina específica con todos sus empleados

#### `POST /api/nominas/generar`
Genera/guarda una nueva nómina (borrador)

**Request (enviado desde el frontend):**
```json
{
  "fecha_inicio": "2026-02-01",
  "fecha_fin": "2026-02-15",
  "tipo_periodo": "Quincenal",
  "detalles": [
    {
      "empleado_id": 1,
      "sueldo": 7500,
      "comisiones": 2250.50,
      "descuentos": 0,
      "motivo_descuento": "",
      "prestamo_nuevo": 0,
      "cobro_prestamo": 500,
      "detalle_comisiones": [
        {
          "expediente_id": "abc-123-uuid",
          "recibo_id": 45,
          "monto_comision": 2250.50,
          "porcentaje_aplicado": 15,
          "es_comision_compartida": false
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "id": 1,
  "codigo": "NOM-2026-02-Q1"
}
```

**NOTA:** El frontend ya envía todos los datos calculados. El backend solo debe:
1. Generar el código único (NOM-YYYY-MM-Q1 o Q2)
2. Guardar en tabla `nominas`
3. Guardar cada empleado en `nomina_detalles`
4. Retornar el ID y código generado

#### `PUT /api/nominas/:id`
Actualiza una nómina en borrador (ajustar descuentos, préstamos, etc.)

**Request:**
```json
{
  "detalles": [
    {
      "empleado_id": 1,
      "descuentos": 500,
      "motivo_descuento": "2 faltas",
      "prestamo_nuevo": 0,
      "cobro_prestamo": 1000
    }
  ]
}
```

#### `POST /api/nominas/:id/cerrar`
Cierra la nómina (ya no se puede editar) y marca las comisiones como pagadas.

**Acciones en backend:**
1. Cambiar estatus de nómina a "Cerrada"
2. Registrar en `comisiones_pagadas` todas las comisiones incluidas (usando `detalle_comisiones` enviados en el POST inicial)
3. Actualizar saldos de préstamos (`cobro_prestamo` resta del saldo, `prestamo_nuevo` crea nuevo préstamo)

#### `POST /api/nominas/:id/pagar`
Marca la nómina como pagada (estatus = "Pagada")

---

### Préstamos

#### `GET /api/prestamos`
Lista todos los préstamos (con filtro por empleado_id y estatus)

**Response:**
```json
[
  {
    "id": 1,
    "empleado_id": 5,
    "monto_original": 5000,
    "saldo_pendiente": 3000,
    "fecha_prestamo": "2026-01-15",
    "motivo": "Préstamo personal",
    "estatus": "Activo"
  }
]
```

#### `GET /api/prestamos/empleado/:empleado_id`
Obtiene préstamos activos de un empleado específico

#### `POST /api/prestamos`
Crea un nuevo préstamo

**Request:**
```json
{
  "empleado_id": 1,
  "monto": 5000,
  "motivo": "Préstamo personal"
}
```

---

### Comisiones Pendientes (OPCIONAL)

Este endpoint es opcional ya que el frontend calcula las comisiones localmente.

#### `GET /api/comisiones/pendientes`
Obtiene las comisiones de pólizas pagadas que aún no han sido incluidas en nómina

**Query params:**
- `fecha_inicio` (required)
- `fecha_fin` (required)
- `agente_id` (optional)

**Response:**
```json
[
  {
    "expediente_id": "abc123",
    "numero_poliza": "12345",
    "cliente_nombre": "Juan Pérez",
    "aseguradora": "Qualitas",
    "producto": "Autos Individual",
    "prima_total": 15000,
    "fecha_pago": "2026-02-05",
    "agente_id": 1,
    "agente_nombre": "Alvaro González",
    "porcentaje_comision": 15,
    "monto_comision": 2250,
    "vendedores": [
      {
        "vendedor_id": 5,
        "vendedor_nombre": "María López",
        "porcentaje": 30,
        "monto": 675
      }
    ]
  }
]
```

---

## Lógica de Cálculo de Comisiones

### Para Agentes:
1. Buscar pólizas donde `agente_id = empleado_id`
2. Filtrar solo pólizas con recibos pagados en el rango de fechas
3. Excluir pólizas/recibos que ya están en `comisiones_pagadas`
4. Calcular: `prima_neta * (porcentaje_comision / 100)`

### Para Vendedores (comisión compartida):
1. Buscar en `equipo_trabajo.comisionesCompartidas` las asignaciones
2. La comisión del vendedor sale de la comisión del agente
3. Mostrar en la nómina del **agente** el total de la comisión
4. Mostrar en la nómina del **vendedor** su porcentaje compartido
5. Evitar que la suma de agente + vendedor sea mayor al total de la comisión

---

## Flujo de Generación de Nómina (Frontend → Backend)

1. Usuario selecciona rango de fechas y da clic en "Generar"
2. Backend calcula sueldos y comisiones pendientes de cada empleado
3. Se muestra tabla editable con todos los empleados
4. Usuario puede ajustar: descuentos, préstamos nuevos, cobros de préstamos
5. Usuario da clic en "Cerrar Nómina"
6. Backend:
   - Registra en `comisiones_pagadas` las comisiones incluidas
   - Actualiza saldos de préstamos
   - Cambia estatus a "Cerrada"
7. Usuario puede marcar como "Pagada" cuando se deposite

---

## Notas Importantes

1. **Comisiones solo de pólizas pagadas**: Usar la tabla `recibos_pago` para verificar qué recibos están pagados
2. **Evitar duplicados**: Siempre verificar en `comisiones_pagadas` antes de incluir
3. **Vendedores cobran vía agente**: El dinero sale de la comisión del agente
4. **Préstamos**: Actualizar saldo en tiempo real al cerrar nómina

---

## NUEVO: Módulo de Corte Diario (Ingresos/Egresos)

### Tabla `movimientos_financieros`

```sql
CREATE TABLE movimientos_financieros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('ingreso', 'egreso') NOT NULL,
  categoria ENUM('comisiones_cobradas', 'otros_ingresos', 'nomina', 'gastos_fijos', 'gastos_administrativos', 'consumibles') NOT NULL,
  fecha DATE NOT NULL,
  concepto VARCHAR(255) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  referencia VARCHAR(100),  -- No. factura, recibo, etc.
  observaciones TEXT,
  es_automatico BOOLEAN DEFAULT FALSE,  -- TRUE si fue generado al cerrar nómina
  nomina_id INT,  -- Referencia a nómina si es automático
  created_by INT,  -- usuario que registró
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (nomina_id) REFERENCES nominas(id),
  INDEX idx_fecha (fecha),
  INDEX idx_tipo (tipo),
  INDEX idx_categoria (categoria)
);
```

### Endpoints Corte Diario

#### `GET /api/corte-diario`
Lista movimientos financieros filtrados por rango de fechas.

**Query params:**
- `fecha_desde` (required) - Fecha inicio YYYY-MM-DD
- `fecha_hasta` (required) - Fecha fin YYYY-MM-DD
- `tipo` (optional) - 'ingreso' | 'egreso'
- `categoria` (optional)

**Response:**
```json
[
  {
    "id": 1,
    "tipo": "egreso",
    "categoria": "gastos_fijos",
    "fecha": "2026-02-05",
    "concepto": "Pago de renta oficina febrero",
    "monto": 8500.00,
    "referencia": "FAC-2026-045",
    "observaciones": "",
    "es_automatico": false,
    "created_at": "2026-02-05T10:30:00Z"
  }
]
```

#### `POST /api/corte-diario`
Crea un nuevo movimiento financiero.

**Request:**
```json
{
  "tipo": "egreso",
  "categoria": "gastos_fijos",
  "fecha": "2026-02-05",
  "concepto": "Pago de luz CFE",
  "monto": 1850.50,
  "referencia": "CFE-12345",
  "observaciones": "Recibo bimestral"
}
```

#### `PUT /api/corte-diario/:id`
Actualiza un movimiento existente (solo los NO automáticos).

#### `DELETE /api/corte-diario/:id`
Elimina un movimiento (solo los NO automáticos).

### Integración con Nómina

Al cerrar una nómina (`POST /api/nominas/:id/cerrar`), se debe **crear automáticamente** un movimiento de egreso:

```sql
INSERT INTO movimientos_financieros (tipo, categoria, fecha, concepto, monto, referencia, es_automatico, nomina_id)
VALUES ('egreso', 'nomina', CURDATE(), 'Pago de nómina NOM-2026-02-Q1', 34034.34, 'NOM-2026-02-Q1', TRUE, 1);
```

### Categorías

**Ingresos:**
| Valor | Descripción |
|---|---|
| `comisiones_cobradas` | Comisiones que la aseguradora paga a la agencia |
| `otros_ingresos` | Cualquier otro ingreso extraordinario |

**Egresos:**
| Valor | Descripción |
|---|---|
| `nomina` | Pago de sueldos y comisiones (automático al cerrar nómina) |
| `gastos_fijos` | Renta, luz, agua, teléfono, internet |
| `gastos_administrativos` | Proveedores, servicios profesionales |
| `consumibles` | Papelería, tóner, café, artículos de limpieza |

---

## Estado - Actualizado 9 Feb 2026

### Frontend ✅ LISTO
- [x] Generación de nómina (cálculo de sueldos y comisiones)
- [x] Modal de detalle de comisiones editable
- [x] Conexión a endpoints (preparada para cuando existan)
- [x] Función `guardarNomina()` → POST /api/nominas/generar
- [x] Función `actualizarNominaEnBD()` → PUT /api/nominas/:id
- [x] Función `cerrarNomina()` → POST /api/nominas/:id/cerrar
- [x] Función `marcarComoPagada()` → POST /api/nominas/:id/pagar
- [x] Carga de préstamos → GET /api/prestamos
- [x] Historial de nóminas → GET /api/nominas
- [x] Corte Diario (ingresos/egresos) → GET/POST/PUT/DELETE /api/corte-diario

### Backend ❌ PENDIENTE (Hugo)
- [ ] Crear tabla `nominas`
- [ ] Crear tabla `nomina_detalles`
- [ ] Crear tabla `prestamos`
- [ ] Crear tabla `movimientos_prestamo`
- [ ] Crear tabla `comisiones_pagadas`
- [ ] Crear tabla `movimientos_financieros` (Corte Diario)
- [ ] `POST /api/nominas/generar` - Guardar nómina
- [ ] `PUT /api/nominas/:id` - Actualizar nómina
- [ ] `POST /api/nominas/:id/cerrar` - Cerrar, registrar comisiones y crear egreso automático
- [ ] `POST /api/nominas/:id/pagar` - Marcar como pagada
- [ ] `GET /api/nominas` - Historial
- [ ] `GET /api/prestamos` - Lista de préstamos
- [ ] `GET /api/corte-diario` - Listar movimientos financieros
- [ ] `POST /api/corte-diario` - Crear movimiento
- [ ] `PUT /api/corte-diario/:id` - Actualizar movimiento
- [ ] `DELETE /api/corte-diario/:id` - Eliminar movimiento
