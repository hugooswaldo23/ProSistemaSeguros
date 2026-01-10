/**
 * Utilidades para validación de datos de contacto de clientes
 * 
 * CENTRALIZA la lógica de validación para evitar duplicación entre:
 * - NvoExpedientes.jsx (captura manual/edición)  
 * - FormularioNuevoExpediente.jsx (captura desde PDF)
 * 
 * REGLAS DE NEGOCIO:
 * - Persona Moral: Requiere contacto principal con nombre Y al menos email/teléfono
 * - Persona Física: Requiere al menos email/teléfono (del cliente o contacto principal)
 * - RFC genérico: Determina tipo por longitud (12=Moral, 13=Física)
 */

/**
 * Valida que el cliente tenga al menos un método de contacto según su tipo de persona
 * @param {Object} formulario - Datos del formulario
 * @param {Object} clienteSeleccionado - Datos del cliente seleccionado
 * @param {Function} toast - Función para mostrar mensajes
 * @returns {boolean} - true si es válido, false si no
 */
export const validarContactoCliente = (formulario, clienteSeleccionado, toast) => {
  if (!clienteSeleccionado) {
    toast('⚠️ Por favor seleccione un cliente');
    return false;
  }

  // Determinar tipo de persona
  let esPersonaMoral = false;
  let esPersonaFisica = false;
  
  if (clienteSeleccionado.tipoPersona === 'Persona Moral') {
    esPersonaMoral = true;
  } else if (clienteSeleccionado.tipoPersona === 'Persona Física') {
    esPersonaFisica = true;
  } else if (clienteSeleccionado.rfc) {
    // Determinar por RFC si no hay tipoPersona
    const rfc = clienteSeleccionado.rfc.trim();
    esPersonaMoral = rfc.length === 12;
    esPersonaFisica = rfc.length === 13;
  }
  
  if (esPersonaMoral) {
    // Persona Moral: Requiere contacto principal + email/teléfono
    const nombreContacto = (formulario.contacto_nombre || clienteSeleccionado.contacto_nombre || '').trim();
    const tieneEmailOMovil = !!(
      (formulario.contacto_email || clienteSeleccionado.contacto_email || '').trim() ||
      (formulario.contacto_telefono_movil || clienteSeleccionado.contacto_telefono_movil || '').trim()
    );
    
    if (!nombreContacto || !tieneEmailOMovil) {
      toast('⚠️ Persona Moral: capture Contacto Principal con nombre y al menos Email o Teléfono Móvil');
      return false;
    }
  } else if (esPersonaFisica) {
    // Persona Física: Requiere email/teléfono (cliente o contacto)
    const tieneEmailPropio = !!(formulario.email || clienteSeleccionado.email || '').trim();
    const tieneMovilPropio = !!(formulario.telefono_movil || clienteSeleccionado.telefono_movil || clienteSeleccionado.telefonoMovil || '').trim();
    
    const tieneContactoPrincipal = !!(formulario.contacto_nombre || clienteSeleccionado.contacto_nombre || '').trim();
    const tieneEmailContacto = !!(formulario.contacto_email || clienteSeleccionado.contacto_email || '').trim();
    const tieneMovilContacto = !!(formulario.contacto_telefono_movil || clienteSeleccionado.contacto_telefono_movil || '').trim();
    
    const tieneContactoValido = tieneEmailPropio || tieneMovilPropio || 
                                (tieneContactoPrincipal && (tieneEmailContacto || tieneMovilContacto));
    
    if (!tieneContactoValido) {
      toast('⚠️ Persona Física: se requiere Email o Teléfono Móvil (cliente o contacto)');
      return false;
    }
  }
  
  return true;
};