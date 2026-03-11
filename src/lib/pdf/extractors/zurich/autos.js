/**
 * Extractor Especializado: Zurich - Autos
 * 
 * Extrae información de pólizas de autos de Zurich Seguros.
 * 
 * @module extractors/zurich/autos
 */

/**
 * Extrae un dato usando expresión regular
 * @param {RegExp} patron - Patrón regex
 * @param {string} texto - Texto donde buscar
 * @param {number} grupo - Grupo de captura (default: 1)
 * @returns {string} Valor extraído o cadena vacía
 */
function extraerDato(patron, texto, grupo = 1) {
  try {
    const match = texto.match(patron);
    return match && match[grupo] ? match[grupo].trim() : '';
  } catch (error) {
    console.warn('Error en extraerDato:', error, 'Patrón:', patron);
    return '';
  }
}

/**
 * Normaliza formato de fecha de DD/MM/YYYY a YYYY-MM-DD
 */
function normalizarFecha(fechaTexto) {
  if (!fechaTexto) return '';
  
  // Formato: 01/12/2024 o 01-12-2024
  const match = fechaTexto.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  if (match) {
    const [, dia, mes, anio] = match;
    return `${anio}-${mes}-${dia}`;
  }
  
  return '';
}

/**
 * Limpia y normaliza montos
 */
function limpiarMonto(texto) {
  if (!texto) return '';
  const limpio = texto.replace(/[$,\s]/g, '').trim();
  const numero = parseFloat(limpio);
  return !isNaN(numero) ? numero.toFixed(2) : '';
}

/**
 * Extrae información de póliza de Zurich Autos
 * @param {Object} ctx - Contexto con textos del PDF
 * @param {string} ctx.textoCompleto - Texto completo del PDF
 * @param {string} ctx.textoPagina1 - Texto de página 1
 * @param {string} ctx.textoPagina2 - Texto de página 2
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  const { textoCompleto, textoPagina1, textoPagina2 } = ctx;
  // Combinar páginas 1 y 2 para tener toda la info del agente
  const texto = textoCompleto || (textoPagina1 + '\n' + (textoPagina2 || ''));
  
  const compania = 'Zurich';
  
  // DEBUG: Mostrar texto completo extraído
  console.log('📄 ========== TEXTO EXTRAÍDO COMPLETO ==========');
  console.log(texto);
  console.log('📄 ===============================================');
  
  // ==================== NÚMERO DE PÓLIZA ====================
  // Patrón: PÓLIZA No. 111819309   Endoso: 0  Inciso: 1
  const numero_poliza = extraerDato(/P[oó]liza\s+No\.?[:\s]+(\d+)/i, texto);
  const endoso = extraerDato(/Endoso[:\s]+(\d+)/i, texto);
  const inciso = extraerDato(/Inciso[:\s]+(\d+)/i, texto);
  
  // ==================== RFC Y TIPO DE PERSONA ====================
  const rfcMatch = texto.match(/R\.?\s*F\.?\s*C\.?[:\s]+([A-Z&Ñ]{3,4}[-\s]?\d{6}[-\s]?[A-Z0-9]{2,3})/i);
  let rfc = rfcMatch ? rfcMatch[1].replace(/[-\s]/g, '') : '';
  const tipo_persona = rfc.length === 13 ? 'Fisica' : rfc.length === 12 ? 'Moral' : 'Fisica';
  
  // ==================== ASEGURADO ====================
  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';
  
  // Buscar nombre después de "Datos del Asegurado" o "Datos de la Póliza" y antes de "Desde:"
  const nombreMatch = texto.match(/(?:Datos del Asegurado|Datos de la P[oó]liza)\s*\n\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\n\s*Desde:)/i);
  
  if (nombreMatch) {
    const nombreCompleto = nombreMatch[1].trim();
    
    if (tipo_persona === 'Moral') {
      razonSocial = nombreCompleto;
    } else {
      const palabras = nombreCompleto.split(/\s+/);
      
      // Formato Zurich: APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S)
      // Ejemplo: ALCARAZ BASURTO ERIKA GUADALUPE
      if (palabras.length >= 4) {
        apellido_paterno = palabras[0];
        apellido_materno = palabras[1];
        nombre = palabras.slice(2).join(' ');
      } else if (palabras.length === 3) {
        apellido_paterno = palabras[0];
        apellido_materno = palabras[1];
        nombre = palabras[2];
      } else if (palabras.length === 2) {
        apellido_paterno = palabras[0];
        nombre = palabras[1];
      } else {
        nombre = nombreCompleto;
      }
    }
  }
  
  // ==================== DOMICILIO ====================
  // Buscar dirección después del nombre del asegurado
  // Formato visible en PDF: AV PASEO SOLARES \n COLONIA GIRASOLES \n ZAPOPAN JALISCO \n C.P. 45136
  
  // Estrategia genérica: buscar bloque entre el nombre del asegurado y R.F.C/Producto
  // Usa el nombre extraído dinámicamente en vez de hardcodear un apellido
  let textoDir = '';
  
  // Estrategia 1: Buscar después del nombre completo del asegurado hasta R.F.C
  if (nombreMatch) {
    const nombreCompleto = nombreMatch[1].trim();
    const ultimaPalabra = nombreCompleto.split(/\s+/).pop();
    const escapedNombre = ultimaPalabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bloqueDir = texto.match(new RegExp(escapedNombre + '([\\s\\S]{0,500})(?:R\\.F\\.C|Producto|Zurich Aseguradora)', 'i'));
    textoDir = bloqueDir ? bloqueDir[1] : '';
  }
  
  // Estrategia 2 (fallback): Buscar entre "Datos del Asegurado" y "R.F.C"
  if (!textoDir) {
    const bloqueDirFallback = texto.match(/(?:Datos del Asegurado|Datos de la P[oó]liza)[\s\S]{0,800}?(?=R\.F\.C|Producto|Zurich Aseguradora)/i);
    textoDir = bloqueDirFallback ? bloqueDirFallback[0] : '';
  }
  
  // Extraer dirección (línea que empieza con AV, CALLE, etc)
  const domicilioMatch = textoDir.match(/\n\s*((?:AV|AVENIDA|CALLE|BLVD|BOULEVARD|PRIVADA|ANDADOR|CALZADA|CERRADA|CIRCUITO|PASEO|PROLONGACION|PROL)[A-Z0-9\s\.\#\-]+)/i);
  const domicilio = domicilioMatch ? domicilioMatch[1].trim() : '';
  
  // Extraer colonia (generalmente viene después de la dirección)
  const coloniaMatch = textoDir.match(/\n\s*(?:COLONIA\s+)?([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*\n\s*[A-Z]+ [A-Z]+\s*\n|\s*C\.P\.)/i);
  const colonia = coloniaMatch ? coloniaMatch[1].trim() : '';
  
  // Extraer ciudad y estado (patrón: CIUDAD ESTADO en la misma línea antes de C.P.)
  const ciudadEstadoMatch = textoDir.match(/\n\s*([A-ZÁÉÍÓÚÑ]+(?:\s[A-ZÁÉÍÓÚÑ]+)?)\s+([A-ZÁÉÍÓÚÑ]+)\s*\n\s*C\.P\./i);
  const ciudad = ciudadEstadoMatch ? ciudadEstadoMatch[1].trim() : '';
  const estado = ciudadEstadoMatch ? ciudadEstadoMatch[2].trim() : '';
  
  // Extraer código postal
  const cpMatch = textoDir.match(/C\.P\.\s*(\d{5})/i);
  const codigo_postal = cpMatch ? cpMatch[1] : '';
  
  const municipio = ciudad;
  
  // ==================== TELÉFONO ====================
  const telefonoMatch = texto.match(/Tel[eé]fono[:\s]+([\d\s\-]+)/i);
  const telefono = telefonoMatch ? telefonoMatch[1].replace(/[\s\-]/g, '') : '';
  
  // ==================== VIGENCIA ====================
  // Formato Zurich peculiar:
  // "Desde: 12:00hrs. 31 /01/ 2025"
  // "31 /01/ 2026"  <- fecha término (ANTES de la palabra "Hasta")
  // "Hasta: 12:00hrs."
  
  const inicioMatch = texto.match(/Desde[:\s]+(?:12:00hrs\.?)?\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i);
  const inicio_vigencia = inicioMatch ? `${inicioMatch[3]}-${inicioMatch[2]}-${inicioMatch[1]}` : '';
  
  // La fecha de término está en la línea siguiente después de la fecha de inicio
  const terminoMatch = texto.match(/Desde[:\s]+(?:12:00hrs\.?)?\s*\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4}\s*\n\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i);
  const termino_vigencia = terminoMatch ? `${terminoMatch[3]}-${terminoMatch[2]}-${terminoMatch[1]}` : '';
  
  // ==================== EMISIÓN Y CAPTURA ====================
  // Formato: "Fecha Emisión: 20 /11/ 2024"
  const emisionMatch = texto.match(/Fecha\s+Emisi[oó]n[:\s]+(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/i);
  const fecha_emision = emisionMatch ? `${emisionMatch[3]}-${emisionMatch[2]}-${emisionMatch[1]}` : '';
  
  // Fecha de captura (fecha actual en formato YYYY-MM-DD)
  const fecha_captura = new Date().toISOString().split('T')[0];
  
  // ==================== PRODUCTO ====================
  // Formato: "Producto: Tu Auto Seguro Mas"
  const productoMatch = texto.match(/Producto[:\s]+([^\n]+?)(?:\s+R\.F\.C\.|$)/i);
  const producto_especifico = productoMatch ? productoMatch[1].trim() : 'Tu Auto Seguro Mas';
  
  // Mapear a categoría genérica para el formulario
  const producto_nombre = 'Autos';
  
  // ==================== VEHÍCULO ====================
  // Formato Zurich: "Placas: 0 Capacidad: 5 Servicio: Particular No. de Motor: QR25615336M"
  // "No. de Serie: JN8BT27T9UW14855 Uso: Tipo Carga: No Peligrosa"
  // "Marca: NISSAN Modelo: 2020 Clave: Salvamento:"
  // "Descripción: X TRAIL SENSE 2ROW SUV CVT AA EE CD BA 170HP ABS 2.5L 4CIL 5P 5OCUP"
  
  // Placas
  const placasMatch = texto.match(/Placas:\s*([A-Z0-9\-]+)/i);
  const placas = placasMatch ? placasMatch[1].trim() : '';
  
  // Servicio
  const servicioMatch = texto.match(/Servicio:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)(?=No\.\s+de\s+Motor|$)/i);
  const servicio = servicioMatch ? servicioMatch[1].trim() : '';
  
  // Motor
  const motorMatch = texto.match(/No\.\s+de\s+Motor:\s*([A-Z0-9]+)/i);
  const motor = motorMatch ? motorMatch[1].trim() : '';
  
  // Serie / VIN
  const serieMatch = texto.match(/No\.\s+de\s+Serie:\s*([A-Z0-9]+)/i);
  const numero_serie = serieMatch ? serieMatch[1].trim() : '';
  
  // Uso
  const usoMatch = texto.match(/Uso:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)(?=Tipo\s+Carga|$)/i);
  const uso = usoMatch ? usoMatch[1].trim() : '';
  
  // Tipo de Carga
  const tipoCargaMatch = texto.match(/Tipo\s+Carga:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)(?=Marca:|$)/i);
  const tipo_carga = tipoCargaMatch ? tipoCargaMatch[1].trim() : '';
  
  // Marca
  const marcaMatch = texto.match(/Marca:\s*([A-Z]+)/i);
  const marca = marcaMatch ? marcaMatch[1].trim() : '';
  
  // Año (Modelo)
  const anioMatch = texto.match(/Modelo:\s*(\d{4})/i);
  const anio = anioMatch ? anioMatch[1] : '';
  
  // Descripción completa del vehículo
  const descripcionMatch = texto.match(/Descripci[oó]n:\s*([A-Z0-9\s]+)/i);
  const modelo = descripcionMatch ? descripcionMatch[1].trim() : '';
  
  // Color - no aparece en Zurich, dejar vacío
  const color = '';
  
  // Tipo de vehículo - extraer de la descripción (SUV, SEDAN, etc)
  let tipo_vehiculo = '';
  if (modelo) {
    if (modelo.includes('SUV')) tipo_vehiculo = 'SUV';
    else if (modelo.includes('SEDAN')) tipo_vehiculo = 'SEDAN';
    else if (modelo.includes('HATCHBACK')) tipo_vehiculo = 'HATCHBACK';
    else if (modelo.includes('PICKUP')) tipo_vehiculo = 'PICKUP';
    else if (modelo.includes('COUPE')) tipo_vehiculo = 'COUPE';
  }
  
  // ==================== AGENTE ====================
  // El nombre viene como: MENDOZA LOPEZ CESAR PAUL (apellidos + nombre)
  // Necesitamos convertirlo a: CESAR PAUL MENDOZA LOPEZ (nombre + apellidos)
  
  const agenteNombreMatch = texto.match(/(?:Nombre\s+del\s+)?Agente[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*Clave)/i);
  
  let agente = '';
  let clave_agente = '';
  
  if (agenteNombreMatch) {
    const nombreOriginal = agenteNombreMatch[1].trim();
    const palabras = nombreOriginal.split(/\s+/);
    
    // Zurich: APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S)
    // Convertir a: NOMBRE(S) APELLIDO_PATERNO APELLIDO_MATERNO
    if (palabras.length >= 4) {
      // MENDOZA LOPEZ CESAR PAUL → CESAR PAUL MENDOZA LOPEZ
      const apellidos = palabras.slice(0, 2).join(' '); // MENDOZA LOPEZ
      const nombres = palabras.slice(2).join(' '); // CESAR PAUL
      agente = `${nombres} ${apellidos}`;
    } else if (palabras.length === 3) {
      // MENDOZA LOPEZ CESAR → CESAR MENDOZA LOPEZ
      const apellidos = palabras.slice(0, 2).join(' ');
      const nombres = palabras[2];
      agente = `${nombres} ${apellidos}`;
    } else {
      agente = nombreOriginal;
    }
  }
  
  // Buscar "Clave: 993 14157" con salto de línea entre números
  const claveMatch = texto.match(/Clave:\s*(\d{3})[\s\n]+(\d{5})/);
  if (claveMatch) {
    clave_agente = `${claveMatch[1]}-${claveMatch[2]}`;
  }
  
  // ==================== FORMA DE PAGO ====================
  const formaPagoMatch = texto.match(/Forma\s+de\s+pago[:\s]+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?=\n|$)/i);
  let forma_pago = formaPagoMatch ? formaPagoMatch[1].trim() : '';
  
  // Normalizar forma de pago
  let tipo_pago = 'Anual';
  let frecuenciaPago = 'Anual';
  
  const formaPagoUpper = forma_pago.toUpperCase();
  
  if (formaPagoUpper.includes('CONTADO') || formaPagoUpper.includes('EFECTIVO') || formaPagoUpper.includes('ANUAL')) {
    tipo_pago = 'Anual';
    frecuenciaPago = 'Anual';
  } else if (formaPagoUpper.includes('MENSUAL')) {
    tipo_pago = 'Fraccionado';
    frecuenciaPago = 'Mensual';
  } else if (formaPagoUpper.includes('TRIMESTRAL')) {
    tipo_pago = 'Fraccionado';
    frecuenciaPago = 'Trimestral';
  } else if (formaPagoUpper.includes('SEMESTRAL')) {
    tipo_pago = 'Fraccionado';
    frecuenciaPago = 'Semestral';
  }
  
  // ==================== FINANCIERO ====================
  // En Zurich, el "Resumen de Valores" tiene formato de renglones alternados:
  // Renglón 1: $8,065.04  $913.14  $0.00
  // Renglón 2: Prima Neta | Otros Serv. Contratados | Cesión de Comisión
  // Renglón 3: $0.00  $750.00  $1,556.51
  // Renglón 4: Financiamiento | Gastos Expedición | I.V.A.
  // Renglón 5: $11,284.69  $11,284.69  $0.00
  // Renglón 6: Prima Total | 1er. Pago | Subsecuentes
  
  // Patrón: Captura 3 valores por línea, con $ y posibles espacios
  const linea1 = texto.match(/\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s*\n\s*Prima\s+Neta/i);
  const prima_pagada = linea1 ? limpiarMonto(linea1[1]) : '';
  const otros_servicios = linea1 ? limpiarMonto(linea1[2]) : '';
  const cesion_comision = linea1 ? limpiarMonto(linea1[3]) : '';
  
  const linea2 = texto.match(/\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s*\n\s*Financiamiento/i);
  const cargo_pago_fraccionado = linea2 ? limpiarMonto(linea2[1]) : '';
  const gastos_expedicion = linea2 ? limpiarMonto(linea2[2]) : '';
  const iva = linea2 ? limpiarMonto(linea2[3]) : '';
  
  const linea3 = texto.match(/\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})\s*\n\s*Prima\s+Total/i);
  const total = linea3 ? limpiarMonto(linea3[1]) : '';
  const primer_pago = linea3 ? limpiarMonto(linea3[2]) : '';
  const pagos_subsecuentes = linea3 ? limpiarMonto(linea3[3]) : '';
  
  // ==================== COBERTURAS ====================
  // Formato Zurich:
  // Coberturas Amparadas    Deducibles    Primas
  // Límites de Responsabilidad
  // Daños Materiales    Valor Comercial    5 %    $ 2,311.91
  // Robo Total    Valor Comercial    10 %    $ 3,330.80
  // Gastos Médicos Ocupantes (L.U.C.)    $ 500,000    Ninguno    $ 299.37
  // Otros Servicios Contratados
  // Asistencia Vial    Amparada    Ninguno    $ 346.86
  
  const coberturas = [];
  
  // Buscar el bloque completo de coberturas (desde "Coberturas Amparadas" hasta "Observaciones")
  const bloqueCoberturasMatch = texto.match(/Coberturas\s+Amparadas[\s\S]{0,5000}?(?=Observaciones|Si\s+el\s+contenido)/i);
  const textoCoberturas = bloqueCoberturasMatch ? bloqueCoberturasMatch[0] : '';
  
  if (textoCoberturas) {
    // Dividir en líneas y procesar cada una
    const lineas = textoCoberturas.split('\n');
    
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      
      // Saltar headers, líneas vacías y títulos
      if (!linea || 
          linea.includes('Coberturas Amparadas') || 
          linea.includes('Deducibles') || 
          linea.includes('Primas') ||
          linea.includes('Límites de Responsabilidad') ||
          linea === 'Otros Servicios Contratados') {
        continue;
      }
      
      // Patrón: Nombre | Suma | Deducible | Prima
      // Ejemplo: "Daños Materiales    Valor Comercial    5 %    $ 2,311.91"
      // Ejemplo: "R.C. por daños a Terceros L.U.C.    $ 1,500,000    0 UMA    $ 1,821.01"
      // Ejemplo: "Gastos Médicos Ocupantes (L.U.C.)    $ 500,000    Ninguno    $ 299.37"
      // Ejemplo: "Asistencia Vial    Amparada    Ninguno    $ 346.86"
      // Ejemplo: "Multas y Corralones    45 UMA    Ninguno    $ 30.93"
      // Ejemplo: "Responsabilidad Civil Extranjero    Amparada    0 UMA"
      const match = linea.match(/^(.+?)\s+(Valor\s+Comercial|\$\s*[\d,]+|Amparad[oa]|[\d]+\s+UMA)\s+([\d]+\s*%?|[\d]+\s+UMA|Ninguno|Amparad[oa]|N\/A|0\s+UMA)(?:\s+\$?\s*([\d,]+\.?\d*))?/i);
      
      if (match) {
        const nombreCob = match[1].trim();
        const suma = match[2].trim();
        let deducible = match[3].trim();
        const prima = match[4] ? match[4].replace(/,/g, '') : '0.00';
        
        // Normalizar deducible: si es solo "0", agregar "UMA"
        if (deducible === '0' || deducible === '0 UMA') {
          deducible = '0 UMA';
        } else if (deducible === 'AMPARADA' || deducible === 'AMPARADO') {
          deducible = 'N/A';
        }
        
        // Filtrar líneas que no sean coberturas
        if (!nombreCob.match(/Prima|Total\s+1er|Subsecuentes|Financiamiento|I\.V\.A\./i) && nombreCob.length > 3) {
          coberturas.push({
            nombre: nombreCob,
            suma_asegurada: suma === 'AMPARADA' || suma === 'AMPARADO' || suma === 'Amparada' ? 'AMPARADA' : suma.replace(/\$/g, '').trim(),
            deducible: deducible,
            prima: parseFloat(prima).toFixed(2),
            tipo: suma.includes('Amparad') ? 'amparada' : 'monto'
          });
        }
      }
    }
  }
  
  // ==================== RESULTADO ====================
  const datosExtraidos = {
    // Asegurado
    tipo_persona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc,
    curp: '',
    domicilio,
    municipio,
    estado,
    codigo_postal,
    pais: 'México',
    email: '',
    telefono_movil: telefono,
    telefono_fijo: telefono,
    
    // Póliza
    compania,
    producto: producto_nombre,
    producto_especifico, // Guardar el producto específico de Zurich para referencia
    etapa_activa: 'Emitida',
    agente,
    clave_agente,
    numero_poliza,
    endoso,
    inciso,
    plan: '',
    inicio_vigencia,
    termino_vigencia,
    fecha_emision,
    fecha_captura,
    
    // Financiero
    prima_pagada,
    cargo_pago_fraccionado,
    gastos_expedicion,
    iva,
    total,
    primer_pago,
    pagos_subsecuentes,
    otros_servicios,
    cesion_comision,
    tipo_pago,
    frecuenciaPago,
    forma_pago,
    periodo_gracia: '30',
    
    // Vehículo
    marca,
    modelo,
    anio,
    numero_serie,
    motor,
    placas,
    color,
    tipo_vehiculo,
    uso,
    servicio,
    tipo_carga,
    tipo_cobertura: '',
    conductor_habitual: '',
    movimiento: endoso && endoso !== '0' && endoso !== '' ? 'Endoso' : 'Emisión',
    moneda: 'MXN',
    
    // Coberturas
    coberturas
  };
  
  return datosExtraidos;
}
