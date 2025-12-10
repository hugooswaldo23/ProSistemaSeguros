# SOLICITUD URGENTE: Backend para Sistema de Comisiones Compartidas

## Hugo, necesitamos implementar el backend para el sistema de comisiones compartidas

**Estado actual:** Frontend 100% completo y funcional ✅
**Commits subidos:** 4da0715, e645052, 12a8482
**Documentación técnica:** `docs/BACKEND-COMISIONES-COMPARTIDAS-VENDEDORES.md`

---

## 🎯 RESUMEN EJECUTIVO

El sistema permite:
- **Agentes**: Autorizar vendedores para usar sus claves y definir porcentaje de comisión
- **Vendedores**: Seleccionar agentes autorizados y configurar su comisión
- **Sincronización bidireccional**: Cuando Agente autoriza Vendedor, se actualiza automáticamente el registro del Vendedor

---

## 📋 LO QUE NECESITAMOS DEL BACKEND

### 1. MODIFICACIÓN EN TABLA `equipo_trabajo`

```sql
ALTER TABLE equipo_trabajo 
ADD COLUMN comisionesCompartidas TEXT NULL 
COMMENT 'JSON array con estructura: [{agenteId, vendedorId, aseguradoraId, clave, comisionBase, porcentajeVendedor, ejecutivoId}]';
```

**Notas:**
- El campo debe almacenar JSON como string
- NULL por defecto (para usuarios sin comisiones compartidas)
- Se usa tanto para Agentes como para Vendedores

---

### 2. ENDPOINTS A MODIFICAR

#### 🔹 GET `/api/equipo-trabajo` (listar todos)
**Agregar en el response de cada usuario:**
```json
{
  "id": 1,
  "nombre": "Juan",
  // ... campos existentes ...
  "productosAseguradoras": "[{...}]",  // YA EXISTE
  "comisionesCompartidas": "[{...}]"   // 👈 AGREGAR ESTE
}
```

#### 🔹 GET `/api/equipo-trabajo/:id` (obtener uno)
**Agregar en el response:**
```json
{
  "id": 1,
  // ... campos existentes ...
  "comisionesCompartidas": "[{...}]"   // 👈 AGREGAR ESTE
}
```

#### 🔹 POST `/api/equipo-trabajo` (crear nuevo)
**Recibir en el body:**
```json
{
  "nombre": "...",
  // ... campos existentes ...
  "comisionesCompartidas": "[{...}]"   // 👈 OPCIONAL, puede venir vacío o null
}
```

**Guardar:** El valor que venga en `comisionesCompartidas` directamente en la BD

#### 🔹 PUT `/api/equipo-trabajo/:id` (actualizar)
**LO MÁS IMPORTANTE - LÓGICA DE SINCRONIZACIÓN:**

**Si el usuario es AGENTE y viene `vendedoresAutorizados` en el payload:**

```javascript
// 1. Guardar comisionesCompartidas del Agente (se construye en frontend)
await db.query(`
  UPDATE equipo_trabajo 
  SET comisionesCompartidas = ? 
  WHERE id = ?
`, [JSON.stringify(req.body.comisionesCompartidas), agenteId]);

// 2. POR CADA vendedor autorizado, actualizar SU comisionesCompartidas
for (const autorizacion of vendedoresAutorizados) {
  const vendedorId = autorizacion.vendedorId;
  
  // Obtener comisionesCompartidas actual del Vendedor
  const vendedor = await db.query('SELECT comisionesCompartidas FROM equipo_trabajo WHERE id = ?', [vendedorId]);
  let comisiones = vendedor.comisionesCompartidas ? JSON.parse(vendedor.comisionesCompartidas) : [];
  
  // Buscar si ya existe esta combinación agenteId + aseguradoraId + clave
  const index = comisiones.findIndex(c => 
    String(c.agenteId) === String(agenteId) && 
    String(c.aseguradoraId) === String(autorizacion.aseguradoraId) && 
    c.clave === autorizacion.clave
  );
  
  // Construir objeto de comisión
  const comision = {
    agenteId: agenteId,
    vendedorId: vendedorId,
    aseguradoraId: autorizacion.aseguradoraId,
    clave: autorizacion.clave,
    comisionBase: autorizacion.comisionBase,
    porcentajeVendedor: autorizacion.porcentajeVendedor,
    ejecutivoId: autorizacion.ejecutivoId || null
  };
  
  if (index >= 0) {
    // Actualizar existente
    comisiones[index] = comision;
  } else {
    // Agregar nueva
    comisiones.push(comision);
  }
  
  // Guardar de vuelta en el Vendedor
  await db.query(`
    UPDATE equipo_trabajo 
    SET comisionesCompartidas = ? 
    WHERE id = ?
  `, [JSON.stringify(comisiones), vendedorId]);
}
```

**Si el usuario es VENDEDOR:**
```javascript
// Solo guardar su comisionesCompartidas (que contiene los agentes autorizados)
await db.query(`
  UPDATE equipo_trabajo 
  SET comisionesCompartidas = ? 
  WHERE id = ?
`, [JSON.stringify(req.body.comisionesCompartidas), vendedorId]);
```

---

### 3. ESTRUCTURA DE DATOS JSON

#### Para AGENTES (campo comisionesCompartidas):
```json
[
  {
    "agenteId": "1",
    "vendedorId": "5",
    "aseguradoraId": "2",
    "clave": "HDI-12345",
    "comisionBase": 15,
    "porcentajeVendedor": 8,
    "ejecutivoId": "3"
  }
]
```

#### Para VENDEDORES (campo comisionesCompartidas):
```json
[
  {
    "agenteId": "1",
    "vendedorId": "5",
    "aseguradoraId": "2",
    "clave": "HDI-12345",
    "comisionBase": 15,
    "porcentajeVendedor": 8,
    "ejecutivoId": "3"
  }
]
```

**Nota:** La estructura es la misma para ambos, pero la perspectiva cambia:
- Agente: "vendedorId" es a quién autorizo
- Vendedor: "agenteId" es quién me autorizó

---

## 🚨 CASOS IMPORTANTES A MANEJAR

### Caso 1: Eliminar autorización
Si el Agente elimina un vendedor de su lista, hay que:
1. Actualizar el `comisionesCompartidas` del Agente (ya no incluye ese vendedor)
2. Actualizar el `comisionesCompartidas` del Vendedor (eliminar esa entrada específica)

### Caso 2: Actualizar porcentaje
Si el Agente cambia el porcentaje de un vendedor:
1. Actualizar en el Agente
2. Actualizar en el Vendedor con el nuevo porcentaje

### Caso 3: Vendedor agrega Agente
El Vendedor solo puede agregar agentes que YA lo autorizaron:
- No hay sincronización inversa (Vendedor NO puede modificar datos del Agente)
- Solo guarda en su propio `comisionesCompartidas`

---

## 📝 PAYLOAD QUE ENVÍA EL FRONTEND

### Cuando guarda un AGENTE:
```json
{
  "id": 1,
  "nombre": "Juan Agente",
  "perfil": "Agente",
  // ... otros campos ...
  "productosAseguradoras": "[{...}]",
  "comisionesCompartidas": "[{agenteId:1, vendedorId:5, ...}, {agenteId:1, vendedorId:6, ...}]",
  "vendedoresAutorizados": [
    {
      "vendedorId": "5",
      "aseguradoraId": "2",
      "clave": "HDI-12345",
      "comisionBase": 15,
      "porcentajeVendedor": 8,
      "ejecutivoId": "3"
    }
  ]
}
```

### Cuando guarda un VENDEDOR:
```json
{
  "id": 5,
  "nombre": "Pedro Vendedor",
  "perfil": "Vendedor",
  // ... otros campos ...
  "comisionesCompartidas": "[{agenteId:1, vendedorId:5, ...}, {agenteId:2, vendedorId:5, ...}]"
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Agregar columna `comisionesCompartidas` en tabla `equipo_trabajo`
- [ ] Modificar GET `/api/equipo-trabajo` - incluir `comisionesCompartidas` en response
- [ ] Modificar GET `/api/equipo-trabajo/:id` - incluir `comisionesCompartidas` en response
- [ ] Modificar POST `/api/equipo-trabajo` - recibir y guardar `comisionesCompartidas`
- [ ] Modificar PUT `/api/equipo-trabajo/:id` - implementar lógica de sincronización para Agentes
- [ ] Modificar PUT `/api/equipo-trabajo/:id` - guardar `comisionesCompartidas` para Vendedores
- [ ] Probar: Agente autoriza Vendedor → se actualiza automáticamente en Vendedor
- [ ] Probar: Agente edita porcentaje → se refleja en Vendedor
- [ ] Probar: Agente elimina autorización → se elimina en Vendedor
- [ ] Probar: Vendedor agrega Agente → se guarda en su comisionesCompartidas

---

## 🔍 PARA PROBAR

1. **Crear un Agente** con claves en `productosAseguradoras`
2. **Autorizar un Vendedor** desde el Agente (botón "Agregar Vendedor")
3. **Verificar en BD** que `comisionesCompartidas` del Vendedor se actualizó
4. **Editar desde Vendedor** - verificar que se guarda correctamente
5. **Eliminar desde Agente** - verificar que se elimina del Vendedor

---

## 📞 DUDAS O ACLARACIONES

Si tienes alguna duda sobre la estructura o lógica, revisa:
- Frontend: `src/screens/EquipoDeTrabajo.jsx` (líneas 690-730 para lógica de vendedoresAutorizados)
- Documentación completa: `docs/BACKEND-COMISIONES-COMPARTIDAS-VENDEDORES.md`
- Payload de ejemplo en console.log (está activo en guardarUsuario)

---

## 🎯 PRIORIDAD

**URGENTE** - Necesitamos esto funcionando lo antes posible para empezar a configurar el equipo de trabajo completo.

El frontend está 100% listo y probado. Solo esperamos el backend! 🚀
