# 📋 INSTRUCCIONES PARA EL EQUIPO DE IT

**Fecha:** 20 de Octubre de 2025  
**Solicitante:** Álvaro González  
**Prioridad:** Media  
**Tiempo estimado:** 5-10 minutos

---

## 🎯 OBJETIVO

Agregar dos campos a la tabla `clientes` en la base de datos del Sistema de Seguros para mejorar la funcionalidad del módulo de clientes.

---

## 📝 CAMBIOS REQUERIDOS

### **Tabla afectada:** `clientes`

### **Campos a agregar:**

1. **`codigo`** (VARCHAR 20, UNIQUE)
   - Propósito: Código visual del cliente (ej: CL001, CL002)
   - Ubicación: Después del campo `id`
   - Único: Sí

2. **`categoria_id`** (INT, NULL)
   - Propósito: Relación con la tabla de categorías de clientes
   - Ubicación: Después del campo `codigo`
   - Foreign Key: Sí → `categorias_clientes(id)`

---

## 🔧 PASOS A EJECUTAR

### **Opción A: Ejecutar el script completo** ⭐ RECOMENDADO

1. Abrir phpMyAdmin o MySQL Workbench
2. Seleccionar la base de datos del sistema de seguros
3. Ir a la pestaña "SQL"
4. Copiar y pegar el contenido del archivo: `scripts/agregar_campos_clientes.sql`
5. Ejecutar
6. Verificar que no haya errores

**Archivo:** `ProSistemaSeguros/scripts/agregar_campos_clientes.sql`

---

### **Opción B: Ejecutar comandos uno por uno**

Si prefieren más control, ejecutar estos comandos en orden:

```sql
-- 1. Agregar columna codigo
ALTER TABLE clientes 
ADD COLUMN codigo VARCHAR(20) UNIQUE AFTER id;

-- 2. Agregar columna categoria_id
ALTER TABLE clientes 
ADD COLUMN categoria_id INT NULL AFTER codigo;

-- 3. Crear índice para categoria_id
ALTER TABLE clientes 
ADD INDEX idx_categoria_id (categoria_id);

-- 4. Agregar foreign key (verificar antes que exista la tabla categorias_clientes)
ALTER TABLE clientes 
ADD CONSTRAINT fk_clientes_categoria 
FOREIGN KEY (categoria_id) REFERENCES categorias_clientes(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- 5. Actualizar clientes existentes con categoría por defecto (ID 1)
UPDATE clientes 
SET categoria_id = 1 
WHERE categoria_id IS NULL;

-- 6. Generar códigos para clientes existentes
UPDATE clientes 
SET codigo = CONCAT('CL', LPAD(id, 3, '0')) 
WHERE codigo IS NULL;
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### **Antes de ejecutar:**

1. ✅ **Hacer backup de la tabla `clientes`**
   ```sql
   CREATE TABLE clientes_backup AS SELECT * FROM clientes;
   ```

2. ✅ **Verificar que existe la tabla `categorias_clientes`**
   ```sql
   SHOW TABLES LIKE 'categorias_clientes';
   ```
   - Si NO existe, omitir el paso 4 (foreign key)
   - Si existe con otro nombre, ajustar el nombre en el paso 4

3. ✅ **Verificar que hay al menos una categoría con ID 1**
   ```sql
   SELECT * FROM categorias_clientes WHERE id = 1;
   ```
   - Si no existe, cambiar el `1` en el paso 5 por el ID que corresponda

---

## ✅ VERIFICACIÓN POST-EJECUCIÓN

Después de ejecutar, verificar que todo esté correcto:

```sql
-- Ver estructura de la tabla
SHOW COLUMNS FROM clientes;

-- Verificar que se crearon los campos
SELECT id, codigo, categoria_id, nombre, apellidoPaterno 
FROM clientes 
LIMIT 5;

-- Verificar que los códigos se generaron
SELECT COUNT(*) as total_con_codigo 
FROM clientes 
WHERE codigo IS NOT NULL;
```

**Resultado esperado:**
- ✅ Debe aparecer el campo `codigo` (varchar 20)
- ✅ Debe aparecer el campo `categoria_id` (int)
- ✅ Los clientes existentes deben tener códigos generados (CL001, CL002, etc.)
- ✅ Los clientes existentes deben tener categoria_id = 1

---

## 🔄 ROLLBACK (En caso de problemas)

Si algo sale mal, restaurar desde el backup:

```sql
-- Eliminar los campos agregados
ALTER TABLE clientes DROP FOREIGN KEY fk_clientes_categoria;
ALTER TABLE clientes DROP INDEX idx_categoria_id;
ALTER TABLE clientes DROP COLUMN categoria_id;
ALTER TABLE clientes DROP COLUMN codigo;

-- O restaurar desde el backup completo
DROP TABLE clientes;
RENAME TABLE clientes_backup TO clientes;
```

---

## 📞 CONTACTO

**En caso de dudas o problemas:**
- Desarrollador Frontend: GitHub Copilot / Asistente IA
- Archivo de script: `ProSistemaSeguros/scripts/agregar_campos_clientes.sql`
- Documentación adicional: Este archivo

---

## 📊 IMPACTO

**Módulos afectados:**
- ✅ Módulo de Clientes (mejora la visualización y categorización)
- ✅ API de clientes (debe aceptar los nuevos campos)

**Sin impacto negativo:**
- ❌ No afecta registros existentes (se actualizan automáticamente)
- ❌ No rompe funcionalidad actual
- ❌ Cambios son retrocompatibles

---

## ✨ BENEFICIOS

Una vez implementado:
- ✅ Códigos visuales para clientes (CL001, CL002, etc.)
- ✅ Categorización de clientes (Normal, VIP, Premium, etc.)
- ✅ Mejor organización y reportes
- ✅ Integridad referencial en la base de datos

---

**Gracias por su apoyo!** 🚀
