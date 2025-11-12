# Captura Dinámica de Contactos Faltantes

**Fecha:** 2025-11-10  
**Módulo:** Expedientes - Compartir Pólizas

---

## 🎯 Problema Resuelto

Cuando un usuario intenta compartir una póliza por **WhatsApp** o **Email** y el cliente **NO tiene** ese dato de contacto registrado, el sistema mostraba un alert simple y detenía el proceso.

Ahora, el sistema muestra un **modal elegante** que permite:
1. ✅ Capturar el dato faltante (email o teléfono) **en ese momento**
2. ✅ Validar el dato en tiempo real
3. ✅ Guardarlo automáticamente en la BD
4. ✅ Actualizar el estado local (clientesMap)
5. ✅ **Continuar automáticamente** con el envío

---

## 📦 Archivos Creados/Modificados

### Nuevos
- `src/components/ModalCapturarContacto.jsx` - Componente modal reutilizable

### Modificados
- `src/screens/Expedientes.jsx`:
  - Import del nuevo modal
  - Estados para controlar el modal
  - Función `handleGuardarContactoFaltante()`
  - Lógica actualizada en `compartirPorWhatsApp()`
  - Lógica actualizada en `compartirPorEmail()`
  - Renderizado del modal

---

## 🔧 Cómo Funciona

### Flujo para WhatsApp:

```
1. Usuario hace clic en "Compartir por WhatsApp"
   ↓
2. Sistema obtiene datos del cliente
   ↓
3. ¿Cliente tiene teléfono móvil?
   ├─ SÍ → Continúa con el envío normal
   └─ NO → Abre modal de captura
       ↓
       Usuario captura teléfono
       ↓
       Validación en tiempo real
       ↓
       Usuario hace clic en "Guardar y Continuar"
       ↓
       Sistema actualiza cliente en BD
       ↓
       Sistema actualiza clientesMap local
       ↓
       Modal se cierra automáticamente
       ↓
       Sistema reintenta el envío (ahora con teléfono)
       ↓
       ✅ Envío exitoso por WhatsApp
```

### Flujo para Email:

```
1. Usuario hace clic en "Compartir por Email"
   ↓
2. Sistema obtiene datos del cliente
   ↓
3. ¿Cliente tiene email?
   ├─ SÍ → Continúa con el envío normal
   └─ NO → Abre modal de captura
       ↓
       Usuario captura email
       ↓
       Validación en tiempo real
       ↓
       Usuario hace clic en "Guardar y Continuar"
       ↓
       Sistema actualiza cliente en BD
       ↓
       Sistema actualiza clientesMap local
       ↓
       Modal se cierra automáticamente
       ↓
       Sistema reintenta el envío (ahora con email)
       ↓
       ✅ Envío exitoso por Email
```

---

## 💡 Características Implementadas

### Validación en Tiempo Real
- **Email**: Valida formato `usuario@dominio.com`
- **Teléfono**: Valida mínimo 10 dígitos numéricos

### Feedback Visual
- ✅ Indicador de validación en curso (spinner)
- ✅ Borde verde cuando el dato es válido
- ✅ Borde rojo y mensaje de error cuando es inválido
- ✅ Botón "Guardar" deshabilitado hasta que el dato sea válido

### Inteligencia de Datos
- **Persona Moral**: Actualiza `contacto_email` / `contacto_telefono_movil`
- **Persona Física**: Actualiza `email` / `telefonoMovil`

### UX Optimizada
- ⚡ Auto-focus en el campo de entrada
- ⌨️ Soporte para tecla Enter (guardar con Enter)
- 🎨 Diseño consistente con Bootstrap 5
- 🔄 Continuación automática del proceso después de guardar

---

## 🧪 Casos de Uso

### Caso 1: Cliente Persona Física sin teléfono móvil
```
1. Usuario intenta compartir por WhatsApp
2. Modal aparece: "El cliente Juan Pérez no tiene teléfono móvil"
3. Usuario captura: 5512345678
4. Sistema actualiza: cliente.telefonoMovil = '5512345678'
5. Sistema envía por WhatsApp automáticamente
```

### Caso 2: Cliente Persona Moral sin email de contacto
```
1. Usuario intenta compartir por Email
2. Modal aparece: "El cliente ACME SA DE CV no tiene email"
3. Usuario captura: contacto@acme.com
4. Sistema actualiza: cliente.contacto_email = 'contacto@acme.com'
5. Sistema envía por Email automáticamente
```

### Caso 3: Usuario cancela la captura
```
1. Usuario intenta compartir
2. Modal aparece
3. Usuario hace clic en "Cancelar"
4. Modal se cierra
5. Proceso de envío se detiene (no se envía nada)
```

---

## 📊 Código Clave

### Actualización del cliente en BD:

```javascript
const response = await fetch(`${API_URL}/api/clientes/${cliente.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // Persona Moral: contacto_email o contacto_telefono_movil
    // Persona Física: email o telefonoMovil
    [campo]: valorCapturado
  })
});
```

### Reintento automático:

```javascript
// Después de guardar exitosamente
setTimeout(() => {
  if (canalEnvio === 'WhatsApp') {
    compartirPorWhatsApp(expedienteEnEspera);
  } else if (canalEnvio === 'Email') {
    compartirPorEmail(expedienteEnEspera);
  }
}, 500);
```

---

## 🎨 Diseño del Modal

- **Tamaño**: Modal centrado, tamaño mediano
- **Header**: Amarillo warning con ícono de alerta
- **Cuerpo**: 
  - Alerta informativa
  - Ícono circular grande (Mail/Phone)
  - Campo de entrada con validación visual
  - Nota informativa sobre el guardado
- **Footer**: Botones "Cancelar" y "Guardar y Continuar"

---

## 🔮 Mejoras Futuras Sugeridas

1. **Historial de cambios**: Registrar en el historial cuando se actualiza un contacto
2. **Múltiples contactos**: Si hay varios contactos, permitir elegir cuál actualizar
3. **Validación por tipo**: Para Persona Moral, poder elegir si actualizar contacto principal o gestor
4. **Pre-llenado inteligente**: Si hay teléfono fijo, sugerirlo para móvil
5. **Verificación de duplicados**: Avisar si el email/teléfono ya existe en otro cliente

---

## ✅ Checklist de Pruebas

- [ ] Crear cliente Persona Física SIN email
- [ ] Intentar compartir por Email → Modal debe aparecer
- [ ] Capturar email válido → Debe guardarse y enviarse
- [ ] Verificar en BD que el email se guardó
- [ ] Intentar compartir nuevamente → Ya NO debe pedir el email

- [ ] Crear cliente Persona Moral SIN teléfono móvil
- [ ] Intentar compartir por WhatsApp → Modal debe aparecer
- [ ] Capturar teléfono válido → Debe guardarse y enviarse
- [ ] Verificar en BD que el teléfono se guardó
- [ ] Intentar compartir nuevamente → Ya NO debe pedir el teléfono

- [ ] Intentar guardar email inválido → Botón debe estar deshabilitado
- [ ] Intentar guardar teléfono con menos de 10 dígitos → Debe mostrar error
- [ ] Hacer clic en "Cancelar" → Modal debe cerrarse sin guardar

---

**Resultado**: Sistema mucho más fluido y profesional. El usuario ya NO tiene que salir del flujo para ir a editar al cliente manualmente. 🚀
