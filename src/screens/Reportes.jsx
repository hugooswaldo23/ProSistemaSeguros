import React, { useState, useEffect } from 'react';
import { FileText, DollarSign, Download, Calendar, Users, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

const Reportes = () => {
  const [reporteActivo, setReporteActivo] = useState('nomina');
  const [loading, setLoading] = useState(false);
  
  // Estados para filtros del reporte de nómina
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [agenteSeleccionado, setAgenteSeleccionado] = useState('todos');
  
  // Estados para datos
  const [agentes, setAgentes] = useState([]);
  const [datosNomina, setDatosNomina] = useState([]);
  
  // Cargar agentes al montar el componente
  useEffect(() => {
    cargarAgentes();
    // Establecer fechas por defecto (mes actual)
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    setFechaInicio(primerDia.toISOString().split('T')[0]);
    setFechaFin(ultimoDia.toISOString().split('T')[0]);
  }, []);
  
  const cargarAgentes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/equipo-trabajo`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAgentes(data);
      }
    } catch (error) {
      console.error('Error al cargar agentes:', error);
    }
  };
  
  const generarReporteNomina = async () => {
    if (!fechaInicio || !fechaFin) {
      toast.error('Por favor selecciona un rango de fechas');
      return;
    }
    
    setLoading(true);
    try {
      // TODO: Endpoint del backend para reporte de nómina
      const params = new URLSearchParams({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        ...(agenteSeleccionado !== 'todos' && { agente_id: agenteSeleccionado })
      });
      
      const response = await fetch(`${API_URL}/api/reportes/nomina?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDatosNomina(data);
        toast.success('Reporte generado exitosamente');
      } else {
        toast.error('Error al generar el reporte');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };
  
  const exportarExcel = () => {
    toast.info('Funcionalidad de exportación en desarrollo');
    // TODO: Implementar exportación a Excel
  };
  
  const calcularTotales = () => {
    if (!datosNomina.length) return { comisiones: 0, polizas: 0 };
    
    return {
      comisiones: datosNomina.reduce((sum, item) => sum + (item.comision || 0), 0),
      polizas: datosNomina.length
    };
  };
  
  const totales = calcularTotales();
  
  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0">
              <FileText className="me-2" size={32} />
              Reportes
            </h2>
          </div>
        </div>
      </div>
      
      {/* Tabs de reportes */}
      <div className="row mb-4">
        <div className="col-12">
          <ul className="nav nav-tabs">
            <li className="nav-item">
              <button
                className={`nav-link ${reporteActivo === 'nomina' ? 'active' : ''}`}
                onClick={() => setReporteActivo('nomina')}
              >
                <DollarSign size={18} className="me-2" />
                Nómina / Comisiones
              </button>
            </li>
            {/* Próximos reportes */}
            <li className="nav-item">
              <button
                className="nav-link disabled"
                disabled
              >
                <TrendingUp size={18} className="me-2" />
                Ventas (Próximamente)
              </button>
            </li>
            <li className="nav-item">
              <button
                className="nav-link disabled"
                disabled
              >
                <Users size={18} className="me-2" />
                Clientes (Próximamente)
              </button>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Contenido del reporte de nómina */}
      {reporteActivo === 'nomina' && (
        <>
          {/* Filtros */}
          <div className="card mb-4">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <Calendar size={20} className="me-2" />
                Filtros
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Fecha Inicio</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Fecha Fin</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Agente</label>
                  <select
                    className="form-select"
                    value={agenteSeleccionado}
                    onChange={(e) => setAgenteSeleccionado(e.target.value)}
                  >
                    <option value="todos">Todos los agentes</option>
                    {agentes.map(agente => (
                      <option key={agente.id} value={agente.id}>
                        {agente.nombre} {agente.apellido_paterno}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button
                    className="btn btn-primary w-100"
                    onClick={generarReporteNomina}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <FileText size={18} className="me-2" />
                        Generar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Tarjetas de resumen */}
          {datosNomina.length > 0 && (
            <div className="row mb-4">
              <div className="col-md-4">
                <div className="card bg-success text-white">
                  <div className="card-body">
                    <h6 className="card-title">Total Comisiones</h6>
                    <h3 className="mb-0">
                      ${totales.comisiones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-info text-white">
                  <div className="card-body">
                    <h6 className="card-title">Pólizas Vendidas</h6>
                    <h3 className="mb-0">{totales.polizas}</h3>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-primary text-white">
                  <div className="card-body">
                    <h6 className="card-title">Promedio por Póliza</h6>
                    <h3 className="mb-0">
                      ${totales.polizas > 0 
                        ? (totales.comisiones / totales.polizas).toLocaleString('es-MX', { minimumFractionDigits: 2 })
                        : '0.00'
                      }
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Tabla de resultados */}
          <div className="card">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Resultados</h5>
              {datosNomina.length > 0 && (
                <button
                  className="btn btn-sm btn-success"
                  onClick={exportarExcel}
                >
                  <Download size={16} className="me-2" />
                  Exportar Excel
                </button>
              )}
            </div>
            <div className="card-body">
              {datosNomina.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <FileText size={48} className="mb-3" />
                  <p>No hay datos para mostrar. Genera un reporte con los filtros deseados.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead className="table-dark">
                      <tr>
                        <th>Agente</th>
                        <th>Póliza</th>
                        <th>Cliente</th>
                        <th>Aseguradora</th>
                        <th>Fecha Emisión</th>
                        <th className="text-end">Prima Total</th>
                        <th className="text-end">% Comisión</th>
                        <th className="text-end">Comisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosNomina.map((item, index) => (
                        <tr key={index}>
                          <td>{item.agente_nombre}</td>
                          <td>{item.numero_poliza}</td>
                          <td>{item.cliente_nombre}</td>
                          <td>{item.aseguradora}</td>
                          <td>{new Date(item.fecha_emision).toLocaleDateString('es-MX')}</td>
                          <td className="text-end">
                            ${parseFloat(item.prima_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-end">{item.porcentaje_comision || 0}%</td>
                          <td className="text-end fw-bold">
                            ${parseFloat(item.comision || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <th colSpan="7" className="text-end">Total:</th>
                        <th className="text-end">
                          ${totales.comisiones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reportes;
