/**
 * ====================================================================
 * COMPONENTE: MULTICOTIZADOR DE EXPEDIENTE
 * ====================================================================
 * Vista completa del multicotizador de un expediente con:
 * - Información general del expediente
 * - Campos de cotización
 * - Acciones (Cotizar, emitir)
 */

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Loader, RefreshCw, Info } from 'lucide-react';
import * as multicotizadorService from '../../services/multicotizadorService';
import * as historialService from '../../services/historialExpedienteService';

const API_URL = import.meta.env.VITE_API_URL;

const MulticotizadorExpediente = React.memo(({ 
  expedienteRenovacion,
  setVistaActual
}) => {
  const [cargandoCotizacionMulticotizador, setCargandoCotizacionMulticotizador] = useState(false);
  const [cargandoEmisionMulticotizador, setCargandoEmisionMulticotizador] = useState(false);
  const [firstQuote, setFirstQuote] = useState(false);
  const [quotesQualitas, setQuotesQualitas] = useState([]);
  const [countriesQualitas, setCountriesQualitas] = useState([])
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
  const initialClientDataQ = {
    nombres:'',
    ap_pat:'',
    ap_mat:'',
    serie:'',
    curp:'',
    fiel:'',
    tipo_persona:'1',
    calle:'',
    nro_ext:'',
    nro_int:'',
    profesion:'17',
    genero:'',
    telefono:'',
    celular:'',
    correo:'',
    fecha_nacimiento:'',
    nacionalidad:'',
    domicilio_extrangero:'',
    tipo_residencia:'',
    pais_nacimiento:'',
    ocupacion:'',
    actividad_giro:'',
    rfc:'',
    tipo_identificacion:'',
    num_identificacion:'',
    estado_nacimiento:'',
    declaracion_pep:'',
    nombre_pep:'',
    parentesco_pep:'',
    fecha_constitucion:'',
    razon_social:'',
    act_obj_social:'',
    apoderado:'',
    folio_mercantil:'',
    dec_pep_moral:'',
    funcionario_pep_moral:'',
    fideicomiso:'',
    nombre_fideicomiso:'',
    nombre_fidecomitente:'',
    nombre_fiduciario:''
  }
  const [clientDataQ, setClientDataQ] = useState(initialClientDataQ);
  const requiredFieldsFisicaQ = [
    'nombres',
    'ap_pat',
    'ap_mat',
    'serie',
    'calle',
    'nro_ext',
    'profesion',
    'genero',
    'celular',
    'correo',
    'fecha_nacimiento',
    'nacionalidad',
    'pais_nacimiento',
    'ocupacion',
    'actividad_giro',
    'rfc',
    'tipo_identificacion',
    'num_identificacion',
    'estado_nacimiento',
    'declaracion_pep'
  ];
  const requiredFieldsMoralQ = [
    'rfc'
  ];
  const [isFormQComplete, setIsFormQComplete] = useState(false);
  const timeoutRef = useRef(null);
  const [textoPaisQ, setTextoPaisQ] = useState('País nacimiento');
  const [textoNacionalidadQ, setTextoNacionalidadQ] = useState('Nacionalidad');
  const [textoGiroQ, setTextoGiroQ] = useState('Actividad o Giro del Negocio');
  const [nacionalidadQ, setNacionalidadQ] = useState("");
  const [decPepQ, setDecPepQ] = useState("");

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
      if(res.length === 0){
        setFirstQuote(true);
        return;
      }else{
        setFirstQuote(false);
      }

      setQuotesQualitas(res);
    }catch(error){
      console.error('Error al obtener cotizaciones:', error);
      setFirstQuote(true);
      setQuotesQualitas([]);
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
      await historialService.registrarEventoMulticotizador(expedienteRenovacion);
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
          setClientDataQ(initialClientDataQ);
          setShowModalEmisionQualitas(true);
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

  const getCountriesQ = async () => {
    try{
      const res = await multicotizadorService.getCountriesQ();
      setCountriesQualitas(res);
    }catch(error){
      toast.error('Error al recuperar paises de Qualitas');
      setCountriesQualitas([]);
    }
  }

  const handleChangeQualitas = (e) => {
    const { name, value } = e.target;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      const isRequired = clientDataQ.tipo_persona == 1 ? requiredFieldsFisicaQ.some((x) => x === name) : requiredFieldsMoralQ.some((x) => x === name);
      if(isRequired){
        const alertRequired = document.getElementById("small_"+name);
        if((value == '' || value == null || value == undefined) && alertRequired){
          alertRequired.style.display = "block";
        }else{
          alertRequired.style.display = "none";
        }
      }
      
      const nextClientDataQ = {
        ...clientDataQ,
        [name]: value,
      };

      setClientDataQ(nextClientDataQ);

      validateFormQ(nextClientDataQ);
    },500);
  };

  const validateFormQ = (form) => {
    const requiredFields = form.tipo_persona == 1 ? requiredFieldsFisicaQ : requiredFieldsMoralQ
    let flag = true;
    for (const key of requiredFields) {
      if(form[key] == '' || form[key] == null || form[key] == undefined){
        flag = false;
        console.log(key);
        break;
      }
    }

    setIsFormQComplete(flag);
  }

  const inputsRequiredsQ = (inputName, action) => {
    if(clientDataQ.tipo_persona == 1){
      if(action === 'add'){
        requiredFieldsFisicaQ.push(inputName);
      }else if(action === 'remove'){
        const index = requiredFieldsFisicaQ.indexOf(inputName);
        if(index > -1){
          requiredFieldsFisicaQ.splice(index, 1);
        }
      }
    }else{
      if(action === 'add'){
        requiredFieldsMoralQ.push(inputName);
      }else if(action === 'remove'){
        const index = requiredFieldsMoralQ.indexOf(inputName);
        if(index > -1){
          requiredFieldsMoralQ.splice(index, 1);
        }
      }
    }
  }

  const changeTypePersonQ = (e) => {
    const { value } = e.target;
    if(value == 1){
      document.getElementById("fecha_nacimiento_group").classList.remove('d-none');
      document.getElementById("ocupacion_group").classList.remove('d-none');
      document.getElementById("identificacion_group").classList.remove('d-none');
      document.getElementById("entidadNacimiento_group").classList.remove('d-none');
      setNacionalidadQ("");
      setDecPepQ("");
      document.getElementById("profesionGroup").classList.remove('d-none');
      document.getElementById("nombreFisicaDiv").classList.remove('d-none');
      document.getElementById("nombreFisicaDiv2").classList.remove('d-none');
      document.getElementById("curpDiv").classList.remove('d-none');
      
      document.getElementById("fecha_constitucion_group").classList.add('d-none');
      document.getElementById("razonSocial_group").classList.add('d-none');
      setTextoPaisQ('País nacimiento');
      setTextoNacionalidadQ('Nacionalidad');
      setTextoGiroQ('Actividad o Giro del Negocio');
      document.getElementById("actividad_group").classList.add('d-none');
      document.getElementById("declaracionPep_Moral_group").classList.add('d-none');
      document.getElementById("dataFideicomiso").classList.add('d-none');
      document.getElementById("dataFideicomiso2").classList.add('d-none');
      document.getElementById("nombrePEP_moral").classList.add('d-none');

    }else{
      document.getElementById("fecha_nacimiento_group").classList.add('d-none');
      document.getElementById("ocupacion_group").classList.add('d-none');
      document.getElementById("identificacion_group").classList.add('d-none');
      document.getElementById("entidadNacimiento_group").classList.add('d-none');
      document.getElementById("div_dom_extrangero").classList.add('d-none');
      document.getElementById("div_pep").classList.add('d-none');
      document.getElementById("profesionGroup").classList.add('d-none');
      document.getElementById("nombreFisicaDiv").classList.add('d-none');
      document.getElementById("nombreFisicaDiv2").classList.add('d-none');
      document.getElementById("curpDiv").classList.add('d-none');

      document.getElementById("fecha_constitucion_group").classList.remove('d-none');
      document.getElementById("razonSocial_group").classList.remove('d-none');
      setTextoPaisQ('Nacionalidad de la sociedad');
      setTextoNacionalidadQ('Nacionalidad del asegurado');
      setTextoGiroQ('Giro mercantil aseg.');
      document.getElementById("actividad_group").classList.remove('d-none');
      document.getElementById("declaracionPep_Moral_group").classList.remove('d-none');
    }
  }
  
  const changeNacionality = (e) => {
    const { value } = e.target;
    if(value === '2'){
      document.getElementById("div_dom_extrangero").classList.remove('d-none');
      inputsRequiredsQ('domicilio_extrangero', 'add');
      inputsRequiredsQ('tipo_residencia', 'add');
    }else{
      document.getElementById("div_dom_extrangero").classList.add('d-none');
      inputsRequiredsQ('domicilio_extrangero', 'remove');
      inputsRequiredsQ('tipo_residencia', 'remove');
    }
  }

  const changeDecPep = (e) => {
    const { value } = e.target;
    if(value == 'S'){
      document.getElementById("div_pep").classList.remove("d-none");
      inputsRequiredsQ('nombre_pep', 'add');
      inputsRequiredsQ('parentesco_pep', 'add');
    }else{
      document.getElementById("div_pep").classList.add("d-none");
      inputsRequiredsQ('nombre_pep', 'remove');
      inputsRequiredsQ('parentesco_pep', 'remove');
    }
  }

  useEffect(() => {
    getQuotes();
    getCountriesQ();
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
                      <p style={{fontSize: '0.8rem'}}>{expedienteRenovacion.nombre != null ? expedienteRenovacion.nombre + expedienteRenovacion.apellido_paterno + ' ' + expedienteRenovacion.apellido_materno : expedienteRenovacion.razon_social}</p>
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
                    quotesQualitas.length === 0 ? (
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
                      {quotesQualitas.map((quote, index) => (
                        <>
                          {index > 0 && quote.aseguradora !== quotesQualitas[index - 1].aseguradora && (
                            <div className="w-100"></div>
                          )}

                            <label key={quote.paquete + '-' + quote.aseguradora} htmlFor={`quote-${quote.paquete}-${quote.aseguradora}`} style={{ cursor: 'pointer', maxWidth: '250px', minWidth: '150px' }} >
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
                        </>
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
                  {firstQuote ? (
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
            <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <div className="modal-dialog modal-x modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header text-white" style={{backgroundColor:"#941880"}}>
                    <h5 className="modal-title">
                      Qualitas
                    </h5>
                    <button 
                      type="button" 
                      className="btn-close btn-close-white" 
                      onClick={() => {
                        setShowModalEmisionQualitas(false);
                      }}
                    ></button>
                  </div>
                  
                  <div className="modal-body">
                    <div className="row" id="nombreFisicaDiv">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Nombre (s)</label>
                            <input type="text" className="form-control" name="nombres" id="nombres" onChange={handleChangeQualitas} autoComplete="nombres" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_nombres" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Apellido paterno</label>
                            <input type="text" className="form-control" name="ap_pat" id="ap_pat" onChange={handleChangeQualitas} autoComplete="ap_pat" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_ap_pat" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col" id="nombreFisicaDiv2">
                            <label style={{ fontSize: '0.8rem' }}>Apellido materno</label>
                            <input type="text" className="form-control" name="ap_mat" id="ap_mat" onChange={handleChangeQualitas} autoComplete="ap_mat" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_ap_mat" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Serie</label>
                            <input type="text" className="form-control" name="serie" id="serie" onChange={handleChangeQualitas} autoComplete="serie" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_serie" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col" id="curpDiv">
                            <label style={{ fontSize: '0.8rem' }}>CURP</label>
                            <input type="text" className="form-control" name="curp" id="curp" onChange={handleChangeQualitas} autoComplete="curp" onInput={handleChangeQualitas}/>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Número certificado FIEL</label>
                            <input type="text" className="form-control" name="fiel" id="fiel" onChange={handleChangeQualitas} autoComplete="fiel" onInput={handleChangeQualitas}/>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Tipo persona</label>
                            <select className="form-control kt-selectpicker" name="tipo_persona" id="tipo_persona" defaultValue={1} onChange={(e) => { handleChangeQualitas(e); changeTypePersonQ(e); }}>
                                <option value="1">Física</option>
                                <option value="2">Moral</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_tipo_persona" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Calle</label>
                            <input type="text" className="form-control" name="calle" id="calle" onChange={handleChangeQualitas} autoComplete="calle" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_calle" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col-3">
                            <label style={{ fontSize: '0.8rem' }}>Núm. ext.</label>
                            <input type="text" className="form-control" name="nro_ext" id="nro_ext" onChange={handleChangeQualitas} autoComplete="nro_ext" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_nro_ext" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col-3">
                            <label style={{ fontSize: '0.8rem' }}>Núm. int.</label>
                            <input type="text" className="form-control" name="nro_int" id="nro_int" onChange={handleChangeQualitas} autoComplete="nro_int" onInput={handleChangeQualitas}/>
                        </div>
                    </div>
                    <div className="row" id="profesionGroup">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Profesión</label>
                            <select className="form-control kt-selectpicker" name="profesion" id="profesion" defaultValue={17} onChange={handleChangeQualitas} autoComplete="profesion" onInput={handleChangeQualitas}>
                                <option value="17">Ninguna</option>
                                <option value="1">Administrador</option>
                                <option value="2">Abogado</option>
                                <option value="3">Arquitecto</option>
                                <option value="4">Actuario</option>
                                <option value="5">Contador</option>
                                <option value="6">Docente</option>
                                <option value="7">Economista</option>
                                <option value="8">Ingeniero</option>
                                <option value="9">Médico</option>
                                <option value="19">Psicólogo</option>
                                <option value="11">Odontólogo</option>
                                <option value="12">Químico</option>
                                <option value="13">Biólogo</option>
                                <option value="14">Sociólogo</option>
                                <option value="15">Periodista</option>
                                <option value="16">Otro</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_profesion" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Género</label>
                            <select className="form-control kt-selectpicker" name="genero" id="genero" onChange={handleChangeQualitas} autoComplete="genero" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="H">Hombre</option>
                                <option value="M">Mujer</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_genero" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Telefono</label>
                            <input type="text" className="form-control" name="telefono" id="telefono" onChange={handleChangeQualitas} autoComplete="telefono" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_telefono" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Celular</label>
                            <input type="text" className="form-control" name="celular" id="celular" onChange={handleChangeQualitas} autoComplete="celular" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_celular" className=" form-text text-danger">Campo obligatorio</small>                        
                        </div>
                    </div>
                    <div className="row">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Correo electrónico</label>
                            <input type="text" className="form-control" name="correo" id="correo" onChange={handleChangeQualitas} autoComplete="correo" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_correo" className=" form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col">
                            <div id="fecha_nacimiento_group">
                                <label style={{ fontSize: '0.8rem' }}>Fecha de nacimiento</label>
                                <input type="date" className="form-control" name="fecha_nacimiento" id="fecha_nacimiento" onChange={handleChangeQualitas} autoComplete="fecha_nacimiento" onInput={handleChangeQualitas}/>
                                <small style={{fontStyle: "italic", display: "none"}} id="small_fecha_nacimiento" className="form-text text-danger">Campo obligatorio</small>
                            </div>
                            <div className="d-none" id="fecha_constitucion_group">
                                <label style={{ fontSize: '0.8rem' }}>Fecha constitucion aseg.</label>
                                <input type="date" className="form-control" name="fecha_constitucion" id="fecha_constitucion" onChange={handleChangeQualitas} autoComplete="fecha_constitucion" onInput={handleChangeQualitas}/>
                                <small style={{fontStyle: "italic", display: "none"}} id="small_fecha_constitucion" className="form-text text-danger">Campo obligatorio</small>
                            </div>
                        </div>
                        <div className="col">
                            <div id="nacionalidad_group">
                                <label style={{ fontSize: '0.8rem' }} id="nacionalidadText">{textoNacionalidadQ}</label>
                                <select className="form-control" name="nacionalidad" id="nacionalidad" onChange={(e) => { handleChangeQualitas(e); changeNacionality(e); setNacionalidadQ(e.target.value); }} autoComplete="nacionalidad" onInput={handleChangeQualitas} value={nacionalidadQ}>
                                    <option value=""></option>
                                    <option value="1">Mexicana</option>
                                    <option value="2">Extranjera</option>
                                </select>
                                <small style={{fontStyle: "italic", display: "none"}} id="small_nacionalidad" className="form-text text-danger">Campo obligatorio</small>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }} id="texto_pais">{textoPaisQ}</label>
                            <select className="form-control" data-live-search="true" data-size="5" name="pais_nacimiento" id="pais_nacimiento" onChange={handleChangeQualitas} autoComplete="pais_nacimiento" onInput={handleChangeQualitas}>
                                <option></option>
                                {countriesQualitas.map((country) => (
                                  <option key={country.codigo} value={country.codigo}>
                                    {country.nombre}
                                  </option>
                                ))}
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_pais_nacimiento" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <div id="ocupacion_group">
                                <label style={{ fontSize: '0.8rem' }}>Ocupación</label>
                                <select className="form-control" name="ocupacion" id="ocupacion" onChange={handleChangeQualitas} autoComplete="ocupacion" onInput={handleChangeQualitas}>
                                    <option></option>
                                    <option value="1">Comerciante</option>
                                    <option value="2">Empleado</option>
                                    <option value="3">Empresario</option>
                                    <option value="4">Permisionario</option>
                                    <option value="6">Transportista</option>
                                    <option value="7">Hogar</option>
                                    <option value="5">Otro</option>
                                </select>
                                <small style={{fontStyle: "italic", display: "none"}} id="small_ocupacion" className="form-text text-danger">Campo obligatorio</small>
                            </div>
                            <div className="d-none" id="razonSocial_group">
                                <label style={{ fontSize: '0.8rem' }}>Razón social</label>
                                <input type="text" className="form-control" name="razon_social" id="razon_social" onChange={handleChangeQualitas} autoComplete="razon_social" onInput={handleChangeQualitas}/>
                                <small style={{fontStyle: "italic", display: "none"}} id="small_razon_social" className="form-text text-danger">Campo obligatorio</small>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }} id="giroText">{textoGiroQ}</label>
                            <select className="form-control kt-selectpicker" name="actividad_giro" id="actividad_giro" onChange={handleChangeQualitas} autoComplete="actividad_giro" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="10">Industrial</option>
                                <option value="20">Comercial</option>
                                <option value="30">Servicios</option>
                                <option value="31">Serv. Públicos</option>
                                <option value="32">Serv. Privados</option>
                                <option value="33">Transporte</option>
                                <option value="34">Turismo</option>
                                <option value="35">Instituciones Financieras</option>
                                <option value="36">Educación</option>
                                <option value="37">Salubridad</option>
                                <option value="38">Finanzas y Seguros</option>
                                <option value="39">Act Vul Ofrecimiento/Prestacion de Servicios</option>
                                <option value="40">Act Vul Otros Emision/Compra/Venta/Distribucion/Comercializacion/Subasta/Intermediacion</option>
                                <option value="41">Act Vul Otros</option>
                                <option value="42">Otros</option>
                                <option value="43">SOFOM ENR (Sociedad Financiera de Objeto Múltiple No Regulada)</option>
                                <option value="44">Transmisor de Dinero</option>
                                <option value="45">Centro Cambiario</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_actividad_giro" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>RFC</label>
                            <input type="text" className="form-control" name="rfc" id="rfc" onKeyUp={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase(); }} onChange={handleChangeQualitas} autoComplete="rfc" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_rfc" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row" id="identificacion_group">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Tipo de identificación</label>
                            <select className="form-control kt-selectpicker" name="tipo_identificacion" id="tipo_identificacion" onChange={handleChangeQualitas} autoComplete="tipo_identificacion" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="1">Credencial IFE</option>
                                <option value="2">Licencia de conducir</option>
                                <option value="3">Pasaporte</option>
                                <option value="4">Cedula profecional</option>
                                <option value="5">Cartilla del servicio militar</option>
                                <option value="6">Certificado de matricula consular</option>
                                <option value="7">Tarjeta unica de identificacion militar</option>
                                <option value="8">Tarjeta de afiliación al Instituto Nacional de las Personas Adultas Mayores</option>
                                <option value="9">Afiliacion al IMSS</option>
                                <option value="10">Forma migratoria</option>
                                <option value="11">CURP</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_tipo_identificacion" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Núm. Identificación</label>
                            <input type="text" className="form-control" name="num_identificacion" id="num_identificacion" onChange={handleChangeQualitas} autoComplete="num_identificacion" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_num_identificacion" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row" id="entidadNacimiento_group">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Entidad Federativa de Nacimiento</label>
                            <select className="form-control kt-selectpicker" data-live-search="true" data-size="5" name="estado_nacimiento" id="estado_nacimiento" onChange={handleChangeQualitas} autoComplete="estado_nacimiento" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="AS">Aguascalientes</option>
                                <option value="BC">Baja California</option>
                                <option value="BS">Baja California Sur</option>
                                <option value="CC">Campeche</option>
                                <option value="CL">Coahuila</option>
                                <option value="CM">Colima</option>
                                <option value="CS">Chiapas</option>
                                <option value="CH">Chihuahua</option>
                                <option value="DF">Distrito Federal</option>
                                <option value="DG">Durango</option>
                                <option value="GT">Guanajuato</option>
                                <option value="GR">Guerrero</option>
                                <option value="HG">Hidalgo</option>
                                <option value="JC">Jalisco</option>
                                <option value="MC">México</option>
                                <option value="MN">Michoacan</option>
                                <option value="MS">Morelos</option>
                                <option value="NT">Nayarit</option>
                                <option value="NL">Nuevo Leon</option>
                                <option value="OC">Oaxaca</option>
                                <option value="PL">Puebla</option>
                                <option value="QT">Queretaro</option>
                                <option value="QR">Quintana Roo</option>
                                <option value="SP">San Luis Potosí</option>
                                <option value="SL">Sinaloa</option>
                                <option value="SR">Sonora</option>
                                <option value="TC">Tabasco</option>
                                <option value="TS">Tamaulipas</option>
                                <option value="TL">Tlaxcala</option>
                                <option value="VZ">Veracruz</option>
                                <option value="YN">Yucatan</option>
                                <option value="ZS">Zacatecas</option>
                                <option value="NE">Nacido en el extranjero</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_estado_nacimiento" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }} title="¿Alguno de los socios o accionistas, desempeña o ha desempeñado en los últimos 2 años cargo alguno en el gobierno y/o funciones públicas destacadas en un país extranjero o territorio Nacional?">Declaracion PEP <Info size={16} style={{ cursor:"pointer" }}/></label>
                            <select className="form-control kt-selectpicker" name="declaracion_pep" id="declaracion_pep" onChange={(e) => {handleChangeQualitas(e); changeDecPep(e); setDecPepQ(e.target.value)}} autoComplete="declaracion_pep" onInput={handleChangeQualitas} value={decPepQ}>
                                <option value=""></option>
                                <option value="N">No</option>
                                <option value="S">Si</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_declaracion_pep" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row d-none" id="div_pep">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Nombre funcionario PEP</label>
                            <input type="text" className="form-control" name="nombre_pep" id="nombre_pep" onChange={handleChangeQualitas} autoComplete="nombre_pep" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_pep" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Parentesco</label>
                            <select className="form-control kt-selectpicker" id="parentesco_pep" name="parentesco_pep" onChange={handleChangeQualitas} autoComplete="parentesco_pep" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="1">Esposo</option>
                                <option value="2">Esposa</option>
                                <option value="3">Hijo</option>
                                <option value="4">Hija</option>
                                <option value="5">Hermano</option>
                                <option value="6">Hermana</option>
                                <option value="7">Padre</option>
                                <option value="8">Madre</option>
                                <option value="9">Abuelo</option>
                                <option value="10">Abuela</option>
                                <option value="11">Tio</option>
                                <option value="12">Tia</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_parentesco_pep" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row d-none" id="div_dom_extrangero">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Domicilio (Extranjero)</label>
                            <input type="text" className="form-control" name="domicilio_extrangero" id="domicilio_extrangero" onChange={handleChangeQualitas} autoComplete="domicilio_extrangero" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_domicilio_extrangero" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Tipo residencia</label>
                            <select className="form-control kt-selectpicker" id="tipo_residencia" name="tipo_residencia" onChange={handleChangeQualitas} autoComplete="tipo_residencia" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="1">Temporal</option>
                                <option value="2">Permanente</option>
                                <option value="3">No reside</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="smal_tipoResidencia" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row" id="actividad_group" style={{ display: "none" }}>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Actividad u objeto social aseg.</label>
                            <input type="text" className="form-control" name="act_obj_social" id="act_obj_social" onChange={handleChangeQualitas} autoComplete="act_obj_social" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_act_obj_social" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Apoderado legar aseg.</label>
                            <input type="text" className="form-control" name="apoderado" id="apoderado" onChange={handleChangeQualitas} autoComplete="apoderado" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_apoderado" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row" id="declaracionPep_Moral_group" style={{ display: "none" }}>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Folio mercantil</label>
                            <input type="text" className="form-control" name="folio_mercantil" id="folio_mercantil" onChange={handleChangeQualitas} autoComplete="folio_mercantil" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_folio_mercantil" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col-3">
                            <label style={{ fontSize: '0.8rem' }} title="¿Alguno de los socios o accionistas, desempeña o ha desempeñado en los últimos 2 años cargo alguno en el gobierno y/o funciones públicas destacadas en un país extranjero o territorio Nacional?">Decl. PEP <Info size={16} style={{ cursor:"pointer" }}/></label>
                            <select className="form-control kt-selectpicker" name="dec_pep_moral" id="dec_pep_moral" onChange={handleChangeQualitas} autoComplete="dec_pep_moral" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="N">No</option>
                                <option value="S">Si</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_dec_pep_moral" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col-3">
                            <label style={{ fontSize: '0.8rem' }}>Fideicomiso</label>
                            <select className="form-control kt-selectpicker" name="fideicomiso" id="fideicomiso" onChange={handleChangeQualitas} autoComplete="fideicomiso" onInput={handleChangeQualitas}>
                                <option></option>
                                <option value="N">No</option>
                                <option value="S">Si</option>
                            </select>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_fideicomiso" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row d-none" id="dataFideicomiso">
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Nombre fideicomiso</label>
                            <input type="text" className="form-control" name="nombre_fideicomiso" id="nombre_fideicomiso" onChange={handleChangeQualitas} autoComplete="nombre_fideicomiso" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_fideicomiso" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col">
                            <label style={{ fontSize: '0.8rem' }}>Nombre fidecomitente</label>
                            <input type="text" className="form-control" name="nombre_fidecomitente" id="nombre_fidecomitente" onChange={handleChangeQualitas} autoComplete="nombre_fidecomitente" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_fidecomitente" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col d-none" id="dataFideicomiso2">
                            <label style={{ fontSize: '0.8rem' }}>Nombre fiduciario</label>
                            <input type="text" className="form-control" name="nombre_fiduciario" id="nombre_fiduciario" onChange={handleChangeQualitas} autoComplete="nombre_fiduciario" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_fiduciario" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="col d-none" id="nombrePEP_moral">
                            <label style={{ fontSize: '0.8rem' }}>Nombre del funcionario PEP</label>
                            <input type="text" className="form-control" name="funcionario_pep_moral" id="funcionario_pep_moral" onChange={handleChangeQualitas} autoComplete="funcionario_pep_moral" onInput={handleChangeQualitas}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_funcionario_pep_moral" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <br/>
                    <div className="row">
                        <div className="col">
                            <div className="form-group form-check">
                                <input type="checkbox" className="form-check-input" id="aviso_privacidad" name="aviso_privacidad"/>
                                <label style={{ fontSize: '0.8rem' }} className="form-check-label" htmlFor="aviso_privacidad">He leído y estoy de acuerdo con el <a href="https://www.qualitas.com.mx/web/qmx/aviso-de-privacidad-1" target="_blank">Aviso de Privacidad.</a></label>						
                                <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_aviso_privacidad" className="form-text text-danger">Debes aceptar el aviso de privacidad</small>
                            </div>
                            <div className="form-group form-check">
                                <input type="checkbox" className="form-check-input" id="interesados" name="interesados"/>
                                <label className="form-check-label" style={{ fontSize: '0.8rem' }} htmlFor="interesados">Estoy de acuerdo en que mis datos personales sean tratados con fines de mercadotecnia, publicidad o prospección comercial para ofrecerle otros de nuestros productos, servicios y promociones.</label>
                            </div>
                        </div>
                    </div>
                  </div>
                  
                  <div className="modal-footer">
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowModalEmisionQualitas(false);
                        
                      }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button" 
                      className="btn"
                      style={{ backgroundColor:"#941880", color:"white" }}
                      disabled={!isFormQComplete}
                    >
                      <RefreshCw size={16} className="me-2" />
                      Emitir Póliza
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
    </div>
  );
});

MulticotizadorExpediente.displayName = 'MulticotizadorExpediente';

export default MulticotizadorExpediente;