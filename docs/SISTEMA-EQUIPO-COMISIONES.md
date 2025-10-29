# Sistema de Equipo de Trabajo y Comisiones

## 📋 CONTEXTO COMPLETO

Este documento especifica la lógica completa del equipo de trabajo y el sistema de comisiones para una agencia de seguros.

---

## 👥 ROLES DEL SISTEMA

### 1️⃣ **Administrador (Promotor)**
- **Permisos**: Ve TODO el sistema
- **Función**: Propietario/administrador de la agencia
- **Puede**: 
  - Gestionar usuarios
  - Ver todas las pólizas
  - Ver/administrar todas las comisiones
  - Pagar comisiones a vendedores (opcional)

### 2️⃣ **Ejecutivo**
- **Permisos**: Ve pólizas de sus agentes/vendedores asignados
- **Función**: Supervisor de equipo
- **Puede**:
  - Atender agentes y vendedores
  - Capturar pólizas en ayuda de agentes sin acceso al sistema
  - Ver reportes de su equipo
  - Generar cotizaciones para sus agentes

### 3️⃣ **Agente**
- **Permisos**: Ve SOLO sus propias pólizas
- **Función**: Vende pólizas y administra su cartera
- **Características CLAVE**:
  - ✅ **Múltiples claves**: Tiene una clave DIFERENTE por cada aseguradora
  - ✅ **Productos específicos**: No puede vender TODOS los productos de TODAS las aseguradoras
  - ✅ **Cobra directo**: Las comisiones las cobra directamente con la aseguradora
  - ✅ **Paga a vendedores**: Puede pagar comisión a sus vendedores (opcional)
  - ✅ **Puede tener vendedores**: Trabajan bajo su clave

**Ejemplo Real:**
```
Agente: Juan Pérez
├─ Qualitas: Clave AG-12345
│  ├─ Productos permitidos: Auto Tradicional, Auto Premium
│  └─ Comisión: 15% (configurable por producto)
├─ ANA Seguros: Clave ANAAG-999
│  ├─ Productos permitidos: Auto Tradicional, GMM
│  └─ Comisión: 12% (configurable por producto)
└─ GNP: Clave GNP-AG-777
   ├─ Productos permitidos: Vida Individual
   └─ Comisión: 20%
```

### 4️⃣ **Vendedor**
- **Permisos**: Ve SOLO sus propias ventas
- **Función**: Vende bajo la clave de un agente
- **Características CLAVE**:
  - ❌ **NO tiene clave propia**: Usa la clave del agente
  - ✅ **Comisión compartida**: El agente le comparte un % de su comisión
  - ✅ **Pago flexible**: Puede cobrar del agente O del promotor

**Ejemplo Real:**
```
Vendedor: María López
├─ Trabaja para: Agente Juan Pérez
├─ Usa clave: AG-12345 (de Juan) en Qualitas
├─ Comisión: 40% de la comisión del agente
└─ Paga: Juan Pérez (el agente) 
         O el Promotor (administrador del sistema)
```

---

## 🗂️ ESTRUCTURA DE BASE DE DATOS

### **Tabla: `equipo_trabajo`** (ya existe)
```sql
CREATE TABLE equipo_trabajo (
  id INT PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(20) UNIQUE,              -- Ej: "AG-001", "VEN-001", "EJE-001"
  nombre VARCHAR(100),
  apellido_paterno VARCHAR(100),
  apellido_materno VARCHAR(100),
  email VARCHAR(100),
  telefono VARCHAR(20),
  perfil ENUM('Administrador', 'Ejecutivo', 'Agente', 'Vendedor'),
  activo BOOLEAN DEFAULT TRUE,
  fecha_ingreso DATE,
  
  -- Compensación
  esquema_compensacion ENUM('sueldo', 'comision', 'mixto'),
  sueldo_diario DECIMAL(10,2),
  tipo_pago ENUM('Semanal', 'Quincenal', 'Mensual'),
  
  -- Usuario del sistema
  usuario VARCHAR(50) UNIQUE,
  contrasena VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **Tabla: `claves_agente_aseguradora`** ⭐ NUEVA
**Propósito**: Un agente tiene múltiples claves (una por aseguradora)

```sql
CREATE TABLE claves_agente_aseguradora (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agente_id INT NOT NULL,                          -- FK a equipo_trabajo
  aseguradora_id INT NOT NULL,                     -- FK a aseguradoras
  clave_aseguradora VARCHAR(50) NOT NULL,          -- Ej: "AG-12345", "ANAAG-999"
  activo BOOLEAN DEFAULT TRUE,
  fecha_asignacion DATE,
  
  FOREIGN KEY (agente_id) REFERENCES equipo_trabajo(id) ON DELETE CASCADE,
  FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras(id) ON DELETE CASCADE,
  UNIQUE KEY unique_agente_aseguradora (agente_id, aseguradora_id)
);
```

**Ejemplo de datos:**
```sql
INSERT INTO claves_agente_aseguradora VALUES
(1, 5, 1, 'AG-12345', TRUE, '2024-01-15'),    -- Agente Juan → Qualitas
(2, 5, 2, 'ANAAG-999', TRUE, '2024-01-15'),   -- Agente Juan → ANA Seguros
(3, 5, 3, 'GNP-AG-777', TRUE, '2024-02-01');  -- Agente Juan → GNP
```

### **Tabla: `productos_agente`** (ya existe como `ejecutivos_por_producto`)
**Propósito**: Qué productos puede vender cada agente/vendedor por aseguradora

```sql
-- RENOMBRAR de ejecutivos_por_producto → productos_agente
-- O EXTENDER la tabla actual
ALTER TABLE ejecutivos_por_producto ADD COLUMN clave_aseguradora VARCHAR(50);
ALTER TABLE ejecutivos_por_producto ADD COLUMN comision_agente DECIMAL(5,2);
ALTER TABLE ejecutivos_por_producto ADD COLUMN comision_vendedor_porcentaje DECIMAL(5,2);
```

**Estructura ideal:**
```sql
CREATE TABLE productos_agente (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT NOT NULL,                         -- FK a equipo_trabajo (Agente o Vendedor)
  aseguradora_id INT NOT NULL,                     -- FK a aseguradoras
  producto_id INT NOT NULL,                        -- FK a tipos_productos
  clave_aseguradora VARCHAR(50),                   -- Clave que usa para esta aseguradora
  comision_base DECIMAL(5,2),                      -- Comisión base del producto (ej: 15%)
  comision_personalizada DECIMAL(5,2),             -- Comisión específica para este agente
  ejecutivo_id INT,                                -- FK a equipo_trabajo (Ejecutivo supervisor)
  activo BOOLEAN DEFAULT TRUE,
  
  FOREIGN KEY (usuario_id) REFERENCES equipo_trabajo(id) ON DELETE CASCADE,
  FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES tipos_productos(id) ON DELETE CASCADE,
  FOREIGN KEY (ejecutivo_id) REFERENCES equipo_trabajo(id) ON DELETE SET NULL,
  UNIQUE KEY unique_usuario_producto (usuario_id, producto_id)
);
```

### **Tabla: `comisiones`** ⭐ NUEVA - CRÍTICA
**Propósito**: Registro de comisiones por cobrar → cobradas

```sql
CREATE TABLE comisiones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  expediente_id INT NOT NULL,                      -- FK a expedientes
  poliza_numero VARCHAR(50),                       -- Número de póliza
  
  -- Identificación
  aseguradora_id INT NOT NULL,
  producto_id INT NOT NULL,
  agente_id INT NOT NULL,                          -- Quien vendió (principal)
  vendedor_id INT,                                 -- Si fue un vendedor (opcional)
  
  -- Montos
  prima_total DECIMAL(10,2),                       -- Monto total de la póliza
  porcentaje_comision DECIMAL(5,2),                -- % que aplica (ej: 15%)
  monto_comision DECIMAL(10,2),                    -- Monto a cobrar (prima * %)
  
  -- Desglose (si hay vendedor)
  porcentaje_vendedor DECIMAL(5,2),                -- % del vendedor (ej: 40% de la comisión)
  monto_vendedor DECIMAL(10,2),                    -- Cuánto le toca al vendedor
  monto_agente DECIMAL(10,2),                      -- Cuánto se queda el agente
  
  -- Control de pago
  estatus ENUM('Por Cobrar', 'Cobrada', 'Cancelada') DEFAULT 'Por Cobrar',
  fecha_vencimiento DATE,                          -- Cuando se debe cobrar
  fecha_cobro DATE,                                -- Cuando SÍ se cobró
  
  -- Quién paga al vendedor
  vendedor_pagado_por ENUM('Agente', 'Promotor'),  -- Quien le paga al vendedor
  vendedor_pago_estatus ENUM('Pendiente', 'Pagado') DEFAULT 'Pendiente',
  vendedor_fecha_pago DATE,
  
  -- Metadata
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE,
  FOREIGN KEY (aseguradora_id) REFERENCES aseguradoras(id),
  FOREIGN KEY (producto_id) REFERENCES tipos_productos(id),
  FOREIGN KEY (agente_id) REFERENCES equipo_trabajo(id),
  FOREIGN KEY (vendedor_id) REFERENCES equipo_trabajo(id) ON DELETE SET NULL,
  
  INDEX idx_agente (agente_id),
  INDEX idx_vendedor (vendedor_id),
  INDEX idx_estatus (estatus),
  INDEX idx_fecha_vencimiento (fecha_vencimiento)
);
```

**Ejemplo de datos:**

**Caso 1: Venta directa del agente (sin vendedor)**
```sql
INSERT INTO comisiones VALUES (
  1,                           -- id
  100,                         -- expediente_id
  'POL-2024-001',             -- poliza_numero
  1,                           -- aseguradora_id (Qualitas)
  5,                           -- producto_id (Auto Tradicional)
  5,                           -- agente_id (Juan Pérez)
  NULL,                        -- vendedor_id (no hay)
  15000.00,                    -- prima_total
  15.00,                       -- porcentaje_comision (15%)
  2250.00,                     -- monto_comision (15000 * 15%)
  NULL,                        -- porcentaje_vendedor
  NULL,                        -- monto_vendedor
  2250.00,                     -- monto_agente (todo para él)
  'Por Cobrar',               -- estatus
  '2024-11-15',               -- fecha_vencimiento
  NULL,                        -- fecha_cobro
  NULL,                        -- vendedor_pagado_por
  NULL,                        -- vendedor_pago_estatus
  NULL,                        -- vendedor_fecha_pago
  'Primera póliza del mes'    -- notas
);
```

**Caso 2: Venta del vendedor bajo clave del agente**
```sql
INSERT INTO comisiones VALUES (
  2,                           -- id
  101,                         -- expediente_id
  'POL-2024-002',             -- poliza_numero
  1,                           -- aseguradora_id (Qualitas)
  5,                           -- producto_id (Auto Tradicional)
  5,                           -- agente_id (Juan Pérez - dueño de la clave)
  8,                           -- vendedor_id (María López)
  20000.00,                    -- prima_total
  15.00,                       -- porcentaje_comision (15%)
  3000.00,                     -- monto_comision (20000 * 15%)
  40.00,                       -- porcentaje_vendedor (40% de la comisión)
  1200.00,                     -- monto_vendedor (3000 * 40%)
  1800.00,                     -- monto_agente (3000 - 1200)
  'Por Cobrar',               -- estatus
  '2024-11-20',               -- fecha_vencimiento
  NULL,                        -- fecha_cobro
  'Agente',                    -- vendedor_pagado_por (Juan le paga a María)
  'Pendiente',                 -- vendedor_pago_estatus
  NULL,                        -- vendedor_fecha_pago
  'Venta de María bajo clave de Juan'
);
```

---

## 🔄 FLUJO COMPLETO: Desde la Venta hasta el Pago

### **Paso 1: Creación de Póliza**
Cuando se crea una póliza en `expedientes`:

```javascript
{
  expediente_id: 100,
  numero_poliza: "POL-2024-001",
  cliente_id: "CLI001",
  aseguradora: "Qualitas",
  producto: "Auto Tradicional",
  importe_total: 15000.00,
  
  // CAMPOS CLAVE PARA COMISIONES
  agente_id: "AG-001",           // ⭐ Quien vendió (o bajo cuya clave)
  vendedor_id: "VEN-001",        // ⭐ Si fue un vendedor (NULL si vendió el agente)
  clave_aseguradora: "AG-12345", // ⭐ Clave usada en la aseguradora
  
  etapa_activa: "Emitida",
  estatus_pago: "Pendiente",
  fecha_emision: "2024-10-15",
  fecha_vencimiento_pago: "2024-11-15"
}
```

### **Paso 2: Registro Automático de Comisión**
Trigger o job que crea el registro en `comisiones`:

```sql
-- Trigger AFTER INSERT en expedientes
CREATE TRIGGER crear_comision_auto
AFTER INSERT ON expedientes
FOR EACH ROW
BEGIN
  DECLARE comision_porcentaje DECIMAL(5,2);
  DECLARE comision_monto DECIMAL(10,2);
  DECLARE vendedor_porcentaje DECIMAL(5,2);
  DECLARE vendedor_monto DECIMAL(10,2);
  DECLARE agente_monto DECIMAL(10,2);
  
  -- Obtener % de comisión del producto
  SELECT comision_personalizada INTO comision_porcentaje
  FROM productos_agente
  WHERE usuario_id = NEW.agente_id 
    AND producto_id = (SELECT id FROM tipos_productos WHERE nombre = NEW.producto LIMIT 1)
  LIMIT 1;
  
  -- Calcular monto de comisión
  SET comision_monto = (NEW.importe_total * comision_porcentaje) / 100;
  
  -- Si hay vendedor, calcular su parte
  IF NEW.vendedor_id IS NOT NULL THEN
    -- Obtener % que le toca al vendedor (configurado en productos_agente)
    SELECT comision_vendedor_porcentaje INTO vendedor_porcentaje
    FROM productos_agente
    WHERE usuario_id = NEW.agente_id;
    
    SET vendedor_monto = (comision_monto * vendedor_porcentaje) / 100;
    SET agente_monto = comision_monto - vendedor_monto;
  ELSE
    SET vendedor_monto = 0;
    SET agente_monto = comision_monto;
  END IF;
  
  -- Insertar registro de comisión
  INSERT INTO comisiones (
    expediente_id, poliza_numero, aseguradora_id, producto_id,
    agente_id, vendedor_id, prima_total, porcentaje_comision, monto_comision,
    porcentaje_vendedor, monto_vendedor, monto_agente,
    estatus, fecha_vencimiento
  ) VALUES (
    NEW.expediente_id, NEW.numero_poliza, 
    (SELECT id FROM aseguradoras WHERE nombre = NEW.aseguradora LIMIT 1),
    (SELECT id FROM tipos_productos WHERE nombre = NEW.producto LIMIT 1),
    NEW.agente_id, NEW.vendedor_id, NEW.importe_total,
    comision_porcentaje, comision_monto,
    vendedor_porcentaje, vendedor_monto, agente_monto,
    'Por Cobrar', NEW.fecha_vencimiento_pago
  );
END;
```

### **Paso 3: Cobro de Comisión**
Cuando el agente cobra su comisión de la aseguradora:

```sql
UPDATE comisiones
SET estatus = 'Cobrada',
    fecha_cobro = CURDATE()
WHERE expediente_id = 100;
```

### **Paso 4: Pago al Vendedor**
Cuando se paga la comisión al vendedor:

```sql
UPDATE comisiones
SET vendedor_pago_estatus = 'Pagado',
    vendedor_fecha_pago = CURDATE()
WHERE expediente_id = 100;
```

---

## 📊 REPORTES NECESARIOS

### **1. Comisiones por Cobrar (Por Agente)**
```sql
SELECT 
  a.codigo AS agente_codigo,
  CONCAT(a.nombre, ' ', a.apellido_paterno) AS agente_nombre,
  aseg.nombre AS aseguradora,
  COUNT(*) AS total_polizas,
  SUM(c.monto_agente) AS total_por_cobrar,
  MIN(c.fecha_vencimiento) AS proxima_fecha
FROM comisiones c
JOIN equipo_trabajo a ON c.agente_id = a.id
JOIN aseguradoras aseg ON c.aseguradora_id = aseg.id
WHERE c.estatus = 'Por Cobrar'
  AND c.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
GROUP BY c.agente_id, c.aseguradora_id
ORDER BY proxima_fecha ASC;
```

### **2. Comisiones Pendientes de Pago a Vendedores**
```sql
SELECT 
  v.codigo AS vendedor_codigo,
  CONCAT(v.nombre, ' ', v.apellido_paterno) AS vendedor_nombre,
  a.codigo AS agente_codigo,
  CONCAT(a.nombre, ' ', a.apellido_paterno) AS agente_nombre,
  COUNT(*) AS total_ventas,
  SUM(c.monto_vendedor) AS total_pendiente,
  c.vendedor_pagado_por AS quien_paga
FROM comisiones c
JOIN equipo_trabajo v ON c.vendedor_id = v.id
JOIN equipo_trabajo a ON c.agente_id = a.id
WHERE c.vendedor_pago_estatus = 'Pendiente'
  AND c.estatus = 'Cobrada'  -- Solo si el agente ya cobró
GROUP BY c.vendedor_id, c.agente_id
ORDER BY total_pendiente DESC;
```

### **3. Resumen de Comisiones por Producto**
```sql
SELECT 
  p.nombre AS producto,
  aseg.nombre AS aseguradora,
  COUNT(*) AS total_ventas,
  SUM(c.prima_total) AS volumen_total,
  AVG(c.porcentaje_comision) AS promedio_comision,
  SUM(c.monto_comision) AS comisiones_generadas,
  SUM(CASE WHEN c.estatus = 'Cobrada' THEN c.monto_comision ELSE 0 END) AS cobradas,
  SUM(CASE WHEN c.estatus = 'Por Cobrar' THEN c.monto_comision ELSE 0 END) AS por_cobrar
FROM comisiones c
JOIN tipos_productos p ON c.producto_id = p.id
JOIN aseguradoras aseg ON c.aseguradora_id = aseg.id
WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
GROUP BY c.producto_id, c.aseguradora_id
ORDER BY comisiones_generadas DESC;
```

### **4. Performance de Vendedores**
```sql
SELECT 
  v.codigo,
  CONCAT(v.nombre, ' ', v.apellido_paterno) AS vendedor,
  a.codigo AS agente_responsable,
  COUNT(*) AS total_ventas,
  SUM(c.prima_total) AS volumen_ventas,
  SUM(c.monto_vendedor) AS comisiones_ganadas,
  SUM(CASE WHEN c.vendedor_pago_estatus = 'Pagado' THEN c.monto_vendedor ELSE 0 END) AS pagadas,
  SUM(CASE WHEN c.vendedor_pago_estatus = 'Pendiente' THEN c.monto_vendedor ELSE 0 END) AS pendientes
FROM comisiones c
JOIN equipo_trabajo v ON c.vendedor_id = v.id
JOIN equipo_trabajo a ON c.agente_id = a.id
WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
GROUP BY c.vendedor_id
ORDER BY comisiones_ganadas DESC;
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Backend (Hugo)
- [ ] Agregar campos a `expedientes`:
  - [ ] `agente_id VARCHAR(20)` ⭐
  - [ ] `vendedor_id VARCHAR(20)` ⭐
  - [ ] `clave_aseguradora VARCHAR(50)` ⭐

- [ ] Crear tabla `claves_agente_aseguradora`
- [ ] Extender/renombrar tabla `ejecutivos_por_producto` → `productos_agente`
- [ ] Crear tabla `comisiones` ⭐ CRÍTICA
- [ ] Crear trigger para auto-generar comisiones
- [ ] Endpoints para:
  - [ ] `GET /api/comisiones/por-cobrar/:agente_id`
  - [ ] `GET /api/comisiones/pendientes-vendedor/:vendedor_id`
  - [ ] `PUT /api/comisiones/:id/marcar-cobrada`
  - [ ] `PUT /api/comisiones/:id/pagar-vendedor`

### Frontend (Álvaro)
- [ ] Actualizar formulario de expedientes:
  - [ ] Selector de agente
  - [ ] Selector de vendedor (opcional)
  - [ ] Mostrar clave que se usará
  
- [ ] Pantalla de comisiones:
  - [ ] Vista de comisiones por cobrar
  - [ ] Vista de comisiones pendientes a vendedores
  - [ ] Botón "Marcar como cobrada"
  - [ ] Botón "Registrar pago a vendedor"

---

## 🎯 PRIORIDAD

**CRÍTICO** - Sin este sistema completo:
- ❌ No se puede rastrear comisiones por cobrar
- ❌ No se puede saber cuánto se le debe a cada vendedor
- ❌ No hay control de pagos
- ❌ Reportes financieros incompletos
