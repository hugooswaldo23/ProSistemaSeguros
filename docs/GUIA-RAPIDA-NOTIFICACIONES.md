# 🎯 Guía Rápida - Cómo Usar el Sistema de Notificaciones

## 📋 Checklist para Hugo (Backend)

### 1. Ejecutar Script SQL
```bash
# En tu servidor MySQL/MariaDB
mysql -u usuario -p nombre_base_datos < scripts/crear_tabla_notificaciones.sql
```

### 2. Implementar Endpoints
Ver detalles completos en: `docs/SISTEMA-NOTIFICACIONES-BACKEND.md`

**Endpoints requeridos:**
- `POST /api/notificaciones` - Registrar notificación
- `GET /api/notificaciones/expediente/:expedienteId` - Obtener por expediente
- `GET /api/notificaciones/cliente/:clienteId` - Obtener por cliente

### 3. Probar Endpoints
```bash
# Test 1: Crear notificación
curl -X POST http://localhost:3000/api/notificaciones \
  -H "Content-Type: application/json" \
  -d '{
    "expediente_id": 142,
    "cliente_id": "CLI-00001",
    "tipo_notificacion": "whatsapp",
    "tipo_mensaje": "emision",
    "destinatario_nombre": "Juan Pérez",
    "destinatario_contacto": "5551234567",
    "mensaje": "Test",
    "numero_poliza": "POL-12345",
    "estado_envio": "enviado"
  }'

# Test 2: Obtener notificaciones
curl http://localhost:3000/api/notificaciones/expediente/142
```

---

## 🎨 Cómo se Ve para el Usuario Final

### Escenario: Enviar Recordatorio de Pago

1. **Abrir póliza con pago próximo a vencer**
   - Usuario ve en la lista: póliza con badge "Por Vencer"
   - Hace clic para ver detalles

2. **Hacer clic en botón "Compartir"**
   - Se abre modal con opciones: WhatsApp o Email
   - Usuario selecciona WhatsApp

3. **Sistema genera mensaje automáticamente**
   ```
   ⏰ Recordatorio de pago • POL-12345
   
   Estimado cliente,
   Te recordamos que tu pago está próximo a vencer:
   
   🏢 Aseguradora: GNP
   📦 Producto: Autos
   🚗 Vehículo: Porsche Cayenne 2024
   📆 Fecha de pago: 01/Dic/2025  ⏳ Vence en 5 día(s)
   💵 Prima: $45,000.00
   
   💡 Por favor realiza tu pago a tiempo.
   
   📌 Cualquier duda, estamos para servirte.
   ```

4. **Se abre WhatsApp Web**
   - Mensaje ya prellenado
   - Usuario solo presiona Enter para enviar

5. **Sistema registra automáticamente**
   - Se guarda en BD: fecha, tipo de mensaje, contenido, destinatario
   - NO cambia el estado del expediente (ya está "Enviada al Cliente")

6. **Ver el historial**
   - Scroll hacia abajo en los detalles de la póliza
   - Sección "Historial de Comunicaciones con el Cliente"
   - Se muestra:
     ```
     📅 03/Nov/2025 14:30
     💬 WHATSAPP
     [Recordatorio] ✅
     
     Para: Juan Pérez (5551234567)
     Póliza: POL-12345 | Estatus pago: Por Vencer
     
     ▼ Ver mensaje completo
     ```

---

## 🧪 Pruebas a Realizar (Una vez que Hugo termine)

### Test 1: Emisión de Póliza
- [ ] Crear nueva póliza
- [ ] Cambiar estado a "Emitida"
- [ ] Compartir por WhatsApp
- [ ] Verificar que se abre WhatsApp con mensaje de emisión
- [ ] Verificar que se guarda en BD
- [ ] Verificar que aparece en historial

### Test 2: Recordatorio de Pago
- [ ] Abrir póliza con pago próximo (5-10 días)
- [ ] Compartir por WhatsApp
- [ ] Verificar mensaje de recordatorio (no de emisión)
- [ ] Verificar que NO cambia el estado del expediente
- [ ] Ver historial y confirmar registro

### Test 3: Pago Vencido
- [ ] Abrir póliza con pago vencido
- [ ] Compartir por WhatsApp
- [ ] Verificar mensaje urgente con emoji 🚨
- [ ] Ver historial

### Test 4: Historial Múltiple
- [ ] Enviar 3-4 notificaciones a la misma póliza
- [ ] Verificar que todas aparecen en el historial
- [ ] Verificar orden cronológico (más reciente primero)
- [ ] Expandir mensajes y verificar contenido completo

### Test 5: Email
- [ ] Compartir por Email
- [ ] Verificar que se abre cliente de correo
- [ ] Verificar asunto y cuerpo del mensaje
- [ ] Verificar registro en BD

---

## 📊 Datos que se Guardan

Cada vez que compartes una póliza, se registra:

```javascript
{
  id: 1,                                      // ID único
  expediente_id: 142,                         // Póliza
  cliente_id: "CLI-00001",                    // Cliente
  tipo_notificacion: "whatsapp",              // Canal
  tipo_mensaje: "recordatorio_pago",          // Propósito
  
  // Destinatario
  destinatario_nombre: "Juan Pérez",
  destinatario_contacto: "5551234567",
  
  // Contenido
  asunto: null,                               // Solo para emails
  mensaje: "Mensaje completo...",
  
  // Contexto de la póliza
  numero_poliza: "POL-12345",
  compania: "GNP",
  producto: "Autos",
  estatus_pago: "Por Vencer",
  fecha_vencimiento_pago: "2025-12-01",
  
  // Metadata
  fecha_envio: "2025-11-03 14:30:00",
  estado_envio: "enviado",
  
  // PDF compartido
  pdf_url: "https://s3.../poliza.pdf",
  pdf_expiracion: "2025-11-04 14:30:00"
}
```

---

## 🎯 Beneficios Inmediatos

### Para Ti (Administrador)
✅ **Trazabilidad Total**: Ves todo lo que se ha enviado
✅ **Respaldo Legal**: "Sí le notificamos el día X a las Y"
✅ **No Duplicados**: Sabes qué ya se envió
✅ **Análisis**: ¿Cuántos recordatorios necesita cada cliente?

### Para el Equipo
✅ **Coordinación**: Todos ven qué se ha comunicado
✅ **Seguimiento**: "Ya le avisamos hace 3 días"
✅ **Mejora de Servicio**: No molestar con mensajes repetidos

### Para el Cliente
✅ **Mensajes Relevantes**: Solo lo que necesita saber
✅ **Información Clara**: Estado real de su póliza
✅ **Sin Spam**: No recibe lo mismo 5 veces

---

## 🔍 Troubleshooting

### Si no aparece el historial:
1. Verificar que Hugo implementó los endpoints
2. Abrir DevTools (F12) → Console
3. Buscar errores de red (404, 500)
4. Verificar que la tabla `notificaciones` existe en BD

### Si no se registran las notificaciones:
1. Verificar que el endpoint POST funciona
2. Revisar logs del backend
3. Verificar foreign keys (expediente_id, cliente_id válidos)

### Si el mensaje no es el correcto:
1. Revisar `src/services/notificacionesService.js`
2. Función `generarMensajeWhatsApp()`
3. Verificar lógica de `determinarTipoMensaje()`

---

## 📞 Contacto y Soporte

**Archivos importantes:**
- 📄 `docs/SISTEMA-NOTIFICACIONES-RESUMEN.md` - Este archivo
- 📄 `docs/SISTEMA-NOTIFICACIONES-BACKEND.md` - Para Hugo
- 💾 `scripts/crear_tabla_notificaciones.sql` - Script SQL
- 🎨 `src/components/HistorialNotificaciones.jsx` - Componente UI
- ⚙️ `src/services/notificacionesService.js` - Lógica de negocio

**¿Dudas?**
- Frontend: Todo está listo, solo esperar a Hugo
- Backend: Revisar documentación para Hugo
- Testing: Seguir checklist de pruebas arriba

---

## ✅ Estado Actual

- [x] Frontend 100% implementado
- [x] Componente de historial integrado
- [x] Mensajes dinámicos funcionando
- [x] Documentación completa
- [ ] **PENDIENTE**: Hugo implemente endpoints
- [ ] **PENDIENTE**: Pruebas end-to-end

**Una vez que Hugo termine, ¡todo funcionará automáticamente!** 🎉
