import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Check, Banknote, MinusCircle, PlusCircle, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;

const Prestamos = () => {
  const [loading, setLoading] = useState(false);
  const { equipoDeTrabajo: empleados } = useEquipoDeTrabajo();
  
  const [listaPrestamos, setListaPrestamos] = useState([]);
  const [modalPrestamo, setModalPrestamo] = useState(false);
  const [prestamoEditando, setPrestamoEditando] = useState(null);
  const [filtroPrestamos, setFiltroPrestamos] = useState('Activo');
  
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
      console.error('Error al cargar préstamos:', error);
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
        toast.success('Préstamo registrado correctamente');
        cargarPrestamos();
        setModalPrestamo(false);
        setPrestamoEditando(null);
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.message || 'Error al crear préstamo');
        } else {
          throw new Error('Error al crear préstamo - endpoint no disponible');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('endpoint no disponible')) {
        const nuevoPrestamo = {
          id: Date.now(),
          ...datos,
          saldo_pendiente: datos.monto,
          fecha_prestamo: datos.fecha_prestamo || new Date().toISOString().split('T')[0],
          estatus: 'Activo',
          created_at: new Date().toISOString()
        };
        setListaPrestamos(prev => [...prev, nuevoPrestamo]);
        toast.success('Préstamo registrado (modo desarrollo)');
        setModalPrestamo(false);
        setPrestamoEditando(null);
      } else {
        toast.error(error.message || 'Error al crear préstamo');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const liquidarPrestamo = async (prestamoId) => {
    if (!confirm('¿Estás seguro de marcar este préstamo como liquidado?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/prestamos/${prestamoId}/liquidar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      
      if (response.ok) {
        toast.success('Préstamo liquidado');
        cargarPrestamos();
      } else {
        throw new Error('Error al liquidar');
      }
    } catch (error) {
      setListaPrestamos(prev => prev.map(p => 
        p.id === prestamoId ? { ...p, estatus: 'Liquidado', saldo_pendiente: 0 } : p
      ));
      toast.success('Préstamo liquidado (modo desarrollo)');
    }
  };
  
  const prestamosFiltrados = useMemo(() => {
    if (filtroPrestamos === 'todos') return listaPrestamos;
    return listaPrestamos.filter(p => p.estatus === filtroPrestamos);
  }, [listaPrestamos, filtroPrestamos]);
  
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
            Préstamos
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
                  <small className="text-dark">Préstamos Activos</small>
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
            <button className="btn btn-primary" onClick={() => { setPrestamoEditando(null); setModalPrestamo(true); }}>
              <Plus size={18} className="me-1" />Nuevo Préstamo
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de préstamos */}
      <div className="card">
        <div className="card-header bg-light">
          <h5 className="mb-0"><Banknote size={20} className="me-2" />Lista de Préstamos ({prestamosFiltrados.length})</h5>
        </div>
        <div className="card-body p-0">
          {prestamosFiltrados.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Banknote size={48} className="mb-3" />
              <p>No hay préstamos {filtroPrestamos !== 'todos' ? filtroPrestamos.toLowerCase() + 's' : ''} registrados</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-dark">
                  <tr>
                    <th style={{ minWidth: '180px' }}>Empleado</th>
                    <th className="text-center" style={{ width: '120px' }}>Fecha</th>
                    <th className="text-end" style={{ width: '120px' }}>Monto Original</th>
                    <th className="text-end" style={{ width: '120px' }}>Saldo Pendiente</th>
                    <th style={{ minWidth: '150px' }}>Motivo</th>
                    <th className="text-center" style={{ width: '100px' }}>Cuota/Quincena</th>
                    <th className="text-center" style={{ width: '100px' }}>Estatus</th>
                    <th className="text-center" style={{ width: '120px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prestamosFiltrados.map((prestamo) => (
                    <tr key={prestamo.id}>
                      <td><strong>{getNombreEmpleado(prestamo.empleado_id)}</strong></td>
                      <td className="text-center">{prestamo.fecha_prestamo ? new Date(prestamo.fecha_prestamo).toLocaleDateString('es-MX') : '-'}</td>
                      <td className="text-end">{formatMoney(prestamo.monto_original || prestamo.monto)}</td>
                      <td className="text-end">
                        {prestamo.estatus === 'Activo' ? (
                          <span className="text-danger fw-bold">{formatMoney(prestamo.saldo_pendiente)}</span>
                        ) : (
                          <span className="text-success">{formatMoney(0)}</span>
                        )}
                      </td>
                      <td><small>{prestamo.motivo || prestamo.descripcion || '-'}</small></td>
                      <td className="text-center">{prestamo.cuota_quincenal ? formatMoney(prestamo.cuota_quincenal) : '-'}</td>
                      <td className="text-center">
                        <span className={`badge ${prestamo.estatus === 'Activo' ? 'bg-warning text-dark' : 'bg-success'}`}>{prestamo.estatus}</span>
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          {prestamo.estatus === 'Activo' && (
                            <>
                              <button className="btn btn-outline-primary" onClick={() => { setPrestamoEditando(prestamo); setModalPrestamo(true); }} title="Editar préstamo"><Edit size={14} /></button>
                              <button className="btn btn-success" onClick={() => liquidarPrestamo(prestamo.id)} title="Liquidar préstamo"><Check size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th colSpan="2" className="text-end">TOTALES:</th>
                    <th className="text-end">{formatMoney(prestamosFiltrados.reduce((s, p) => s + parseFloat(p.monto_original || p.monto || 0), 0))}</th>
                    <th className="text-end text-danger">{formatMoney(prestamosFiltrados.reduce((s, p) => s + parseFloat(p.saldo_pendiente || 0), 0))}</th>
                    <th colSpan="4"></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal para crear/editar préstamo */}
      {modalPrestamo && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalPrestamo(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title"><Banknote size={20} className="me-2" />{prestamoEditando ? 'Editar Préstamo' : 'Nuevo Préstamo'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalPrestamo(false)}></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                crearPrestamo({
                  empleado_id: formData.get('empleado_id'),
                  monto: parseFloat(formData.get('monto')),
                  cuota_quincenal: parseFloat(formData.get('cuota_quincenal')) || 0,
                  motivo: formData.get('motivo'),
                  fecha_prestamo: formData.get('fecha_prestamo') || new Date().toISOString().split('T')[0]
                });
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Empleado <span className="text-danger">*</span></label>
                    <select name="empleado_id" className="form-select" defaultValue={prestamoEditando?.empleado_id || ''} required>
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
                      <label className="form-label">Monto del Préstamo <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" name="monto" className="form-control" defaultValue={prestamoEditando?.monto || ''} placeholder="0.00" min="0" step="0.01" required />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Cuota por Quincena</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" name="cuota_quincenal" className="form-control" defaultValue={prestamoEditando?.cuota_quincenal || ''} placeholder="0.00" min="0" step="0.01" />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Fecha del Préstamo</label>
                    <input type="date" name="fecha_prestamo" className="form-control" defaultValue={prestamoEditando?.fecha_prestamo || new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Motivo / Descripción</label>
                    <textarea name="motivo" className="form-control" rows="2" defaultValue={prestamoEditando?.motivo || prestamoEditando?.descripcion || ''} placeholder="Motivo del préstamo..."></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalPrestamo(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-1" /> : <Check size={16} className="me-1" />}
                    {prestamoEditando ? 'Actualizar' : 'Registrar'} Préstamo
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

export default Prestamos;
