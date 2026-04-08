/**
 * ====================================================================
 * COMPONENTE: MULTICOTIZADOR DE EXPEDIENTE
 * ====================================================================
 * Vista completa del multicotizador de un expediente con:
 * - Información general del expediente
 * - Campos de cotización
 * - Acciones (Cotizar, emitir)
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Loader, FileSymlink } from 'lucide-react';
import * as multicotizadorService from '../../../services/multicotizadorService';
import * as historialService from '../../../services/historialExpedienteService';
import IssuanceFormQualitas from './FormulariosEmision/IssuanceFormQualitas';
import IssuanceFormHDI from './FormulariosEmision/IssuanceFormHDI';

const API_URL = import.meta.env.VITE_API_URL;

const MulticotizadorExpediente = React.memo(({ 
  expedienteRenovacion,
  setVistaActual
}) => {
  const [cargandoCotizacionMulticotizador, setCargandoCotizacionMulticotizador] = useState(false);
  const [cargandoEmisionMulticotizador, setCargandoEmisionMulticotizador] = useState(false);
  const [firstQuote, setFirstQuote] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [completeFieldsFormData, setCompleteFieldsFormData] = useState({
    plazo_pago: '',
    cp: '',
    col: '',
    uso: '',
    servicio: ''
  });
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState("");
  const [showPaqueteRequired, setShowPaqueteRequired] = useState(false);
  const [showModalEmisionQualitas, setShowModalEmisionQualitas] = useState(false);
  const [showModalEmisionHDI, setShowModalEmisionHDI] = useState(false);
  const [isPolizaEmitida, setIsPolizaEmitida] = useState(false);
  const [isLoadLookPolicy, setIsLoadLookPolicy] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCompleteFieldsFormData({
      ...completeFieldsFormData,
      [name]: value
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getNeibhborhoods(e);
    }
  };
  
  const getQuotes = async () => {
    try{
      const { id } = expedienteRenovacion;
      const res = await multicotizadorService.getQuotes(id);

      if(!res.success){
        toast.error('Error al obtener las cotizaciones');
      }

      if(res.estatus && res.estatus == 2){
        setIsPolizaEmitida(true);
      }

      const quotes = res.data;
      if(quotes.length === 0){
        setFirstQuote(true);
        return
      }else{
        setFirstQuote(false);
      }

      setQuotes(quotes);
    }catch(error){
      toast.error('Error al obtener las cotizaciones');
      setFirstQuote(true);
      setIsPolizaEmitida(false);
      setQuotes([]);
    }
  }

  const cotizar = async () => {
    try {
      if(firstQuote){
        const requiredFields = ['plazo_pago', 'cp', 'col', 'uso', 'servicio'];
        const missingFields = requiredFields.filter((field) => !completeFieldsFormData[field]);
  
        if (missingFields.length > 0) {
          toast.error('Completa todos los campos del formulario');
          return;
        }
      }
      
      if (!expedienteRenovacion) {
        toast.error('Selecciona un expediente');
        return;
      }
      
      setCargandoCotizacionMulticotizador(true);

      // Generar cotizaciones
      const resultado = await multicotizadorService.generarCotizacion(expedienteRenovacion.id, firstQuote, completeFieldsFormData);
      console.log(resultado);
      if (resultado.success) {
        toast.success('Cotizaciones generadas correctamente');
      } else {
        throw new Error(resultado.message || 'Error al generar cotizaciones');
      }
      
      // Registrar evento usando helper del servicio (descripción enriquecida)
      const msg = `Multicotizador - cotizaciones generadas para renovación de póliza ${expedienteRenovacion.numero_poliza || 'S/N'}.`;
      await historialService.registrarEventoMulticotizador(expedienteRenovacion, 'cotizacion_generada', msg);
    } catch (error) {
      console.error('Error al cargar cotización:', error);
      toast.error('Error al generar cotización');
    } finally {
      setCargandoCotizacionMulticotizador(false);
      await getQuotes();
    }
  };

  const emitir = async () => {
    if(selectedQuote == '' || selectedQuote == null || selectedQuote == undefined){
      toast.error('Selecciona un paquete'); 
      setShowPaqueteRequired(true);
      return;
    }

    const splitQuote = selectedQuote.trim().split('||');
    const [insurer, pack] = splitQuote;

    const normalizedInsurer = insurer?.toUpperCase();
    switch (normalizedInsurer) {
      case "QUALITAS":
          setShowModalEmisionQualitas(true);
        break;
      case "HDI":
          setShowModalEmisionHDI(true);
        break;
      default:
        toast.error('Intentalo de nuevo, no fue posible cargar el modal de emisión.')
        break;
    }
  }

  const getNeibhborhoods = async (e) => {
    const { value } = e.target;
    try {
      const res = await multicotizadorService.getNeibhborhoods(value);
      if(res.success === false || res.data.length === 0){
        throw new Error(res.message || 'Error al obtener las colonias');
      }
      setNeighborhoods(res.data);
    } catch (error) {
      console.error('Error al obtener las colonias:', error);
      setNeighborhoods([]);
    }
  }

  const reloadMulticotizador = async () => {
    await getQuotes();
  }

  const verPoliza = async () => {
    setIsLoadLookPolicy(true);
    const { data } = await multicotizadorService.printPolicy(expedienteRenovacion.id);
    if(!data.success){
      setIsLoadLookPolicy(false);
      toast.error('Error al imprimir la póliza');
      return;
    }

    switch(data.aseguradora){
      case "QUALITAS":
        window.open(data.url, '_blank');
        break;
      case "HDI":
        try{
          const binaryString = atob(data.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } catch (error) {
          toast.error('Error al visualizar la póliza emitida con HDI');
        }

        break;
      default:
        toast.error('No se reconoce la aseguradora de la póliza emitida');
        break;
    }

    setIsLoadLookPolicy(false);
  }

  useEffect(() => {
    getQuotes();
  }, [expedienteRenovacion]); 

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">Multicotizador</h3>
        <div className="d-flex gap-3">
          <button
            onClick={() => setVistaActual('lista')}
            className="btn btn-outline-secondary"
          >
            Volver
          </button>
        </div>
      </div>
        {expedienteRenovacion && (
          <div className="card">
            <div className="card-body p-3">
              <div className="row g-3">
                {/* datos generales */}
                <div className="col-12">
                  <h6 className="card-title border-bottom pb-1 mb-2" style={{fontSize: '0.9rem'}}>Datos Generales de Póliza</h6>
                  <div className="row">
                    <div className="col-sm-12 col-md">
                      <small style={{fontSize: '0.8rem'}}>Número de póliza:</small>
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.numero_poliza}</p>
                    </div>
                    <div className="col-sm-12 col-md">
                      <small style={{fontSize: '0.8rem'}}>Nombre completo:</small>
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.nombre != null ? expedienteRenovacion.nombre + ' ' + expedienteRenovacion.apellido_paterno + ' ' + expedienteRenovacion.apellido_materno : expedienteRenovacion.razon_social}</p>
                    </div>
                    <div className="col-sm-12 col-md">
                      <small style={{fontSize: '0.8rem'}}>RFC:</small>
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.rfc}</p>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-sm-12 col-md">
                      <small style={{fontSize: '0.8rem'}}>Marca:</small>
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.marca}</p>
                    </div>
                    <div className="col-sm-12 col-md">
                      <small style={{fontSize: '0.8rem'}}>Modelo:</small>
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.modelo}</p>
                    </div>
                    <div className="col-sm-12 col-md">
                      <small style={{fontSize: '0.8rem'}}>Año:</small>
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.anio}</p>
                    </div>
                    <div className="col-sm-12 col-md">
                      <small style={{fontSize: '0.8rem'}}>Número de serie:</small>
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.numero_serie}</p>
                    </div>
                  </div>
                </div>

                {firstQuote && (
                  <div className="col-12">
                    <h6 className="card-title border-bottom pb-1 mb-2" style={{fontSize: '0.9rem'}}>Completa campos</h6>
                    <form className="row g-3" >
                      <div className="col-md-4">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Plazo de pago
                        </label>
                        <select className="form-select form-select-sm" name="plazo_pago" onChange={handleChange}>
                          <option value="">Selecciona</option>
                          <option value="contado">Contado</option>
                          <option value="semestral">Semestral</option>
                          <option value="trimestral">Trimestral</option>
                          <option value="mensual">Mensual</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Uso
                        </label>
                        <select className="form-select form-select-sm" name="uso" onChange={handleChange}>
                          <option value="">Selecciona</option>
                          <option value="auto">Automovil residente</option>
                          <option value="pick_up">Pick Up familiar</option>
                          <option value="pick_up_comercial">Pick Up carga comercial</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Servicio
                        </label>
                        <select className="form-select form-select-sm" name="servicio" onChange={handleChange}>
                          <option value="">Selecciona</option>
                          <option value="particular">Particular</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Código postal
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          name="cp"
                          placeholder="Ej. 01000"
                          onChange={(e) => {
                            handleChange(e);
                            getNeibhborhoods(e);
                          }}
                          onKeyDown={handleKeyDown}
                        />
                      </div>

                      <div className="col-md-8">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Colonia
                        </label>
                        <select className="form-select form-select-sm" name="col" onChange={handleChange}>
                          <option value="">Selecciona</option>
                          {neighborhoods.length > 0 && (
                            neighborhoods.map((element) => (
                              <option key={element} value={element}>{element}</option>
                            ))
                          )}
                        </select>
                      </div>
                    </form>
                  </div>
                )}

                {/* Listado de cotizaciones */}
                <div className="col-12">
                  <h6 className="card-title border-bottom pb-1 mb-2" style={{fontSize: '0.9rem'}}>Cotizaciones</h6>
                  <br />
                  {cargandoCotizacionMulticotizador ? (
                    <div className='d-flex justify-content-center'>
                      <Loader className="me-2 spinner-border spinner-border-sm" />
                      Cargando...
                    </div>
                  ) : (
                    quotes.length === 0 ? (
                      <p className="text-muted mb-0 d-flex justify-content-center" style={{ fontSize: '0.8rem' }}>
                        No hay cotizaciones disponibles.
                      </p>
                    ) : (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '1rem',
                        alignItems: 'stretch'
                      }}>
                      <style>{`
                        .quote-radio:checked ~ div {
                          border-color: #0d6efd !important;
                          box-shadow: 0 0 0.6rem rgba(13, 110, 253, 0.6);
                        }
                      `}</style>
                      {quotes.map((quote, index) => (
                        <React.Fragment key={quote.paquete + '-' + quote.aseguradora}>
                          {index > 0 && quote.aseguradora !== quotes[index - 1].aseguradora && (
                            <div className="w-100"></div>
                          )}

                            <label htmlFor={`quote-${quote.paquete}-${quote.aseguradora}`} style={{ cursor: 'pointer', maxWidth: '250px', minWidth: '150px' }} >
                              <input
                                type="radio"
                                className="quote-radio"
                                name="selectedQuote"
                                id={`quote-${quote.paquete}-${quote.aseguradora}`}
                                style={{ display: 'none' }}
                                value={quote.aseguradora + '||' + quote.paquete}
                                onChange={(e) => {setSelectedQuote(e.target.value), setShowPaqueteRequired(false)}}
                              />
                              <div className="border rounded p-2 h-100 d-flex justify-content-between flex-column align-items-center">
                                <div className="col-12">
                                  <div className="col-12 d-flex justify-content-end mb-1">
                                    {/* <button
                                      className="d-flex align-items-center justify-content-center"
                                      title="Emitir"
                                      onClick={{  }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        color: 'inherit'
                                      }}
                                    >
                                      <FileCheck color="#0d6efd" size={20}  />
                                    </button> */}
                                  </div>
                                  
                                  <h6 className='text-center'><strong>{quote.aseguradora}</strong></h6>
                                  <p className="mb-1 text-center" style={{ fontSize: '0.85rem' }}>
                                    {quote.paquete}
                                  </p>
                                  <ul>
                                    {quote.coberturas && quote.coberturas.map((cobertura) => (
                                      <li key={cobertura} style={{ fontSize: '0.75rem' }}>
                                        {cobertura}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <strong className='mb-0 text-center' style={{ fontSize: '0.8rem' }}>{quote.total ? 
                                  `$
                                    ${new Intl.NumberFormat('es-MX', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    }).format(quote.total)}
                                  ` : 'N/A'}</strong>
                              </div>
                            </label>
                        </React.Fragment>
                      ))}
                      </div>
                    )
                  )}
                  <br />
                  <div className={showPaqueteRequired ? 'd-flex justify-content-center' : "d-none"}>
                    <small style={{color:"red", fontStyle:"italic" }}>Selecciona un paquete a emitir</small>
                  </div>
                </div>

                <div className="col-12 d-flex justify-content-center align-items-center">
                  <br />
                  <br />
                  <br />
                  {firstQuote && !isPolizaEmitida ? (
                    <button 
                      type="button" 
                      className="btn btn-info"
                      onClick={() => cotizar()}
                      disabled={cargandoCotizacionMulticotizador}
                    >
                    {cargandoCotizacionMulticotizador ? (
                      <>
                        <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        Cotizar pólizas
                      </>
                    )}
                  </button>
                  ):(
                    !isPolizaEmitida ? (
                      <button 
                        type="button" 
                        className="btn btn-info"
                        onClick={() => emitir()}
                        disabled={firstQuote || cargandoEmisionMulticotizador}
                      >
                        {cargandoEmisionMulticotizador ? (
                          <>
                            <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                            Emitiendo póliza...
                          </>
                        ) : (
                          <>
                            Emitir póliza
                          </>
                        )}
                    </button>
                    ):(
                      <button 
                        type="button" 
                        className="btn btn-info"
                        onClick={() => verPoliza()}
                        disabled= {isLoadLookPolicy}
                      >
                        {isLoadLookPolicy ? (
                          <>
                            <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                            Cargando...
                          </>
                        ) : (
                          <>
                            <FileSymlink size={16} className="me-2"/>
                            Ver póliza
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .fs-8:{
            font-size:.8rem !important;
          }
        `}</style>
        {/* ═══════════════════════════════════════════════════════════════
            MODALES DE EMISIÓN PÓLIZAS
            ═══════════════════════════════════════════════════════════════ */}
        {/* Modal: Emisión Qualitas */}
        {showModalEmisionQualitas && expedienteRenovacion && (
          <IssuanceFormQualitas
            setShowModalEmisionQualitas={setShowModalEmisionQualitas}
            selectedQuote={selectedQuote}
            expedienteRenovacion={expedienteRenovacion}
            reloadMulticotizador={reloadMulticotizador}
          />
        )}

        {/* Modal: Emisión HDI */}
        {showModalEmisionHDI && expedienteRenovacion && (
          <IssuanceFormHDI
            setShowModalEmisionHDI={setShowModalEmisionHDI}
            selectedQuote={selectedQuote}
            expedienteRenovacion={expedienteRenovacion}
            reloadMulticotizador={reloadMulticotizador}
          />
        )}
    </div>
  );
});

export default MulticotizadorExpediente;