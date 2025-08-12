import React, { useState } from 'react';
import { Save } from 'lucide-react';

export const FormularioExpediente = ({ expediente = null, onGuardar, onCancelar }) => {
  const [formData, setFormData] = useState(expediente || {
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    telefonoFijo: '',
    telefonoMovil: '',
    compania: '',
    producto: '',
    agente: '',
    etapaActiva: 'Pendiente',
    estatusPago: 'Pendiente',
    total: '',
    primaPagada: '',
    inicioVigencia: '',
    terminoVigencia: '',
    tipoPago: 'Contado',
    frecuenciaPago: '',
    periodoGracia: '30'
  });

  const calcularTerminoVigencia = (fechaInicio) => {
    if (!fechaInicio) return '';
    const fecha = new Date(fechaInicio);
    fecha.setFullYear(fecha.getFullYear() + 1);
    return fecha.toISOString().split('T')[0];
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };

      // Actualizar término de vigencia automáticamente
      if (name === 'inicioVigencia') {
        newData.terminoVigencia = calcularTerminoVigencia(value);
      }

      return newData;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onGuardar(formData);
    e.preventDefault();
    onSubmit({
      ...formData,
      fechaCreacion: formData.fechaCreacion || new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="card">
      <div className="card-body">
        <h3 className="mb-4">
          {expediente ? 'Editar' : 'Nuevo'} Expediente
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            {/* Información del Cliente */}
            <div className="col-12">
              <h5 className="border-bottom pb-2">Información del Cliente</h5>
            </div>
            <div className="col-md-4">
              <label className="form-label">Nombre</label>
              <input
                type="text"
                name="nombre"
                className="form-control"
                value={formData.nombre}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Apellido Paterno</label>
              <input
                type="text"
                name="apellidoPaterno"
                className="form-control"
                value={formData.apellidoPaterno}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Apellido Materno</label>
              <input
                type="text"
                name="apellidoMaterno"
                className="form-control"
                value={formData.apellidoMaterno}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Teléfono Fijo</label>
              <input
                type="tel"
                name="telefonoFijo"
                className="form-control"
                value={formData.telefonoFijo}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Teléfono Móvil</label>
              <input
                type="tel"
                name="telefonoMovil"
                className="form-control"
                value={formData.telefonoMovil}
                onChange={handleChange}
              />
            </div>

            {/* Información del Seguro */}
            <div className="col-12 mt-4">
              <h5 className="border-bottom pb-2">Información del Seguro</h5>
            </div>
            <div className="col-md-4">
              <label className="form-label">Compañía</label>
              <select
                name="compania"
                className="form-select"
                value={formData.compania}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione...</option>
                <option value="GNP">GNP</option>
                <option value="Qualitas">Qualitas</option>
                <option value="AXA">AXA</option>
                <option value="HDI">HDI</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Producto</label>
              <select
                name="producto"
                className="form-select"
                value={formData.producto}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione...</option>
                <option value="Vida">Vida</option>
                <option value="Gastos Médicos">Gastos Médicos</option>
                <option value="Autos">Autos</option>
                <option value="Hogar">Hogar</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Agente</label>
              <select
                name="agente"
                className="form-select"
                value={formData.agente}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione...</option>
                <option value="Juan Pérez">Juan Pérez</option>
                <option value="María García">María García</option>
              </select>
            </div>

            {/* Información de Pago */}
            <div className="col-12 mt-4">
              <h5 className="border-bottom pb-2">Información de Pago</h5>
            </div>
            <div className="col-md-3">
              <label className="form-label">Total</label>
              <div className="input-group">
                <span className="input-group-text">$</span>
                <input
                  type="number"
                  name="total"
                  className="form-control"
                  value={formData.total}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Prima Pagada</label>
              <div className="input-group">
                <span className="input-group-text">$</span>
                <input
                  type="number"
                  name="primaPagada"
                  className="form-control"
                  value={formData.primaPagada}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Inicio de Vigencia</label>
              <input
                type="date"
                name="inicioVigencia"
                className="form-control"
                value={formData.inicioVigencia}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Término de Vigencia</label>
              <input
                type="date"
                name="terminoVigencia"
                className="form-control"
                value={formData.terminoVigencia}
                onChange={handleChange}
                disabled
              />
              <small className="text-muted">Se calcula automáticamente</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">Tipo de Pago</label>
              <select
                name="tipoPago"
                className="form-select"
                value={formData.tipoPago}
                onChange={handleChange}
                required
              >
                <option value="Contado">Contado</option>
                <option value="Fraccionado">Fraccionado</option>
              </select>
            </div>
            {formData.tipoPago === 'Fraccionado' && (
              <>
                <div className="col-md-4">
                  <label className="form-label">Frecuencia de Pago</label>
                  <select
                    name="frecuenciaPago"
                    className="form-select"
                    value={formData.frecuenciaPago}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Seleccione...</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Período de Gracia (días)</label>
                  <input
                    type="number"
                    name="periodoGracia"
                    className="form-control"
                    value={formData.periodoGracia}
                    onChange={handleChange}
                    min="0"
                    max="90"
                  />
                </div>
              </>
            )}

            {/* Botones */}
            <div className="col-12 mt-4">
              <button type="submit" className="btn btn-primary me-2">
                <Save size={16} className="me-2" />
                {expediente ? 'Actualizar' : 'Crear'} Expediente
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioExpediente;
