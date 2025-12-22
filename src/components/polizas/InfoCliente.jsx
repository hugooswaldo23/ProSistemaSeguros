import React from 'react';

const InfoCliente = React.memo(({ expediente, cliente }) => {
  // Mostrar SIEMPRE el nombre del cliente (asegurado/razón social) en la primera línea
  // Debajo, mostrar datos de contacto si existen; si no, datos del propio asegurado

  // 1) Nombre del cliente (asegurado)
  let nombreCliente = '';
  if (cliente) {
    if (cliente.razon_social || cliente.razonSocial) {
      nombreCliente = cliente.razon_social || cliente.razonSocial;
    } else {
      const n = cliente.nombre || '';
      const ap = cliente.apellido_paterno || cliente.apellidoPaterno || '';
      const am = cliente.apellido_materno || cliente.apellidoMaterno || '';
      nombreCliente = `${n} ${ap} ${am}`.trim();
    }
  } else {
    // Fallback si no hay cliente en mapa
    if (expediente.razon_social) {
      nombreCliente = expediente.razon_social;
    } else {
      nombreCliente = `${expediente.nombre || ''} ${expediente.apellido_paterno || ''} ${expediente.apellido_materno || ''}`.trim();
    }
  }

  // 2) Datos de contacto: preferir contacto principal; si no, usar datos del cliente
  const tieneContacto = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
  const contactoNombre = tieneContacto
    ? `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim()
    : '';
  const emailMostrar = tieneContacto
    ? (cliente?.contacto_email || cliente?.contactoEmail || '')
    : (cliente?.email || expediente.email || '');

  // Teléfonos: mostrar AMBOS si existen (móvil y fijo). Priorizar contacto_* y si no hay, caer a los del cliente
  const telContactoMovil = cliente?.contacto_telefono_movil || cliente?.contactoTelefonoMovil || '';
  const telContactoFijo = cliente?.contacto_telefono_fijo || cliente?.contactoTelefonoFijo || '';
  const telClienteMovil = cliente?.telefono_movil || cliente?.telefonoMovil || expediente.telefono_movil || '';
  const telClienteFijo = cliente?.telefono_fijo || cliente?.telefonoFijo || expediente.telefono_fijo || '';

  return (
    <div>
      <div className="fw-semibold">{nombreCliente || 'Sin nombre'}</div>
      {tieneContacto && contactoNombre && (
        <div><small className="text-muted">Contacto: {contactoNombre}</small></div>
      )}
      {emailMostrar && (
        <div><small className="text-muted">{emailMostrar}</small></div>
      )}
      {/* Teléfonos: si hay contacto, mostrar ambos (móvil y fijo). Si no hay contacto, caer a teléfonos del cliente */}
      {tieneContacto ? (
        (telContactoMovil || telContactoFijo) && (
          <div>
            <small className="text-muted">
              {telContactoMovil && (<><span>📱 {telContactoMovil}</span></>)}
              {telContactoMovil && telContactoFijo && <span> • </span>}
              {telContactoFijo && (<><span>☎️ {telContactoFijo}</span></>)}
            </small>
          </div>
        )
      ) : (
        (telClienteMovil || telClienteFijo) && (
          <div>
            <small className="text-muted">
              {telClienteMovil && (<><span>📱 {telClienteMovil}</span></>)}
              {telClienteMovil && telClienteFijo && <span> • </span>}
              {telClienteFijo && (<><span>☎️ {telClienteFijo}</span></>)}
            </small>
          </div>
        )
      )}
    </div>
  );
});

InfoCliente.displayName = 'InfoCliente';

export default InfoCliente;
