import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader, RefreshCw } from 'lucide-react';
import * as multicotizadorService from '../../services/multicotizadorService';

const ModalCargaPolizaByNum = ({ onClose, setVistaActual, cargarExpedientes }) => {
    const [isValidForm, setIsValidForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [objPeticion, setObjPeticion] = useState({
        aseguradora: 'Q',
        numPoliza: ''
    });
    const requiredFields = ['numPoliza', 'aseguradora'];

    const handleChange = (e) => {
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
            ...objPeticion,
            [name]: value,
        };

        setObjPeticion(nextData);

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

        setIsValidForm(flag);
        return flag;
    }

    const getPolicy = async () => {
        if(!validateForm(objPeticion)){
            toast.error("Por favor, completa los campos.");
            return;
        }

        setIsLoading(true);

        try {
            const response = await multicotizadorService.getPolicyByNum(objPeticion);

            if(response.success == true){
                toast.success("Póliza recuperada exitosamente.");
                onClose(response.data);
                setVistaActual('lista');
                cargarExpedientes();
            }else{
                toast.error("No se pudo recuperar la póliza. Intenta nuevamente.");
            }
        } catch (error) {
            console.error("Error al recuperar la póliza:", error);
            toast.error("Ocurrió un error al recuperar la póliza. Intenta nuevamente.");
        } finally {
            setIsLoading(false);
        }
    }
    return (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-x modal-dialog-centered">
            <div className="modal-content">
                <div className="modal-header text-white" style={{backgroundColor:"#941880"}}>
                <h5 className="modal-title">
                    Recuperar datos por número de póliza
                </h5>
                <button 
                    type="button" 
                    className="btn-close btn-close-white" 
                    onClick={onClose}
                ></button>
                </div>
                
                <div className="modal-body">
                    <div className="row">
                        <div className="col">
                            <label htmlFor="">Aseguradora</label>
                            <select name="aseg" id="aseg" className="form-control" value={objPeticion.aseguradora} onChange={handleChange}>
                                <option value="Q">Qualitas</option>
                            </select>
                            <small id="small_aseguradora" style={{ display: 'none', color: 'red' }}>Este campo es obligatorio</small>
                        </div>
                        <div className="col-12">
                            <label htmlFor="">Número de póliza</label>
                            <input type="text" className="form-control" name="numPoliza" onChange={handleChange} value={objPeticion.numPoliza}/>
                            <small id="small_numPoliza" style={{ display: 'none', color: 'red' }}>Este campo es obligatorio</small>
                        </div>
                    </div>
                </div>
                
                <div className="modal-footer">
                <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={onClose}
                >
                    Cancelar
                </button>
                <button 
                    type="button" 
                    className="btn"
                    style={{ backgroundColor:"#941880", color:"white" }}
                    disabled={isLoading || !isValidForm}
                    onClick={getPolicy}
                >
                    {isLoading ? (
                        <>
                            <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                            Recuperando póliza...
                        </>
                        ) : (
                        <>
                            <RefreshCw size={16} className="me-2" />
                            Recuperar póliza
                        </>
                    )}
                </button>
                </div>
            </div>
            </div>
        </div>
    );
}

export default ModalCargaPolizaByNum;