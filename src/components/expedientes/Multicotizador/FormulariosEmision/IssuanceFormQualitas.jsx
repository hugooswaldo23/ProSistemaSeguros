import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Loader, RefreshCw, Info } from 'lucide-react';
import * as multicotizadorService from '../../../../services/multicotizadorService';
import * as historialService from '../../../../services/historialExpedienteService';

const IssuanceFormQualitas = ({
    setShowModalEmisionQualitas,
    selectedQuote,
    expedienteRenovacion,
    reloadMulticotizador
}) => {
    const [cargandoEmision, setCargandoEmision] = useState(false);
    const [countriesQualitas, setCountriesQualitas] = useState([])
    const initialClientDataQ = {
        aseguradora:'Qualitas',
        paquete:'',
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
        correo:'',
        fecha_nacimiento:'',
        nacionalidad:'',
        domicilio_extranjero:'',
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
        'telefono',
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
        'serie',
        'calle',
        'nro_ext',
        'telefono',
        'correo',
        'fecha_constitucion',
        'nacionalidad',
        'pais_nacimiento',
        'razon_social',
        'actividad_giro',
        'rfc',
        'act_obj_social',
        'apoderado',
        'folio_mercantil',
        'dec_pep_moral',
        'fideicomiso'
    ];
    const requiredFieldsAdditional = [];
    const [isFormQComplete, setIsFormQComplete] = useState(false);
    const timeoutRef = useRef(null);
    const [textoPaisQ, setTextoPaisQ] = useState('País nacimiento');
    const [textoNacionalidadQ, setTextoNacionalidadQ] = useState('Nacionalidad');
    const [textoGiroQ, setTextoGiroQ] = useState('Actividad o Giro del Negocio');
    const [nacionalidadQ, setNacionalidadQ] = useState("");
    const [decPepQ, setDecPepQ] = useState("");
    const [decPepMoralQ, setDecPepMoralQ] = useState("");
    const [fideicomisoQ, setFideicomisoQ] = useState("");
    const [insurer, pack] = selectedQuote.trim().split('||');
    const [isAceptedPrivacyPolicy, setIsAceptedPrivacyPolicy] = useState(false);

    const preLoadData = () => {
        if(expedienteRenovacion){
            const tel = (expedienteRenovacion.telefono_fijo != null && expedienteRenovacion.telefono_fijo != '') ? expedienteRenovacion.telefono_fijo : expedienteRenovacion.telefono_movil;
            setClientDataQ(prev => ({
                ...prev,
                nombres: expedienteRenovacion.nombre || '',
                ap_pat: expedienteRenovacion.apellido_paterno || '',
                ap_mat: expedienteRenovacion.apellido_materno || '',
                serie: expedienteRenovacion.numero_serie || '',
                rfc: expedienteRenovacion.rfc || '',
                razon_social: expedienteRenovacion.razon_social || '',
                paquete: pack,
                telefono: tel || '',
                correo: expedienteRenovacion.email || '',
                calle: expedienteRenovacion.direccion_c || '',
                curp: expedienteRenovacion.curp || '',
                fecha_nacimiento: expedienteRenovacion.fecha_nacimiento_c || '',
            }));
        }
    };

    useEffect(() => {
        getCountriesQ();
        setClientDataQ(initialClientDataQ);
        preLoadData();
    }, []);

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
            let requiredFields = clientDataQ.tipo_persona == 1 ? requiredFieldsFisicaQ : requiredFieldsMoralQ;
            requiredFields = [...requiredFields, ...requiredFieldsAdditional];
            const isRequired = requiredFields.some((x) => x === name);

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
        let requiredFields = form.tipo_persona == 1 ? requiredFieldsFisicaQ : requiredFieldsMoralQ;
        requiredFields = [...requiredFields, ...requiredFieldsAdditional];
        let flag = true;
        for (const key of requiredFields) {
            if(form[key] == '' || form[key] == null || form[key] == undefined){
                flag = false;
                break;
            }
        }

        setIsFormQComplete(flag);
        return flag;
    }

    const addInputsRequiredsQ = (inputName, action) => {
        if(action === 'add'){
            requiredFieldsAdditional.push(inputName);
        }else if(action === 'remove'){
            const index = requiredFieldsAdditional.indexOf(inputName);
            if(index > -1){
                requiredFieldsAdditional.splice(index, 1);
            }
        }
    }

    const changeTypePersonQ = (e) => {
        const { value } = e.target;
        requiredFieldsAdditional.length = 0;
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
            document.getElementById("div_pep").classList.add('d-none');
            document.getElementById("profesionGroup").classList.add('d-none');
            document.getElementById("nombreFisicaDiv").classList.add('d-none');
            document.getElementById("nombreFisicaDiv2").classList.add('d-none');
            document.getElementById("curpDiv").classList.add('d-none');

            document.getElementById("fecha_constitucion_group").classList.remove('d-none');
            setTextoPaisQ('Nacionalidad de la sociedad');
            setTextoNacionalidadQ('Nacionalidad del asegurado');
            document.getElementById("razonSocial_group").classList.remove('d-none');
            setTextoGiroQ('Giro mercantil aseg.');
            document.getElementById("actividad_group").classList.remove('d-none');
            document.getElementById("declaracionPep_Moral_group").classList.remove('d-none');
            setDecPepMoralQ("");
            setFideicomisoQ("");
            setNacionalidadQ("");
        }
    }

    const changeNacionality = (e) => {
        const { value } = e.target;
        if(value === '2'){
            document.getElementById("div_dom_extrangero").classList.remove('d-none');
            addInputsRequiredsQ('domicilio_extranjero', 'add');
            addInputsRequiredsQ('tipo_residencia', 'add');
        }else{
            document.getElementById("div_dom_extrangero").classList.add('d-none');
            addInputsRequiredsQ('domicilio_extranjero', 'remove');
            addInputsRequiredsQ('tipo_residencia', 'remove');
        }
    }

    const changeDecPep = (e) => {
        const { value } = e.target;
        if(value == 'S'){
            document.getElementById("div_pep").classList.remove("d-none");
            addInputsRequiredsQ('nombre_pep', 'add');
            addInputsRequiredsQ('parentesco_pep', 'add');
        }else{
            document.getElementById("div_pep").classList.add("d-none");
            addInputsRequiredsQ('nombre_pep', 'remove');
            addInputsRequiredsQ('parentesco_pep', 'remove');
        }
    }

    const changeDecPepMoral = (e) => {
        const { value } = e.target;
        if(value == 'S'){
            document.getElementById("nombrePEP_moral").classList.remove("d-none");
            addInputsRequiredsQ('funcionario_pep_moral', 'add');
        }else{
            document.getElementById("nombrePEP_moral").classList.add("d-none");
            addInputsRequiredsQ('funcionario_pep_moral', 'remove');
        }
    }

    const changeFideicomisoMoral = (e) => {
        const { value } = e.target;
        if(value == 'S'){
            document.getElementById("dataFideicomiso").classList.remove("d-none");
            document.getElementById("dataFideicomiso2").classList.remove("d-none");
            addInputsRequiredsQ('nombre_fideicomiso', 'add');
            addInputsRequiredsQ('nombre_fidecomitente', 'add');
            addInputsRequiredsQ('nombre_fiduciario', 'add');
        }else{
            document.getElementById("dataFideicomiso").classList.add("d-none");
            document.getElementById("dataFideicomiso2").classList.add("d-none");
            addInputsRequiredsQ('nombre_fideicomiso', 'remove');
            addInputsRequiredsQ('nombre_fidecomitente', 'remove');
            addInputsRequiredsQ('nombre_fiduciario', 'remove');
        }
    }

    const issuancePolicyQualitas = async () => {
        if(!validateFormQ(clientDataQ)){
            toast.error('Por favor completa todos los campos requeridos');
            return;
        }

        setCargandoEmision(true);

        const resultado = await multicotizadorService.emitirPoliza(expedienteRenovacion.id, clientDataQ);
        if (resultado.success) {
            toast.success('Póliza generada correctamente');
        } else {
            toast.error(resultado.error || 'Error al generar póliza');
            setCargandoEmision(false);
            return;
        }
        
        const msg = `Multicotizador - póliza #${resultado.numero_poliza || 'S/N'} emitida, que sustituye a la póliza #${expedienteRenovacion.numero_poliza || 'S/N'}.`;
        await historialService.registrarEventoMulticotizador(expedienteRenovacion, 'poliza_emitida', msg);
        setCargandoEmision(false);
        setShowModalEmisionQualitas(false);
        reloadMulticotizador();
    }

    return (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-x modal-dialog-centered">
            <div className="modal-content">
                <div className="modal-header text-white" style={{backgroundColor:"#941880"}}>
                <h5 className="modal-title">
                    {insurer} - {pack}
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
                <div className="row">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Tipo persona*</label>
                        <select className="form-control kt-selectpicker" name="tipo_persona" id="tipo_persona" defaultValue={1} onChange={(e) => { handleChangeQualitas(e); changeTypePersonQ(e); }}>
                            <option value="1">Física</option>
                            <option value="2">Moral</option>
                        </select>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_tipo_persona" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row" id="nombreFisicaDiv">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Nombre (s)*</label>
                        <input type="text" className="form-control" name="nombres" id="nombres" onChange={handleChangeQualitas} autoComplete="nombres" defaultValue={expedienteRenovacion.nombre || ''}/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_nombres" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Apellido paterno*</label>
                        <input type="text" className="form-control" name="ap_pat" id="ap_pat" onChange={handleChangeQualitas} autoComplete="ap_pat" defaultValue={expedienteRenovacion.apellido_paterno || ''}/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_ap_pat" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row">
                    <div className="col" id="nombreFisicaDiv2">
                        <label style={{ fontSize: '0.8rem' }}>Apellido materno*</label>
                        <input type="text" className="form-control" name="ap_mat" id="ap_mat" onChange={handleChangeQualitas} autoComplete="ap_mat" defaultValue={expedienteRenovacion.apellido_materno || ''}/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_ap_mat" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Serie*</label>
                        <input type="text" className="form-control" name="serie" id="serie" onChange={handleChangeQualitas} autoComplete="serie" defaultValue={expedienteRenovacion.numero_serie || ''}/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_serie" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row">
                    <div className="col" id="curpDiv">
                        <label style={{ fontSize: '0.8rem' }}>CURP</label>
                        <input type="text" className="form-control" name="curp" id="curp" onChange={handleChangeQualitas} autoComplete="curp" defaultValue={expedienteRenovacion.curp || ''}/>
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Número certificado FIEL</label>
                        <input type="text" className="form-control" name="fiel" id="fiel" onChange={handleChangeQualitas} autoComplete="fiel"/>
                    </div>
                </div>
                <div className="row">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Calle*</label>
                        <input type="text" className="form-control" name="calle" id="calle" onChange={handleChangeQualitas} autoComplete="calle" defaultValue={expedienteRenovacion.direccion_c || ''}/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_calle" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-3">
                        <label style={{ fontSize: '0.8rem' }}>Núm. ext.*</label>
                        <input type="text" className="form-control" name="nro_ext" id="nro_ext" onChange={handleChangeQualitas} autoComplete="nro_ext"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_nro_ext" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-3">
                        <label style={{ fontSize: '0.8rem' }}>Núm. int.</label>
                        <input type="text" className="form-control" name="nro_int" id="nro_int" onChange={handleChangeQualitas} autoComplete="nro_int"/>
                    </div>
                </div>
                <div className="row" id="profesionGroup">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Profesión*</label>
                        <select className="form-control kt-selectpicker" name="profesion" id="profesion" defaultValue={17} onChange={handleChangeQualitas} autoComplete="profesion">
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
                        <label style={{ fontSize: '0.8rem' }}>Género*</label>
                        <select className="form-control kt-selectpicker" name="genero" id="genero" onChange={handleChangeQualitas} autoComplete="genero">
                            <option></option>
                            <option value="H">Hombre</option>
                            <option value="M">Mujer</option>
                        </select>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_genero" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Teléfono*</label>
                        <input type="text" className="form-control" name="telefono" id="telefono" onChange={handleChangeQualitas} autoComplete="telefono" defaultValue={(expedienteRenovacion.telefono_fijo != null && expedienteRenovacion.telefono_fijo != '') ? expedienteRenovacion.telefono_fijo : expedienteRenovacion.telefono_movil}/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_telefono" className=" form-text text-danger">Campo obligatorio</small>                        
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Correo electrónico*</label>
                        <input type="text" className="form-control" name="correo" id="correo" onChange={handleChangeQualitas} autoComplete="correo" defaultValue={expedienteRenovacion.email || ''}/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_correo" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row">
                    <div className="col">
                        <div id="fecha_nacimiento_group">
                            <label style={{ fontSize: '0.8rem' }}>Fecha de nacimiento*</label>
                            <input type="date" className="form-control" name="fecha_nacimiento" id="fecha_nacimiento" onChange={handleChangeQualitas} autoComplete="fecha_nacimiento" defaultValue={expedienteRenovacion.fecha_nacimiento_c ? expedienteRenovacion.fecha_nacimiento_c.split('T')[0] : ''}/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_fecha_nacimiento" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                        <div className="d-none" id="fecha_constitucion_group">
                            <label style={{ fontSize: '0.8rem' }}>Fecha constitucion aseg.*</label>
                            <input type="date" className="form-control" name="fecha_constitucion" id="fecha_constitucion" onChange={handleChangeQualitas} autoComplete="fecha_constitucion"/>
                            <small style={{fontStyle: "italic", display: "none"}} id="small_fecha_constitucion" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                    <div className="col">
                        <div id="nacionalidad_group">
                            <label style={{ fontSize: '0.8rem' }} id="nacionalidadText">{textoNacionalidadQ}*</label>
                            <select className="form-control" name="nacionalidad" id="nacionalidad" onChange={(e) => { handleChangeQualitas(e); changeNacionality(e); setNacionalidadQ(e.target.value); }} autoComplete="nacionalidad" value={nacionalidadQ}>
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
                        <label style={{ fontSize: '0.8rem' }} id="texto_pais">{textoPaisQ}*</label>
                        <select className="form-control" data-live-search="true" data-size="5" name="pais_nacimiento" id="pais_nacimiento" onChange={handleChangeQualitas} autoComplete="pais_nacimiento">
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
                            <label style={{ fontSize: '0.8rem' }}>Ocupación*</label>
                            <select className="form-control" name="ocupacion" id="ocupacion" onChange={handleChangeQualitas} autoComplete="ocupacion">
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
                            <label style={{ fontSize: '0.8rem' }}>Razón social*</label>
                            <input type="text" className="form-control" name="razon_social" id="razon_social" onChange={handleChangeQualitas} autoComplete="razon_social" defaultValue={expedienteRenovacion.razon_social || ''} />
                            <small style={{fontStyle: "italic", display: "none"}} id="small_razon_social" className="form-text text-danger">Campo obligatorio</small>
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }} id="giroText">{textoGiroQ}*</label>
                        <select className="form-control kt-selectpicker" name="actividad_giro" id="actividad_giro" onChange={handleChangeQualitas} autoComplete="actividad_giro">
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
                        <input type="text" className="form-control" name="rfc" id="rfc" onKeyUp={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase(); }} onChange={handleChangeQualitas} autoComplete="rfc" defaultValue={expedienteRenovacion.rfc || ''} />
                        <small style={{fontStyle: "italic", display: "none"}} id="small_rfc" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row" id="identificacion_group">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Tipo de identificación*</label>
                        <select className="form-control kt-selectpicker" name="tipo_identificacion" id="tipo_identificacion" onChange={handleChangeQualitas} autoComplete="tipo_identificacion">
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
                        <label style={{ fontSize: '0.8rem' }}>Núm. Identificación*</label>
                        <input type="text" className="form-control" name="num_identificacion" id="num_identificacion" onChange={handleChangeQualitas} autoComplete="num_identificacion"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_num_identificacion" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row" id="entidadNacimiento_group">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Entidad Federativa de Nacimiento*</label>
                        <select className="form-control kt-selectpicker" data-live-search="true" data-size="5" name="estado_nacimiento" id="estado_nacimiento" onChange={handleChangeQualitas} autoComplete="estado_nacimiento">
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
                        <label style={{ fontSize: '0.8rem' }} title="¿Alguno de los socios o accionistas, desempeña o ha desempeñado en los últimos 2 años cargo alguno en el gobierno y/o funciones públicas destacadas en un país extranjero o territorio Nacional?">Declaracion PEP* <Info size={16} style={{ cursor:"pointer" }}/></label>
                        <select className="form-control kt-selectpicker" name="declaracion_pep" id="declaracion_pep" onChange={(e) => {handleChangeQualitas(e); changeDecPep(e); setDecPepQ(e.target.value)}} autoComplete="declaracion_pep" value={decPepQ}>
                            <option value=""></option>
                            <option value="N">No</option>
                            <option value="S">Si</option>
                        </select>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_declaracion_pep" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row d-none" id="div_pep">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Nombre funcionario PEP*</label>
                        <input type="text" className="form-control" name="nombre_pep" id="nombre_pep" onChange={handleChangeQualitas} autoComplete="nombre_pep"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_pep" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Parentesco*</label>
                        <select className="form-control kt-selectpicker" id="parentesco_pep" name="parentesco_pep" onChange={handleChangeQualitas} autoComplete="parentesco_pep">
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
                        <label style={{ fontSize: '0.8rem' }}>Domicilio (Extranjero)*</label>
                        <input type="text" className="form-control" name="domicilio_extranjero" id="domicilio_extranjero" onChange={handleChangeQualitas} autoComplete="domicilio_extranjero"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_domicilio_extranjero" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Tipo residencia*</label>
                        <select className="form-control kt-selectpicker" id="tipo_residencia" name="tipo_residencia" onChange={handleChangeQualitas} autoComplete="tipo_residencia">
                            <option></option>
                            <option value="1">Temporal</option>
                            <option value="2">Permanente</option>
                            <option value="3">No reside</option>
                        </select>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_tipo_residencia" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row d-none" id="actividad_group">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Actividad u objeto social aseg.*</label>
                        <input type="text" className="form-control" name="act_obj_social" id="act_obj_social" onChange={handleChangeQualitas} autoComplete="act_obj_social"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_act_obj_social" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Apoderado legar aseg.*</label>
                        <input type="text" className="form-control" name="apoderado" id="apoderado" onChange={handleChangeQualitas} autoComplete="apoderado"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_apoderado" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row d-none" id="declaracionPep_Moral_group">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Folio mercantil*</label>
                        <input type="text" className="form-control" name="folio_mercantil" id="folio_mercantil" onChange={handleChangeQualitas} autoComplete="folio_mercantil"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_folio_mercantil" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-3">
                        <label style={{ fontSize: '0.8rem' }} title="¿Alguno de los socios o accionistas, desempeña o ha desempeñado en los últimos 2 años cargo alguno en el gobierno y/o funciones públicas destacadas en un país extranjero o territorio Nacional?">Decl. PEP *<Info size={16} style={{ cursor:"pointer" }}/></label>
                        <select className="form-control kt-selectpicker" name="dec_pep_moral" id="dec_pep_moral" onChange={(e) => { handleChangeQualitas(e); changeDecPepMoral(e); setDecPepMoralQ(e.target.value);}} autoComplete="dec_pep_moral" value={decPepMoralQ}>
                            <option value=""></option>
                            <option value="N">No</option>
                            <option value="S">Si</option>
                        </select>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_dec_pep_moral" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-3">
                        <label style={{ fontSize: '0.8rem' }}>Fideicomiso*</label>
                        <select className="form-control kt-selectpicker" name="fideicomiso" id="fideicomiso" onChange={(e) => { handleChangeQualitas(e); changeFideicomisoMoral(e); setFideicomisoQ(e.target.value);}} autoComplete="fideicomiso" value={fideicomisoQ}>
                            <option value=""></option>
                            <option value="N">No</option>
                            <option value="S">Si</option>
                        </select>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_fideicomiso" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row d-none" id="dataFideicomiso">
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Nombre fideicomiso*</label>
                        <input type="text" className="form-control" name="nombre_fideicomiso" id="nombre_fideicomiso" onChange={handleChangeQualitas} autoComplete="nombre_fideicomiso"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_fideicomiso" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col">
                        <label style={{ fontSize: '0.8rem' }}>Nombre fidecomitente*</label>
                        <input type="text" className="form-control" name="nombre_fidecomitente" id="nombre_fidecomitente" onChange={handleChangeQualitas} autoComplete="nombre_fidecomitente"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_fidecomitente" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <div className="row">
                    <div className="col d-none" id="dataFideicomiso2">
                        <label style={{ fontSize: '0.8rem' }}>Nombre fiduciario*</label>
                        <input type="text" className="form-control" name="nombre_fiduciario" id="nombre_fiduciario" onChange={handleChangeQualitas} autoComplete="nombre_fiduciario"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_fiduciario" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col d-none" id="nombrePEP_moral">
                        <label style={{ fontSize: '0.8rem' }}>Nombre del funcionario PEP*</label>
                        <input type="text" className="form-control" name="funcionario_pep_moral" id="funcionario_pep_moral" onChange={handleChangeQualitas} autoComplete="funcionario_pep_moral"/>
                        <small style={{fontStyle: "italic", display: "none"}} id="small_funcionario_pep_moral" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                </div>
                <br/>
                <div className="row">
                    <div className="col">
                        <div className="form-group form-check">
                            <input type="checkbox" className="form-check-input" id="aviso_privacidad" name="aviso_privacidad" onChange={(e) => setIsAceptedPrivacyPolicy(e.target.checked)}/>
                            <label style={{ fontSize: '0.8rem' }} className="form-check-label" htmlFor="aviso_privacidad">He leído y estoy de acuerdo con el <a href="https://www.qualitas.com.mx/web/qmx/aviso-de-privacidad-1" target="_blank">Aviso de Privacidad.</a></label>						
                            <small style={{fontStyle: "italic", display: "none"}} id="small_nombre_aviso_privacidad" className="form-text text-danger">Debes aceptar el aviso de privacidad</small>
                        </div>
                        {/* <div className="form-group form-check">
                            <input type="checkbox" className="form-check-input" id="interesados" name="interesados"/>
                            <label className="form-check-label" style={{ fontSize: '0.8rem' }} htmlFor="interesados">Estoy de acuerdo en que mis datos personales sean tratados con fines de mercadotecnia, publicidad o prospección comercial para ofrecerle otros de nuestros productos, servicios y promociones.</label>
                        </div> */}
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
                    disabled={!isFormQComplete || !isAceptedPrivacyPolicy || cargandoEmision}
                    onClick={issuancePolicyQualitas}
                >
                    {cargandoEmision ? (
                        <>
                            <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                            Emitiendo póliza...
                        </>
                        ) : (
                        <>
                            <RefreshCw size={16} className="me-2" />
                            Emitir póliza
                        </>
                    )}
                </button>
                </div>
            </div>
            </div>
        </div>
    );
};

export default IssuanceFormQualitas;