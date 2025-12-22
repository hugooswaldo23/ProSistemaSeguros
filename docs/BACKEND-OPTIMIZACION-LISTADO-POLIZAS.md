# 🚀 Optimización: Separar consulta de expedientes y recibos

## 📋 Problema actual

El endpoint `GET /api/expedientes` está incluyendo todos los recibos de todas las pólizas mediante JOIN, lo cual es ineficiente para el listado.

---

## ✅ Solución (sin crear nuevos endpoints)

### **1. Backend: `GET /api/expedientes` - SIN recibos**

Retornar SOLO los campos de la tabla `expedientes` (sin JOIN con recibos_pago):

```sql
SELECT 
  e.*,
  c.nombre as cliente_nombre,
  c.apellido_paterno,
  c.apellido_materno,
  c.rfc as cliente_rfc
FROM expedientes e
LEFT JOIN clientes c ON e.cliente_id = c.id
WHERE e.deleted_at IS NULL
ORDER BY e.fecha_creacion DESC;
```

**Respuesta JSON:**
```javascript
[
  {
    id: 514,
    numero_poliza: '0971460813',
    cliente_id: 'uuid',
    compania: 'HDI',
    
    // 🎯 Estos campos YA existen y se actualizan automáticamente
    ultimo_recibo_pagado: 1,
    fecha_vencimiento_pago: '2025-12-25', // Ya es el próximo vencimiento
    estatus_pago: 'Pago por vencer',
    
    // ❌ NO incluir recibos aquí
  }
]
```

---

### **2. Backend: `GET /api/recibos/:expediente_id` - Usar el existente**

Este endpoint YA existe. Retorna todos los recibos de un expediente específico:

```javascript
GET /api/recibos/514
// Retorna:
[
  { numero_recibo: 1, fecha_vencimiento: '2025-08-14', fecha_pago_real: '2025-12-20', estatus: 'Pagado', monto: 2033.19 },
  { numero_recibo: 2, fecha_vencimiento: '2025-12-25', fecha_pago_real: null, estatus: 'Por vencer', monto: 1290.81 },
  { numero_recibo: 3, fecha_vencimiento: '2026-02-14', fecha_pago_real: null, estatus: 'Pendiente', monto: 1290.81 },
  { numero_recibo: 4, fecha_vencimiento: '2026-05-14', fecha_pago_real: null, estatus: 'Pendiente', monto: 1290.81 }
]
```

---

### **3. Frontend: Cargar recibos solo cuando se necesita**

**Para listado de pólizas:**
```javascript
// ✅ Usa los campos del expediente (no necesita recibos)
const ListaExpedientes = ({ expedientes }) => {
  return expedientes.map(exp => (
    <tr key={exp.id}>
      <td>{exp.numero_poliza}</td>
      <td>{exp.cliente_nombre}</td>
      <td>{exp.compania}</td>
      <td>
        {/* 🎯 Usa fecha_vencimiento_pago del expediente */}
        Próximo pago: {exp.fecha_vencimiento_pago}
      </td>
      <td>
        {/* 🎯 Usa estatus_pago del expediente */}
        <Badge>{exp.estatus_pago}</Badge>
      </td>
    </tr>
  ));
};
```

**Para detalle/editar (cuando se necesita el calendario):**
```javascript
// ✅ Carga recibos solo cuando abre detalle/editar
const verDetalleExpediente = async (expedienteId) => {
  // 1. Ya tenemos el expediente del listado
  const expediente = expedientes.find(e => e.id === expedienteId);
  
  // 2. Cargar recibos solo ahora (llamada adicional)
  const response = await fetch(`/api/recibos/${expedienteId}`);
  const recibos = await response.json();
  
  // 3. Combinar
  setExpedienteSeleccionado({
    ...expediente,
    recibos: recibos
  });
};
```

---

## 📊 Comparación

| Escenario | Antes (actual) | Después (optimizado) |
|-----------|---------------|---------------------|
| **Listado (100 pólizas)** | 1 query con JOIN pesado (400 recibos) | 1 query simple (0 recibos) |
| **Abrir detalle** | Ya tiene recibos | +1 query para cargar recibos |
| **Payload listado** | ~500 KB | ~50 KB (90% menos) |
| **Tiempo listado** | 2-3 segundos | ~300ms |

---

## 🔧 Implementación

### **Backend (Node.js) - Modificar GET /api/expedientes:**

```javascript
/**
 * GET /api/expedientes
 * Lista de pólizas SIN recibos (solo campos de expediente)
 */
app.get('/api/expedientes', async (req, res) => {
  try {
    const query = `
      SELECT 
        e.*,
        c.nombre as cliente_nombre,
        c.apellido_paterno,
        c.apellido_materno,
        c.rfc as cliente_rfc,
        c.email as cliente_email
      FROM expedientes e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      WHERE e.deleted_at IS NULL
      ORDER BY e.fecha_creacion DESC
    `;
    
    const [rows] = await pool.query(query);
    res.json(rows);
    
  } catch (error) {
    console.error('Error al listar expedientes:', error);
    res.status(500).json({ error: 'Error al listar expedientes' });
  }
});

// ✅ GET /api/recibos/:expediente_id ya existe - no modificar
```

### **Frontend - Adaptar carga de datos:**

```javascript
// useExpedientes.js - Cargar expedientes sin recibos
const cargarExpedientes = useCallback(async () => {
  const response = await fetch(`${API_URL}/api/expedientes`);
  const data = await response.json();
  
  // ✅ data ya NO incluye recibos
  setExpedientes(data);
}, []);

// Expedientes.jsx - Cargar recibos solo al editar
const editarExpediente = useCallback(async (expediente) => {
  setModoEdicion(true);
  setVistaActual('formulario');
  
  // Cargar recibos solo ahora
  const response = await fetch(`${API_URL}/api/recibos/${expediente.id}`);
  const recibos = await response.json();
  
  setFormulario({
    ...expediente,
    recibos: recibos.data || recibos // Manejar formato de respuesta
  });
}, []);
```

---

## ✅ Beneficios

✅ No requiere crear nuevos endpoints
✅ Usa servicios existentes (`GET /api/recibos/:id`)
✅ Payload del listado 90% más pequeño
✅ Carga inicial 80% más rápida
✅ Recibos se cargan solo cuando se necesitan (lazy loading)
✅ Escalable a miles de pólizas

---

## 📝 Checklist

**Backend:**
- [ ] Eliminar JOIN con `recibos_pago` en `GET /api/expedientes`
- [ ] Verificar que `GET /api/recibos/:id` funcione correctamente
- [ ] Asegurar que campos `fecha_vencimiento_pago` y `estatus_pago` se actualizan al aplicar pagos

**Frontend:**
- [ ] Adaptar `useExpedientes` para NO esperar recibos en el listado
- [ ] Modificar `editarExpediente` para cargar recibos on-demand
- [ ] Modificar `verDetalleExpediente` para cargar recibos on-demand
- [ ] Actualizar `ListaExpedientes` para usar campos del expediente
- [ ] Probar flujo completo: listar → editar → ver calendario

---

**Prioridad:** 🔴 ALTA
**Estimado:** 1-2 horas
**Impacto:** Mejora dramática en rendimiento inicial
