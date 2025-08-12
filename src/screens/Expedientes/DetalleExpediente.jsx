import React from 'react';
import { Edit, ArrowRight, XCircle, DollarSign } from 'lucide-react';

export const DetalleExpediente = ({ expediente, onEditar, onVolver }) => {
  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">Detalles del Expediente</h3>
          <div className="d-flex gap-2">
            {expediente.etapaActiva !== 'Pagado' && expediente.etapaActiva !== 'Cancelado' && (
              <button
                className="btn btn-success d-flex align-items-center"
              >
                <DollarSign size={16} className="me-2" />
                Aplicar Pago
              </button>
            )}
            
            <button
              onClick={() => onEditar(expediente)}
              className="btn btn-primary d-flex align-items-center"
            >
              <Edit size={16} className="me-2" />
              Editar
            </button>
            <button
              onClick={onVolver}
              className="btn btn-secondary"
            >
              Volver
            </button>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-md-6">
            <h5 className="card-title border-bottom pb-2">Información del Cliente</h5>
            <div className="mb-3">
              <strong className="d-block text-muted">Nombre completo:</strong>
              {expediente.nombre} {expediente.apellidoPaterno} {expediente.apellidoMaterno}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Email:</strong>
              {expediente.email || '-'}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Teléfono fijo:</strong>
              {expediente.telefonoFijo || '-'}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Teléfono móvil:</strong>
              {expediente.telefonoMovil || '-'}
            </div>
          </div>

          <div className="col-md-6">
            <h5 className="card-title border-bottom pb-2">Información del Seguro</h5>
            <div className="mb-3">
              <strong className="d-block text-muted">Compañía:</strong>
              {expediente.compania}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Producto:</strong>
              {expediente.producto}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Etapa Activa:</strong>
              <span className={`badge ${
                expediente.etapaActiva === 'Pagado' ? 'bg-success' :
                expediente.etapaActiva === 'Cancelado' ? 'bg-danger' :
                expediente.etapaActiva === 'Emitida' ? 'bg-info' :
                expediente.etapaActiva === 'Autorizado' ? 'bg-primary' :
                'bg-warning'
              }`}>
                {expediente.etapaActiva}
              </span>
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Agente:</strong>
              {expediente.agente || '-'}
            </div>
          </div>

          <div className="col-md-6">
            <h5 className="card-title border-bottom pb-2">Información Financiera</h5>
            <div className="mb-3">
              <strong className="d-block text-muted">Prima pagada:</strong>
              ${expediente.primaPagada || '-'}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Total:</strong>
              ${expediente.total || '-'}
            </div>
          </div>

          <div className="col-md-6">
            <h5 className="card-title border-bottom pb-2">Vigencia</h5>
            <div className="mb-3">
              <strong className="d-block text-muted">Inicio de vigencia:</strong>
              {expediente.inicioVigencia || '-'}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Término de vigencia:</strong>
              {expediente.terminoVigencia || '-'}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Fecha de creación:</strong>
              {expediente.fechaCreacion}
            </div>
          </div>

          <div className="col-md-6">
            <h5 className="card-title border-bottom pb-2">Configuración de Pagos</h5>
            <div className="mb-3">
              <strong className="d-block text-muted">Tipo de pago:</strong>
              <span className={`badge ${expediente.tipoPago === 'Fraccionado' ? 'bg-info' : 'bg-primary'}`}>
                {expediente.tipoPago || 'Sin definir'}
              </span>
              {expediente.frecuenciaPago && (
                <span className="ms-2 badge bg-secondary">{expediente.frecuenciaPago}</span>
              )}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Período de gracia:</strong>
              {expediente.periodoGracia ? `${expediente.periodoGracia} días` : '-'}
            </div>
            <div className="mb-3">
              <strong className="d-block text-muted">Estatus del pago:</strong>
              <span className={`badge ${
                expediente.estatusPago === 'Pagado' ? 'bg-success' :
                expediente.estatusPago === 'Vencido' ? 'bg-danger' :
                expediente.estatusPago === 'Pago en período de gracia' ? 'bg-warning' :
                'bg-secondary'
              }`}>
                {expediente.estatusPago || 'Sin definir'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetalleExpediente;
