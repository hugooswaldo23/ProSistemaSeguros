// Constantes y opciones predefinidas para expedientes
export const expedienteOpciones = {
  companias: ['Qualitas', 'Banorte', 'HDI', 'El Aguila', 'Mapfre', 'Chubb', 'Afirme'],
  productos: ['Autos', 'Vida', 'Daños', 'Equipo pesado', 'Embarcaciones', 'Ahorro'],
  etapasActivas: [
    'En cotización',
    'Cotización enviada', 
    'Autorizado',
    'En proceso emisión',
    'Emitida',
    'Pendiente de pago',
    'Pagado',
    'Cancelado'
  ],
  tiposPago: ['Anual', 'Fraccionado'],
  frecuenciasPago: ['Mensual', 'Trimestral', 'Semestral'],
  periodosGracia: [14, 30],
  estatusPago: [
    'Sin definir',
    'Pago en período de gracia',
    'Pagado',
    'Vencido',
    'Pago por vencer',
    'Por renovar'
  ],
  motivosCancelacion: [
    'Cliente desistió',
    'Precio muy alto',
    'Encontró mejor opción',
    'No cumple requisitos',
    'Documentación incompleta',
    'Otro'
  ],
  tiposVehiculo: ['Sedán', 'SUV', 'Pickup', 'Hatchback', 'Vagoneta', 'Deportivo', 'Otro'],
  tiposCobertura: ['Amplia', 'Limitada', 'RC (Responsabilidad Civil)'],
  marcasVehiculo: [
    'Audi', 'BMW', 'Chevrolet', 'Chrysler', 'Dodge', 'Fiat', 'Ford', 
    'Honda', 'Hyundai', 'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 
    'Mitsubishi', 'Nissan', 'Peugeot', 'Renault', 'Seat', 'Suzuki', 
    'Toyota', 'Volkswagen', 'Volvo', 'Otra'
  ],
};
