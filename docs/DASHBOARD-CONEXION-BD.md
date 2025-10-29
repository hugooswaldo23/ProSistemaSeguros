# Guía de Conexión del Dashboard con la Base de Datos

## 📋 Resumen de Cambios Realizados

### Archivos Limpiados
1. **src/screens/Dashboard.jsx** - Eliminados ~100 registros de datos hardcodeados
2. **src/screens/ConfiguracionTablas.jsx** - Eliminados datos de catálogos hardcodeados

---

## 🎯 Dashboard.jsx - Estados Listos para Conectar

### Estados Actualizados (líneas ~31-34)
```javascript
const [expedientes, setExpedientes] = useState([]);
const [tramites, setTramites] = useState([]);
const [pagos, setPagos] = useState([]);
const [nuevasPolizas, setNuevasPolizas] = useState([]);
```

### Tipos de Datos que se Necesitan Cargar

#### 1. **Trámites** (para sección "Gestión de Trámites")
Filtrar de `expedientes` donde `tipo === 'tramite'`

**Estructura esperada:**
```javascript
{
  id: number,
  tipo: 'tramite',
  tramite: string, // Nombre del tipo de trámite
  poliza: string,
  
  // Roles involucrados
  cliente: string,
  telefono: string,
  email: string,
  agente: string,
  agenteEmail: string,
  agenteTelefono: string,
  vendedor: string | null,
  vendedorEmail: string,
  vendedorTelefono: string,
  ejecutivo: string,
  ejecutivoEmail: string,
  ejecutivoTelefono: string,
  
  // Información de la póliza
  aseguradora: string,
  producto: string,
  vehiculo: string, // Solo si aplica (Autos)
  placas: string, // Solo si aplica (Autos)
  fechaSolicitud: string, // Formato: 'YYYY-MM-DD'
  estado: 'En proceso' | 'Pendiente' | 'Autorizado',
  descripcion: string,
  archivos: string[], // Array de nombres de archivos
  observaciones: string,
  solicitadoPor: 'Cliente' | 'Agente' | 'Vendedor' | 'Ejecutivo'
}
```

**Tipos de trámites definidos:**
- Cambio de beneficiario (CB)
- Actualización de datos (AD)
- Cambio de forma de pago (FP)
- Solicitud de cancelación (SC)
- Reexpedición de póliza (RP)
- Cambio de cobertura (CC)
- Inclusión/Exclusión (IE)
- Cambio suma asegurada (SA)
- Rehabilitación (RH)
- Endoso (EN)

---

#### 2. **Nuevas Pólizas** (para sección "Pipeline de Nuevas Pólizas")
Filtrar de `expedientes` donde `tipo === 'nueva'`

**Estructura esperada:**
```javascript
{
  id: number,
  tipo: 'nueva',
  etapa: string, // Una de las 5 etapas definidas
  producto: string,
  cliente: string,
  empresa: string
}
```

**Etapas definidas:**
1. 'Solicitud de cotización' (COT)
2. 'Cotización enviada' (ENV)
3. 'Solicitar emisión' (EMI)
4. 'Emitida pendiente de pago' (PEN)
5. 'Pagada' (PAG)

---

#### 3. **Pagos** (para sección "Control Financiero de Pagos")
Filtrar de `expedientes` donde `tipo === 'pago'`

**Estructura esperada:**
```javascript
{
  id: number,
  tipo: 'pago',
  estatusPago: 'Vencido' | 'Por vencer' | 'En período de gracia',
  poliza: string,
  monto: number,
  cliente: string,
  diasVencido?: number, // Solo si estatusPago === 'Vencido'
  diasParaVencer?: number, // Solo si estatusPago === 'Por vencer'
  diasGracia?: number // Solo si estatusPago === 'En período de gracia'
}
```

---

## 🎨 ConfiguracionTablas.jsx - Catálogos Listos para Conectar

### Estados Actualizados (líneas ~202-217)
```javascript
const [documentosPersonaFisica, setDocumentosPersonaFisica] = useState([]);
const [documentosPersonaMoral, setDocumentosPersonaMoral] = useState([]);
const [canalesVenta, setCanalesVenta] = useState([]);
const [categoriasClientes, setCategoriaClientes] = useState([]);
const [tiposTramites, setTiposTramites] = useState([]);
const [tiposProductos, setTiposProductos] = useState([]);
```

### Estructuras de Datos de Catálogos

#### 1. **Documentos Persona Física**
```javascript
{
  id: number,
  nombre: string,
  codigo: string, // Ej: 'DOC_PF_001'
  obligatorio: boolean,
  vigenciaDias: number, // 0 = sin vencimiento
  activo: boolean,
  orden: number
}
```

#### 2. **Documentos Persona Moral**
```javascript
{
  id: number,
  nombre: string,
  codigo: string, // Ej: 'DOC_PM_001'
  obligatorio: boolean,
  vigenciaDias: number,
  activo: boolean,
  orden: number
}
```

#### 3. **Canales de Venta**
```javascript
{
  id: number,
  nombre: string,
  codigo: string, // Ej: 'CV_001'
  descripcion: string,
  icono: string, // Nombre del icono de lucide-react
  color: string, // 'primary', 'success', 'info', etc.
  activo: boolean,
  orden: number
}
```

#### 4. **Categorías de Clientes**
```javascript
{
  id: number,
  nombre: string,
  codigo: string, // Ej: 'CAT_001'
  descripcion: string,
  color: string, // 'primary', 'warning', 'secondary', etc.
  activo: boolean,
  orden: number
}
```

#### 5. **Tipos de Trámites**
```javascript
{
  id: number,
  nombre: string,
  codigo: string, // Ej: 'TRAM_001'
  descripcion: string,
  tiempoEstimado: number, // Horas
  requiereDocumentos: boolean,
  documentosRequeridos: string[], // Array de códigos de documentos
  activo: boolean,
  orden: number
}
```

---

## 🔌 Pasos para Conectar con la Base de Datos

### 1. Crear useEffect para cargar datos iniciales

En **Dashboard.jsx**, agregar después de los estados:

```javascript
useEffect(() => {
  cargarDatosIniciales();
}, []);

const cargarDatosIniciales = async () => {
  try {
    // Cargar todos los expedientes de la BD
    const response = await fetch('/api/expedientes'); // O tu servicio
    const data = await response.json();
    
    setExpedientes(data);
    
    // O si necesitas separarlos:
    setTramites(data.filter(e => e.tipo === 'tramite'));
    setNuevasPolizas(data.filter(e => e.tipo === 'nueva'));
    setPagos(data.filter(e => e.tipo === 'pago'));
  } catch (error) {
    console.error('Error al cargar datos:', error);
  }
};
```

### 2. Crear useEffect para catálogos

En **ConfiguracionTablas.jsx**, agregar:

```javascript
useEffect(() => {
  cargarCatalogos();
}, []);

const cargarCatalogos = async () => {
  try {
    // Cargar cada catálogo desde la BD
    const [docs_pf, docs_pm, canales, categorias, tramites, productos] = 
      await Promise.all([
        tiposDocumentosService.obtenerPorTipoPersona('fisica'),
        tiposDocumentosService.obtenerPorTipoPersona('moral'),
        canalesVentaService.obtenerTodos(),
        categoriasClientesService.obtenerTodos(),
        tiposTramitesService.obtenerTodos(),
        tiposProductosService.obtenerTodos()
      ]);
    
    setDocumentosPersonaFisica(docs_pf);
    setDocumentosPersonaMoral(docs_pm);
    setCanalesVenta(canales);
    setCategoriaClientes(categorias);
    setTiposTramites(tramites);
    setTiposProductos(productos);
  } catch (error) {
    console.error('Error al cargar catálogos:', error);
  }
};
```

---

## 📊 KPIs y Métricas Calculadas

El Dashboard calcula automáticamente estas estadísticas a partir de los datos:

### Estadísticas de Trámites
- Total de trámites activos
- Agrupación por tipo de trámite
- Conteo de pendientes vs en proceso vs autorizados

### Estadísticas de Nuevas Pólizas
- Cantidad por cada etapa del pipeline
- Visualización de progreso

### Estadísticas de Pagos
- Total de pagos vencidos
- Total de pagos por vencer (próximos 7 días)
- Total en período de gracia
- Suma total de montos por cobrar

---

## ✅ Validación

### Dashboard muestra correctamente cuando:
- [ ] Los KPIs en la parte superior reflejan datos reales
- [ ] La sección de Trámites muestra los registros activos
- [ ] El modal de detalle abre con información completa
- [ ] El pipeline de Nuevas Pólizas muestra cantidades por etapa
- [ ] El Control de Pagos agrupa correctamente por estatus

### ConfiguracionTablas funciona cuando:
- [ ] Cada pestaña muestra sus catálogos correspondientes
- [ ] Los formularios de agregar/editar funcionan
- [ ] Se pueden activar/desactivar registros
- [ ] El orden se respeta en las visualizaciones

---

## 🚨 Datos de Seed/Demo (Opcional)

Si necesitas datos de prueba para desarrollo, puedes crear un script SQL con los datos que se eliminaron. Los encuentras en:
- Commit anterior: `8b7868b`
- Líneas eliminadas están en el diff del commit

Para restaurar temporalmente:
```bash
git show 8b7868b:src/screens/Dashboard.jsx > Dashboard-con-datos.jsx
```

---

## 📝 Notas Importantes

1. **Tipos de datos:** El Dashboard agrupa por el campo `tipo` en expedientes
2. **Estados:** Los trámites usan `estado`, los pagos usan `estatusPago`
3. **Filtrado:** Todas las estadísticas se calculan con `useMemo` para optimización
4. **Modal:** El modal de detalle espera el objeto completo del trámite

---

**Última actualización:** 28 de octubre de 2025  
**Commits relacionados:**
- Limpieza de datos: `08e6e43`
- Layout optimizado: `8b7868b`
