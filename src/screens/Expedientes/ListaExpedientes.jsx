import React from 'react';
import { Eye, Edit } from 'lucide-react';

const ListaExpedientes = ({ expedientes, onVerDetalles, onEditar }) => {
  return (
    <div className="card">
      <div className="card-body">
        {expedientes.length === 0 ? (
          <div className="text-center py-5">
            <Eye size={48} className="text-muted mb-3" />
            <h4 className="text-muted">No hay expedientes</h4>
            <p>Comienza creando un nuevo expediente</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Compañía</th>
                  <th>Etapa Activa</th>
                  <th>Estatus Pago</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expedientes.map((expediente) => (
                  <tr key={expediente.id}>
                    <td>{`${expediente.nombre} ${expediente.apellidoPaterno}`}</td>
                    <td>{expediente.producto}</td>
                    <td>{expediente.compania}</td>
                    <td>
                      <span className={`badge ${
                        expediente.etapaActiva === 'Pagado' ? 'bg-success' :
                        expediente.etapaActiva === 'Cancelado' ? 'bg-danger' :
                        expediente.etapaActiva === 'Emitida' ? 'bg-info' :
                        expediente.etapaActiva === 'Autorizado' ? 'bg-primary' :
                        'bg-warning'
                      }`}>
                        {expediente.etapaActiva || 'Pendiente'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        expediente.estatusPago === 'Pagado' ? 'bg-success' :
                        expediente.estatusPago === 'Vencido' ? 'bg-danger' :
                        expediente.estatusPago === 'Pago en período de gracia' ? 'bg-warning' :
                        'bg-secondary'
                      }`}>
                        {expediente.estatusPago || 'Sin definir'}
                      </span>
                    </td>
                    <td>{expediente.fechaCreacion}</td>
                    <td>
                      <button
                        onClick={() => onVerDetalles(expediente)}
                        className="btn btn-sm btn-outline-primary me-2"
                        title="Ver detalles"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => onEditar(expediente)}
                        className="btn btn-sm btn-outline-secondary"
                        title="Editar"
                      >
                        <Edit size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListaExpedientes;
