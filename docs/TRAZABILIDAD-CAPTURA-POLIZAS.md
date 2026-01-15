# Trazabilidad de Captura de Pólizas

## 📋 Resumen

Se implementó un sistema completo de trazabilidad que registra detalladamente cómo se captura cada póliza en el sistema, diferenciando entre **captura manual** y **extracción desde PDF**, además de detectar y registrar las modificaciones manuales realizadas después de una extracción automática.

## 🎯 Objetivo

Proporcionar un historial completo y transparente del origen de los datos de cada póliza, permitiendo:
- Identificar el método de captura utilizado
- Detectar campos que fueron modificados manualmente después de una extracción de PDF
- Auditar la calidad de las extracciones automáticas
- Mejorar la trazabilidad y confiabilidad de los datos

## 🔧 Implementación

### 1. **Detección del Método de Captura**

#### Archivo: `FormularioNuevoExpediente.jsx`

Se agregó la capacidad de detectar y marcar el método de captura:

```javascript
// Estados para rastreo
const [modoCaptura, setModoCaptura] = useState(null); // 'manual' o 'pdf'
const [camposModificadosPostPDF, setCamposModificadosPostPDF] = useState([]);

// Al seleccionar captura manual
if (modo === 'manual') {
  setFormulario(prev => ({
    ...prev,
    _metodo_captura: 'manual'
  }));
}

// Al importar desde PDF
nuevosDatos._datos_desde_pdf = true;
nuevosDatos._metodo_captura = 'pdf';
nuevosDatos._snapshot_pdf = JSON.stringify(nuevosDatos); // Para detectar cambios
```

### 2. **Detección de Modificaciones Post-PDF**

Se implementó un wrapper inteligente de `setFormulario` que compara el estado actual con el snapshot inicial del PDF:

```javascript
const setFormularioConDeteccion = useCallback((updater) => {
  setFormulario(prev => {
    const updated = typeof updater === 'function' ? updater(prev) : updater;
    
    // Si fue captura desde PDF y ya se cargaron los datos
    if (updated._metodo_captura === 'pdf' && updated._snapshot_pdf && datosImportadosDesdePDF) {
      const snapshot = JSON.parse(updated._snapshot_pdf);
      const camposModificados = [];
      
      // Campos importantes a monitorear
      const camposClave = [
        'numero_poliza', 'compania', 'producto', 'numero_endoso',
        'fecha_emision', 'inicio_vigencia', 'termino_vigencia',
        'prima_neta', 'total', 'tipo_pago', 'frecuenciaPago',
        'marca', 'modelo', 'anio', 'placas', 'numero_serie',
        'agente', 'estatusPago', 'fecha_vencimiento_pago'
      ];
      
      // Detectar cambios
      camposClave.forEach(campo => {
        if (snapshot[campo] !== updated[campo]) {
          camposModificados.push(campo);
        }
      });
      
      if (camposModificados.length > 0) {
        setCamposModificadosPostPDF(prev => [...new Set([...prev, ...camposModificados])]);
      }
    }
    
    return updated;
  });
}, [setFormulario, datosImportadosDesdePDF]);
```

### 3. **Registro en Historial de Expediente**

#### Archivo: `NvoExpedientes.jsx`

Al guardar un expediente nuevo, se registra automáticamente un evento en el historial:

```javascript
// Capturar información antes de limpiar
const fueExtractorPDF = datos._datos_desde_pdf === true;
const camposModificadosPostPDF = datos._campos_modificados_post_pdf || [];
const metodoCaptura = datos._metodo_captura || (fueExtractorPDF ? 'pdf' : 'manual');

// Registro del evento
await historialService.registrarEvento({
  expediente_id: expedienteId,
  cliente_id: datos.cliente_id,
  tipo_evento: fueExtractorPDF 
    ? historialService.TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF 
    : historialService.TIPOS_EVENTO.CAPTURA_MANUAL,
  usuario_nombre: 'Sistema',
  descripcion: fueExtractorPDF 
    ? `Expediente creado mediante extracción automática de PDF - ${datos.compania} ${datos.numero_poliza}${camposModificadosPostPDF.length > 0 ? ' (con modificaciones manuales)' : ''}`
    : `Expediente creado mediante captura manual - ${datos.compania} ${datos.numero_poliza}`,
  datos_adicionales: {
    // ... datos de la póliza ...
    
    // 🔥 METADATA DE TRAZABILIDAD
    metodo_captura: metodoCaptura === 'pdf' ? 'Extractor PDF' : 'Captura Manual',
    campos_extraidos_desde_pdf: fueExtractorPDF,
    campos_modificados_manualmente: camposModificadosPostPDF.length > 0,
    campos_modificados: camposModificadosPostPDF.length > 0 ? camposModificadosPostPDF : null,
    cantidad_campos_modificados: camposModificadosPostPDF.length,
    fecha_captura: new Date().toISOString(),
    etapa_inicial: datos.etapa_activa || 'Captura'
  }
});
```

### 4. **Visualización en Timeline**

#### Archivo: `TimelineExpediente.jsx`

Se mejoró la visualización de eventos de captura para mostrar:

- ✅ Método de captura (Manual o PDF)
- ✅ Indicador visual cuando hubo modificaciones post-PDF
- ✅ Badge con cantidad de campos modificados
- ✅ Lista expandible de campos específicos modificados

```jsx
{evento.tipo_evento === 'captura_extractor_pdf' && (
  <>
    <span className="text-dark">
      📄 {evento.datos_adicionales?.nombre_archivo_pdf || 'Extracción desde PDF'}
    </span>
    {evento.datos_adicionales?.campos_modificados_manualmente && (
      <span className="badge bg-warning">
        ✏️ {evento.datos_adicionales?.cantidad_campos_modificados} campo(s) modificado(s)
      </span>
    )}
    {evento.datos_adicionales?.campos_modificados && (
      <div className="mt-2 p-2 bg-light rounded">
        <div className="text-muted mb-1">
          <strong>✏️ Campos editados manualmente post-extracción:</strong>
        </div>
        <div className="d-flex flex-wrap gap-1">
          {evento.datos_adicionales.campos_modificados.map((campo, idx) => (
            <span key={idx} className="badge bg-secondary">
              {campo}
            </span>
          ))}
        </div>
      </div>
    )}
  </>
)}
```

## 📊 Datos Registrados

### Para **Captura Manual**:
```json
{
  "tipo_evento": "captura_manual",
  "datos_adicionales": {
    "metodo_captura": "Captura Manual",
    "campos_extraidos_desde_pdf": false,
    "campos_modificados_manualmente": false,
    "fecha_captura": "2026-01-08T12:30:00.000Z",
    "numero_poliza": "...",
    "compania": "...",
    // ... más datos de la póliza ...
  }
}
```

### Para **Extracción desde PDF sin modificaciones**:
```json
{
  "tipo_evento": "captura_extractor_pdf",
  "datos_adicionales": {
    "metodo_captura": "Extractor PDF",
    "campos_extraidos_desde_pdf": true,
    "campos_modificados_manualmente": false,
    "cantidad_campos_modificados": 0,
    "fecha_captura": "2026-01-08T12:35:00.000Z",
    "numero_poliza": "...",
    "compania": "...",
    // ... más datos de la póliza ...
  }
}
```

### Para **Extracción desde PDF CON modificaciones**:
```json
{
  "tipo_evento": "captura_extractor_pdf",
  "descripcion": "Expediente creado mediante extracción automática de PDF - AXA 1234567 (con modificaciones manuales)",
  "datos_adicionales": {
    "metodo_captura": "Extractor PDF",
    "campos_extraidos_desde_pdf": true,
    "campos_modificados_manualmente": true,
    "campos_modificados": [
      "numero_poliza",
      "fecha_emision",
      "prima_neta",
      "total"
    ],
    "cantidad_campos_modificados": 4,
    "fecha_captura": "2026-01-08T12:40:00.000Z",
    "numero_poliza": "...",
    "compania": "...",
    // ... más datos de la póliza ...
  }
}
```

## 🎨 Interfaz de Usuario

### Badges Visuales

- **📄 Extracción desde PDF**: Indica que los datos fueron importados automáticamente
- **✏️ N campo(s) modificado(s)**: Badge amarillo indicando que hubo edición manual después de la extracción
- **✍️ Captura manual**: Indica que todos los campos fueron introducidos manualmente

### Lista de Campos Modificados

Cuando hay modificaciones post-PDF, se muestra una lista de badges con los nombres de los campos que fueron editados:

```
✏️ Campos editados manualmente post-extracción:
[numero_poliza] [fecha_emision] [prima_neta] [total]
```

## 📈 Beneficios

1. **Auditoría Completa**: Saber exactamente cómo se capturó cada póliza
2. **Mejora del Extractor**: Identificar qué campos requieren más correcciones manuales
3. **Confiabilidad**: Mayor transparencia en el origen de los datos
4. **Cumplimiento**: Trazabilidad completa para auditorías
5. **Optimización**: Detectar patrones de modificaciones para mejorar el extractor automático

## 🔍 Campos Monitoreados

El sistema monitorea cambios en los siguientes campos críticos después de una extracción de PDF:

- **Identificación**: `numero_poliza`, `numero_endoso`, `compania`, `producto`
- **Fechas**: `fecha_emision`, `inicio_vigencia`, `termino_vigencia`, `fecha_vencimiento_pago`
- **Montos**: `prima_neta`, `total`
- **Pago**: `tipo_pago`, `frecuenciaPago`, `estatusPago`
- **Vehículo**: `marca`, `modelo`, `anio`, `placas`, `numero_serie`
- **Agente**: `agente`

## 🚀 Uso

El sistema funciona automáticamente:

1. **Usuario selecciona método de captura** en el modal inicial
2. **Sistema marca internamente** el método utilizado
3. **Si es PDF**: Se guarda un snapshot de los datos extraídos
4. **Usuario edita campos** (opcional)
5. **Al guardar**: Sistema compara estado actual vs snapshot
6. **Registro automático** en historial con toda la información

## 📝 Notas Técnicas

- Los campos temporales (`_metodo_captura`, `_snapshot_pdf`, `_campos_modificados_post_pdf`) se eliminan antes de enviar al backend
- La detección de cambios es inteligente e ignora campos vacíos o undefined
- El snapshot se serializa en JSON para evitar referencias mutables
- La comparación se hace solo sobre campos relevantes para optimizar rendimiento

## ✅ Estado

- ✅ Detección de método de captura (manual/PDF)
- ✅ Snapshot de datos extraídos del PDF
- ✅ Detección automática de campos modificados
- ✅ Registro en historial con datos detallados
- ✅ Visualización mejorada en timeline
- ✅ Badges y alertas visuales

---

**Fecha de implementación**: 8 de enero de 2026
**Archivos modificados**:
- `src/components/expedientes/FormularioNuevoExpediente.jsx`
- `src/screens/NvoExpedientes.jsx`
- `src/components/TimelineExpediente.jsx`
