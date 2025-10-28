import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, Users, X, Plus, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Componente para buscar y seleccionar un cliente existente
 * o crear uno nuevo si no existe
 */
const BuscadorCliente = ({ 
  onClienteSeleccionado, 
  clienteSeleccionado = null,
  datosIniciales = {},
  mostrarBotonNuevo = true 
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clientesFiltrados, setClientesFiltrados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [error, setError] = useState(null);

  // Helper para obtener nombre completo manejando ambos formatos
  const getNombreCompleto = (cliente) => {
    const nombre = cliente.nombre || '';
    const apellidoPaterno = cliente.apellido_paterno || cliente.apellidoPaterno || '';
    const apellidoMaterno = cliente.apellido_materno || cliente.apellidoMaterno || '';
    const razonSocial = cliente.razon_social || cliente.razonSocial || '';
    const tipoPersona = cliente.tipo_persona || cliente.tipoPersona || '';
    
    return tipoPersona === 'Persona Moral' 
      ? razonSocial 
      : `${nombre} ${apellidoPaterno} ${apellidoMaterno}`.trim();
  };

  // Cargar todos los clientes al montar
  useEffect(() => {
    cargarClientes();
  }, []);

  // Pre-llenar búsqueda si hay datos iniciales
  useEffect(() => {
    if (datosIniciales.rfc || datosIniciales.nombre) {
      const busquedaInicial = datosIniciales.rfc || 
        `${datosIniciales.nombre || ''} ${datosIniciales.apellido_paterno || ''} ${datosIniciales.apellido_materno || ''}`.trim();
      setBusqueda(busquedaInicial);
      
      // Buscar automáticamente
      if (busquedaInicial) {
        buscarCliente(busquedaInicial);
      }
    }
  }, [datosIniciales]);

  const cargarClientes = async () => {
    try {
      setCargando(true);
      const response = await fetch(`${API_URL}/api/clientes`);
      if (!response.ok) throw new Error('Error al cargar clientes');
      const data = await response.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando clientes:', err);
      setError('Error al cargar clientes');
    } finally {
      setCargando(false);
    }
  };

  const buscarCliente = useCallback((termino) => {
    if (!termino || termino.length < 2) {
      setClientesFiltrados([]);
      setMostrarResultados(false);
      return;
    }

    const terminoLower = termino.toLowerCase();
    const resultados = clientes.filter(cliente => {
      // Manejar tanto camelCase como snake_case del backend
      const nombre = cliente.nombre || '';
      const apellidoPaterno = cliente.apellido_paterno || cliente.apellidoPaterno || '';
      const apellidoMaterno = cliente.apellido_materno || cliente.apellidoMaterno || '';
      const nombreCompleto = `${nombre} ${apellidoPaterno} ${apellidoMaterno}`.toLowerCase();
      const razonSocial = (cliente.razon_social || cliente.razonSocial || '').toLowerCase();
      const rfc = (cliente.rfc || '').toLowerCase();
      const email = (cliente.email || '').toLowerCase();
      
      return nombreCompleto.includes(terminoLower) ||
             razonSocial.includes(terminoLower) ||
             rfc.includes(terminoLower) ||
             email.includes(terminoLower);
    });

    setClientesFiltrados(resultados);
    setMostrarResultados(true);
  }, [clientes]);

  const handleBusquedaChange = (e) => {
    const valor = e.target.value;
    setBusqueda(valor);
    buscarCliente(valor);
  };

  const seleccionarCliente = (cliente) => {
    onClienteSeleccionado(cliente);
    setMostrarResultados(false);
    setBusqueda(getNombreCompleto(cliente));
  };

  const limpiarSeleccion = () => {
    onClienteSeleccionado(null);
    setBusqueda('');
    setClientesFiltrados([]);
    setMostrarResultados(false);
  };

  const crearNuevoCliente = () => {
    // Emitir evento para abrir modal de nuevo cliente
    onClienteSeleccionado('CREAR_NUEVO', datosIniciales);
  };

  return (
    <div className="buscador-cliente mb-3">
      <label className="form-label">
        Cliente <span className="text-danger">*</span>
      </label>
      
      {clienteSeleccionado && clienteSeleccionado !== 'CREAR_NUEVO' ? (
        // Cliente ya seleccionado
        <div className="alert alert-success d-flex justify-content-between align-items-start">
          <div>
            <div className="d-flex align-items-center mb-2">
              {(clienteSeleccionado.tipo_persona || clienteSeleccionado.tipoPersona) === 'Persona Moral' ? (
                <Users size={20} className="me-2" />
              ) : (
                <User size={20} className="me-2" />
              )}
              <strong>
                {getNombreCompleto(clienteSeleccionado)}
              </strong>
            </div>
            <div>
              <small className="text-muted d-block">RFC: {clienteSeleccionado.rfc}</small>
              {clienteSeleccionado.email && (
                <small className="text-muted d-block">Email: {clienteSeleccionado.email}</small>
              )}
              {(clienteSeleccionado.telefono_movil || clienteSeleccionado.telefonoMovil) && (
                <small className="text-muted d-block">Tel: {clienteSeleccionado.telefono_movil || clienteSeleccionado.telefonoMovil}</small>
              )}
            </div>
          </div>
          <button 
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={limpiarSeleccion}
            title="Cambiar cliente"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        // Búsqueda de cliente
        <div className="position-relative">
          <div className="input-group">
            <span className="input-group-text">
              <Search size={20} />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre, RFC, email..."
              value={busqueda}
              onChange={handleBusquedaChange}
              onFocus={() => busqueda && setMostrarResultados(true)}
            />
            {busqueda && (
              <button 
                className="btn btn-outline-secondary" 
                type="button"
                onClick={limpiarSeleccion}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Overlay para cerrar dropdown */}
          {mostrarResultados && (
            <div 
              className="position-fixed top-0 start-0 w-100 h-100" 
              style={{ zIndex: 1040 }}
              onClick={() => setMostrarResultados(false)}
            />
          )}

          {/* Resultados de búsqueda */}
          {mostrarResultados && (
            <div className="position-absolute w-100 shadow-lg bg-white border rounded mt-1" style={{ zIndex: 1050, maxHeight: '300px', overflowY: 'auto' }}>
              {cargando ? (
                <div className="p-3 text-center">
                  <div className="spinner-border spinner-border-sm me-2" />
                  Buscando...
                </div>
              ) : clientesFiltrados.length > 0 ? (
                <>
                  <div className="p-2 bg-light border-bottom">
                    <small className="text-muted">
                      {clientesFiltrados.length} cliente(s) encontrado(s)
                    </small>
                  </div>
                  <div className="list-group list-group-flush">
                    {clientesFiltrados.map(cliente => (
                      <button
                        key={cliente.id}
                        type="button"
                        className="list-group-item list-group-item-action"
                        onClick={() => seleccionarCliente(cliente)}
                      >
                        <div className="d-flex align-items-start">
                          {cliente.tipo_persona === 'Persona Moral' || cliente.tipoPersona === 'Persona Moral' ? (
                            <Users size={20} className="me-2 mt-1 text-primary" />
                          ) : (
                            <User size={20} className="me-2 mt-1 text-success" />
                          )}
                          <div className="flex-grow-1">
                            <div className="fw-semibold">
                              {getNombreCompleto(cliente)}
                              <span className={`badge ms-2 ${(cliente.tipo_persona || cliente.tipoPersona) === 'Persona Moral' ? 'bg-primary' : 'bg-success'}`}>
                                {(cliente.tipo_persona || cliente.tipoPersona) === 'Persona Moral' ? 'PM' : 'PF'}
                              </span>
                            </div>
                            <small className="text-muted d-block">RFC: {cliente.rfc}</small>
                            {cliente.email && (
                              <small className="text-muted d-block">{cliente.email}</small>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : busqueda ? (
                <div className="p-3 text-center">
                  <AlertCircle size={24} className="text-warning mb-2" />
                  <p className="mb-2">No se encontraron clientes</p>
                  {mostrarBotonNuevo && (
                    <button 
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={crearNuevoCliente}
                    >
                      <Plus size={16} className="me-1" />
                      Crear Nuevo Cliente
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 text-center text-muted">
                  <small>Escribe al menos 2 caracteres para buscar</small>
                </div>
              )}
            </div>
          )}

          {/* Mensaje de ayuda */}
          <small className="form-text text-muted d-block mt-1">
            <AlertCircle size={12} className="me-1" />
            Busca un cliente existente o {mostrarBotonNuevo && 'créalo si no existe'}
          </small>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mt-2">
          {error}
        </div>
      )}
    </div>
  );
};

export default BuscadorCliente;
