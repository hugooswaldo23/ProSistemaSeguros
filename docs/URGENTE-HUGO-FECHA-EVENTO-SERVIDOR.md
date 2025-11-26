# 🚨 URGENTE: Backend debe generar fecha_evento automáticamente

**FECHA:** 25 de noviembre 2025  
**PRIORIDAD:** CRÍTICA  
**AFECTA A:** Endpoint `POST /api/historial-expedientes`

---

## ❌ PROBLEMA ACTUAL

El frontend enviaba `fecha_evento` con la hora del navegador del usuario, causando:
- ❌ Dependencia del reloj local del usuario (puede estar mal configurado)
- ❌ Problemas de zona horaria entre usuarios
- ❌ Código frontend complejo con conversiones innecesarias
- ❌ Inconsistencias en timestamps del historial

---

## ✅ SOLUCIÓN IMPLEMENTADA EN FRONTEND

**Archivo modificado:** `src/services/historialExpedienteService.js`

```javascript
// ✅ AHORA: No enviamos fecha_evento desde frontend
const payload = {
  expediente_id: datos.expediente_id,
  cliente_id: datos.cliente_id || null,
  tipo_evento: datos.tipo_evento,
  // ... otros campos ...
  // ✅ NO enviamos fecha_evento - el backend la genera
};
```

**Simplificación:** Eliminamos función `obtenerFechaHoraLocal()` y conversiones de timezone (50+ líneas eliminadas)

---

## 📋 TAREAS PARA HUGO (BACKEND)

### 1️⃣ Modificar endpoint POST /api/historial-expedientes

**Ubicación probable:** `routes/historial-expedientes.js` o similar

```javascript
router.post('/api/historial-expedientes', async (req, res) => {
  try {
    const datos = {
      expediente_id: req.body.expediente_id,
      cliente_id: req.body.cliente_id,
      tipo_evento: req.body.tipo_evento,
      etapa_anterior: req.body.etapa_anterior,
      etapa_nueva: req.body.etapa_nueva,
      usuario_id: req.body.usuario_id,
      usuario_nombre: req.body.usuario_nombre,
      descripcion: req.body.descripcion,
      datos_adicionales: req.body.datos_adicionales,
      metodo_contacto: req.body.metodo_contacto,
      destinatario_nombre: req.body.destinatario_nombre,
      destinatario_contacto: req.body.destinatario_contacto,
      documento_url: req.body.documento_url,
      documento_tipo: req.body.documento_tipo,
      
      // ✅ CRÍTICO: Si fecha_evento no viene, generar con hora del servidor
      fecha_evento: req.body.fecha_evento || new Date().toISOString()
    };
    
    // Insertar en base de datos...
    const resultado = await db.query(
      `INSERT INTO historial_expedientes SET ?`,
      datos
    );
    
    res.json({ success: true, id: resultado.insertId });
  } catch (error) {
    console.error('Error al registrar evento:', error);
    res.status(500).json({ error: 'Error al registrar evento' });
  }
});
```

### 2️⃣ Verificar zona horaria del servidor MySQL

**Ejecutar en MySQL:**
```sql
-- Ver zona horaria actual
SELECT @@global.time_zone, @@session.time_zone;

-- Si no está en Mexico City, configurar:
SET GLOBAL time_zone = 'America/Mexico_City';
SET SESSION time_zone = 'America/Mexico_City';
```

**En my.cnf o my.ini:**
```ini
[mysqld]
default-time-zone = 'America/Mexico_City'
```

### 3️⃣ Verificar zona horaria del servidor Node.js

**En tu archivo principal (server.js o app.js):**
```javascript
// Al inicio del archivo
process.env.TZ = 'America/Mexico_City';

console.log('🕐 Zona horaria del servidor:', new Date().toString());
// Debe mostrar: "... GMT-0600 (Central Standard Time)"
```

---

## 🧪 TESTING

### ✅ Prueba 1: Crear evento sin fecha_evento
```bash
curl -X POST http://localhost:3001/api/historial-expedientes \
  -H "Content-Type: application/json" \
  -d '{
    "expediente_id": 123,
    "tipo_evento": "PRUEBA_TIMEZONE",
    "descripcion": "Test sin fecha_evento"
  }'
```

**Verificar:** El evento debe tener `fecha_evento` con la hora actual del servidor

### ✅ Prueba 2: Frontend - Capturar nueva póliza
1. Capturar póliza en sistema
2. Ir a Historial del expediente
3. Verificar que la hora mostrada coincida **EXACTAMENTE** con la hora del sistema
4. **Antes mostraba:** 1:32 PM cuando eran las 7:32 PM (6 horas de diferencia)
5. **Ahora debe mostrar:** 7:32 PM cuando son las 7:32 PM (hora correcta)

---

## 📊 IMPACTO DEL CAMBIO

| Aspecto | Antes ❌ | Después ✅ |
|---------|---------|------------|
| **Generación de hora** | Frontend (navegador usuario) | Backend (servidor único) |
| **Precisión** | Depende del reloj del usuario | Siempre correcta (servidor) |
| **Zona horaria** | Conversiones manuales complejas | Servidor maneja todo |
| **Código frontend** | +50 líneas de conversiones | Simple: `new Date(fechaISO)` |
| **Mantenimiento** | Complejo | Simple |

---

## 🔍 ARCHIVOS MODIFICADOS EN ESTE COMMIT

1. **src/services/historialExpedienteService.js**
   - ❌ Eliminada función `obtenerFechaHoraLocal()`
   - ✅ Payload NO envía `fecha_evento`

2. **src/components/TimelineExpediente.jsx**
   - ❌ Eliminadas conversiones complejas de timezone
   - ✅ Simplificado a: `new Date(fechaISO)` directo

---

## ⚠️ IMPORTANTE

- **NO es opcional:** Sin este cambio en backend, NO habrá `fecha_evento` en los nuevos eventos
- **Retrocompatibilidad:** Eventos antiguos siguen funcionando
- **Urgencia:** Debe implementarse ANTES del próximo deploy
- **Testing obligatorio:** Verificar que hora mostrada = hora real del sistema

---

## 📞 CONTACTO

Si hay dudas o problemas con la implementación, revisar este commit donde se eliminaron las conversiones del frontend.

**Commit:** [pendiente - se agregará al hacer push]

---

**Firmado:** Álvaro (Frontend)  
**Fecha:** 25-nov-2025  
**Estado:** ⏳ Pendiente implementación backend
