const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem('ss_token');
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

export async function getNeibhborhoods(cp) {
    try {
        const url = `${API_URL}/api/multicotizador/colonias/${cp}`;
        const response = await fetch(url, {
            method: "GET",
            headers: getAuthHeaders()
        });
        if (response.success == false) {
            throw new Error('Error al obtener las colonias');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al obtener las colonias:', error);
        throw error;
    }
}

export async function generarCotizacion(expedienteId, firstQuote, completeFieldsFormData) {
    try {
        const url = `${API_URL}/api/multicotizador/cotizar/${expedienteId}`;

        const body = firstQuote ? completeFieldsFormData : null;

        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify(body)
        });

        if (response.success == false) {
            const errorText = await response.text();
            console.error('❌ Error del servidor:', errorText);
            let errorMessage = 'Error al generar la cotización';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('✅ Cotización generada exitosamente:', data);
        return data;
    } catch (error) {
        console.error('❌ Error al generar cotización:', error);
        throw error;
    }
}

export async function getQuotes(expedienteId) {
    try {
        const url = `${API_URL}/api/multicotizador/cotizaciones/${expedienteId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al obtener las cotizaciones de Qualitas';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            console.log(errorMessage);
            return {success: false, message: errorMessage};
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.log('❌ Error al obtener cotizaciones:', error);
        return {success: false, message: error.message || 'Error al generar la cotización'};
    }
}

export async function getCountriesQ() {
    try {
        const url = `${API_URL}/api/multicotizador/qualitas/paises`;

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al obtener los paises de Qualitas';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            console.log(errorMessage);
            return {success: false, message: errorMessage};
        }

        const {data} = await response.json();
        return data;
    } catch (error) {
        console.log('❌ Error al obtener paises:', error);
        return {success: false, message: error.message || 'Error al generar la cotización'};
    }
}

export async function emitirPoliza(expedienteId, formData) {
    try {
        const url = `${API_URL}/api/multicotizador/emitir/${expedienteId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify(formData)
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al generar la cotización';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            return {success: false, message: errorMessage || 'Error al generar la póliza'}
        }

        const data = await response.json();
        return data;
    } catch (error) {
        return {success: false, message: error.message || 'Error al generar la póliza'};
    }
}

export async function printPolicy(expedienteId) {
    try {
        const url = `${API_URL}/api/multicotizador/imprimir/poliza/${expedienteId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al imprimir la póliza';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            return {success: false, message: errorMessage || 'Error al imprimir la póliza'}
        }

        const data = await response.json();
        return { success: true, data: data}
    }catch(error){
        return { success: false , message: error.message || 'Error al imprimir póliza'}
    }
}

export async function getOccupationsListHDI() {
    try {
        const url = `${API_URL}/api/multicotizador/hdi/ocupaciones`;

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al obtener las ocupaciones de HDI';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            console.log(errorMessage);
            return {success: false, message: errorMessage};
        }

        const {data} = await response.json();
        return data;
    } catch (error) {
        console.log('❌ Error al obtener ocupaciones:', error);
        return {success: false, message: error.message || 'Error al obtener ocupaciones'};
    }
}

export async function getNacionalitiesListHDI() {
    try {
        const url = `${API_URL}/api/multicotizador/hdi/nacionalidades`;

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al obtener las nacionalidades de HDI';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            console.log(errorMessage);
            return {success: false, message: errorMessage};
        }

        const {data} = await response.json();
        return data;
    } catch (error) {
        console.log('❌ Error al obtener nacionalidades:', error);
        return {success: false, message: error.message || 'Error al obtener nacionalidades'};
    }
}

export async function getCountriesListHDI() {
    try {
        const url = `${API_URL}/api/multicotizador/hdi/paises`;

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al obtener los países de HDI';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            console.log(errorMessage);
            return {success: false, message: errorMessage};
        }

        const {data} = await response.json();
        return data;
    } catch (error) {
        console.log('❌ Error al obtener los países:', error);
        return {success: false, message: error.message || 'Error al obtener paises'};
    }
}

export async function getTaxRegimesListHDI(tipoPersona) {
    try {
        const url = `${API_URL}/api/multicotizador/hdi/regimenes_fiscales`;
        const body = {
            tipo_persona:tipoPersona ?? '00'
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify(body)
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al obtener los regímenes fiscales de HDI';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            console.log(errorMessage);
            return {success: false, message: errorMessage};
        }

        const {data} = await response.json();
        return data;
    } catch (error) {
        console.log('❌ Error al obtener los regímenes fiscales:', error);
        return {success: false, message: error.message || 'Error al obtener regimenes fiscales'};
    }
}

export async function getGiroActividadListHDI(){
    try {
        const url = `${API_URL}/api/multicotizador/hdi/giro_actividad`;

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al obtener los giros/actividades de HDI';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            
            console.log(errorMessage);
            return {success: false, message: errorMessage};
        }

        const {data} = await response.json();
        return data;
    } catch (error) {
        console.log('❌ Error al obtener los giros/actividades:', error);
        return {success: false, message: error.message || 'Error al obtener giros'};
    }
}

export async function getPolicyByNum(data) {
    try {
        const url = `${API_URL}/api/multicotizador/poliza/recuperar`;

        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify(data)
        });
        const dataResponse = await response.json();
        if (dataResponse.success == false) {
            const errorText = await response.text();
            let errorMessage = 'Error al recuperar la póliza';
            
            try {
                const error = JSON.parse(errorText);
                errorMessage = error.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            return {success: false, message: errorMessage || 'Error al recuperar la póliza'}
        }

        return { success: true, data: dataResponse}
    } catch (error) {
        return { success: false , message: error.message || 'Error al recuperar la póliza'};
    }
}