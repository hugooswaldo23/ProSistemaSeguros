// Script para agregar productos de Vida a la base de datos
// Ejecutar con: node scripts/agregar_productos_vida.js

const API_URL = 'https://apiseguros.proordersistem.com.mx';

const productosVida = [
  {
    codigo: 'VIDA_001',
    nombre: 'Vida Individual',
    descripcion: 'Protección básica de vida',
    icono: 'heart',
    color: 'danger',
    activo: true,
    orden: 1
  },
  {
    codigo: 'VIDA_002',
    nombre: 'Vida Temporal',
    descripcion: 'Cobertura por periodo específico',
    icono: 'heart',
    color: 'danger',
    activo: true,
    orden: 2
  },
  {
    codigo: 'VIDA_003',
    nombre: 'Vida Dotal',
    descripcion: 'Ahorro + protección',
    icono: 'heart',
    color: 'danger',
    activo: true,
    orden: 3
  },
  {
    codigo: 'VIDA_004',
    nombre: 'Vida Universal',
    descripcion: 'Flexible con componente de inversión',
    icono: 'heart',
    color: 'danger',
    activo: true,
    orden: 4
  },
  {
    codigo: 'VIDA_005',
    nombre: 'Gastos Funerarios',
    descripcion: 'Cubre gastos de funeral',
    icono: 'heart',
    color: 'danger',
    activo: true,
    orden: 5
  }
];

async function agregarProductos() {
  console.log('🚀 Iniciando inserción de productos de Vida...\n');
  
  for (const producto of productosVida) {
    try {
      const response = await fetch(`${API_URL}/api/tiposProductos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test'
        },
        body: JSON.stringify(producto)
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${producto.nombre} (${producto.codigo}) - Agregado exitosamente`);
      } else {
        console.log(`❌ ${producto.nombre} - Error: ${result.error || result.message || 'Error desconocido'}`);
      }
    } catch (error) {
      console.log(`❌ ${producto.nombre} - Error de conexión: ${error.message}`);
    }
  }
  
  console.log('\n✨ Proceso completado!');
}

agregarProductos();
