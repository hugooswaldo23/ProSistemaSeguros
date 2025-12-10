# 🔥 FIX URGENTE - URLs con HTTP en lugar de HTTPS en Historial

## 🐛 Problema Detectado

Las URLs que se guardan en el historial de expedientes están usando `http://` en lugar de `https://`:

**Incorrecto (actual):**
```
http://apiseguros.proordersistem.com.mx/api/historial-expedientes/436
```

**Correcto (esperado):**
```
https://apiseguros.proordersistem.com.mx/api/historial-expedientes/436
```

---

## 📍 Ubicación del Problema

El problema está en el **BACKEND**, específicamente en el endpoint:

```
POST /api/historial-expedientes
```

Cuando se registra un evento en el historial, el backend está construyendo la URL con el protocolo incorrecto.

---

## 🔍 Código Problemático (Probable)

Es probable que tengas algo como esto:

```javascript
// ❌ INCORRECTO
router.post('/api/historial-expedientes', async (req, res) => {
  const { expediente_id, tipo_evento, descripcion, datos_adicionales } = req.body;
  
  // Esto genera URLs con http:// siempre
  const url_evento = `http://${req.hostname}${req.originalUrl}`;
  
  await db.query(
    'INSERT INTO historial_expedientes (expediente_id, tipo_evento, descripcion, url_evento, ...) VALUES (?, ?, ?, ?, ...)',
    [expediente_id, tipo_evento, descripcion, url_evento, ...]
  );
  
  res.json({ success: true });
});
```

---

## ✅ Solución

### Opción 1: Detectar protocolo automáticamente (RECOMENDADO)

```javascript
// ✅ CORRECTO - Detecta si es HTTP o HTTPS
router.post('/api/historial-expedientes', async (req, res) => {
  const { expediente_id, tipo_evento, descripcion, datos_adicionales } = req.body;
  
  // Detectar protocolo según la configuración del servidor
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const url_evento = `${protocol}://${req.hostname}${req.originalUrl}`;
  
  console.log('📝 URL del evento:', url_evento); // Para debug
  
  await db.query(
    'INSERT INTO historial_expedientes (expediente_id, tipo_evento, descripcion, url_evento, ...) VALUES (?, ?, ?, ?, ...)',
    [expediente_id, tipo_evento, descripcion, url_evento, ...]
  );
  
  res.json({ success: true });
});
```

### Opción 2: Forzar HTTPS siempre (MÁS SIMPLE)

```javascript
// ✅ CORRECTO - Fuerza HTTPS en producción
router.post('/api/historial-expedientes', async (req, res) => {
  const { expediente_id, tipo_evento, descripcion, datos_adicionales } = req.body;
  
  // Siempre usar HTTPS en producción
  const isProduction = process.env.NODE_ENV === 'production';
  const protocol = isProduction ? 'https' : 'http';
  const url_evento = `${protocol}://${req.hostname}${req.originalUrl}`;
  
  console.log('📝 URL del evento:', url_evento); // Para debug
  
  await db.query(
    'INSERT INTO historial_expedientes (expediente_id, tipo_evento, descripcion, url_evento, ...) VALUES (?, ?, ?, ?, ...)',
    [expediente_id, tipo_evento, descripcion, url_evento, ...]
  );
  
  res.json({ success: true });
});
```

### Opción 3: Usar variable de entorno (MÁS FLEXIBLE)

```javascript
// ✅ CORRECTO - Usa variable de entorno
router.post('/api/historial-expedientes', async (req, res) => {
  const { expediente_id, tipo_evento, descripcion, datos_adicionales } = req.body;
  
  // Obtener la URL base desde .env
  const BASE_URL = process.env.API_BASE_URL || `https://${req.hostname}`;
  const url_evento = `${BASE_URL}${req.originalUrl}`;
  
  console.log('📝 URL del evento:', url_evento); // Para debug
  
  await db.query(
    'INSERT INTO historial_expedientes (expediente_id, tipo_evento, descripcion, url_evento, ...) VALUES (?, ?, ?, ?, ...)',
    [expediente_id, tipo_evento, descripcion, url_evento, ...]
  );
  
  res.json({ success: true });
});
```

Y en tu `.env`:
```bash
API_BASE_URL=https://apiseguros.proordersistem.com.mx
```

---

## 🔧 Configuración del Servidor (Importante)

Si usas **nginx** o un **proxy reverso**, asegúrate de que pase los headers correctos:

```nginx
# Configuración de nginx
location /api/ {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;  # 👈 IMPORTANTE
}
```

Esto hace que `req.headers['x-forwarded-proto']` tenga el valor correcto en Express.

---

## 🧪 Testing

Después de implementar la solución, prueba:

1. **Registrar un evento nuevo:**
   ```bash
   curl -X POST https://apiseguros.proordersistem.com.mx/api/historial-expedientes \
     -H "Content-Type: application/json" \
     -d '{
       "expediente_id": "436",
       "tipo_evento": "PRUEBA",
       "descripcion": "Test de URL"
     }'
   ```

2. **Verificar la URL guardada:**
   ```sql
   SELECT url_evento FROM historial_expedientes 
   WHERE expediente_id = '436' 
   ORDER BY fecha_evento DESC 
   LIMIT 1;
   ```
   
   Debería retornar:
   ```
   https://apiseguros.proordersistem.com.mx/api/historial-expedientes/436
   ```

3. **Probar desde el frontend:**
   - Aplicar un pago a una póliza
   - Verificar en el historial que la URL comience con `https://`

---

## 📊 Impacto

**Registros afectados:** Todos los eventos de historial que ya se han guardado con `http://`

**¿Necesita migración?** SÍ (opcional pero recomendado)

### Script de migración para corregir URLs existentes:

```sql
-- Actualizar URLs existentes de http:// a https://
UPDATE historial_expedientes 
SET url_evento = REPLACE(url_evento, 'http://', 'https://')
WHERE url_evento LIKE 'http://apiseguros.proordersistem.com.mx%';

-- Verificar cambios
SELECT 
  COUNT(*) as total_corregidos,
  MIN(fecha_evento) as primer_evento,
  MAX(fecha_evento) as ultimo_evento
FROM historial_expedientes 
WHERE url_evento LIKE 'https://apiseguros.proordersistem.com.mx%';
```

---

## ✅ Checklist

- [ ] Identificar dónde se construye la URL en el endpoint POST
- [ ] Implementar detección de protocolo (Opción 1, 2 o 3)
- [ ] Agregar logs para debug: `console.log('URL generada:', url_evento)`
- [ ] Verificar configuración de nginx/proxy (header `X-Forwarded-Proto`)
- [ ] Probar registrando un evento nuevo
- [ ] Verificar que la URL guardada sea `https://`
- [ ] (Opcional) Ejecutar script de migración para corregir URLs antiguas
- [ ] Confirmar con Álvaro que el problema está resuelto

---

## 📝 Notas

1. **No afecta al frontend**: El frontend está configurado correctamente
2. **Problema solo en backend**: Al construir URLs para guardar en BD
3. **Afecta solo a historial**: Otros endpoints pueden tener el mismo problema
4. **Revisar otros lugares**: Buscar en el código otros lugares donde se construyan URLs

---

## 🔍 Otros lugares para revisar

Busca en tu código backend por:

```bash
# Buscar construcciones de URLs
grep -r "http://" *.js
grep -r "req.hostname" *.js
grep -r "req.originalUrl" *.js
```

Revisa especialmente:
- Endpoints de subida de archivos (PDF, comprobantes)
- Endpoints de notificaciones
- Cualquier lugar donde se generen URLs públicas

---

## 🆘 Si necesitas ayuda

Si después de implementar esto sigues viendo `http://` en las URLs:

1. Revisa los logs del servidor cuando registres un evento
2. Verifica la configuración de nginx/proxy
3. Confirma que `req.secure` o `req.headers['x-forwarded-proto']` tengan el valor correcto
4. Comparte el log de `console.log('URL generada:', url_evento)` para debug
