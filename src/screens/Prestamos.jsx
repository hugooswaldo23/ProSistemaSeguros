import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Check, Banknote, MinusCircle, PlusCircle, Eye, DollarSign, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;

const Prestamos = () => {
  const [loading, setLoading] = useState(false);
  const { equipoDeTrabajo: empleados } = useEquipoDeTrabajo();
  
  const [listaPrestamos, setListaPrestamos] = useState([]);
  const [modalPrestamo, setModalPrestamo] = useState(false);
  const [filtroPrestamos, setFiltroPrestamos] = useState('Activo');
  
  // Modal Abonar
  const [modalAbono, setModalAbono] = useState(false);
  const [grupoAbono, setGrupoAbono] = useState(null); // grupo del empleado
  
  // Modal Ver (historial de movimientos)
  const [modalDetalle, setModalDetalle] = useState(false);
  const [prestamoDetalle, setPrestamoDetalle] = useState(null);
  const [movimientosPrestamo, setMovimientosPrestamo] = useState([]);
  
  useEffect(() => {
    cargarPrestamos();
  }, []);
  
  const cargarPrestamos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/prestamos`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const prestamos = await response.json();
          setListaPrestamos(prestamos);
        }
      }
    } catch (error) {
      console.error('Error al cargar prestamos:', error);
    }
  };
  
  const getNombreEmpleado = (empleadoId) => {
    const emp = empleados.find(e => e.id === empleadoId);
    if (!emp) return 'Desconocido';
    return `${emp.nombre || ''} ${emp.apellidoPaterno || ''}`.trim();
  };
  
  const crearPrestamo = async (datos) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        },
        body: JSON.stringify(datos)
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          await response.json();
        }
        toast.success('Prestamo registrado correctamente');
        cargarPrestamos();
        setModalPrestamo(false);
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.message || 'Error al crear prestamo');
        } else {
          throw new Error('Error al crear prestamo - endpoint no disponible');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('endpoint no disponible')) {
        const nuevoPrestamo = {
          id: Date.now(),
          ...datos,
          monto_original: datos.monto,
          saldo_pendiente: datos.monto,
          fecha_prestamo: datos.fecha_prestamo || new Date().toISOString().split('T')[0],
          estatus: 'Activo',
          movimientos: [],
          created_at: new Date().toISOString()
        };
        setListaPrestamos(prev => [...prev, nuevoPrestamo]);
        toast.success('Prestamo registrado (modo desarrollo)');
        setModalPrestamo(false);
      } else {
        toast.error(error.message || 'Error al crear prestamo');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Abonar al saldo del empleado
  const registrarAbono = async (empleadoId, datos) => {
    setLoading(true);
    try {
      // Enviar al endpoint con empleado_id
      const response = await fetch(`${API_URL}/api/prestamos/abono`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        },
        body: JSON.stringify({ empleado_id: empleadoId, ...datos })
      });
      
      if (response.ok) {
        toast.success('Abono registrado correctamente');
        cargarPrestamos();
        setModalAbono(false);
        setGrupoAbono(null);
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.message || 'Error al registrar abono');
        } else {
          throw new Error('Endpoint no disponible');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('no disponible')) {
        // Modo desarrollo: distribuir abono entre préstamos activos del empleado
        let restante = parseFloat(datos.monto);
        setListaPrestamos(prev => prev.map(p => {
          if (p.empleado_id === empleadoId && p.estatus === 'Activo' && restante > 0) {
            const saldo = parseFloat(p.saldo_pendiente);
            const aplicar = Math.min(restante, saldo);
            restante -= aplicar;
            const nuevoSaldo = Math.max(0, saldo - aplicar);
            const movs = p.movimientos || [];
            movs.push({
              id: Date.now() + Math.random(),
              tipo: 'Cobro',
              monto: aplicar,
              saldo_anterior: saldo,
              saldo_nuevo: nuevoSaldo,
              observaciones: datos.observaciones || '',
              fecha: datos.fecha || new Date().toISOString().split('T')[0],
              created_at: new Date().toISOString()
            });
            return {
              ...p,
              saldo_pendiente: nuevoSaldo,
              estatus: nuevoSaldo <= 0 ? 'Liquidado' : 'Activo',
              movimientos: movs
            };
          }
          return p;
        }));
        toast.success(`Abono de $${parseFloat(datos.monto).toFixed(2)} registrado (modo desarrollo)`);
        setModalAbono(false);
        setGrupoAbono(null);
      } else {
        toast.error(error.message || 'Error al registrar abono');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Ver flujo de caja del empleado
  const verDetalleGrupo = async (grupo) => {
    setPrestamoDetalle(grupo);
    setModalDetalle(true);
    
    // Construir flujo de caja cronológico con todas los movimientos
    let flujo = [];
    
    for (const prestamo of grupo.prestamos) {
      // Agregar el préstamo inicial como movimiento
      flujo.push({
        id: `p-${prestamo.id}`,
        fecha: prestamo.fecha_prestamo || prestamo.created_at,
        tipo: 'Prestamo',
        prestamo: parseFloat(prestamo.monto_original || prestamo.monto || 0),
        abono: 0,
        observaciones: prestamo.motivo || 'Préstamo otorgado',
      });
      
      // Cargar movimientos del préstamo
      let movs = [];
      try {
        const response = await fetch(`${API_URL}/api/prestamos/${prestamo.id}/movimientos`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        });
        if (response.ok) {
          const ct = response.headers.get('content-type');
          if (ct && ct.includes('application/json')) {
            movs = await response.json();
          }
        }
      } catch {
        // usar movimientos locales
      }
      
      // Fallback: movimientos locales del modo desarrollo
      if (movs.length === 0 && prestamo.movimientos) {
        movs = prestamo.movimientos;
      }
      
      // Agregar abonos/cobros al flujo (excluir el movimiento "Prestamo" inicial si viene del backend)
      movs.forEach(mov => {
        if (mov.tipo === 'Cobro' || mov.tipo === 'Ajuste') {
          flujo.push({
            id: `m-${mov.id}`,
            fecha: mov.fecha || mov.created_at,
            tipo: mov.tipo,
            prestamo: 0,
            abono: parseFloat(mov.monto || 0),
            observaciones: mov.observaciones || '',
          });
        }
      });
    }
    
    // Ordenar por fecha
    flujo.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    // Calcular saldo corrido
    let saldo = 0;
    flujo = flujo.map(mov => {
      saldo = saldo + mov.prestamo - mov.abono;
      return { ...mov, saldo };
    });
    
    setMovimientosPrestamo(flujo);
  };

  // Abrir modal de abono para el empleado
  const abrirAbonoGrupo = (grupo) => {
    if (grupo.total_saldo_pendiente <= 0) { toast.error('No hay saldo pendiente'); return; }
    setGrupoAbono(grupo);
    setModalAbono(true);
  };
  
  const liquidarPrestamo = async (prestamoId) => {
    if (!confirm('¿Estas seguro de marcar este prestamo como liquidado? Esto pondrá el saldo en $0.')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/prestamos/${prestamoId}/liquidar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      
      if (response.ok) {
        toast.success('Prestamo liquidado');
        cargarPrestamos();
      } else {
        throw new Error('Error al liquidar');
      }
    } catch (error) {
      setListaPrestamos(prev => prev.map(p => 
        p.id === prestamoId ? { ...p, estatus: 'Liquidado', saldo_pendiente: 0 } : p
      ));
      toast.success('Prestamo liquidado (modo desarrollo)');
    }
  };
  
  const prestamosFiltrados = useMemo(() => {
    if (filtroPrestamos === 'todos') return listaPrestamos;
    return listaPrestamos.filter(p => p.estatus === filtroPrestamos);
  }, [listaPrestamos, filtroPrestamos]);

  // Agrupar préstamos por empleado (una fila por empleado)
  const prestamosAgrupados = useMemo(() => {
    const grupos = {};
    prestamosFiltrados.forEach(p => {
      const eid = p.empleado_id;
      if (!grupos[eid]) {
        grupos[eid] = {
          empleado_id: eid,
          prestamos: [],
          total_monto_original: 0,
          total_saldo_pendiente: 0,
        };
      }
      grupos[eid].prestamos.push(p);
      grupos[eid].total_monto_original += parseFloat(p.monto_original || p.monto || 0);
      grupos[eid].total_saldo_pendiente += parseFloat(p.saldo_pendiente || 0);
    });
    return Object.values(grupos);
  }, [prestamosFiltrados]);
  
  const totalesPrestamos = useMemo(() => {
    const activos = listaPrestamos.filter(p => p.estatus === 'Activo');
    return {
      cantidadActivos: activos.length,
      montoTotal: activos.reduce((sum, p) => sum + parseFloat(p.monto_original || p.monto || 0), 0),
      saldoPendiente: activos.reduce((sum, p) => sum + parseFloat(p.saldo_pendiente || 0), 0)
    };
  }, [listaPrestamos]);
  
  const formatMoney = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-0">
            <Banknote className="me-2" size={32} />
            Prestamos
          </h2>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card bg-warning text-dark">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-dark">Prestamos Activos</small>
                  <h3 className="mb-0">{totalesPrestamos.cantidadActivos}</h3>
                </div>
                <Banknote size={40} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-info text-white">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-white-50">Monto Total Prestado</small>
                  <h3 className="mb-0">{formatMoney(totalesPrestamos.montoTotal)}</h3>
                </div>
                <PlusCircle size={40} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-danger text-white">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-white-50">Saldo Pendiente Total</small>
                  <h3 className="mb-0">{formatMoney(totalesPrestamos.saldoPendiente)}</h3>
                </div>
                <MinusCircle size={40} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="btn-group" role="group">
              <button className={`btn btn-sm ${filtroPrestamos === 'Activo' ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setFiltroPrestamos('Activo')}>Activos</button>
              <button className={`btn btn-sm ${filtroPrestamos === 'Liquidado' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setFiltroPrestamos('Liquidado')}>Liquidados</button>
              <button className={`btn btn-sm ${filtroPrestamos === 'todos' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setFiltroPrestamos('todos')}>Todos</button>
            </div>
            <button className="btn btn-primary" onClick={() => setModalPrestamo(true)}>
              <Plus size={18} className="me-1" />Nuevo Prestamo
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de prestamos */}
      <div className="card">
        <div className="card-header bg-light">
          <h5 className="mb-0"><Banknote size={20} className="me-2" />Lista de Prestamos ({prestamosAgrupados.length} empleado{prestamosAgrupados.length !== 1 ? 's' : ''})</h5>
        </div>
        <div className="card-body p-0">
          {prestamosAgrupados.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Banknote size={48} className="mb-3" />
              <p>No hay prestamos {filtroPrestamos !== 'todos' ? filtroPrestamos.toLowerCase() + 's' : ''} registrados</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-dark">
                  <tr>
                    <th style={{ minWidth: '200px' }}>Empleado</th>
                    <th className="text-center" style={{ width: '120px' }}>Préstamos</th>
                    <th className="text-end" style={{ width: '130px' }}>Monto Total</th>
                    <th className="text-end" style={{ width: '130px' }}>Saldo Pendiente</th>
                    <th className="text-center" style={{ width: '100px' }}>Estatus</th>
                    <th className="text-center" style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prestamosAgrupados.map((grupo) => {
                    const activos = grupo.prestamos.filter(p => p.estatus === 'Activo');
                    const liquidados = grupo.prestamos.filter(p => p.estatus === 'Liquidado');
                    const tieneActivos = activos.length > 0;
                    return (
                      <tr key={grupo.empleado_id}>
                        <td><strong>{getNombreEmpleado(grupo.empleado_id)}</strong></td>
                        <td className="text-center">
                          <span className="badge bg-primary">{grupo.prestamos.length}</span>
                          {activos.length > 0 && <small className="d-block text-warning">{activos.length} activo{activos.length > 1 ? 's' : ''}</small>}
                          {liquidados.length > 0 && <small className="d-block text-success">{liquidados.length} liquidado{liquidados.length > 1 ? 's' : ''}</small>}
                        </td>
                        <td className="text-end">{formatMoney(grupo.total_monto_original)}</td>
                        <td className="text-end">
                          {grupo.total_saldo_pendiente > 0 ? (
                            <span className="text-danger fw-bold">{formatMoney(grupo.total_saldo_pendiente)}</span>
                          ) : (
                            <span className="text-success">{formatMoney(0)}</span>
                          )}
                        </td>
                        <td className="text-center">
                          {tieneActivos ? (
                            <span className="badge bg-warning text-dark">Activo</span>
                          ) : (
                            <span className="badge bg-success">Liquidado</span>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-info" onClick={() => verDetalleGrupo(grupo)} title="Ver detalle">
                              <Eye size={14} className="me-1" />Ver
                            </button>
                            {tieneActivos && (
                              <button className="btn btn-success" onClick={() => abrirAbonoGrupo(grupo)} title="Registrar abono">
                                <DollarSign size={14} className="me-1" />Abonar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th colSpan="2" className="text-end">TOTALES:</th>
                    <th className="text-end">{formatMoney(prestamosAgrupados.reduce((s, g) => s + g.total_monto_original, 0))}</th>
                    <th className="text-end text-danger">{formatMoney(prestamosAgrupados.reduce((s, g) => s + g.total_saldo_pendiente, 0))}</th>
                    <th colSpan="2"></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nuevo Prestamo */}
      {modalPrestamo && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalPrestamo(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title"><Plus size={20} className="me-2" />Nuevo Prestamo</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalPrestamo(false)}></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                crearPrestamo({
                  empleado_id: parseInt(formData.get('empleado_id')),
                  monto: parseFloat(formData.get('monto')),
                  cuota_quincenal: parseFloat(formData.get('cuota_quincenal')) || 0,
                  motivo: formData.get('motivo'),
                  fecha_prestamo: formData.get('fecha_prestamo') || new Date().toISOString().split('T')[0]
                });
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Empleado <span className="text-danger">*</span></label>
                    <select name="empleado_id" className="form-select" required>
                      <option value="">Seleccionar empleado...</option>
                      {empleados.filter(e => e.activo !== false).map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {`${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim()} - {emp.perfil}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Monto del Prestamo <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" name="monto" className="form-control" placeholder="0.00" min="0.01" step="0.01" required />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Cuota por Quincena</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" name="cuota_quincenal" className="form-control" placeholder="0.00" min="0" step="0.01" />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Fecha del Prestamo</label>
                    <input type="date" name="fecha_prestamo" className="form-control" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Motivo / Descripcion</label>
                    <textarea name="motivo" className="form-control" rows="2" placeholder="Motivo del prestamo..."></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalPrestamo(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1" /> : <Check size={16} className="me-1" />}
                    Registrar Prestamo
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abonar */}
      {modalAbono && grupoAbono && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { setModalAbono(false); setGrupoAbono(null); }}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><DollarSign size={20} className="me-2" />Registrar Abono - {getNombreEmpleado(grupoAbono.empleado_id)}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setModalAbono(false); setGrupoAbono(null); }}></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const monto = parseFloat(fd.get('monto'));
                if (monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
                if (monto > grupoAbono.total_saldo_pendiente) {
                  if (!confirm(`El abono ($${monto.toFixed(2)}) es mayor al saldo ($${grupoAbono.total_saldo_pendiente.toFixed(2)}). ¿Continuar?`)) return;
                }
                registrarAbono(grupoAbono.empleado_id, {
                  monto: monto,
                  fecha: fd.get('fecha'),
                  observaciones: fd.get('observaciones') || ''
                });
              }}>
                <div className="modal-body">
                  <div className="text-center p-3 mb-3 bg-light rounded">
                    <small className="text-muted d-block">Saldo Pendiente</small>
                    <h3 className="text-danger mb-0">{formatMoney(grupoAbono.total_saldo_pendiente)}</h3>
                  </div>
                  
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Monto del Abono <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" name="monto" className="form-control" placeholder="0.00" min="0.01" step="0.01" required autoFocus />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Fecha del Abono</label>
                      <input type="date" name="fecha" className="form-control" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Observaciones</label>
                      <input type="text" name="observaciones" className="form-control" placeholder="Ej: Descuento de nomina, pago en efectivo..." />
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <button type="button" className="btn btn-sm btn-outline-success" onClick={() => {
                      const input = document.querySelector('input[name="monto"]');
                      if (input) { input.value = grupoAbono.total_saldo_pendiente; input.dispatchEvent(new Event('input', { bubbles: true })); }
                    }}>
                      Liquidar saldo completo ({formatMoney(grupoAbono.total_saldo_pendiente)})
                    </button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setModalAbono(false); setGrupoAbono(null); }}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1" /> : <DollarSign size={16} className="me-1" />}
                    Registrar Abono
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Flujo de Caja del Empleado */}
      {modalDetalle && prestamoDetalle && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { setModalDetalle(false); setPrestamoDetalle(null); }}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title"><History size={20} className="me-2" />Flujo de Caja - {getNombreEmpleado(prestamoDetalle.empleado_id)}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setModalDetalle(false); setPrestamoDetalle(null); }}></button>
              </div>
              <div className="modal-body p-0">
                {/* Saldo actual destacado */}
                <div className="p-3 bg-light border-bottom">
                  <div className="row text-center">
                    <div className="col-md-4">
                      <small className="text-muted d-block">Total Prestado</small>
                      <h5 className="text-primary mb-0">{formatMoney(prestamoDetalle.total_monto_original)}</h5>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block">Total Abonado</small>
                      <h5 className="text-success mb-0">{formatMoney(prestamoDetalle.total_monto_original - prestamoDetalle.total_saldo_pendiente)}</h5>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block">Saldo Actual</small>
                      <h4 className={`mb-0 fw-bold ${prestamoDetalle.total_saldo_pendiente > 0 ? 'text-danger' : 'text-success'}`}>
                        {formatMoney(prestamoDetalle.total_saldo_pendiente)}
                      </h4>
                      <small className="text-muted">Este saldo aparece en nómina</small>
                    </div>
                  </div>
                </div>

                {/* Tabla flujo de caja */}
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-secondary">
                      <tr>
                        <th style={{ width: '110px' }}>Fecha</th>
                        <th className="text-end" style={{ width: '120px' }}>Préstamo</th>
                        <th className="text-end" style={{ width: '120px' }}>Abono</th>
                        <th className="text-end" style={{ width: '130px' }}>Saldo</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosPrestamo.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4 text-muted">
                            <span className="spinner-border spinner-border-sm me-2" />
                            Cargando movimientos...
                          </td>
                        </tr>
                      ) : (
                        movimientosPrestamo.map((mov, idx) => (
                          <tr key={mov.id || idx} className={mov.tipo === 'Prestamo' ? 'table-warning' : ''}>
                            <td>{mov.fecha ? new Date(mov.fecha).toLocaleDateString('es-MX') : '-'}</td>
                            <td className="text-end">
                              {mov.prestamo > 0 ? (
                                <span className="text-primary fw-bold">{formatMoney(mov.prestamo)}</span>
                              ) : ''}
                            </td>
                            <td className="text-end">
                              {mov.abono > 0 ? (
                                <span className="text-success fw-bold">{formatMoney(mov.abono)}</span>
                              ) : ''}
                            </td>
                            <td className="text-end">
                              <span className={`fw-bold ${mov.saldo > 0 ? 'text-danger' : 'text-success'}`}>
                                {formatMoney(mov.saldo)}
                              </span>
                            </td>
                            <td><small>{mov.observaciones || '-'}</small></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {movimientosPrestamo.length > 0 && (
                      <tfoot className="table-dark">
                        <tr>
                          <th>TOTALES</th>
                          <th className="text-end">{formatMoney(movimientosPrestamo.reduce((s, m) => s + m.prestamo, 0))}</th>
                          <th className="text-end">{formatMoney(movimientosPrestamo.reduce((s, m) => s + m.abono, 0))}</th>
                          <th className="text-end text-danger">{formatMoney(movimientosPrestamo.length > 0 ? movimientosPrestamo[movimientosPrestamo.length - 1].saldo : 0)}</th>
                          <th></th>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                {prestamoDetalle.total_saldo_pendiente > 0 && (
                  <button className="btn btn-success" onClick={() => { setModalDetalle(false); abrirAbonoGrupo(prestamoDetalle); }}>
                    <DollarSign size={16} className="me-1" />Registrar Abono
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => { setModalDetalle(false); setPrestamoDetalle(null); }}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prestamos;
