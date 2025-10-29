import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { obtenerClientes } from '../services/clientesService';

const BuscadorCliente = ({ 
  onClienteSeleccionado, 
  clienteSeleccionado = null,
  datosIniciales = {},
  mostrarBotonNuevo = false 
}) => {
  const [clientes, setClientes] = useState([]);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [cargando, setCargando] = useState(false);
  const wrapperRef = useRef(null);

  // Cargar clientes al montar
  useEffect(() => {
    cargarClientes();
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setMostrarResultados(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cargarClientes = async () => {
    setCargando(true);
    try {
      const resultado = await obtenerClientes();
      if (resultado.success) {
        // Normalizar datos del backend (convertir snake_case a camelCase)
        const clientesParseados = resultado.data.map(cliente => ({
          ...cliente,
          // Normalizar campos - manejar tanto snake_case como camelCase
          razonSocial: cliente.razonSocial || cliente.razon_social || '',
          nombreComercial: cliente.nombreComercial || cliente.nombre_comercial || '',
          apellidoPaterno: cliente.apellidoPaterno || cliente.apellido_paterno || '',
          apellidoMaterno: cliente.apellidoMaterno || cliente.apellido_materno || '',
          telefonoFijo: cliente.telefonoFijo || cliente.telefono_fijo || '',
          telefonoMovil: cliente.telefonoMovil || cliente.telefono_movil || '',
          contactos: (() => {
            if (!cliente.contactos) return [];
            if (Array.isArray(cliente.contactos)) return cliente.contactos;
            if (typeof cliente.contactos === 'string') {
              try {
                return JSON.parse(cliente.contactos);
              } catch (error) {
                return [];
              }
            }
            return [];
          })()
        }));
        
        // Log para debugging - mostrar primeros 3 clientes
        console.log('📋 BuscadorCliente - Clientes cargados:', clientesParseados.length);
        clientesParseados.slice(0, 3).forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.tipoPersona}:`, {
            id: c.id,
            razonSocial: c.razonSocial,
            razon_social: c.razon_social,
            nombreComercial: c.nombreComercial,
            nombre: c.nombre,
            apellidoPaterno: c.apellidoPaterno,
            email: c.email
          });
        });
        
        setClientes(clientesParseados);
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setCargando(false);
    }
  };

  const clientesFiltrados = clientes.filter(cliente => {
    if (!terminoBusqueda.trim()) return true;
    
    const termino = terminoBusqueda.toLowerCase();
    const nombreCompleto = `${cliente.nombre || ''} ${cliente.apellidoPaterno || ''} ${cliente.apellidoMaterno || ''}`.toLowerCase();
    const razonSocial = (cliente.razonSocial || '').toLowerCase();
    const rfc = (cliente.rfc || '').toLowerCase();
    const email = (cliente.email || '').toLowerCase();
    const codigo = (cliente.codigo || '').toLowerCase();
    
    return nombreCompleto.includes(termino) || 
           razonSocial.includes(termino) || 
           rfc.includes(termino) ||
           email.includes(termino) ||
           codigo.includes(termino);
  });

  const seleccionarCliente = (cliente) => {
    console.log('✅ BuscadorCliente - Cliente seleccionado:', {
      id: cliente.id,
      tipoPersona: cliente.tipoPersona,
      razonSocial: cliente.razonSocial,
      nombreComercial: cliente.nombreComercial,
      nombre: cliente.nombre,
      apellidoPaterno: cliente.apellidoPaterno
    });
    
    onClienteSeleccionado(cliente);
    setTerminoBusqueda('');
    setMostrarResultados(false);
  };

  const limpiarSeleccion = () => {
    onClienteSeleccionado(null);
    setTerminoBusqueda('');
  };

  const obtenerNombreCliente = (cliente) => {
    if (!cliente) return '';
    
    if (cliente.tipoPersona === 'Persona Moral' && cliente.razonSocial) {
      return cliente.razonSocial;
    }
    
    return `${cliente.nombre || ''} ${cliente.apellidoPaterno || ''} ${cliente.apellidoMaterno || ''}`.trim();
  };

  return (
    <div className="mb-3" ref={wrapperRef}>
      {!clienteSeleccionado && (
        <>
          <label className="form-label">
            <Search size={16} className="me-1" />
            Buscar Cliente
          </label>
        </>
      )}
      
      {clienteSeleccionado ? (
        // Mostrar botón para cambiar cliente
        <div className="d-flex justify-content-end">
          <button
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={limpiarSeleccion}
            title="Cambiar cliente"
          >
            <X size={16} className="me-1" />
            Cambiar Cliente
          </button>
        </div>
      ) : (
        // Mostrar buscador
        <>
          <div className="position-relative">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre, razón social, RFC, email o código..."
              value={terminoBusqueda}
              onChange={(e) => {
                setTerminoBusqueda(e.target.value);
                setMostrarResultados(true);
              }}
              onFocus={() => setMostrarResultados(true)}
            />
            {cargando && (
              <div className="position-absolute end-0 top-50 translate-middle-y me-2">
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Resultados de búsqueda */}
          {mostrarResultados && (
            <div 
              className="list-group position-absolute w-100 shadow-lg" 
              style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                zIndex: 1050,
                marginTop: '2px'
              }}
            >
              {clientesFiltrados.length === 0 ? (
                <div className="list-group-item text-muted">
                  {terminoBusqueda ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                </div>
              ) : (
                clientesFiltrados.slice(0, 50).map(cliente => (
                  <button
                    key={cliente.id}
                    type="button"
                    className="list-group-item list-group-item-action"
                    onClick={() => seleccionarCliente(cliente)}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <div className="fw-bold">
                          {obtenerNombreCliente(cliente)}
                        </div>
                        <small className="text-muted">
                          {cliente.tipoPersona === 'Persona Moral' && cliente.nombreComercial && (
                            <span className="me-2">
                              <strong>Nombre Comercial:</strong> {cliente.nombreComercial}
                            </span>
                          )}
                          {cliente.rfc && (
                            <span className="me-2">
                              <strong>RFC:</strong> {cliente.rfc}
                            </span>
                          )}
                          {cliente.email && (
                            <span>
                              <strong>Email:</strong> {cliente.email}
                            </span>
                          )}
                        </small>
                        {cliente.codigo && (
                          <div>
                            <span className="badge bg-secondary">{cliente.codigo}</span>
                          </div>
                        )}
                      </div>
                      <span className={`badge ${cliente.tipoPersona === 'Persona Moral' ? 'bg-info' : 'bg-primary'}`}>
                        {cliente.tipoPersona === 'Persona Moral' ? '🏢 Empresa' : '👤 Física'}
                      </span>
                    </div>
                  </button>
                ))
              )}
              
              {mostrarBotonNuevo && (
                <button
                  type="button"
                  className="list-group-item list-group-item-action text-primary fw-bold"
                  onClick={() => {
                    onClienteSeleccionado('CREAR_NUEVO');
                    setMostrarResultados(false);
                  }}
                >
                  + Crear Nuevo Cliente
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BuscadorCliente;
