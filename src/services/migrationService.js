import { executeQuery, handleDatabaseError, handleDatabaseSuccess } from '../lib/database';

// Función para crear todas las tablas
export const crearTablas = async () => {
  try {
    console.log('Iniciando creación de tablas...');

    // Crear tabla de aseguradoras
    const queryAseguradoras = `
      CREATE TABLE IF NOT EXISTS aseguradoras (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        rfc VARCHAR(13) NOT NULL,
        razon_social TEXT,
        telefono VARCHAR(20),
        email VARCHAR(255),
        sitio_web VARCHAR(255),
        direccion TEXT,
        ciudad VARCHAR(100),
        estado VARCHAR(100),
        codigo_postal VARCHAR(10),
        productos_disponibles JSON,
        comision_base DECIMAL(5,2),
        tiempo_emision INT,
        contacto_principal VARCHAR(255),
        telefono_contacto VARCHAR(20),
        email_contacto VARCHAR(255),
        notas TEXT,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_aseguradoras_codigo (codigo),
        INDEX idx_aseguradoras_activo (activo)
      )
    `;

    const resultAseguradoras = await executeQuery(queryAseguradoras);
    if (!resultAseguradoras.success) {
      console.error('Error creando tabla aseguradoras:', resultAseguradoras.error);
      return handleDatabaseError(resultAseguradoras.error);
    }
    console.log('✅ Tabla aseguradoras creada');

    // Crear tabla de agentes
    const queryAgentes = `
      CREATE TABLE IF NOT EXISTS agentes (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        codigo_agente VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        apellido_paterno VARCHAR(255) NOT NULL,
        apellido_materno VARCHAR(255),
        email VARCHAR(255),
        telefono VARCHAR(20),
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_agentes_codigo (codigo_agente),
        INDEX idx_agentes_activo (activo)
      )
    `;

    const resultAgentes = await executeQuery(queryAgentes);
    if (!resultAgentes.success) {
      console.error('Error creando tabla agentes:', resultAgentes.error);
      return handleDatabaseError(resultAgentes.error);
    }
    console.log('✅ Tabla agentes creada');

    // Crear tabla de clientes
    const queryClientes = `
      CREATE TABLE IF NOT EXISTS clientes (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        nombre VARCHAR(255) NOT NULL,
        apellido_paterno VARCHAR(255) NOT NULL,
        apellido_materno VARCHAR(255),
        email VARCHAR(255),
        telefono_fijo VARCHAR(20),
        telefono_movil VARCHAR(20),
        direccion TEXT,
        ciudad VARCHAR(100),
        estado VARCHAR(100),
        codigo_postal VARCHAR(10),
        rfc VARCHAR(13),
        fecha_nacimiento DATE,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_clientes_activo (activo)
      )
    `;

    const resultClientes = await executeQuery(queryClientes);
    if (!resultClientes.success) {
      console.error('Error creando tabla clientes:', resultClientes.error);
      return handleDatabaseError(resultClientes.error);
    }
    console.log('✅ Tabla clientes creada');

    // Crear tabla de productos personalizados
    const queryProductos = `
      CREATE TABLE IF NOT EXISTS productos_personalizados (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        descripcion TEXT,
        companias_disponibles JSON,
        comision_base DECIMAL(5,2),
        vigencia_dias INT DEFAULT 365,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_productos_codigo (codigo)
      )
    `;

    const resultProductos = await executeQuery(queryProductos);
    if (!resultProductos.success) {
      console.error('Error creando tabla productos_personalizados:', resultProductos.error);
      return handleDatabaseError(resultProductos.error);
    }
    console.log('✅ Tabla productos_personalizados creada');

    // Crear tabla de expedientes (al final por las foreign keys)
    const queryExpedientes = `
      CREATE TABLE IF NOT EXISTS expedientes (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        cliente_id VARCHAR(36),
        agente_id VARCHAR(36),
        aseguradora_id VARCHAR(36),
        producto VARCHAR(255) NOT NULL,
        etapa_activa VARCHAR(100) DEFAULT 'En cotización',
        estatus_pago VARCHAR(100) DEFAULT 'Sin definir',
        prima_pagada DECIMAL(10,2),
        total DECIMAL(10,2),
        inicio_vigencia DATE,
        termino_vigencia DATE,
        tipo_pago VARCHAR(50),
        frecuencia_pago VARCHAR(50),
        periodo_gracia INT,
        proximo_pago DATE,
        fecha_ultimo_pago DATE,
        motivo_cancelacion TEXT,
        notas TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_expedientes_cliente (cliente_id),
        INDEX idx_expedientes_agente (agente_id),
        INDEX idx_expedientes_aseguradora (aseguradora_id),
        INDEX idx_expedientes_etapa (etapa_activa)
      )
    `;

    const resultExpedientes = await executeQuery(queryExpedientes);
    if (!resultExpedientes.success) {
      console.error('Error creando tabla expedientes:', resultExpedientes.error);
      return handleDatabaseError(resultExpedientes.error);
    }
    console.log('✅ Tabla expedientes creada');

    console.log('🎉 Todas las tablas creadas exitosamente');
    return handleDatabaseSuccess('Todas las tablas creadas exitosamente');

  } catch (error) {
    console.error('Error en migración:', error);
    return handleDatabaseError(error);
  }
};

// Función para verificar si las tablas existen
export const verificarTablas = async () => {
  try {
    const query = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'sistemaseguros'
      AND TABLE_NAME IN ('aseguradoras', 'agentes', 'clientes', 'expedientes', 'productos_personalizados')
    `;
    
    const resultado = await executeQuery(query);
    
    if (!resultado.success) {
      return handleDatabaseError(resultado.error);
    }

    const tablasExistentes = resultado.data.map(row => row.TABLE_NAME);
    const tablasRequeridas = ['aseguradoras', 'agentes', 'clientes', 'expedientes', 'productos_personalizados'];
    const tablasFaltantes = tablasRequeridas.filter(tabla => !tablasExistentes.includes(tabla));

    return handleDatabaseSuccess({
      tablasExistentes,
      tablasFaltantes,
      todasCreadas: tablasFaltantes.length === 0
    });

  } catch (error) {
    return handleDatabaseError(error);
  }
};