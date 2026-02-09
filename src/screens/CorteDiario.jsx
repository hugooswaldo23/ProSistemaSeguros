import React, { useState, useEffect, useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Edit, Trash2, Filter, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;

// Categorías de movimientos
const CATEGORIAS_INGRESO = [
  { value: 'comisiones_cobradas', label: 'Comisiones Cobradas' },
  { value: 'otros_ingresos', label: 'Otros Ingresos' }
];

const CATEGORIAS_EGRESO = [
  { value: 'nomina', label: 'Nómina' },
  { value: 'gastos_fijos', label: 'Gastos Fijos (Renta, Luz, Agua, Tel, Internet)' },
  { value: 'gastos_administrativos', label: 'Gastos Administrativos' },
  { value: 'consumibles', label: 'Consumibles (Papelería, Tóner, etc.)' }
];

const TODAS_CATEGORIAS = [...CATEGORIAS_INGRESO, ...CATEGORIAS_EGRESO];

const getLabelCategoria = (value) => {
  const cat = TODAS_CATEGORIAS.find(c => c.value === value);
  return cat ? cat.label : value;
};

const CorteDiario = () => {
  const [loading, setLoading] = useState(false);
  const { equipoDeTrabajo: empleados } = useEquipoDeTrabajo();
  
  // Filtros
  const [fechaDesde, setFechaDesde] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'ingreso' | 'egreso'
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  
  // Datos
  const [movimientos, setMovimientos] = useState([]);
  
  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [movimientoEditando, setMovimientoEditando] = useState(null);
  const [tipoMovimiento, setTipoMovimiento] = useState('egreso');
  
  useEffect(() => {
    cargarMovimientos();
  }, [fechaDesde, fechaHasta]);
  
  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
      const response = await fetch(`${API_URL}/api/corte-diario?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setMovimientos(data);
        } else {
          setMovimientos([]);
        }
      } else {
        setMovimientos([]);
      }
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  };
  
  const guardarMovimiento = async (datos) => {
    setLoading(true);
    try {
      const url = movimientoEditando 
        ? `${API_URL}/api/corte-diario/${movimientoEditando.id}`
        : `${API_URL}/api/corte-diario`;
      const method = movimientoEditando ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        },
        body: JSON.stringify(datos)
      });
      
      if (response.ok) {
        toast.success(movimientoEditando ? 'Movimiento actualizado' : 'Movimiento registrado');
        cargarMovimientos();
        cerrarModal();
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.message || 'Error al guardar');
        } else {
          throw new Error('Endpoint no disponible');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('no disponible')) {
        // Modo desarrollo
        const nuevoMov = {
          id: movimientoEditando?.id || Date.now(),
          ...datos,
          created_at: movimientoEditando?.created_at || new Date().toISOString()
        };
        
        if (movimientoEditando) {
          setMovimientos(prev => prev.map(m => m.id === nuevoMov.id ? nuevoMov : m));
        } else {
          setMovimientos(prev => [...prev, nuevoMov]);
        }
        toast.success(`Movimiento ${movimientoEditando ? 'actualizado' : 'registrado'} (modo desarrollo)`);
        cerrarModal();
      } else {
        toast.error(error.message || 'Error al guardar movimiento');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const eliminarMovimiento = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/corte-diario/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      
      if (response.ok) {
        toast.success('Movimiento eliminado');
        cargarMovimientos();
      } else {
        throw new Error('Error al eliminar');
      }
    } catch (error) {
      // Modo desarrollo
      setMovimientos(prev => prev.filter(m => m.id !== id));
      toast.success('Movimiento eliminado (modo desarrollo)');
    }
  };
  
  const cerrarModal = () => {
    setModalAbierto(false);
    setMovimientoEditando(null);
    setTipoMovimiento('egreso');
  };
  
  const abrirNuevo = (tipo) => {
    setTipoMovimiento(tipo);
    setMovimientoEditando(null);
    setModalAbierto(true);
  };
  
  const abrirEditar = (mov) => {
    setTipoMovimiento(mov.tipo);
    setMovimientoEditando(mov);
    setModalAbierto(true);
  };
  
  // Filtrado
  const movimientosFiltrados = useMemo(() => {
    let filtrados = [...movimientos];
    if (filtroTipo !== 'todos') {
      filtrados = filtrados.filter(m => m.tipo === filtroTipo);
    }
    if (filtroCategoria !== 'todas') {
      filtrados = filtrados.filter(m => m.categoria === filtroCategoria);
    }
    // Ordenar por fecha desc
    filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return filtrados;
  }, [movimientos, filtroTipo, filtroCategoria]);
  
  // Totales
  const totales = useMemo(() => {
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + parseFloat(m.monto || 0), 0);
    const egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + parseFloat(m.monto || 0), 0);
    
    // Por categoría
    const porCategoria = {};
    movimientos.forEach(m => {
      const key = m.categoria;
      if (!porCategoria[key]) porCategoria[key] = { tipo: m.tipo, total: 0, count: 0 };
      porCategoria[key].total += parseFloat(m.monto || 0);
      porCategoria[key].count++;
    });
    
    return { ingresos, egresos, balance: ingresos - egresos, porCategoria };
  }, [movimientos]);
  
  const formatMoney = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const getBadgeCategoria = (categoria) => {
    const colores = {
      comisiones_cobradas: 'bg-success',
      otros_ingresos: 'bg-info',
      nomina: 'bg-primary',
      gastos_fijos: 'bg-warning text-dark',
      gastos_administrativos: 'bg-secondary',
      consumibles: 'bg-dark'
    };
    return colores[categoria] || 'bg-secondary';
  };
  
  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h2 className="mb-0">
            <DollarSign className="me-2" size={32} />
            Corte Diario
          </h2>
          <div className="d-flex gap-2">
            <button className="btn btn-success" onClick={() => abrirNuevo('ingreso')}>
              <ArrowUpCircle size={18} className="me-1" /> Registrar Ingreso
            </button>
            <button className="btn btn-danger" onClick={() => abrirNuevo('egreso')}>
              <ArrowDownCircle size={18} className="me-1" /> Registrar Egreso
            </button>
          </div>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card bg-success text-white">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-white-50">Total Ingresos</small>
                  <h3 className="mb-0">{formatMoney(totales.ingresos)}</h3>
                </div>
                <TrendingUp size={40} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-danger text-white">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-white-50">Total Egresos</small>
                  <h3 className="mb-0">{formatMoney(totales.egresos)}</h3>
                </div>
                <TrendingDown size={40} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className={`card ${totales.balance >= 0 ? 'bg-primary' : 'bg-dark'} text-white`}>
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-white-50">Balance</small>
                  <h3 className="mb-0">{formatMoney(totales.balance)}</h3>
                </div>
                <DollarSign size={40} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desglose por categoría */}
      {Object.keys(totales.porCategoria).length > 0 && (
        <div className="row mb-4">
          {Object.entries(totales.porCategoria).map(([cat, data]) => (
            <div className="col-md-3 col-sm-6 mb-2" key={cat}>
              <div className="card">
                <div className="card-body py-2">
                  <small className="text-muted d-block">{getLabelCategoria(cat)}</small>
                  <span className={`fw-bold ${data.tipo === 'ingreso' ? 'text-success' : 'text-danger'}`}>
                    {data.tipo === 'egreso' ? '-' : '+'}{formatMoney(data.total)}
                  </span>
                  <small className="text-muted ms-2">({data.count} mov.)</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-2">
              <label className="form-label small">Fecha Desde</label>
              <input type="date" className="form-control form-control-sm" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Fecha Hasta</label>
              <input type="date" className="form-control form-control-sm" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Tipo</label>
              <select className="form-select form-select-sm" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small">Categoría</label>
              <select className="form-select form-select-sm" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                <option value="todas">Todas</option>
                <optgroup label="Ingresos">
                  {CATEGORIAS_INGRESO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </optgroup>
                <optgroup label="Egresos">
                  {CATEGORIAS_EGRESO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="col-md-3 text-end">
              <small className="text-muted">{movimientosFiltrados.length} movimientos</small>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="card">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0"><Filter size={18} className="me-2" />Movimientos</h5>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2 text-muted">Cargando movimientos...</p>
            </div>
          ) : movimientosFiltrados.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <DollarSign size={48} className="mb-3" />
              <p>No hay movimientos en el período seleccionado</p>
              <div className="d-flex justify-content-center gap-2">
                <button className="btn btn-sm btn-success" onClick={() => abrirNuevo('ingreso')}>
                  <Plus size={16} className="me-1" />Registrar Ingreso
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => abrirNuevo('egreso')}>
                  <Plus size={16} className="me-1" />Registrar Egreso
                </button>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-dark">
                  <tr>
                    <th style={{ width: '110px' }}>Fecha</th>
                    <th className="text-center" style={{ width: '90px' }}>Tipo</th>
                    <th style={{ width: '200px' }}>Categoría</th>
                    <th>Concepto</th>
                    <th style={{ width: '150px' }}>Referencia</th>
                    <th className="text-end" style={{ width: '130px' }}>Monto</th>
                    <th className="text-center" style={{ width: '100px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map((mov) => (
                    <tr key={mov.id}>
                      <td>{new Date(mov.fecha).toLocaleDateString('es-MX')}</td>
                      <td className="text-center">
                        {mov.tipo === 'ingreso' ? (
                          <span className="badge bg-success"><ArrowUpCircle size={12} className="me-1" />Ingreso</span>
                        ) : (
                          <span className="badge bg-danger"><ArrowDownCircle size={12} className="me-1" />Egreso</span>
                        )}
                      </td>
                      <td><span className={`badge ${getBadgeCategoria(mov.categoria)}`}>{getLabelCategoria(mov.categoria)}</span></td>
                      <td>{mov.concepto || '-'}</td>
                      <td><small className="text-muted">{mov.referencia || '-'}</small></td>
                      <td className={`text-end fw-bold ${mov.tipo === 'ingreso' ? 'text-success' : 'text-danger'}`}>
                        {mov.tipo === 'egreso' ? '-' : '+'}{formatMoney(mov.monto)}
                      </td>
                      <td className="text-center">
                        {!mov.es_automatico && (
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" onClick={() => abrirEditar(mov)} title="Editar"><Edit size={14} /></button>
                            <button className="btn btn-outline-danger" onClick={() => eliminarMovimiento(mov.id)} title="Eliminar"><Trash2 size={14} /></button>
                          </div>
                        )}
                        {mov.es_automatico && (
                          <small className="text-muted">Auto</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th colSpan="5" className="text-end">TOTAL INGRESOS:</th>
                    <th className="text-end text-success">+{formatMoney(movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0))}</th>
                    <th></th>
                  </tr>
                  <tr>
                    <th colSpan="5" className="text-end">TOTAL EGRESOS:</th>
                    <th className="text-end text-danger">-{formatMoney(movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0))}</th>
                    <th></th>
                  </tr>
                  <tr>
                    <th colSpan="5" className="text-end">BALANCE:</th>
                    <th className={`text-end fw-bold ${
                      (movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0) -
                       movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0)) >= 0
                        ? 'text-primary' : 'text-danger'
                    }`}>
                      {formatMoney(
                        movimientosFiltrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0) -
                        movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto || 0), 0)
                      )}
                    </th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal para crear/editar movimiento */}
      {modalAbierto && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={cerrarModal}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className={`modal-header ${tipoMovimiento === 'ingreso' ? 'bg-success' : 'bg-danger'} text-white`}>
                <h5 className="modal-title">
                  {tipoMovimiento === 'ingreso' ? <ArrowUpCircle size={20} className="me-2" /> : <ArrowDownCircle size={20} className="me-2" />}
                  {movimientoEditando ? 'Editar' : 'Nuevo'} {tipoMovimiento === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrarModal}></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                guardarMovimiento({
                  tipo: tipoMovimiento,
                  categoria: fd.get('categoria'),
                  fecha: fd.get('fecha'),
                  concepto: fd.get('concepto'),
                  monto: parseFloat(fd.get('monto')),
                  referencia: fd.get('referencia') || '',
                  observaciones: fd.get('observaciones') || ''
                });
              }}>
                <div className="modal-body">
                  {/* Selector de tipo (por si quiere cambiar en el modal) */}
                  <div className="mb-3">
                    <div className="btn-group w-100" role="group">
                      <button type="button" className={`btn ${tipoMovimiento === 'ingreso' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setTipoMovimiento('ingreso')}>
                        <ArrowUpCircle size={16} className="me-1" /> Ingreso
                      </button>
                      <button type="button" className={`btn ${tipoMovimiento === 'egreso' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setTipoMovimiento('egreso')}>
                        <ArrowDownCircle size={16} className="me-1" /> Egreso
                      </button>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Categoría <span className="text-danger">*</span></label>
                      <select name="categoria" className="form-select" defaultValue={movimientoEditando?.categoria || ''} required>
                        <option value="">Seleccionar...</option>
                        {tipoMovimiento === 'ingreso' 
                          ? CATEGORIAS_INGRESO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)
                          : CATEGORIAS_EGRESO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)
                        }
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Fecha <span className="text-danger">*</span></label>
                      <input type="date" name="fecha" className="form-control" defaultValue={movimientoEditando?.fecha || new Date().toISOString().split('T')[0]} required />
                    </div>
                    <div className="col-md-8">
                      <label className="form-label">Concepto <span className="text-danger">*</span></label>
                      <input type="text" name="concepto" className="form-control" defaultValue={movimientoEditando?.concepto || ''} placeholder={tipoMovimiento === 'ingreso' ? 'Ej: Comisión póliza #12345 Qualitas' : 'Ej: Pago de renta oficina febrero'} required />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Monto <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" name="monto" className="form-control" defaultValue={movimientoEditando?.monto || ''} placeholder="0.00" min="0.01" step="0.01" required />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Referencia / No. Factura</label>
                      <input type="text" name="referencia" className="form-control" defaultValue={movimientoEditando?.referencia || ''} placeholder="Ej: FAC-001, Recibo #45" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Observaciones</label>
                      <input type="text" name="observaciones" className="form-control" defaultValue={movimientoEditando?.observaciones || ''} placeholder="Notas adicionales..." />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
                  <button type="submit" className={`btn ${tipoMovimiento === 'ingreso' ? 'btn-success' : 'btn-danger'}`} disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1" /> : <Plus size={16} className="me-1" />}
                    {movimientoEditando ? 'Actualizar' : 'Registrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorteDiario;
