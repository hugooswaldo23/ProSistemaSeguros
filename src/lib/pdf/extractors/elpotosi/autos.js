/**
 * Extractor para El Potosí - Seguros de Autos
 */

export async function extraer({ textoCompleto, textoPagina1, todasLasPaginas }) {
  console.log('🚗 Extractor El Potosí Autos');
  
  // ========== TEXTO CRUDO DEL PDF ==========
  console.log('📄 ========== TEXTO COMPLETO DEL PDF ==========');
  console.log(textoCompleto);
  console.log('📄 ============================================');
  console.log('');
  console.log('📄 ========== TEXTO PÁGINA 1 ==========');
  console.log(textoPagina1);
  console.log('📄 ======================================');
  console.log('');
  
  const datos = {
    // Asegurado
    tipo_persona: 'Física',
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    razonSocial: '',
    rfc: '',
    email: '',
    telefono_movil: '',
    domicilio: '',
    colonia: '',
    municipio: '',
    estado: '',
    codigo_postal: '',
    pais: 'MEXICO',
    
    // Póliza
    numero_poliza: '',
    endoso: '',
    inciso: '',
    plan: '',
    compania: 'El Potosí',
    producto: 'Autos',
    etapa_activa: 'Emitida',
    tipo_cobertura: '',
    forma_pago: '',
    tipo_pago: '',
    frecuenciaPago: '',
    
    // Vehículo
    marca: '',
    modelo: '',
    anio: '',
    placas: '',
    numero_serie: '',
    motor: '',
    color: '',
    uso: '',
    servicio: '',
    tipo_vehiculo: '',
    capacidad: '',
    
    // Fechas
    fecha_emision: '',
    inicio_vigencia: '',
    termino_vigencia: '',
    fecha_captura: new Date().toISOString().split('T')[0],
    
    // Montos
    prima_neta: '',
    gastos_expedicion: '',
    cargo_pago_fraccionado: '',
    subtotal: '',
    iva: '',
    total: '',
    primer_pago: '',
    pagos_subsecuentes: '',
    moneda: 'MXN',
    periodo_gracia: '30',
    fecha_limite_pago: '',
    
    // Agente
    clave_agente: '',
    agente: '',
    
    // Otros
    conductor_habitual: '',
    movimiento: 'Emisión',
    
    // Coberturas
    coberturas: []
  };

  // ==================== NÚMERO DE PÓLIZA ====================
  // Buscar "Póliza | Certificado" en formato tabla o "AUIN-109426-77"
  let matchPoliza = textoCompleto.match(/(?:Póliza|Poliza)\s+[|\s]+(?:Certificado\s+)?[|\s]*\n?\s*([A-Z]+-\d+-\d+)/i);
  if (!matchPoliza) {
    matchPoliza = textoCompleto.match(/\b(AUIN-\d+-\d+)\b/);
  }
  if (matchPoliza) {
    datos.numero_poliza = matchPoliza[1].trim();
    console.log('📋 Póliza:', datos.numero_poliza);
  }

  // ==================== VIGENCIA ====================
  // Buscar "Desde: 22-FEB-25 12:00 hrs." y "Hasta: 22-FEB-26 12:00 hrs."
  const matchDesde = textoCompleto.match(/Desde:\s+(\d{2})-([A-Z]{3})-(\d{2})\s+\d{2}:\d{2}/i);
  const matchHasta = textoCompleto.match(/Hasta:\s+(\d{2})-([A-Z]{3})-(\d{2})\s+\d{2}:\d{2}/i);
  
  if (matchDesde && matchHasta) {
    // Convertir formato "22-FEB-25" a "2025-02-22" (formato ISO para el formulario)
    const meses = { 
      'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
      'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12' 
    };
    
    const diaIni = matchDesde[1];
    const mesIni = meses[matchDesde[2].toUpperCase()];
    const anioIni = '20' + matchDesde[3];
    
    const diaFin = matchHasta[1];
    const mesFin = meses[matchHasta[2].toUpperCase()];
    const anioFin = '20' + matchHasta[3];
    
    // Formato YYYY-MM-DD para que funcione correctamente en el formulario
    datos.inicio_vigencia = `${anioIni}-${mesIni}-${diaIni}`;
    datos.termino_vigencia = `${anioFin}-${mesFin}-${diaFin}`;
    
    console.log('📅 Vigencia:', datos.inicio_vigencia, 'al', datos.termino_vigencia);
  }
  
  // ==================== FECHA DE EMISIÓN/EXPEDICIÓN ====================
  // Buscar "Fecha de expedición 13-FEB-25 02:46 hrs."
  const matchExpedicion = textoCompleto.match(/Fecha\s+de\s+expedici[óo]n\s+(\d{2})-([A-Z]{3})-(\d{2})\s+\d{2}:\d{2}/i);
  
  if (matchExpedicion) {
    const meses = { 
      'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
      'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12' 
    };
    
    const dia = matchExpedicion[1];
    const mes = meses[matchExpedicion[2].toUpperCase()];
    const anio = '20' + matchExpedicion[3];
    
    datos.fecha_emision = `${anio}-${mes}-${dia}`;
    console.log('📝 Fecha de emisión:', datos.fecha_emision);
  } else if (datos.inicio_vigencia) {
    // Si no se encuentra fecha de expedición, usar inicio de vigencia
    datos.fecha_emision = datos.inicio_vigencia;
  }
  
  // ==================== FECHA DE CAPTURA ====================
  // Fecha de captura es siempre HOY (cuando se sube el PDF al sistema)
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = String(hoy.getDate()).padStart(2, '0');
  datos.fecha_captura = `${year}-${month}-${day}`;
  console.log('📅 Fecha de captura:', datos.fecha_captura);

  // ==================== DATOS DEL CONTRATANTE ====================
  // Formato exacto del PDF:
  // "Nombre o razón social:"
  // "Desde: 22-FEB-25 12:00 hrs."
  // "MARTHA KARINA PONZO GARCIA"
  // "Hasta: 22-FEB-26 12:00 hrs."
  
  // Nombre completo - aparece entre "Desde:" y "Hasta:"
  let matchNombre = textoCompleto.match(/Desde:\s+\d{2}-[A-Z]{3}-\d{2}[^\n]*\n\s*([A-ZÁÉÍÓÚÑ\s]{10,60}?)\s*\n\s*Hasta:/i);
  
  if (matchNombre) {
    const nombreCompleto = matchNombre[1].trim();
    const partes = nombreCompleto.split(/\s+/).filter(p => p.length > 0);
    
    // Detectar si es persona moral (razón social)
    if (nombreCompleto.match(/S\.?A\.?|S\.?C\.?|S\.?R\.?L\.?|SOCIEDAD|CORPORAT|EMPRESA|GRUPO|ASOCIACI[ÓO]N/i)) {
      datos.tipo_persona = 'Moral';
      datos.razonSocial = nombreCompleto;
      console.log('🏢 Persona Moral:', datos.razonSocial);
    } else {
      // Persona física: dividir en nombre y apellidos
      datos.tipo_persona = 'Física';
      if (partes.length >= 3) {
        datos.nombre = partes[0];
        datos.apellido_paterno = partes[1];
        datos.apellido_materno = partes.slice(2).join(' ');
      } else if (partes.length === 2) {
        datos.nombre = partes[0];
        datos.apellido_paterno = partes[1];
      } else {
        datos.nombre = nombreCompleto;
      }
      console.log('👤 Persona Física:', datos.nombre, datos.apellido_paterno, datos.apellido_materno);
    }
  }
  
  // RFC - aparece como "No. de Cliente" seguido de "POGM-860910-IGA"
  // Formato: letras-números-letras con guiones
  let matchRFC = textoCompleto.match(/No\.\s+de\s+Cliente\s+([A-ZÑ&]{3,4})-(\d{6})-([A-Z0-9]{3})\b/i);
  
  if (matchRFC) {
    // Unir las partes sin guiones y asegurar solo los 12 o 13 caracteres correctos
    let rfcTemp = (matchRFC[1] + matchRFC[2] + matchRFC[3]).toUpperCase();
    // Asegurar que solo sean 12 o 13 caracteres
    if (rfcTemp.length > 13) {
      rfcTemp = rfcTemp.substring(0, 13);
    }
    datos.rfc = rfcTemp;
    console.log('🆔 RFC:', datos.rfc, `(${rfcTemp.length} caracteres)`);
  } else {
    // Buscar con puntos "R.F.C.:"
    matchRFC = textoCompleto.match(/R\.F\.C\.\s*:?\s*([A-ZÑ&]{3,4})-?(\d{6})-?([A-Z0-9]{3})\b/i);
    if (matchRFC) {
      let rfcTemp = (matchRFC[1] + matchRFC[2] + matchRFC[3]).toUpperCase();
      // Asegurar que solo sean 12 o 13 caracteres
      if (rfcTemp.length > 13) {
        rfcTemp = rfcTemp.substring(0, 13);
      }
      datos.rfc = rfcTemp;
      console.log('🆔 RFC (con puntos):', datos.rfc, `(${rfcTemp.length} caracteres)`);
    }
  }
  
  // Validar tipo de persona según longitud del RFC
  // RFC de 13 caracteres = Persona Física
  // RFC de 12 caracteres = Persona Moral
  if (datos.rfc) {
    if (datos.rfc.length === 13) {
      datos.tipo_persona = 'Física';
      console.log('✅ RFC de 13 caracteres → Persona Física');
      
      // Si teníamos razón social pero es física, convertir a nombre/apellidos
      if (datos.razonSocial && !datos.nombre && !datos.apellido_paterno) {
        const partes = datos.razonSocial.split(/\s+/).filter(p => p.length > 0);
        if (partes.length >= 3) {
          datos.nombre = partes[0];
          datos.apellido_paterno = partes[1];
          datos.apellido_materno = partes.slice(2).join(' ');
        } else if (partes.length === 2) {
          datos.nombre = partes[0];
          datos.apellido_paterno = partes[1];
        } else {
          datos.nombre = datos.razonSocial;
        }
        datos.razonSocial = ''; // Limpiar razón social ya que es física
        console.log('✅ Convertido a Persona Física:', datos.nombre, datos.apellido_paterno, datos.apellido_materno);
      }
    } else if (datos.rfc.length === 12) {
      datos.tipo_persona = 'Moral';
      console.log('✅ RFC de 12 caracteres → Persona Moral');
      
      // Si es moral y no tenemos razón social, usar el nombre completo
      if (!datos.razonSocial && (datos.nombre || datos.apellido_paterno)) {
        datos.razonSocial = [datos.nombre, datos.apellido_paterno, datos.apellido_materno]
          .filter(Boolean)
          .join(' ');
        console.log('🏢 Razón Social ajustada:', datos.razonSocial);
      }
    }
  }
  
  // Teléfono - aparece después de "Teléfono:" (10 dígitos)
  const matchTelefono = textoCompleto.match(/Tel[ée]fono:\s*(\d{10})/i);
  if (matchTelefono) {
    datos.telefono_movil = matchTelefono[1];
    console.log('📞 Teléfono:', datos.telefono_movil);
  }
  
  // Email - aparece después de "Correo electrónico:"
  const matchEmail = textoCompleto.match(/Correo\s+electr[óo]nico:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (matchEmail) {
    datos.email = matchEmail[1].toLowerCase();
    console.log('📧 Email:', datos.email);
  }
  
  // Dirección - buscar en múltiples formatos
  // Formato El Potosí: "Domicilio de Riesgo:" seguido de "Plan de pago" y luego la dirección
  // Ejemplo: "CARRET A TODOS SANTOS No. SN, , BRISAS DEL PACIFICO, CP 23473, LOS"
  // Siguiente línea: "CABOS, BAJA CALIFORNIA SUR, MEXICO"
  
  let matchDomicilio = textoCompleto.match(/Domicilio\s+de\s+Riesgo:\s*\n?\s*Plan\s+de\s+pago[^\n]*\n\s*([^\n]+?)\s*\n\s*Moneda\s*\n\s*[A-Z]+\s*\n\s*([^\n]+)/i);
  
  if (matchDomicilio) {
    const calleOriginal = matchDomicilio[1].trim();
    const ciudadEstado = matchDomicilio[2].trim();
    
    // Verificar si la calle termina con ", LOS", ", LAS", ", EL", ", LA" (parte de la ciudad)
    const matchArticulo = calleOriginal.match(/,\s+(LOS|LAS|EL|LA)\s*$/i);
    
    let calle = calleOriginal;
    let articuloCiudad = '';
    
    if (matchArticulo) {
      // Guardar el artículo (LOS, LAS, etc.) para agregarlo a la ciudad
      articuloCiudad = matchArticulo[1];
      // Quitar el artículo de la calle
      calle = calleOriginal.replace(/,\s+(LOS|LAS|EL|LA)\s*$/i, '');
      console.log('📍 Artículo encontrado en calle:', articuloCiudad);
    }
    
    // Guardar la calle limpia en domicilio
    datos.domicilio = calle;
    console.log('🏠 Domicilio (calle limpia):', datos.domicilio);
    
    // Extraer código postal de la calle (buscar "CP" seguido de 5 dígitos)
    const matchCP = calle.match(/CP\s*(\d{5})/i);
    if (matchCP) {
      datos.codigo_postal = matchCP[1];
      console.log('📮 CP:', datos.codigo_postal);
    }
    
    // Extraer municipio completo (unir artículo + resto de ciudad si aplica)
    const matchRestoCiudad = ciudadEstado.match(/^([A-ZÁÉÍÓÚÑ\s]+?)(?:,|$)/);
    if (matchRestoCiudad) {
      if (articuloCiudad) {
        // Unir: LOS + CABOS = LOS CABOS
        datos.municipio = `${articuloCiudad} ${matchRestoCiudad[1]}`.trim();
        console.log('🏙️ Municipio (con artículo):', datos.municipio);
      } else {
        datos.municipio = matchRestoCiudad[1].trim();
        console.log('🏙️ Municipio:', datos.municipio);
      }
    }
    
    // Extraer estado (después de la primera coma, antes de "MEXICO")
    const matchEstado = ciudadEstado.match(/,\s*([^,]+?)(?:,\s*MEXICO)?$/i);
    if (matchEstado) {
      datos.estado = matchEstado[1].trim();
      console.log('🗺️ Estado:', datos.estado);
    }
  } else {
    console.log('⚠️ No se encontró domicilio con formato esperado');
  }

  // ==================== AGENTE ====================
  // Formato del PDF:
  // "Clave    Nombre    Registro"
  // "776024   CESAR PAUL MENDOZA LOPEZ   LKJ1947DBH06FSM-100%-"
  const matchAgente = textoCompleto.match(/AGENTE\s+Clave\s+Nombre\s+Registro\s+(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+[A-Z0-9]+-)/i);
  
  if (matchAgente) {
    datos.clave_agente = matchAgente[1].trim();
    datos.agente = matchAgente[2].trim(); // Solo el nombre, SIN la clave
    console.log('👤 Clave Agente:', datos.clave_agente);
    console.log('👤 Nombre Agente:', datos.agente);
  } else {
    // Intentar buscar solo por el patrón de clave + nombre
    const matchAgente2 = textoCompleto.match(/Fracciones:\s+AGENTE\s+Clave[^\n]*\n\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]{10,60}?)(?=\s+[A-Z]{2})/i);
    if (matchAgente2) {
      datos.clave_agente = matchAgente2[1].trim();
      datos.agente = matchAgente2[2].trim(); // Solo el nombre, SIN la clave
      console.log('👤 Clave Agente (método 2):', datos.clave_agente);
      console.log('👤 Nombre Agente (método 2):', datos.agente);
    }
  }

  // ==================== PLAN DE PAGO ====================
  const matchPlanPago = textoCompleto.match(/Plan de pago\s+\(?\d*\)?\s*(ANUAL|SEMESTRAL|TRIMESTRAL|MENSUAL|BIMESTRAL)/i);
  if (matchPlanPago) {
    const plan = matchPlanPago[1].toUpperCase();
    datos.forma_pago = plan;
    
    if (plan === 'ANUAL') {
      datos.tipo_pago = 'Anual';
      datos.frecuenciaPago = 'Anual';
    } else {
      datos.tipo_pago = 'Fraccionado';
      datos.frecuenciaPago = plan.charAt(0) + plan.slice(1).toLowerCase();
    }
    console.log('💳 Plan de pago:', datos.tipo_pago, '-', datos.frecuenciaPago);
  }
  
  // ==================== PERÍODO DE GRACIA ====================
  // Buscar "PRIMER RECIBO 30 DÍAS," y "SUBSECUENTES 5 DÍAS"
  const matchPrimerRecibo = textoCompleto.match(/PRIMER\s+RECIBO\s+(\d+)\s+D[ÍI]AS/i);
  const matchSubsecuentes = textoCompleto.match(/SUBSECUENTES\s+(\d+)\s+D[ÍI]AS/i);
  
  if (matchPrimerRecibo) {
    datos.periodo_gracia_primer_pago = parseInt(matchPrimerRecibo[1]);
    console.log('📆 Período de gracia primer pago:', datos.periodo_gracia_primer_pago, 'días');
  }
  
  if (matchSubsecuentes) {
    datos.periodo_gracia = parseInt(matchSubsecuentes[1]);
    console.log('📆 Período de gracia pagos subsecuentes:', datos.periodo_gracia, 'días');
  } else if (matchPrimerRecibo) {
    // Si no hay subsecuentes definido, usar el del primer recibo
    datos.periodo_gracia = parseInt(matchPrimerRecibo[1]);
  }

  // ==================== DATOS DEL VEHÍCULO ====================
  const seccionVehiculo = textoCompleto.match(/DATOS DEL RIESGO ASEGURADO[\s\S]{0,800}?(?=CONDICIONES|$)/i);
  
  if (seccionVehiculo) {
    const texto = seccionVehiculo[0];
    
    // Vehículo completo (ej: "002-562-04 Mod.2020/CHRYSLER JEEP GLADIATOR RUBICON,AUT,4 PTAS,6 CIL,A/A,E/E,PIEL,B/A")
    const matchVehiculo = texto.match(/Veh[ií]culo:\s*([^\n]+)/i);
    if (matchVehiculo) {
      const lineaVehiculo = matchVehiculo[1];
      
      // Extraer año/marca/modelo
      const matchDetalles = lineaVehiculo.match(/Mod\.(\d{4})\/([A-Z\s]+?)(?:,|$)/i);
      if (matchDetalles) {
        datos.anio = matchDetalles[1];
        const marcaModelo = matchDetalles[2].trim().split(/\s+/);
        datos.marca = marcaModelo[0];
        datos.modelo = marcaModelo.slice(1).join(' ');
        console.log('🚗 Vehículo:', datos.anio, datos.marca, datos.modelo);
      }
    }
    
    // Serie/VIN - buscar después de "No. de serie:" (17 caracteres alfanuméricos)
    // Puede aparecer en diferentes formatos, buscar con más flexibilidad
    let matchSerie = texto.match(/No\.\s+de\s+serie:\s*([A-Z0-9]{17})/i);
    
    if (!matchSerie) {
      // Buscar patrón de VIN (17 caracteres) en cualquier parte de la sección del vehículo
      matchSerie = texto.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    }
    
    if (matchSerie) {
      datos.numero_serie = matchSerie[1].toUpperCase();
      console.log('🔢 Serie/VIN:', datos.numero_serie);
    } else {
      console.warn('⚠️ No se encontró VIN/Serie en la sección del vehículo');
    }
    
    // Número de motor - aparece ANTES de "No. de serie:"
    // Formato del PDF:
    // "HECHO EN USA"
    // "No. de serie: 1C6JJTBG4LL134257 No. de motor:"
    // "AUTOMATICA"
    const matchNumMotor = texto.match(/([A-Z\s]{5,20})\s*\n\s*No\.\s+de\s+serie:/i);
    if (matchNumMotor) {
      const valor = matchNumMotor[1].trim();
      // Asegurar que no capture nombres de vehículos
      if (!valor.match(/CHRYSLER|JEEP|FORD|NISSAN|GLADIATOR|RUBICON/i)) {
        datos.motor = valor;
        console.log('🔧 Número de motor:', datos.motor);
      }
    }
    
    // Si no se encontró, buscar "HECHO EN USA" directamente
    if (!datos.motor && texto.match(/HECHO EN USA/i)) {
      datos.motor = 'HECHO EN USA';
      console.log('🔧 Número de motor (directo):', datos.motor);
    }
    
    // Transmisión
    if (texto.match(/\bAUTOMATICA\b/i) || texto.match(/\bAUT\b/)) {
      datos.transmision = 'AUTOMATICA';
    } else if (texto.match(/\bSTANDARD\b/i) || texto.match(/\bMECANICA\b/i)) {
      datos.transmision = 'STANDARD';
    }
    
    // Motor (cilindros) — solo si no se extrajo el número de motor antes
    if (!datos.motor) {
      const matchMotor = texto.match(/(\d+)\s*CIL/i);
      if (matchMotor) {
        datos.motor = matchMotor[1] + ' CIL';
      }
    }
    
    // Capacidad/Puertas
    const matchPuertas = texto.match(/(\d+)\s*PTAS/i);
    if (matchPuertas) {
      datos.capacidad = matchPuertas[1];
    }
    
    // Uso - buscar "PARTICULAR", "COMERCIAL", etc.
    const matchUso = texto.match(/\n\s*(PARTICULAR|COMERCIAL|FRONTERIZO)\s*\n/i);
    if (matchUso) {
      datos.uso = matchUso[1].toUpperCase();
      datos.servicio = datos.uso === 'COMERCIAL' ? 'Público' : 'Particular';
      console.log('🚗 Uso:', datos.uso);
    } else {
      datos.uso = 'PARTICULAR';
      datos.servicio = 'Particular';
    }
    
    // Tipo de vehículo
    const matchTipo = texto.match(/Tipo Veh[ií]culo:\s*([A-Za-z]+)/i);
    if (matchTipo) {
      datos.tipo_vehiculo = matchTipo[1];
    } else {
      datos.tipo_vehiculo = 'Residente';
    }
  }
  
  // Si no se encontró el VIN en la sección del vehículo, buscar en todo el documento
  if (!datos.numero_serie) {
    const matchSerieGlobal = textoCompleto.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if (matchSerieGlobal) {
      datos.numero_serie = matchSerieGlobal[1].toUpperCase();
      console.log('🔢 Serie/VIN (búsqueda global):', datos.numero_serie);
    }
  }

  // ==================== COBERTURAS ====================
  // No se extraen coberturas por regex — se dejan para revisión manual
  datos.coberturas = [];

  // ==================== MONTOS FINANCIEROS ====================
  // Buscar tabla "DETALLES DE MOVIMIENTO"
  // Formato: línea con encabezados seguida de línea con valores
  // "Gastos de Tasa de financiamiento expedición por pago fraccionado"
  // "Prima Subtotal IVA Art. 101 IVA Art. 101 Total"
  // "23,553.03 550.00 0.00 29,496.81"
  // "1,340.16 25,443.19 4,053.62 0.00"
  
  const seccionDetalles = textoCompleto.match(/DETALLES\s+DE\s+MOVIMIENTO[\s\S]{0,500}?Fracciones:/i);
  
  if (seccionDetalles) {
    const texto = seccionDetalles[0];
    
    // Buscar la tabla con todos los valores en dos líneas
    // Primera línea: Prima, Gastos, Tasa, Subtotal, IVA, Art.101, IVA Art.101, Total
    // Los valores vienen en el orden de la tabla
    
    // Extraer todos los números de la sección
    const numeros = texto.match(/[\d,]+\.\d{2}/g);
    
    if (numeros && numeros.length >= 8) {
      // Los valores aparecen en este orden en la tabla:
      // [0] = Prima (23,553.03)
      // [1] = Gastos expedición (550.00)
      // [2] = Subtotal primera línea (0.00) - ignorar
      // [3] = Total primera línea (29,496.81)
      // [4] = Tasa financiamiento (1,340.16)
      // [5] = Subtotal (25,443.19)
      // [6] = IVA (4,053.62)
      // [7] = Art. 101 (0.00)
      
      datos.prima_neta = numeros[0].replace(/,/g, '');
      datos.gastos_expedicion = numeros[1].replace(/,/g, '');
      datos.cargo_pago_fraccionado = numeros[4].replace(/,/g, '');
      datos.subtotal = numeros[5].replace(/,/g, '');
      datos.iva = numeros[6].replace(/,/g, '');
      datos.total = numeros[3].replace(/,/g, '');
      
      console.log('💰 Prima neta:', datos.prima_neta);
      console.log('📄 Gastos de expedición:', datos.gastos_expedicion);
      console.log('💳 Cargo por fraccionamiento:', datos.cargo_pago_fraccionado);
      console.log('📊 Subtotal:', datos.subtotal);
      console.log('💵 IVA:', datos.iva);
      console.log('💰 Total:', datos.total);
    }
  }

  // ==================== PRIMER PAGO (ANUAL) ====================
  // En pago anual, el primer pago es el total
  if (datos.tipo_pago === 'Anual' && datos.total && !datos.primer_pago) {
    datos.primer_pago = datos.total;
  }

  // ==================== PAGOS FRACCIONADOS ====================
  if (datos.tipo_pago === 'Fraccionado') {
    // Buscar montos de pagos: "1 de 15,067.21 y 1 de 14,429.60"
    // Probar diferentes patrones para capturar los montos de fraccionamiento
    
    // Patrón 1: "Fracciones: 1 de 15,067.21 y 1 de 14,429.60" (con espacios y saltos de línea flexibles)
    let matchPagos = textoCompleto.match(/Fracciones:\s*[\n\r]*\s*1\s+de\s+([\d,]+\.\d{2})\s+y\s+1\s+de\s+([\d,]+\.\d{2})/i);
    
    // Patrón 2: Buscar en la tabla "1 de" seguido de número
    if (!matchPagos) {
      matchPagos = textoCompleto.match(/1\s+de\s+([\d,]+\.\d{2})\s+y\s+1\s+de\s+([\d,]+\.\d{2})/i);
    }
    
    // Patrón 3: En líneas separadas "1 de X" y "de X" (segunda parte)
    if (!matchPagos) {
      const match1 = textoCompleto.match(/(?:Fracciones:?\s*)?1\s+de\s+([\d,]+\.\d{2})/i);
      const match2 = textoCompleto.match(/(?:y\s+)?1\s+de\s+([\d,]+\.\d{2})/i);
      
      if (match1 && match2 && match1.index !== match2.index) {
        matchPagos = [null, match1[1], match2[1]];
      }
    }
    
    if (matchPagos && matchPagos[1] && matchPagos[2]) {
      datos.primer_pago = matchPagos[1].replace(/,/g, '');
      datos.pagos_subsecuentes = matchPagos[2].replace(/,/g, '');
      console.log('💳 Primer pago:', datos.primer_pago);
      console.log('💳 Pagos subsecuentes:', datos.pagos_subsecuentes);
    } else {
      console.log('⚠️ No se pudieron extraer los montos de pagos fraccionados');
      console.log('📄 Buscando "Fracciones:" en el texto...');
      const seccionFracciones = textoCompleto.match(/Fracciones:[\s\S]{0,200}/i);
      if (seccionFracciones) {
        console.log('📄 Texto encontrado:', seccionFracciones[0]);
      }
    }
  }

  console.log('✅ Extracción completa El Potosí');
  return datos;
}
