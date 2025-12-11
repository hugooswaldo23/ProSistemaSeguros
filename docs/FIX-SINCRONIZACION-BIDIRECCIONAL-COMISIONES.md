# 🚨 FIX: Sincronización Bidireccional de Comisiones Compartidas

## PROBLEMA IDENTIFICADO

La sincronización de comisiones compartidas solo funciona en UNA dirección:

✅ **Vendedor → Agente**: Cuando un Vendedor guarda, los cambios SÍ se reflejan en el Agente
❌ **Agente → Vendedor**: Cuando un Agente guarda, los cambios NO se reflejan en el Vendedor

### Prueba realizada:

**Escenario 1: Editar desde Vendedor (Mariana)**
1. Mariana edita su comisión en las claves de Alvaro: 15% y 20%
2. Guarda
3. ✅ Los cambios persisten en Mariana
4. ✅ Los cambios SE REFLEJAN en la vista de Alvaro (vendedores autorizados)

**Escenario 2: Editar desde Agente (Alvaro)**
1. Alvaro edita la comisión de Mariana: 20% y 25%
2. Guarda
3. ✅ Los cambios persisten en la vista de Alvaro
4. ❌ Los cambios NO SE REFLEJAN en la vista de Mariana

---

## 🎯 SOLUCIÓN REQUERIDA

Hugo debe implementar sincronización bidireccional en el endpoint `PUT /api/equipoDeTrabajo/:id`

### Cuando un AGENTE guarda:

El backend recibe:
```javascript
{
  id: 61,
  perfil: "Agente",
  vendedoresAutorizados: [
    {
      vendedorId: "67",
      aseguradoraId: "1",
      clave: "25576",
      comisionBase: 15,
      porcentajeVendedor: 20,  // 👈 Alvaro cambió esto
      ejecutivoId: null
    },
    {
      vendedorId: "67",
      aseguradoraId: "1",
      clave: "26399",
      comisionBase: 20,
      porcentajeVendedor: 25,  // 👈 Alvaro cambió esto
      ejecutivoId: null
    }
  ]
}
```

**Hugo debe:**

1. Guardar los `vendedoresAutorizados` en el campo del Agente (ya lo hace ✅)

2. **SINCRONIZAR a cada Vendedor** (esto falta ❌):

```javascript
// Para cada vendedor autorizado
for (const autorizacion of vendedoresAutorizados) {
  const vendedorId = autorizacion.vendedorId;
  
  // Obtener las comisionesCompartidas del Vendedor
  const vendedor = await db.query(
    'SELECT comisionesCompartidas FROM equipo_trabajo WHERE id = ?',
    [vendedorId]
  );
  
  let comisiones = [];
  try {
    comisiones = JSON.parse(vendedor.comisionesCompartidas || '[]');
  } catch (e) {
    comisiones = [];
  }
  
  // Buscar si ya existe esta comisión
  const index = comisiones.findIndex(c => 
    String(c.agenteId) === String(agenteId) && 
    String(c.aseguradoraId) === String(autorizacion.aseguradoraId) && 
    c.clave === autorizacion.clave
  );
  
  // Crear/actualizar el registro
  const comisionActualizada = {
    agenteId: agenteId,
    vendedorId: vendedorId,
    aseguradoraId: autorizacion.aseguradoraId,
    clave: autorizacion.clave,
    comisionBase: autorizacion.comisionBase,
    porcentajeVendedor: autorizacion.porcentajeVendedor,
    ejecutivoId: autorizacion.ejecutivoId
  };
  
  if (index >= 0) {
    // Actualizar existente
    comisiones[index] = comisionActualizada;
  } else {
    // Agregar nuevo
    comisiones.push(comisionActualizada);
  }
  
  // Guardar de vuelta en el Vendedor
  await db.query(
    'UPDATE equipo_trabajo SET comisionesCompartidas = ? WHERE id = ?',
    [JSON.stringify(comisiones), vendedorId]
  );
}
```

---

## 🧪 CÓMO PROBAR EL FIX

### Test 1: Agente edita comisión de Vendedor

1. Editar Agente (Alvaro)
2. Cambiar comisión de Mariana a 30% y 35%
3. Guardar
4. Editar Vendedor (Mariana)
5. **Verificar:** Debe mostrar 30% y 35% en las comisiones

### Test 2: Vendedor edita su comisión

1. Editar Vendedor (Mariana)
2. Cambiar comisión a 40% y 45%
3. Guardar
4. Editar Agente (Alvaro)
5. **Verificar:** Debe mostrar 40% y 45% en vendedores autorizados

### Test 3: Eliminar autorización desde Agente

1. Editar Agente (Alvaro)
2. Eliminar una de las autorizaciones de Mariana
3. Guardar
4. Editar Vendedor (Mariana)
5. **Verificar:** Esa clave ya NO debe aparecer en Mariana

---

## 📋 ESTRUCTURA DE DATOS

### Campo `comisionesCompartidas` (en Vendedor):
```json
[
  {
    "agenteId": "61",
    "vendedorId": "67",
    "aseguradoraId": "1",
    "clave": "25576",
    "comisionBase": 15,
    "porcentajeVendedor": 20,
    "ejecutivoId": null
  }
]
```

### Campo `vendedoresAutorizados` (en Agente - solo se usa como input):
```json
[
  {
    "vendedorId": "67",
    "aseguradoraId": "1",
    "clave": "25576",
    "comisionBase": 15,
    "porcentajeVendedor": 20,
    "ejecutivoId": null
  }
]
```

**IMPORTANTE:** El campo `vendedoresAutorizados` NO se guarda en el Agente. Solo se usa para sincronizar a los Vendedores.

---

## ⚠️ PROBLEMA ADICIONAL: Sincronizar cambios en Comisión Base

Cuando un Agente **modifica la Comisión Base de su clave** (en la sección "Claves y Aseguradoras"), ese cambio NO se refleja en los `comisionesCompartidas` de los Vendedores autorizados.

### Ejemplo del problema:

1. Alvaro tiene clave 25576 con comisión base 10%
2. Mariana está autorizada para usar esa clave
3. Alvaro edita su clave y cambia comisión base a 5%
4. ❌ Mariana sigue viendo 10% en lugar de 5%

### Solución requerida:

Cuando un Agente guarda cambios en `productosAseguradoras`, Hugo debe:

```javascript
// Después de actualizar productosAseguradoras del Agente
for (const producto of productosAseguradoras) {
  // Buscar todos los Vendedores que tienen esta clave autorizada
  const vendedoresConEsaClave = await db.query(`
    SELECT id, comisionesCompartidas 
    FROM equipo_trabajo 
    WHERE perfil = 'Vendedor' 
    AND comisionesCompartidas LIKE ?
  `, [`%"clave":"${producto.clave}"%`]);
  
  for (const vendedor of vendedoresConEsaClave) {
    let comisiones = JSON.parse(vendedor.comisionesCompartidas || '[]');
    
    // Actualizar comisionBase en las comisiones que coincidan
    comisiones = comisiones.map(c => {
      if (String(c.agenteId) === String(agenteId) && 
          String(c.aseguradoraId) === String(producto.aseguradoraId) && 
          c.clave === producto.clave) {
        return {
          ...c,
          comisionBase: producto.comisionPersonalizada || productoInfo.comisionBase
        };
      }
      return c;
    });
    
    await db.query(`
      UPDATE equipo_trabajo 
      SET comisionesCompartidas = ? 
      WHERE id = ?
    `, [JSON.stringify(comisiones), vendedor.id]);
  }
}
```

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Sincronización Vendedor → Agente (ya funciona)
- [x] Sincronización Agente → Vendedor cuando cambia % Vendedor (ya funciona)
- [ ] Sincronización cuando Agente cambia Comisión Base de su clave (falta implementar)
- [ ] Eliminar autorización (cuando Agente borra, eliminar de Vendedor)
- [ ] Mantener `comisionBase` actualizado en ambos lados

---

## 🎯 PRIORIDAD

**ALTA** - Sin esto, el sistema no mantiene la sincronización correcta entre Agentes y Vendedores.

---

## 📞 EVIDENCIA DEL BUG

**Logs de consola al guardar desde Agente:**
```javascript
Usuario completo: {perfil: "Agente", ...}
Comisiones compartidas cargadas: []  // Agente no tiene comisionesCompartidas
Vendedores autorizados cargados: [...]  // Estos se envían al backend
```

**Payload que se envía:**
```javascript
{
  perfil: "Agente",
  comisionesCompartidas: [],  // Vacío para Agentes
  vendedoresAutorizados: [...]  // 👈 Estos deben sincronizarse a los Vendedores
}
```

El backend recibe `vendedoresAutorizados` pero **NO los está sincronizando** a los `comisionesCompartidas` de cada Vendedor.
