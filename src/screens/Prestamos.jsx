import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Banknote, MinusCircle, PlusCircle, Eye, DollarSign, History, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;
const MOVIMIENTOS_POR_PAGINA = 10;

const Prestamos = () => {
  const [loading, setLoading] = useState(false);
  const { equipoDeTrabajo: empleados } = useEquipoDeTrabajo();

  const [listaPrestamos, setListaPrestamos] = useState([]);

  // Modal Movimiento (sirve para Prestamo y Abono)
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState('Prestamo');
  const [empleadoMovimiento, setEmpleadoMovimiento] = useState(null);

  // Modal Ver historial
  const [modalDetalle, setModalDetalle] = useState(false);
  const [detalleEmpleado, setDetalleEmpleado] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [paginaMovimientos, setPaginaMovimientos] = useState(1);

  useEffect(() => {
    cargarPrestamos();
  }, []);

  // --- Carga de datos ---
  const cargarPrestamos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/prestamos`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      if (response.ok) {
        const ct = response.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await response.json();
          setListaPrestamos(data);
        }
      }
    } catch (error) {
      console.error('Error al cargar prestamos:', error);
    }
  };

  // --- Helpers ---
  const getNombreEmpleado = (empleadoId) => {
    const emp = empleados.find(e => e.id === empleadoId);
    if (!emp) return 'Desconocido';
    return `${emp.nombre || ''} ${emp.apellidoPaterno || ''}`.trim();
  };

  const formatMoney = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // --- Agrupar por empleado: balance unico ---
  const balancePorEmpleado = useMemo(() => {
    const grupos = {};
    listaPrestamos.forEach(p => {
      const eid = p.empleado_id;
      if (!grupos[eid]) {
        grupos[eid] = {
          empleado_id: eid,
          prestamos: [],
          total_prestado: 0,
          total_abonado: 0,
          saldo: 0,
        };
      }
      grupos[eid].prestamos.push(p);
      const monto = parseFloat(p.monto_original || p.monto || 0);
      const pendiente = parseFloat(p.saldo_pendiente || 0);
      grupos[eid].total_prestado += monto;
      grupos[eid].total_abonado += (monto - pendiente);
      grupos[eid].saldo += pendiente;
    });
    return Object.values(grupos);
  }, [listaPrestamos]);

  const totales = useMemo(() => {
    return balancePorEmpleado.reduce((acc, g) => ({
      empleados: acc.empleados + (g.saldo > 0 ? 1 : 0),
      prestado: acc.prestado + g.total_prestado,
      abonado: acc.abonado + g.total_abonado,
      saldo: acc.saldo + g.saldo,
    }), { empleados: 0, prestado: 0, abonado: 0, saldo: 0 });
  }, [balancePorEmpleado]);

  // --- Registrar movimiento (Prestamo o Abono) ---
  const registrarMovimiento = async (grupo, tipo, datos) => {
    setLoading(true);
    try {
      if (tipo === 'Prestamo') {
        // POST /api/prestamos
        const response = await fetch(`${API_URL}/api/prestamos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
          },
          body: JSON.stringify({
            empleado_id: grupo.empleado_id,
            monto: datos.monto,
            motivo: datos.observaciones,
            fecha_prestamo: datos.fecha
          })
        });
        if (!response.ok) throw new Error('Error al registrar prestamo');
        toast.success('Prestamo registrado');
      } else {
        // Abono: distribuir entre prestamos activos del empleado
        // POST /api/prestamos/:id/abono
        const prestamosActivos = grupo.prestamos
          .filter(p => parseFloat(p.saldo_pendiente || 0) > 0)
          .sort((a, b) => new Date(a.fecha_prestamo || a.created_at) - new Date(b.fecha_prestamo || b.created_at));

        let montoRestante = datos.monto;
        for (const prestamo of prestamosActivos) {
          if (montoRestante <= 0) break;
          const saldoPrestamo = parseFloat(prestamo.saldo_pendiente || 0);
          const montoAbonar = Math.min(montoRestante, saldoPrestamo);

          const response = await fetch(`${API_URL}/api/prestamos/${prestamo.id}/abono`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
            },
            body: JSON.stringify({
              monto: montoAbonar,
              observaciones: datos.observaciones || '',
              fecha: datos.fecha
            })
          });
          if (!response.ok) throw new Error(`Error al abonar al prestamo #${prestamo.id}`);
          montoRestante -= montoAbonar;
        }
        toast.success('Abono registrado');
      }
      cargarPrestamos();
      cerrarModalMovimiento();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Abrir modales ---
  const abrirPrestamo = (grupo) => {
    setEmpleadoMovimiento(grupo);
    setTipoMovimiento('Prestamo');
    setModalMovimiento(true);
  };

  const abrirAbono = (grupo) => {
    if (grupo.saldo <= 0) { toast.error('No hay saldo pendiente'); return; }
    setEmpleadoMovimiento(grupo);
    setTipoMovimiento('Abono');
    setModalMovimiento(true);
  };

  const cerrarModalMovimiento = () => {
    setModalMovimiento(false);
    setEmpleadoMovimiento(null);
  };

  // --- Ver historial ---
  const verHistorial = async (grupo) => {
    setDetalleEmpleado(grupo);
    setPaginaMovimientos(1);
    setModalDetalle(true);

    let flujo = [];

    for (const prestamo of grupo.prestamos) {
      flujo.push({
        id: `p-${prestamo.id}`,
        fecha: prestamo.fecha_prestamo || prestamo.created_at,
        tipo: 'Prestamo',
        prestamo: parseFloat(prestamo.monto_original || prestamo.monto || 0),
        abono: 0,
        observaciones: prestamo.motivo || 'Prestamo otorgado',
      });

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
      } catch (e) { /* sin movimientos del backend */ }

      if (movs.length === 0 && prestamo.movimientos) {
        movs = prestamo.movimientos;
      }

      movs.forEach(mov => {
        if (mov.tipo === 'Cobro' || mov.tipo === 'Abono' || mov.tipo === 'Ajuste') {
          flujo.push({
            id: `m-${mov.id}`,
            fecha: mov.fecha || mov.created_at,
            tipo: 'Abono',
            prestamo: 0,
            abono: parseFloat(mov.monto || 0),
            observaciones: mov.observaciones || '',
          });
        }
      });
    }

    flujo.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    let saldo = 0;
    flujo = flujo.map(mov => {
      saldo = saldo + mov.prestamo - mov.abono;
      return { ...mov, saldo };
    });

    setMovimientos(flujo);
  };

  // Paginacion del historial
  const totalPaginas = Math.max(1, Math.ceil(movimientos.length / MOVIMIENTOS_POR_PAGINA));
  const movimientosPagina = useMemo(() => {
    const inicio = (paginaMovimientos - 1) * MOVIMIENTOS_POR_PAGINA;
    return movimientos.slice(inicio, inicio + MOVIMIENTOS_POR_PAGINA);
  }, [movimientos, paginaMovimientos]);

  // --- RENDER ---
  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-0"><Banknote className="me-2" size={32} />Prestamos</h2>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card bg-warning text-dark">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small>Empleados con Saldo</small>
                  <h3 className="mb-0">{totales.empleados}</h3>
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
                  <small className="text-white-50">Total Prestado</small>
                  <h3 className="mb-0">{formatMoney(totales.prestado)}</h3>
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
                  <h3 className="mb-0">{formatMoney(totales.saldo)}</h3>
                </div>
                <MinusCircle size={40} className="opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de balances por empleado */}
      <div className="card">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0"><Banknote size={20} className="me-2" />Balance por Empleado</h5>
        </div>
        <div className="card-body p-0">
          {balancePorEmpleado.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Banknote size={48} className="mb-3" />
              <p>No hay prestamos registrados</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-dark">
                  <tr>
                    <th style={{ minWidth: '220px' }}>Empleado</th>
                    <th className="text-end" style={{ width: '140px' }}>Total Prestado</th>
                    <th className="text-end" style={{ width: '140px' }}>Total Abonado</th>
                    <th className="text-end" style={{ width: '150px' }}>Saldo</th>
                    <th className="text-center" style={{ width: '260px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {balancePorEmpleado.map((grupo) => (
                    <tr key={grupo.empleado_id}>
                      <td><strong>{getNombreEmpleado(grupo.empleado_id)}</strong></td>
                      <td className="text-end">{formatMoney(grupo.total_prestado)}</td>
                      <td className="text-end text-success">{formatMoney(grupo.total_abonado)}</td>
                      <td className="text-end">
                        <span className={`fw-bold ${grupo.saldo > 0 ? 'text-danger' : 'text-success'}`}>
                          {formatMoney(grupo.saldo)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-info" onClick={() => verHistorial(grupo)} title="Ver historial">
                            <Eye size={14} className="me-1" />Ver
                          </button>
                          <button className="btn btn-outline-primary" onClick={() => abrirPrestamo(grupo)} title="Agregar prestamo">
                            <PlusCircle size={14} className="me-1" />Prestamo
                          </button>
                          {grupo.saldo > 0 && (
                            <button className="btn btn-success" onClick={() => abrirAbono(grupo)} title="Registrar abono">
                              <DollarSign size={14} className="me-1" />Abono
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th className="text-end">TOTALES:</th>
                    <th className="text-end">{formatMoney(totales.prestado)}</th>
                    <th className="text-end text-success">{formatMoney(totales.abonado)}</th>
                    <th className="text-end text-danger">{formatMoney(totales.saldo)}</th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* --- Modal Movimiento (Prestamo o Abono) --- */}
      {modalMovimiento && empleadoMovimiento && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={cerrarModalMovimiento}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className={`modal-header ${tipoMovimiento === 'Prestamo' ? 'bg-primary' : 'bg-success'} text-white`}>
                <h5 className="modal-title">
                  {tipoMovimiento === 'Prestamo' ? <PlusCircle size={20} className="me-2" /> : <DollarSign size={20} className="me-2" />}
                  {tipoMovimiento === 'Prestamo' ? 'Agregar Prestamo' : 'Registrar Abono'} - {getNombreEmpleado(empleadoMovimiento.empleado_id)}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrarModalMovimiento}></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const monto = parseFloat(fd.get('monto'));
                if (monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
                if (tipoMovimiento === 'Abono' && monto > empleadoMovimiento.saldo) {
                  if (!confirm(`El abono ($${monto.toFixed(2)}) es mayor al saldo ($${empleadoMovimiento.saldo.toFixed(2)}). Continuar?`)) return;
                }
                registrarMovimiento(empleadoMovimiento, tipoMovimiento, {
                  monto,
                  fecha: fd.get('fecha'),
                  observaciones: fd.get('observaciones') || ''
                });
              }}>
                <div className="modal-body">
                  {/* Saldo actual */}
                  <div className="text-center p-3 mb-3 bg-light rounded">
                    <small className="text-muted d-block">Saldo Actual</small>
                    <h3 className={`mb-0 ${empleadoMovimiento.saldo > 0 ? 'text-danger' : 'text-success'}`}>
                      {formatMoney(empleadoMovimiento.saldo)}
                    </h3>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Monto <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" name="monto" className="form-control" placeholder="0.00" min="0.01" step="0.01" required autoFocus />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Fecha</label>
                      <input type="date" name="fecha" className="form-control" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Observaciones</label>
                      <input type="text" name="observaciones" className="form-control"
                        placeholder={tipoMovimiento === 'Prestamo' ? 'Motivo del prestamo...' : 'Ej: Descuento de nomina, pago en efectivo...'} />
                    </div>
                  </div>

                  {tipoMovimiento === 'Abono' && empleadoMovimiento.saldo > 0 && (
                    <div className="mt-3">
                      <button type="button" className="btn btn-sm btn-outline-success" onClick={() => {
                        const input = document.querySelector('input[name="monto"]');
                        if (input) { input.value = empleadoMovimiento.saldo; input.dispatchEvent(new Event('input', { bubbles: true })); }
                      }}>
                        Liquidar saldo completo ({formatMoney(empleadoMovimiento.saldo)})
                      </button>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={cerrarModalMovimiento}>Cancelar</button>
                  <button type="submit" className={`btn ${tipoMovimiento === 'Prestamo' ? 'btn-primary' : 'btn-success'}`} disabled={loading}>
                    {loading && <span className="spinner-border spinner-border-sm me-1" />}
                    {tipoMovimiento === 'Prestamo' ? 'Registrar Prestamo' : 'Registrar Abono'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal Historial (flujo de caja paginado) --- */}
      {modalDetalle && detalleEmpleado && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { setModalDetalle(false); setDetalleEmpleado(null); }}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title"><History size={20} className="me-2" />Historial - {getNombreEmpleado(detalleEmpleado.empleado_id)}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setModalDetalle(false); setDetalleEmpleado(null); }}></button>
              </div>
              <div className="modal-body p-0">
                {/* Resumen */}
                <div className="p-3 bg-light border-bottom">
                  <div className="row text-center">
                    <div className="col-md-4">
                      <small className="text-muted d-block">Total Prestado</small>
                      <h5 className="text-primary mb-0">{formatMoney(detalleEmpleado.total_prestado)}</h5>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block">Total Abonado</small>
                      <h5 className="text-success mb-0">{formatMoney(detalleEmpleado.total_abonado)}</h5>
                    </div>
                    <div className="col-md-4">
                      <small className="text-muted d-block">Saldo Actual</small>
                      <h4 className={`mb-0 fw-bold ${detalleEmpleado.saldo > 0 ? 'text-danger' : 'text-success'}`}>
                        {formatMoney(detalleEmpleado.saldo)}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Tabla de movimientos */}
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-secondary">
                      <tr>
                        <th style={{ width: '110px' }}>Fecha</th>
                        <th className="text-end" style={{ width: '120px' }}>Prestamo</th>
                        <th className="text-end" style={{ width: '120px' }}>Abono</th>
                        <th className="text-end" style={{ width: '130px' }}>Saldo</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4 text-muted">Sin movimientos</td>
                        </tr>
                      ) : movimientosPagina.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4 text-muted">Sin movimientos en esta pagina</td>
                        </tr>
                      ) : (
                        movimientosPagina.map((mov, idx) => (
                          <tr key={mov.id || idx} className={mov.tipo === 'Prestamo' ? 'table-warning' : ''}>
                            <td>{mov.fecha ? new Date(mov.fecha).toLocaleDateString('es-MX') : '-'}</td>
                            <td className="text-end">
                              {mov.prestamo > 0 && <span className="text-primary fw-bold">{formatMoney(mov.prestamo)}</span>}
                            </td>
                            <td className="text-end">
                              {mov.abono > 0 && <span className="text-success fw-bold">{formatMoney(mov.abono)}</span>}
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
                    {movimientos.length > 0 && (
                      <tfoot className="table-dark">
                        <tr>
                          <th>TOTALES</th>
                          <th className="text-end">{formatMoney(movimientos.reduce((s, m) => s + m.prestamo, 0))}</th>
                          <th className="text-end">{formatMoney(movimientos.reduce((s, m) => s + m.abono, 0))}</th>
                          <th className="text-end text-danger">{formatMoney(movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : 0)}</th>
                          <th></th>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Paginacion */}
                {totalPaginas > 1 && (
                  <div className="d-flex justify-content-between align-items-center p-2 border-top bg-light">
                    <small className="text-muted">
                      Mostrando {((paginaMovimientos - 1) * MOVIMIENTOS_POR_PAGINA) + 1}-{Math.min(paginaMovimientos * MOVIMIENTOS_POR_PAGINA, movimientos.length)} de {movimientos.length} movimientos
                    </small>
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-secondary" disabled={paginaMovimientos <= 1} onClick={() => setPaginaMovimientos(p => p - 1)}>
                        <ChevronLeft size={14} />
                      </button>
                      <span className="btn btn-outline-secondary disabled">
                        {paginaMovimientos} / {totalPaginas}
                      </span>
                      <button className="btn btn-outline-secondary" disabled={paginaMovimientos >= totalPaginas} onClick={() => setPaginaMovimientos(p => p + 1)}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-primary btn-sm" onClick={() => { setModalDetalle(false); abrirPrestamo(detalleEmpleado); }}>
                  <PlusCircle size={14} className="me-1" />Prestamo
                </button>
                {detalleEmpleado.saldo > 0 && (
                  <button className="btn btn-success btn-sm" onClick={() => { setModalDetalle(false); abrirAbono(detalleEmpleado); }}>
                    <DollarSign size={14} className="me-1" />Abono
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => { setModalDetalle(false); setDetalleEmpleado(null); }}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prestamos;
