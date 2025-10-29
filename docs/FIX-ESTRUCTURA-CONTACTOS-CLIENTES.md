# 🔧 FIX: Estructura Correcta de Contactos para Clientes

## 📋 Problema Identificado

El sistema NO diferenciaba correctamente entre:
- **Persona Física**: Datos del cliente vs datos del gestor/contacto
- **Persona Moral**: Datos de la empresa vs datos del contacto (persona con quien hablas)

Esto causaba que:
1. Al guardar una póliza de Persona Moral, se mostraba el nombre del contacto en el listado en lugar de la razón social
2. No había forma de registrar un gestor/contacto para Persona Física

## ✅ Solución Implementada

### 1. Cambios en Base de Datos

**Script creado:** `scripts/agregar_campos_contacto_gestor.sql`

Se agregaron nuevos campos a la tabla `clientes` para Persona Física:
- `contacto_nombre`
- `contacto_apellido_paterno`
- `contacto_apellido_materno`
- `contacto_email`
- `contacto_telefono_fijo`
- `contacto_telefono_movil`
- `contacto_puesto`

**⚠️ IMPORTANTE: Debes ejecutar manualmente este script en tu base de datos**

```sql
-- Comando para ejecutar:
mysql -u root -p prosistema_seguros < scripts/agregar_campos_contacto_gestor.sql
```

### 2. Lógica de Datos por Tipo de Persona

#### 🧑 PERSONA FÍSICA

**Datos del Cliente (campos principales):**
- `nombre`, `apellido_paterno`, `apellido_materno`
- `rfc`, `curp`, `fecha_nacimiento`
- `email`, `telefono_fijo`, `telefono_movil`

**Datos del Gestor/Contacto (campos nuevos - opcional):**
- `contacto_nombre`, `contacto_apellido_paterno`, `contacto_apellido_materno`
- `contacto_email`, `contacto_telefono_fijo`, `contacto_telefono_movil`
- `contacto_puesto`

**Ejemplo:**
- Cliente: **Álvaro González** (datos principales)
- Gestor: **Estefanía Esteban** (campos contacto_*)
- *Estefanía es quien gestiona las pólizas de Álvaro*

---

#### 🏢 PERSONA MORAL

**Datos de la Empresa:**
- `razon_social` (COCA-COLA FEMSA S.A. DE C.V.)
- `nombre_comercial` (Coca-Cola)
- `rfc`

**Datos del Contacto (la persona con quien hablas):**
- `nombre`, `apellido_paterno`, `apellido_materno`
- `email`, `telefono_fijo`, `telefono_movil`

**Ejemplo:**
- Empresa: **CORRUGADOS Y SUMINISTROS DEL NORTE S.A. DE C.V.**
- Contacto: **Pato Sánchez** (campos nombre/apellidos)
- *No puedes hablar con Coca-Cola, hablas con Pato Sánchez*

**❌ Los campos `contacto_*` NO SE USAN para Persona Moral**

### 3. Cambios en Código

#### A. Actualización de Clientes al Guardar Póliza

**Archivo:** `src/screens/Expedientes.jsx`
**Función:** `guardarExpediente` (línea ~4748)

Ahora distingue correctamente:

```javascript
if (clienteSeleccionado.tipoPersona === 'Persona Moral') {
  // Actualiza nombre/apellidos (son DEL CONTACTO)
  datosActualizados = {
    nombre: formulario.nombre,
    apellido_paterno: formulario.apellido_paterno,
    apellido_materno: formulario.apellido_materno,
    email: formulario.email,
    telefono_fijo: formulario.telefono_fijo,
    telefono_movil: formulario.telefono_movil
  };
} else {
  // Persona Física: actualiza contacto_* (GESTOR)
  datosActualizados = {
    contacto_nombre: formulario.nombre,
    contacto_apellido_paterno: formulario.apellido_paterno,
    contacto_apellido_materno: formulario.apellido_materno,
    contacto_email: formulario.email,
    contacto_telefono_fijo: formulario.telefono_fijo,
    contacto_telefono_movil: formulario.telefono_movil
  };
}
```

#### B. Visualización en Listado de Pólizas

**Archivo:** `src/screens/Expedientes.jsx`
**Componente:** `InfoCliente` (línea ~139)

Ahora muestra correctamente:

```javascript
// Detecta Persona Moral por razon_social (no por apellidos vacíos)
const esPersonaMoral = expediente.razon_social && expediente.razon_social.trim() !== '';

// Persona Moral: Muestra RAZÓN SOCIAL
{esPersonaMoral ? (
  <div>
    <div>{expediente.razon_social}</div>
    {expediente.nombre_comercial && <small>({expediente.nombre_comercial})</small>}
    {expediente.nombre && (
      <div>👤 Contacto: {expediente.nombre} {expediente.apellido_paterno}</div>
    )}
  </div>
) : (
  // Persona Física: Muestra nombre del cliente
  <>{expediente.nombre} {expediente.apellido_paterno} {expediente.apellido_materno}</>
)}
```

## 🧪 Pruebas Requeridas

### Test 1: Persona Moral - Crear Nueva Póliza

1. Extraer PDF con datos de Persona Moral
2. Verificar que se crea/encuentra cliente correctamente
3. Aplicar datos al formulario
4. Capturar manualmente datos de contacto (nombre, email, teléfonos)
5. Guardar póliza
6. **Verificar en listado:** Debe mostrar RAZÓN SOCIAL, no nombre del contacto
7. **Verificar en BD:** Campos `nombre`, `apellido_paterno`, `email`, `telefono_movil` del cliente deben estar actualizados

### Test 2: Persona Física con Gestor

1. Crear/seleccionar cliente Persona Física
2. En formulario de póliza, capturar datos del gestor en campos de contacto
3. Guardar póliza
4. **Verificar en BD:** Campos `contacto_*` del cliente deben estar actualizados
5. **Verificar:** Los campos principales del cliente NO deben cambiar

### Test 3: Editar Cliente en Catálogo

1. Editar un cliente (cambiar email, teléfono, etc.)
2. **Verificar:** El listado de pólizas NO debe cambiar (usa datos denormalizados)

## 📊 Resumen de Campos

| Tipo | Empresa/Cliente | Contacto/Gestor |
|------|----------------|-----------------|
| **Persona Física** | `nombre`, `apellido_paterno`, `apellido_materno`, `email`, `telefono_*` | `contacto_nombre`, `contacto_apellido_paterno`, `contacto_email`, `contacto_telefono_*` |
| **Persona Moral** | `razon_social`, `nombre_comercial`, `rfc` | `nombre`, `apellido_paterno`, `apellido_materno`, `email`, `telefono_*` |

## ⚠️ Acción Requerida

1. **Ejecutar script SQL:**
   ```bash
   mysql -u root -p prosistema_seguros < scripts/agregar_campos_contacto_gestor.sql
   ```

2. **Verificar que el backend soporte los nuevos campos `contacto_*`** en el endpoint `PUT /api/clientes/:id`

3. **Probar el flujo completo** con ambos tipos de persona

---

**Fecha:** 29 de octubre de 2025
**Archivos modificados:**
- `scripts/agregar_campos_contacto_gestor.sql` (nuevo)
- `src/screens/Expedientes.jsx` (líneas ~139 y ~4748)
- `docs/FIX-ESTRUCTURA-CONTACTOS-CLIENTES.md` (este archivo)
