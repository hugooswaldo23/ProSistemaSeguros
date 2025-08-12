// Hook para manejo de fechas en expedientes
export const useFechasExpediente = () => {
  const calcularTerminoVigencia = (inicioVigencia) => {
    if (!inicioVigencia) return '';
    
    const fechaInicio = new Date(inicioVigencia);
    const fechaTermino = new Date(fechaInicio);
    fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
    
    return fechaTermino.toISOString().split('T')[0];
  };

  const calcularProximoPago = (inicioVigencia, tipoPago, frecuenciaPago, esPrimerPago = true) => {
    if (!inicioVigencia) return '';
    
    const fechaInicio = new Date(inicioVigencia);
    let proximoPago = new Date(fechaInicio);
    
    if (tipoPago === 'Anual') {
      if (esPrimerPago) {
        return inicioVigencia;
      } else {
        proximoPago.setFullYear(proximoPago.getFullYear() + 1);
      }
    } else if (tipoPago === 'Fraccionado' && frecuenciaPago) {
      if (esPrimerPago) {
        return inicioVigencia;
      } else {
        switch (frecuenciaPago) {
          case 'Mensual':
            proximoPago.setMonth(proximoPago.getMonth() + 1);
            break;
          case 'Trimestral':
            proximoPago.setMonth(proximoPago.getMonth() + 3);
            break;
          case 'Semestral':
            proximoPago.setMonth(proximoPago.getMonth() + 6);
            break;
          default:
            return '';
        }
      }
    } else {
      return '';
    }
    
    return proximoPago.toISOString().split('T')[0];
  };

  const calcularSiguientePago = (fechaActual, frecuencia) => {
    if (!fechaActual || !frecuencia) return '';
    
    const proximaFecha = new Date(fechaActual);
    
    switch (frecuencia) {
      case 'Mensual':
        proximaFecha.setMonth(proximaFecha.getMonth() + 1);
        break;
      case 'Trimestral':
        proximaFecha.setMonth(proximaFecha.getMonth() + 3);
        break;
      case 'Semestral':
        proximaFecha.setMonth(proximaFecha.getMonth() + 6);
        break;
    }
    
    return proximaFecha.toISOString().split('T')[0];
  };

  return {
    calcularTerminoVigencia,
    calcularProximoPago,
    calcularSiguientePago,
  };
};
