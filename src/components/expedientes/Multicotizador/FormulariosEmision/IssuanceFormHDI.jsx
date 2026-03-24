import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Loader, RefreshCw } from 'lucide-react';
import * as multicotizadorService from '../../../../services/multicotizadorService';
import * as historialService from '../../../../services/historialExpedienteService';

const IssuanceFormHDI = ({
    setShowModalEmisionHDI,
    selectedQuote,
    expedienteRenovacion,
    reloadMulticotizador
}) => {
    const [insurer, pack] = selectedQuote.trim().split('||');
    const [isFormHDIComplete, setIsFormHDIComplete] = useState(false);
    const [isAceptedPrivacyPolicy, setIsAceptedPrivacyPolicy] = useState(false);
    const [isIssuanceLoading, setIsIssuanceLoading] = useState(false);
    const [occupationOptions, setOccupationsOptions] = useState([]);
    const [nationalitiesOptions, setNationalitiesOptions] = useState([]);
    const [countriesOptions, setContriesOptions] = useState([]);
    const [taxRegimesOptions, setTaxRegimesOptions] = useState([]);
    const [giroActividadOptions, setGiroActividadOptions] = useState([]);
    const [isLegalEntity, setIsLegalEntity] = useState(false);
    const [isPoliticalActivity, setIsPoliticalActivity] = useState(false);
    const initialform = {
        aseguradora: 'HDI',
        paquete: '',
        tipoPersona: '00',
        nombres: '',
        ap_pat: '',
        ap_mat: '',
        serie: '',
        curp: '',
        genero: '',
        estadoCivil: '',
        fecha_nacimiento: '',
        actividad_politica: 'N',
        entidad_gubernamental: '',
        giroActividad: '',
        ocupacion: '',
        rfc: '',
        folioMercantil: '',
        nombreApoderado: '',
        calle: '',
        nro_ext: '',
        nro_int: '',
        nacionalidad: '',
        pais: '',
        nro_tel: '',
        regimen_fiscal: '',
        email: ''
    }
    const [formData, setFormData] = useState(initialform);
    const requiredFields = [
        "tipoPersona",
        "nombres",
        "ap_pat",
        "ap_mat",
        "serie",
        "genero",
        "estadoCivil",
        "fecha_nacimiento",
        "actividad_politica",
        "ocupacion",
        "rfc",
        "calle",
        "nro_ext",
        "nacionalidad",
        "pais",
        "nro_tel",
        "regimen_fiscal"
    ];

    const preLoadForm = () => {
        const tel = (expedienteRenovacion.telefono_fijo != null && expedienteRenovacion.telefono_fijo != '') ? expedienteRenovacion.telefono_fijo : expedienteRenovacion.telefono_movil;
        setFormData({
            ...formData,
            nombres: expedienteRenovacion.nombre || '',
            ap_pat: expedienteRenovacion.apellido_paterno || '',
            ap_mat: expedienteRenovacion.apellido_materno || '',
            serie: expedienteRenovacion.numero_serie || '',
            rfc: expedienteRenovacion.rfc || '',
            paquete: pack,
            nro_tel: tel || '',
            email: expedienteRenovacion.email || '',
            calle: expedienteRenovacion.direccion_c || '',
            curp: expedienteRenovacion.curp || '',
            fecha_nacimiento: (expedienteRenovacion.fecha_nacimiento_c ? expedienteRenovacion.fecha_nacimiento_c.split('T')[0] : ''),
        });
    }
    
    const getOccupationsList = async () => {
        try {
            const response = await multicotizadorService.getOccupationsListHDI();
            const options = response.map((item) => ({
                value: item.Clave,
                label: item.Descripcion
            }));
            setOccupationsOptions(options);
        } catch (error) {
            toast.error('Error al cargar la lista de ocupaciones');
        }
    }

    const getNacionalitiesList = async () => {
        try {
            const response = await multicotizadorService.getNacionalitiesListHDI();
            const options = response.map((item) => ({
                value: item.Clave,
                label: item.Descripcion
            }));
            setNationalitiesOptions(options);
        } catch (error) {
            toast.error('Error al cargar la lista de nacionalidades');
        }
    }

    const getCountriesList = async () => {
        try {
            const response = await multicotizadorService.getCountriesListHDI();
            const options = response.map((item) => ({
                value: item.Clave,
                label: item.Descripcion
            }));
            setContriesOptions(options);
        } catch (error) {
            toast.error('Error al cargar la lista de países');
        }
    }

    const getTaxtRemiesList = async () => {
        try {
            const tipoPersona = document.getElementById('tipoPersona').value;
            const response = await multicotizadorService.getTaxRegimesListHDI(tipoPersona);
            const options = response.map((item) => ({
                value: item.Clave,
                label:item.Descripcion
            }));
            setTaxRegimesOptions(options);
        } catch (error) {
            toast.error('Error al cargar la lista de regímenes fiscales');
        }
    }

    const getGiroActividadList = async () => {
        try {
            const response = await multicotizadorService.getGiroActividadListHDI();
            const options = response.map((item) => ({
                value: item.Clave,
                label: item.Descripcion
            }));
            setGiroActividadOptions(options);
        } catch (error) {
            toast.error('Error al cargar la lista de giros/actividades');
        }
    }

    const changeTypePerson = (e) => {
        const tipoPersona = e.target.value;
        if(tipoPersona === '02') {
            setIsLegalEntity(true);
            addInputsRequired('giroActividad', 'add');
            addInputsRequired('folioMercantil', 'add');
            addInputsRequired('nombreApoderado', 'add');
        }else{
            setIsLegalEntity(false);
            addInputsRequired('giroActividad', 'remove');
            addInputsRequired('folioMercantil', 'remove');
            addInputsRequired('nombreApoderado', 'remove');
        }

        getTaxtRemiesList();
    }

    const changePoliticalActivityHDI = (e) => {
        let actividadPolitica = e.target.value;
        if (actividadPolitica === 'S') {
            setIsPoliticalActivity(true);
            addInputsRequired('entidad_gubernamental', 'add')
        } else {
            setIsPoliticalActivity(false);
            addInputsRequired('entidad_gubernamental', 'remove');
        }
    }

    const addInputsRequired = (inputName, action) => {
        if(action === 'add'){
            requiredFields.push(inputName);
        }else if(action === 'remove'){
            const index = requiredFields.indexOf(inputName);
            if(index > -1){
                requiredFields.splice(index, 1);
            }
        }
    }

    useEffect(() => {
        getOccupationsList();
        getNacionalitiesList();
        getCountriesList();
        getTaxtRemiesList();
        getGiroActividadList();
        preLoadForm();
    }, []);

    const handleChangeHDI = (e) => {
        const { name, value } = e.target;
        const isRequired = requiredFields.some((x) => x === name);

        if(isRequired){
            const alertRequired = document.getElementById("small_"+name);
            if((value == '' || value == null || value == undefined) && alertRequired){
                alertRequired.style.display = "block";
            }else{
                alertRequired.style.display = "none";
            }
        }
        
        const nextData = {
            ...formData,
            [name]: value,
        };

        setFormData(nextData);

        validateForm(nextData);
    }

    const validateForm = (data) => {
        let flag = true;
        for (const key of requiredFields) {
            if(data[key] == '' || data[key] == null || data[key] == undefined){
                flag = false;
                break;
            }
        }

        setIsFormHDIComplete(flag);
        return flag;
    }

    const issuancePolicyHDI = async () => {
        if(!validateForm(formData)){
            toast.error('Por favor completa todos los campos requeridos');
            return;
        }

        setIsIssuanceLoading(true);

        const resultado = await multicotizadorService.emitirPoliza(expedienteRenovacion.id, formData);
        if (resultado.success) {
            toast.success('Póliza generada correctamente');
        } else {
            toast.error(resultado.error || 'Error al generar póliza');
            setIsIssuanceLoading(false);
            return;
        }
        
        const msg = `Multicotizador - póliza #${resultado.numero_poliza || 'S/N'} emitida, que sustituye a la póliza #${expedienteRenovacion.numero_poliza || 'S/N'}.`;
        await historialService.registrarEventoMulticotizador(expedienteRenovacion, 'poliza_emitida', msg);
        setIsIssuanceLoading(false);
        setShowModalEmisionHDI(false);
        reloadMulticotizador();
    }

    return(
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-x modal-dialog-centered">
        <div className="modal-content">
            <div className="modal-header text-white" style={{backgroundColor:"#006729"}}>
            <h5 className="modal-title">
                {insurer} - {pack}
            </h5>
            <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={() => {
                    setShowModalEmisionHDI(false);
                }}
            ></button>
            </div>
            
            <div className="modal-body">
                <style>{`
                    .modal-body label {
                        font-size: 0.8rem;
                    }
                `}</style>
                <div className='row'>
                    <div className="col-12">
                        <label>Tipo persona *</label>
                        <select className="form-control" name="tipoPersona" id="tipoPersona" defaultValue={'00'} onChange={(e) => {changeTypePerson(e); handleChangeHDI(e);}} value={formData.tipoPersona}>
                            <option value="00">Física</option>
                            <option value="02">Moral</option>
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_tipoPersona" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Nombre (s) *</label>
                        <input type="text" className="form-control" name="nombres" id="nombres" onChange={(e) => {handleChangeHDI(e);}} value={formData.nombres}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_nombres" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Apellido paterno *</label>
                        <input type="text" className="form-control" name="ap_pat" id="ap_pat" onChange={(e) => {handleChangeHDI(e);}} value={formData.ap_pat}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_ap_pat" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Apellido materno *</label>
                        <input type="text" className="form-control" name="ap_mat" id="ap_mat" onChange={(e) => {handleChangeHDI(e);}} value={formData.ap_mat}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_ap_mat" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Serie *</label>
                        <input type="text" className="form-control" name="serie" id="serie" onChange={(e) => {handleChangeHDI(e);}} value={formData.serie}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_serie" className="form-text text-danger">Campo obligatorio</small>    
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Curp</label>
                        <input type="text" className="form-control" name="curp" id="curp" onChange={(e) => {handleChangeHDI(e);}} value={formData.curp}/>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Género *</label>
                        <select className="form-control" name="genero" id="genero" onChange={(e) => {handleChangeHDI(e);}} value={formData.genero}>
                            <option value=""></option>
                            <option value="1">Hombre</option>
                            <option value="2">Mujer</option>
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_genero" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Estado civil *</label>
                        <select className="form-control" name="estadoCivil" id="estadoCivil" onChange={(e) => {handleChangeHDI(e);}} value={formData.estadoCivil}>
                            <option value=""></option>
                            <option value="C">Casado/a</option>
                            <option value="D">Divorciado/a</option>
                            <option value="S">Soltero/a</option>
                            <option value="U">Union libre</option>
                            <option value="V">Viudo/a</option>
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_estadoCivil" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Fecha de nacimiento *</label>
                        <input type="date" className="form-control" name="fecha_nacimiento" id="fecha_nacimiento" onChange={(e) => {handleChangeHDI(e);}} value={formData.fecha_nacimiento}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_fecha_nacimiento" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Actividad política *</label>
                        <select className="form-control" name="actividad_politica" id="actividad_politica" onChange={(e) => {changePoliticalActivityHDI(e); handleChangeHDI(e);}} value={formData.actividad_politica}>
                            <option value="S">Si</option>
                            <option value="N" selected>No</option>
                        </select>
                    </div>
                    <div className={`col-12 col-sm-6 ${isPoliticalActivity ? '' : 'd-none'}`}>
                        <label>Entidad gubernamental *</label>
                        <input type="text" className="form-control" name="entidad_gubernamental" id="entidad_gubernamental" onChange={(e) => {handleChangeHDI(e);}} value={formData.entidad_gubernamental}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_entidad_gubernamental" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className={`col-12 col-sm-6 persona_moral ${isLegalEntity ? '' : 'd-none'}`}>
                        <label>Giro/Actividad *</label>
                        <select className="form-control" data-live-search="true" data-size="5" name="giroActividad" id="giroActividad" onChange={(e) => {handleChangeHDI(e);}} value={formData.giroActividad}>
                            <option></option>
                            {giroActividadOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_giro" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Ocupación *</label>
                        <select className="form-control" data-live-search="true" data-size="5" name="ocupacion" id="ocupacion" onChange={(e) => {handleChangeHDI(e);}} value={formData.ocupacion}>
                            <option value=""></option>
                            {occupationOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_ocupacion" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>RFC *</label>
                        <input type="text" className="form-control" name="rfc" id="rfc" onKeyUp={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase(); }} onChange={(e) => {handleChangeHDI(e);}} value={formData.rfc}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_rfc" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className={`col-12 col-sm-6 persona_moral ${isLegalEntity ? '' : 'd-none'}`}>
                        <label>Folio mercantil *</label>
                        <input type="text" className="form-control" name="folioMercantil" id="folioMercantil" onChange={(e) => {handleChangeHDI(e);}} value={formData.folioMercantil}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_folioMercantil" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className={`col-12 col-sm-6 persona_moral ${isLegalEntity ? '' : 'd-none'}`}>
                        <label>Nombre apoderado *</label>
                        <input type="text" className="form-control" name="nombreApoderado" id="nombreApoderado" onChange={(e) => {handleChangeHDI(e);}} value={formData.nombreApoderado}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_nombreApoderado" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Calle *</label>
                        <input type="text" className="form-control" name="calle" id="calle" onChange={(e) => {handleChangeHDI(e);}} value={formData.calle}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_calle" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Num. Externo *</label>
                        <input type="text" className="form-control" name="nro_ext" id="nro_ext" onChange={(e) => {handleChangeHDI(e);}} value={formData.nro_ext}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_nro_ext" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Num. Interno</label>
                        <input type="text" className="form-control" name="nro_int" id="nro_int" onChange={(e) => {handleChangeHDI(e);}} value={formData.nro_int}/>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Nacionalidad *</label>
                        <select className="form-control" data-live-search="true" data-size="5" name="nacionalidad" id="nacionalidad" onChange={(e) => {handleChangeHDI(e);}} value={formData.nacionalidad}>
                            <option value=""></option>
                            {nationalitiesOptions
                                .filter((option) => option.value !== '000')
                                .map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                            ))}
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_nacionalidad" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>País *</label>
                        <select className="form-control" data-live-search="true" data-size="5" name="pais" id="pais" onChange={(e) => {handleChangeHDI(e);}} value={formData.pais}>
                            <option></option>
                            { countriesOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            )) }
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_pais" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12 col-sm-6">
                        <label>Teléfono *</label>
                        <input type="text" className="form-control" name="nro_tel" id="nro_tel" onChange={(e) => {handleChangeHDI(e);}} value={formData.nro_tel}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_nro_tel" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12">
                        <label>Régimen fiscal *</label>
                        <select className="form-control" data-live-search="true" data-size="5" name="regimen_fiscal" id="regimen_fiscal" onChange={(e) => {handleChangeHDI(e);}}>
                            <option></option>
                            { taxRegimesOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            )) }
                        </select>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_regimen_fiscal" className="form-text text-danger">Campo obligatorio</small>
                    </div>
                    <div className="col-12">
                        <label>Correo electrónico</label>
                        <input type="text" className="form-control" name="email" id="email" onChange={(e) => {handleChangeHDI(e);}} value={formData.email}/>
                        <small style={{ fontStyle: 'italic', display: 'none' }} id="small_email" className=" form-text text-danger">Campo obligatorio</small>
                    </div>
                    <br />
                    <div className="col-12 mt-3">
                        <div className="form-group form-check">
                            <input type="checkbox" className="form-check-input" id="aviso_privacidad" name="aviso_privacidad" onChange={(e) => setIsAceptedPrivacyPolicy(e.target.checked)}/>
                            <label className="form-check-label" htmlFor="aviso_privacidad">He leído y estoy de acuerdo con el Aviso de Privacidad.</label>						
                            <small style={{ fontStyle: 'italic', display: 'none' }} id="small_nombre_aviso_privacidad" className="form-text text-danger">Debes aceptar el aviso de privacidad</small>
                        </div>
                    </div>
                </div>
            </div>

            <div className="modal-footer">
                <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                        setShowModalEmisionHDI(false);
                    }}
                >
                    Cancelar
                </button>
                <button 
                    type="button" 
                    className="btn"
                    style={{ backgroundColor:"#006729", color:"white" }}
                    disabled={!isFormHDIComplete || !isAceptedPrivacyPolicy || isIssuanceLoading}
                    onClick={issuancePolicyHDI}
                >
                    {isIssuanceLoading ? (
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
}

export default IssuanceFormHDI;