/**
 * ====================================================================
 * COMPONENTE: Modal para Capturar Contacto Faltante
 * PROPÓSITO: Solicitar email/teléfono antes de enviar comunicaciones
 * FECHA: 2025-11-10
 * ====================================================================
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Mail, Phone, Save, X } from 'lucide-react';

const ModalCapturarContacto = ({ 
  show, 
  onClose, 
  onGuardar,
  onGuardarYContinuar, // Nueva prop para continuar automáticamente
  cliente,
  tipoDatoFaltante, // 'email' o 'telefono_movil'
  canalEnvio // 'Email' o 'WhatsApp'
}) => {
  const [valor, setValor] = useState('');
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Resetear cuando cambia el cliente o se abre el modal
  useEffect(() => {
    if (show) {
      setValor('');
      setError('');
      setValidando(false);
      setGuardando(false);
    }
  }, [show, cliente]);

  // Validación en tiempo real
  useEffect(() => {
    if (!valor) {
      setError('');
      return;
    }

    setValidando(true);
    const timer = setTimeout(() => {
      if (tipoDatoFaltante === 'email') {
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(valor)) {
          setError('❌ Email inválido');
        } else {
          setError('');
        }
      } else if (tipoDatoFaltante === 'telefono_movil') {
        // Validar teléfono (10 dígitos mínimo)
        const telefonoLimpio = valor.replace(/[\s\-()]/g, '');
        if (telefonoLimpio.length < 10) {
          setError('❌ Teléfono debe tener al menos 10 dígitos');
        } else if (!/^\d+$/.test(telefonoLimpio)) {
          setError('❌ Teléfono solo debe contener números');
        } else {
          setError('');
        }
      }
      setValidando(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [valor, tipoDatoFaltante]);

  const handleGuardar = async () => {
    if (error || !valor.trim()) {
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(valor.trim());
      // El componente padre cierra el modal después de guardar
      // Si se proporcionó onGuardarYContinuar, lo llama para reintentar el envío
      if (onGuardarYContinuar) {
        onGuardarYContinuar();
      }
    } catch (err) {
      setError('Error al guardar: ' + err.message);
      setGuardando(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !error && valor.trim()) {
      handleGuardar();
    }
  };

  if (!show) return null;

  const nombreCliente = cliente?.tipoPersona === 'Persona Moral'
    ? cliente?.razonSocial || cliente?.razon_social || 'Cliente'
    : `${cliente?.nombre || ''} ${cliente?.apellidoPaterno || cliente?.apellido_paterno || ''}`.trim() || 'Cliente';

  const icono = tipoDatoFaltante === 'email' ? <Mail size={48} /> : <Phone size={48} />;
  const etiqueta = tipoDatoFaltante === 'email' ? 'Correo Electrónico' : 'Teléfono Móvil';
  const placeholder = tipoDatoFaltante === 'email' 
    ? 'ejemplo@correo.com' 
    : '5512345678 (10 dígitos)';

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title">
              <AlertCircle className="me-2" size={24} />
              Dato de Contacto Faltante
            </h5>
            <button 
              type="button" 
              className="btn-close"
              onClick={onClose}
              disabled={guardando}
            ></button>
          </div>

          <div className="modal-body">
            {/* Alerta informativa */}
            <div className="alert alert-warning d-flex align-items-start mb-4">
              <AlertCircle className="me-2 flex-shrink-0" size={20} />
              <div>
                <strong>No se puede enviar por {canalEnvio}</strong>
                <p className="mb-0 mt-1">
                  El cliente <strong>{nombreCliente}</strong> no tiene un {etiqueta.toLowerCase()} registrado.
                </p>
                <p className="mb-0 mt-1 small text-muted">
                  Captura el dato ahora para continuar con el envío.
                </p>
              </div>
            </div>

            {/* Icono visual */}
            <div className="text-center mb-4">
              <div 
                className="d-inline-flex align-items-center justify-content-center rounded-circle"
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  backgroundColor: '#fff3cd',
                  color: '#856404'
                }}
              >
                {icono}
              </div>
            </div>

            {/* Campo de captura */}
            <div className="mb-3">
              <label className="form-label">
                <strong>{etiqueta} *</strong>
              </label>
              <input
                type={tipoDatoFaltante === 'email' ? 'email' : 'tel'}
                className={`form-control form-control-lg ${error ? 'is-invalid' : valor && !validando ? 'is-valid' : ''}`}
                placeholder={placeholder}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
                disabled={guardando}
              />
              {validando && (
                <div className="form-text">
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Validando...
                </div>
              )}
              {error && (
                <div className="invalid-feedback d-block">
                  {error}
                </div>
              )}
              {valor && !error && !validando && (
                <div className="valid-feedback d-block">
                  ✅ {etiqueta} válido
                </div>
              )}
            </div>

            {/* Información adicional */}
            <div className="card bg-light border-0">
              <div className="card-body py-2">
                <small className="text-muted">
                  <strong>💡 Nota:</strong> Este dato se guardará automáticamente en la ficha del cliente 
                  para futuros envíos.
                </small>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={guardando}
            >
              <X size={16} className="me-1" />
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleGuardar}
              disabled={!valor.trim() || error || validando || guardando}
            >
              {guardando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={16} className="me-1" />
                  Guardar y Continuar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalCapturarContacto;
