import React, { useState, useCallback } from 'react';
import { ListaExpedientes } from './Expedientes/ListaExpedientes';
import { DetalleExpediente } from './Expedientes/DetalleExpediente';
import { FormularioExpediente } from './Expedientes/FormularioExpediente';

export const Expedientes = () => {
  // Estados principales
  const [expedientes, setExpedientes] = useState([]);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [vista, setVista] = useState('lista'); // 'lista', 'formulario', 'detalle'

  // Funciones CRUD
  const crearExpediente = useCallback(() => {
    setExpedienteSeleccionado(null);
    setVista('formulario');
  }, []);

  const editarExpediente = useCallback((expediente) => {
    setExpedienteSeleccionado(expediente);
    setVista('formulario');
  }, []);

  const eliminarExpediente = useCallback((id) => {
    if (window.confirm('¿Está seguro de eliminar este expediente?')) {
      setExpedientes(prev => prev.filter(exp => exp.id !== id));
    }
  }, []);

  const verDetalles = useCallback((expediente) => {
    setExpedienteSeleccionado(expediente);
    setVista('detalle');
  }, []);

  const guardarExpediente = useCallback((datosExpediente) => {
    if (expedienteSeleccionado) {
      // Edición
      setExpedientes(prev => prev.map(exp => 
        exp.id === expedienteSeleccionado.id ? { ...datosExpediente, id: exp.id } : exp
      ));
    } else {
      // Creación
      setExpedientes(prev => [...prev, { ...datosExpediente, id: Date.now() }]);
    }
    setExpedienteSeleccionado(null);
    setVista('lista');
  }, [expedienteSeleccionado]);

  const cancelar = useCallback(() => {
    setExpedienteSeleccionado(null);
    setVista('lista');
  }, []);

  // Renderizado condicional basado en la vista actual
  return (
    <div className="container-fluid py-4">
      {vista === 'lista' && (
        <ListaExpedientes
          expedientes={expedientes}
          onCrear={crearExpediente}
          onEditar={editarExpediente}
          onEliminar={eliminarExpediente}
          onVerDetalles={verDetalles}
        />
      )}

      {vista === 'formulario' && (
        <FormularioExpediente
          expediente={expedienteSeleccionado}
          onGuardar={guardarExpediente}
          onCancelar={cancelar}
        />
      )}

      {vista === 'detalle' && expedienteSeleccionado && (
        <DetalleExpediente
          expediente={expedienteSeleccionado}
          onEditar={() => editarExpediente(expedienteSeleccionado)}
          onVolver={cancelar}
        />
      )}
    </div>
  );
};
