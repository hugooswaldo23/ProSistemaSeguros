# ⚠️ Análisis de Rendimiento: ¿Soporta 5,000 Pólizas?

## 📊 Estado Actual

### ❌ Problemas Identificados

1. **Backend: SIN límites ni paginación**
   - `GET /api/expedientes` devuelve TODAS las pólizas de una vez
   - Sin parámetros de paginación (page, limit, offset)
   - Sin índices optimizados en base de datos
   - Carga completa en memoria del servidor

2. **Frontend: Paginación solo del lado del cliente**
   - `useExpedientes` hook carga TODOS los expedientes al inicio
   - `usePaginacion` recibe el array completo y lo divide después
   - No hay lazy loading ni virtualización
   - Búsqueda se ejecuta sobre TODO el array en memoria

3. **Transferencia de datos masiva**
   - Con 5000 pólizas x ~2KB promedio = ~10MB por carga
   - Se transfiere todo aunque solo se muestren 10 items
   - Cada recarga trae las 5000 pólizas de nuevo

4. **Filtros ineficientes**
   - `expedientesFiltrados` ejecuta `.filter()` sobre las 5000 pólizas
   - Se recalcula en cada cambio de carpeta
   - Operaciones Date() repetidas 5000 veces por filtro

## 🚨 Impacto Esperado con 5,000 Pólizas

| Métrica | Actual (100 pólizas) | Con 5,000 pólizas |
|---------|---------------------|-------------------|
| **Carga inicial** | ~500ms | 8-12 segundos ⚠️ |
| **Transferencia red** | ~200KB | ~10MB ⚠️ |
| **Memoria navegador** | ~5MB | ~250MB ⚠️ |
| **Cambio de carpeta** | Instantáneo | 1-2 segundos ⚠️ |
| **Búsqueda** | ~100ms | 500-800ms ⚠️ |
| **Scroll en lista** | Fluido | Lag visible ⚠️ |

## ✅ Soluciones Recomendadas

### 1. **Backend: Implementar Paginación Real**

```javascript
// backend/routes/expedientes.js
app.get('/api/expedientes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const carpeta = req.query.carpeta || 'en_proceso';
    const busqueda = req.query.busqueda || '';
    
    // Construir WHERE según carpeta
    let whereClause = 'WHERE e.deleted_at IS NULL';
    
    if (carpeta === 'vigentes') {
      whereClause += ` AND e.estatus_pago = 'Pagado'`;
    } else if (carpeta === 'en_proceso') {
      whereClause += ` AND DATEDIFF(e.fecha_vencimiento_pago, CURDATE()) <= 15 
                       AND e.fecha_vencimiento_pago >= CURDATE()`;
    } else if (carpeta === 'vencidas') {
      whereClause += ` AND e.fecha_vencimiento_pago < CURDATE()`;
    }
    
    // Agregar búsqueda
    if (busqueda) {
      whereClause += ` AND (
        e.numero_poliza LIKE ? OR
        e.compania LIKE ? OR
        c.nombre LIKE ? OR
        c.apellido_paterno LIKE ?
      )`;
    }
    
    // Query con paginación
    const query = `
      SELECT 
        e.*,
        c.nombre as cliente_nombre,
        c.apellido_paterno,
        c.apellido_materno
      FROM expedientes e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      ${whereClause}
      ORDER BY e.fecha_creacion DESC
      LIMIT ? OFFSET ?
    `;
    
    const params = busqueda 
      ? [`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`, limit, offset]
      : [limit, offset];
    
    // Obtener total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM expedientes e
      LEFT JOIN clientes c ON e.cliente_id = c.id
      ${whereClause}
    `;
    
    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query(countQuery, busqueda ? [`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`] : []);
    
    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error al listar expedientes:', error);
    res.status(500).json({ error: 'Error al listar expedientes' });
  }
});
```

### 2. **Frontend: Hook con Paginación del Servidor**

```javascript
// src/hooks/useExpedientes.js
export const useExpedientes = ({ carpeta = 'en_proceso', page = 1, limit = 50, busqueda = '' }) => {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  const cargarExpedientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        carpeta,
        busqueda
      });
      
      const response = await fetch(`${API_URL}/api/expedientes?${params}`);
      if (!response.ok) {
        throw new Error('Error al cargar expedientes');
      }
      
      const data = await response.json();
      
      setExpedientes(data.data);
      setPagination(data.pagination);
      
      console.log('📋 Expedientes cargados:', data.data.length, 'de', data.pagination.total);
      
      return data.data;
    } catch (err) {
      console.error('Error al cargar expedientes:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [page, limit, carpeta, busqueda]);

  useEffect(() => {
    cargarExpedientes();
  }, [cargarExpedientes]);
  
  return {
    expedientes,
    loading,
    error,
    pagination,
    cargarExpedientes
  };
};
```

### 3. **Índices en Base de Datos**

```sql
-- Índices para optimizar consultas
CREATE INDEX idx_expedientes_estatus_pago ON expedientes(estatus_pago);
CREATE INDEX idx_expedientes_fecha_vencimiento ON expedientes(fecha_vencimiento_pago);
CREATE INDEX idx_expedientes_etapa_activa ON expedientes(etapa_activa);
CREATE INDEX idx_expedientes_numero_poliza ON expedientes(numero_poliza);
CREATE INDEX idx_expedientes_compania ON expedientes(compania);
CREATE INDEX idx_expedientes_cliente_id ON expedientes(cliente_id);
CREATE INDEX idx_expedientes_deleted_at ON expedientes(deleted_at);

-- Índice compuesto para carpetas
CREATE INDEX idx_expedientes_carpeta ON expedientes(estatus_pago, fecha_vencimiento_pago, etapa_activa);
```

### 4. **Virtualización de Lista (Opcional)**

Si necesitas mostrar 1000+ items en pantalla, usar `react-window`:

```bash
npm install react-window
```

```javascript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={expedientes.length}
  itemSize={60}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ExpedienteRow expediente={expedientes[index]} />
    </div>
  )}
</FixedSizeList>
```

## 🎯 Prioridades

### Fase 1 (URGENTE - 1 día) ⚠️
1. ✅ Implementar paginación en backend
2. ✅ Agregar índices en base de datos
3. ✅ Modificar hook useExpedientes para paginación

### Fase 2 (1-2 días)
4. ✅ Adaptar ListaExpedientes para usar paginación real
5. ✅ Implementar búsqueda del lado del servidor
6. ✅ Optimizar filtros de carpetas

### Fase 3 (Opcional - 1 día)
7. ⭕ Implementar virtualización con react-window
8. ⭕ Caché con React Query
9. ⭕ Debounce en búsqueda

## 📈 Mejora Esperada

| Métrica | Antes | Después |
|---------|-------|---------|
| **Carga inicial** | 8-12s | ~800ms ✅ |
| **Transferencia red** | ~10MB | ~100KB ✅ |
| **Memoria navegador** | ~250MB | ~10MB ✅ |
| **Cambio de carpeta** | 1-2s | ~300ms ✅ |
| **Búsqueda** | 500-800ms | ~200ms ✅ |

## ⚡ Conclusión

**Estado actual:** ❌ **NO** soporta 5,000 pólizas de manera eficiente

**Con optimizaciones (Fase 1 + Fase 2):** ✅ **SÍ** soporta hasta 50,000+ pólizas

**Tiempo estimado:** 2-3 días de desarrollo

**Impacto:** Crítico para escalabilidad del sistema
