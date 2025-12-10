# Implementación Backend: Comisiones Compartidas para Vendedores

## Descripción
Sistema para que los Vendedores puedan trabajar con claves específicas de Agentes y definir porcentajes de comisión.

## Cambios Requeridos en Base de Datos

### 1. Agregar campo a tabla `equipo_trabajo`

```sql
ALTER TABLE equipo_trabajo 
ADD COLUMN comisionesCompartidas JSON DEFAULT NULL;
```

O si prefieres TEXT:
```sql
ALTER TABLE equipo_trabajo 
ADD COLUMN comisionesCompartidas TEXT DEFAULT NULL;
```

### 2. Estructura del JSON para `comisionesCompartidas`

```json
[
  {
    "id": "timestamp_unico",
    "agenteId": "85",
    "vendedorId": "89",
    "claveId": "1",
    "clave": "25576",
    "aseguradoraId": "1",
    "comisionBase": 10,
    "porcentajeVendedor": 50,
    "ejecutivoId": "61",
    "activo": true
  }
]
```

## Cambios en Endpoints

### GET `/api/equipo-trabajo/:id`
**Modificación:** Incluir el campo `comisionesCompartidas` en la respuesta

```javascript
// Ejemplo de respuesta
{
  "id": 89,
  "codigo": "VE001",
  "nombre": "mariana",
  "apellidoPaterno": "GONZALEZ",
  "perfil": "Vendedor",
  "esquemaCompensacion": "comision", // Importante: debe retornar este campo correctamente
  "comisionesCompartidas": [ /* array de objetos */ ],
  // ... otros campos
}
```

### POST `/api/equipo-trabajo` y PUT `/api/equipo-trabajo/:id`
**Modificación:** Guardar el campo `comisionesCompartidas` del payload

```javascript
// El frontend enviará:
{
  // ... otros campos del formulario
  "esquemaCompensacion": "comision", // o "mixto" o "sueldo"
  "comisionesCompartidas": [ /* array de objetos */ ]
}
```

**Importante:** 
- Si `comisionesCompartidas` viene como array, convertirlo a JSON string antes de guardar
- Al retornar, parsear el JSON string a array

## Flujo Funcional

1. **Agente** tiene claves registradas en `productosAseguradoras` (ya implementado)
2. **Vendedor** configura:
   - Selecciona un Agente
   - Marca checkboxes de las claves del agente que quiere usar
   - Define porcentaje de comisión para cada clave (0-100%)
   - Asigna un Ejecutivo opcional
3. Al guardar el Vendedor, se envía `comisionesCompartidas` en el payload
4. Al editar el Vendedor, se carga `comisionesCompartidas` y se muestra en la tabla

## Uso Futuro

Este campo se utilizará en el módulo de Pólizas para:
- Filtrar qué vendedores pueden capturar una póliza según el agente y clave seleccionados
- Calcular automáticamente las comisiones según los porcentajes configurados
- Asignar el ejecutivo correspondiente

## Testing

Para probar:
1. Editar vendedor VE001 (mariana)
2. Cambiar a pestaña "Compensación y Comisiones"
3. Seleccionar "Solo Comisiones"
4. Click en "+ Agregar Agente"
5. Seleccionar AG001 (ALVARO) y marcar sus 2 claves de Qualitas
6. Definir porcentajes (ej: 50% cada uno)
7. Guardar usuario
8. Volver a editar y verificar que se muestre la tabla con los datos guardados

## Fecha de Implementación
10 de diciembre de 2025

## Prioridad
**ALTA** - Bloqueante para módulo de captura de pólizas
