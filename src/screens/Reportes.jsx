import React, { useState, useEffect, useMemo } from 'react';
import { FileText, DollarSign, Download, Calendar, Users, TrendingUp, Plus, Eye, Lock, Check, History, AlertCircle, Wallet, MinusCircle, PlusCircle, Banknote, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;

const Reportes = () => {
  const [reporteActivo, setReporteActivo] = useState('nomina');
  const [loading, setLoading] = useState(false);
  const [vistaActual, setVistaActual] = useState('generar'); // 'generar' | 'historial' | 'detalle'
  
  // Estados para filtros del reporte de nómina
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Usar el hook de equipo de trabajo
  const { equipoDeTrabajo: empleados, loading: loadingEmpleados } = useEquipoDeTrabajo();
  
  // Estados para datos
  const [datosNomina, setDatosNomina] = useState([]);
  const [historialNominas, setHistorialNominas] = useState([]);
  const [nominaSeleccionada, setNominaSeleccionada] = useState(null);
  const [nominaGenerada, setNominaGenerada] = useState(false);
  const [nominaId, setNominaId] = useState(null); // ID de la nómina guardada en BD
  const [nominaGuardada, setNominaGuardada] = useState(false); // Si ya está en BD
  const [empleadoDetalle, setEmpleadoDetalle] = useState(null); // Para modal de detalle de comisiones
  const [detalleEditado, setDetalleEditado] = useState([]); // Para editar comisiones en el modal
  const [prestamosEmpleados, setPrestamosEmpleados] = useState({}); // Saldos de préstamos por empleado
  
  // Estados para módulo de préstamos
  const [listaPrestamos, setListaPrestamos] = useState([]);
  const [modalPrestamo, setModalPrestamo] = useState(false);
  const [prestamoEditando, setPrestamoEditando] = useState(null);
  const [filtroPrestamos, setFiltroPrestamos] = useState('Activo'); // 'Activo' | 'Liquidado' | 'todos'
  
  // Establecer fechas por defecto al montar
  useEffect(() => {
    cargarHistorialNominas();
    cargarPrestamosEmpleados();
    // Establecer fechas por defecto (quincena actual)
    const hoy = new Date();
    const dia = hoy.getDate();
    let primerDia, ultimoDia;
    
    if (dia <= 15) {
      // Primera quincena
      primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth(), 15);
    } else {
      // Segunda quincena
      primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 16);
      ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    }
    
    setFechaInicio(primerDia.toISOString().split('T')[0]);
    setFechaFin(ultimoDia.toISOString().split('T')[0]);
  }, []);
  
  const cargarHistorialNominas = async () => {
    try {
      const response = await fetch(`${API_URL}/api/nominas`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHistorialNominas(data);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
      // Datos de ejemplo mientras no exista el endpoint
      setHistorialNominas([]);
    }
  };
  
  // Cargar saldos de préstamos de todos los empleados
  const cargarPrestamosEmpleados = async () => {
    try {
      const response = await fetch(`${API_URL}/api/prestamos`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        const prestamos = await response.json();
        // Guardar lista completa para el módulo de préstamos
        setListaPrestamos(prestamos);
        // Crear mapa de empleado_id -> saldo pendiente
        const saldos = {};
        prestamos.forEach(p => {
          if (p.estatus === 'Activo') {
            saldos[p.empleado_id] = (saldos[p.empleado_id] || 0) + parseFloat(p.saldo_pendiente || 0);
          }
        });
        setPrestamosEmpleados(saldos);
      }
    } catch (error) {
      console.error('Error al cargar préstamos:', error);
      setPrestamosEmpleados({});
    }
  };
  
  const generarNomina = async () => {
    if (!fechaInicio || !fechaFin) {
      toast.error('Por favor selecciona un rango de fechas');
      return;
    }
    
    if (!empleados || empleados.length === 0) {
      toast.error('No hay empleados registrados en el sistema');
      return;
    }
    
    setLoading(true);
    try {
      // Obtener expedientes con sus recibos
      const [expResponse, asegResponse, prodResponse] = await Promise.all([
        fetch(`${API_URL}/api/expedientes`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        }),
        fetch(`${API_URL}/api/aseguradoras`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        }),
        fetch(`${API_URL}/api/tiposProductos`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        })
      ]);
      
      if (!expResponse.ok) {
        throw new Error('Error al obtener expedientes');
      }
      
      const expedientes = await expResponse.json();
      const aseguradoras = asegResponse.ok ? await asegResponse.json() : [];
      const tiposProductos = prodResponse.ok ? await prodResponse.json() : [];
      
      // Crear mapa de productos: nombre -> id
      const productoIdMap = {};
      tiposProductos.forEach(prod => {
        productoIdMap[prod.nombre?.toLowerCase()] = prod.id;
      });
      
      // Crear mapa de comisiones: aseguradora + producto_id -> comision
      const comisionesAseguradora = {};
      aseguradoras.forEach(aseg => {
        if (aseg.productos_disponibles && Array.isArray(aseg.productos_disponibles)) {
          aseg.productos_disponibles.forEach(prod => {
            const key = `${aseg.nombre?.toLowerCase()}_${prod.producto_id}`;
            comisionesAseguradora[key] = parseFloat(prod.comision) || 0;
          });
        }
      });
      
      // Función para obtener comisión desde aseguradora y producto
      const obtenerComision = (compania, producto) => {
        if (!compania || !producto) return 10; // Default
        const productoId = productoIdMap[producto.toLowerCase()];
        if (!productoId) return 10;
        const key = `${compania.toLowerCase()}_${productoId}`;
        const comision = comisionesAseguradora[key];
        return comision !== undefined ? comision : 10; // Default 10% si no está configurado
      };
      
      // Calcular días del período
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      const diasPeriodo = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
      
      // Filtrar recibos pagados en el rango de fechas
      const recibosPagadosEnPeriodo = [];
      expedientes.forEach(exp => {
        if (exp.recibos && Array.isArray(exp.recibos)) {
          exp.recibos.forEach(recibo => {
            if (recibo.estatus === 'Pagado' && recibo.fecha_pago_real) {
              const fechaPago = new Date(recibo.fecha_pago_real);
              if (fechaPago >= inicio && fechaPago <= fin) {
                // Usar prima_neta, si no subtotal, si no calcular desde total (total incluye IVA ~16%)
                let primaBase = parseFloat(exp.prima_neta) || parseFloat(exp.subtotal) || 0;
                if (primaBase === 0 && exp.total) {
                  // Aproximar prima neta desde total (quitar IVA aproximado)
                  primaBase = parseFloat(exp.total) / 1.16;
                }
                
                recibosPagadosEnPeriodo.push({
                  ...recibo,
                  expediente: exp,
                  prima_neta: primaBase,
                  producto: exp.producto, // "Autos Individual", "Vida", etc.
                  compania: exp.compania, // "Qualitas", "Chubb", etc.
                  agente: exp.agente,
                  sub_agente: exp.sub_agente
                });
              }
            }
          });
        }
      });
      
      // Calcular comisiones por empleado
      const comisionesPorEmpleado = {};
      const detalleComisionesPorEmpleado = {};
      
      recibosPagadosEnPeriodo.forEach(recibo => {
        // Obtener comisión desde la configuración de aseguradora + producto
        const porcentajeComision = obtenerComision(recibo.compania, recibo.producto);
        const primaBase = recibo.prima_neta;
        const comisionTotal = primaBase * (porcentajeComision / 100);
        
        // Extraer clave del agente (antes del " - ") y nombre (después del " - ")
        const claveAgente = recibo.agente ? recibo.agente.split(' - ')[0]?.trim() : null;
        const nombreAgente = recibo.agente ? recibo.agente.split(' - ')[1]?.trim().toLowerCase() : null;
        const nombreSubAgente = recibo.sub_agente ? recibo.sub_agente.trim().toLowerCase() : null;
        
        // Buscar el agente en el equipo de trabajo por nombre
        const agente = nombreAgente ? empleados.find(emp => {
          if (emp.perfil !== 'Agente') return false;
          const nombreCompleto = `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim().toLowerCase();
          return nombreCompleto === nombreAgente || nombreAgente.includes(nombreCompleto) || nombreCompleto.includes(nombreAgente);
        }) : null;
        
        // Buscar vendedor por nombre
        const vendedor = nombreSubAgente ? empleados.find(emp => {
          const nombreCompleto = `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim().toLowerCase();
          return nombreCompleto.includes(nombreSubAgente) || nombreSubAgente.includes(nombreCompleto.split(' ').slice(0, 2).join(' '));
        }) : null;
        
        if (vendedor && agente) {
          // Buscar la configuración de comisión del vendedor para esta clave
          let porcentajeVendedor = 0; // Default: el vendedor no recibe comisión si no está configurado
          
          if (vendedor.comisionesCompartidas && Array.isArray(vendedor.comisionesCompartidas)) {
            // Buscar la configuración que coincida con la clave del agente
            const configComision = vendedor.comisionesCompartidas.find(cc => cc.clave === claveAgente);
            if (configComision) {
              porcentajeVendedor = parseFloat(configComision.porcentajeVendedor) || 0;
            }
          }
          
          // Comisión compartida: dividir entre agente y vendedor según configuración
          const comisionVendedor = comisionTotal * (porcentajeVendedor / 100);
          const comisionAgente = comisionTotal - comisionVendedor;
          
          // Nombre completo del agente para mostrar
          const nombreAgenteCompleto = `${agente.nombre || ''} ${agente.apellidoPaterno || ''}`.trim();
          const nombreVendedorCompleto = `${vendedor.nombre || ''} ${vendedor.apellidoPaterno || ''}`.trim();
          
          // Datos comunes de la comisión compartida
          const datosCompartidos = {
            expediente_id: recibo.expediente.id,
            recibo_id: recibo.id,
            poliza: recibo.expediente.numero_poliza,
            compania: recibo.compania,
            clave: claveAgente,
            producto: recibo.producto,
            prima: primaBase,
            comisionTotal: comisionTotal,
            porcentajeProducto: porcentajeComision,
            tipo: 'Compartida',
            // Datos del agente
            nombreAgente: nombreAgenteCompleto,
            porcentajeAgente: 100 - porcentajeVendedor,
            comisionAgente: comisionAgente,
            // Datos del vendedor
            nombreVendedor: nombreVendedorCompleto,
            porcentajeVendedor: porcentajeVendedor,
            comisionVendedor: comisionVendedor
          };
          
          // Asignar al vendedor
          if (!comisionesPorEmpleado[vendedor.id]) {
            comisionesPorEmpleado[vendedor.id] = 0;
            detalleComisionesPorEmpleado[vendedor.id] = [];
          }
          comisionesPorEmpleado[vendedor.id] += comisionVendedor;
          detalleComisionesPorEmpleado[vendedor.id].push({
            ...datosCompartidos,
            comision: comisionVendedor
          });
          
          // Asignar al agente
          if (!comisionesPorEmpleado[agente.id]) {
            comisionesPorEmpleado[agente.id] = 0;
            detalleComisionesPorEmpleado[agente.id] = [];
          }
          comisionesPorEmpleado[agente.id] += comisionAgente;
          detalleComisionesPorEmpleado[agente.id].push({
            ...datosCompartidos,
            comision: comisionAgente
          });
        } else if (agente) {
          // Sin vendedor, toda la comisión para el agente
          const nombreAgenteCompleto = `${agente.nombre || ''} ${agente.apellidoPaterno || ''}`.trim();
          
          if (!comisionesPorEmpleado[agente.id]) {
            comisionesPorEmpleado[agente.id] = 0;
            detalleComisionesPorEmpleado[agente.id] = [];
          }
          comisionesPorEmpleado[agente.id] += comisionTotal;
          detalleComisionesPorEmpleado[agente.id].push({
            expediente_id: recibo.expediente.id,
            recibo_id: recibo.id,
            poliza: recibo.expediente.numero_poliza,
            compania: recibo.compania,
            clave: claveAgente,
            producto: recibo.producto,
            prima: primaBase,
            comision: comisionTotal,
            comisionTotal: comisionTotal,
            porcentajeProducto: porcentajeComision,
            tipo: 'Directa',
            nombreAgente: nombreAgenteCompleto,
            porcentajeAgente: 100,
            comisionAgente: comisionTotal
          });
        }
      });
      
      // Filtrar solo empleados activos
      const empleadosActivos = empleados.filter(emp => emp.activo !== false);
      
      // Generar nómina con datos reales
      const nominaReal = empleadosActivos.map(emp => {
        const sueldoDiario = parseFloat(emp.sueldoDiario) || 0;
        const sueldo = sueldoDiario * diasPeriodo;
        
        // Comisiones reales calculadas
        const comisiones = comisionesPorEmpleado[emp.id] || 0;
        const detalleComisiones = detalleComisionesPorEmpleado[emp.id] || [];
        
        // Obtener saldo de préstamo del empleado
        const saldoPrestamo = prestamosEmpleados[emp.id] || 0;
        
        const subtotal = Math.round((sueldo + comisiones) * 100) / 100;
        
        return {
          empleado_id: emp.id,
          nombre: `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim(),
          perfil: emp.perfil || 'Empleado',
          esquemaCompensacion: emp.esquemaCompensacion || 'mixto',
          sueldo: Math.round(sueldo * 100) / 100,
          comisiones: Math.round(comisiones * 100) / 100,
          detalleComisiones: detalleComisiones,
          subtotal: subtotal,
          descuentos: 0,
          motivo_descuento: '',
          saldo_prestamo: saldoPrestamo,
          prestamo_nuevo: 0,
          cobro_prestamo: 0,
          total_pagar: subtotal
        };
      });
      
      setDatosNomina(nominaReal);
      setNominaGenerada(true);
      
      const polizasEncontradas = recibosPagadosEnPeriodo.length;
      toast.success(`Nómina generada: ${nominaReal.length} empleados, ${polizasEncontradas} pólizas pagadas en el período.`);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar la nómina: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Actualizar un campo de la nómina
  const actualizarCampoNomina = (index, campo, valor) => {
    setDatosNomina(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      
      // Recalcular total a pagar
      const item = nuevos[index];
      item.subtotal = (item.sueldo || 0) + (item.comisiones || 0);
      item.total_pagar = item.subtotal - (item.descuentos || 0) - (item.cobro_prestamo || 0);
      
      return nuevos;
    });
  };
  
  // Abrir modal de detalle con datos editables
  const abrirDetalleEmpleado = (item) => {
    setEmpleadoDetalle(item);
    // Clonar el detalle para edición
    // Los porcentajes de Agente y Vendedor son sobre el 100% de la comisión (no sobre la prima)
    setDetalleEditado(item.detalleComisiones?.map(det => {
      const comisionBase = det.porcentajeProducto || 0;
      
      // porcentajeAgente y porcentajeVendedor ya vienen como % sobre la comisión (ej: 70 y 30)
      let pctAgente = det.porcentajeAgente || 100;
      let pctVendedor = det.porcentajeVendedor || 0;
      
      // Si es directa (sin vendedor), agente es 100%
      if (det.tipo === 'Directa') {
        pctAgente = 100;
        pctVendedor = 0;
      }
      
      return {
        ...det,
        comisionBaseEdit: comisionBase,
        porcentajeAgenteEdit: pctAgente, // Sobre 100% de la comisión
        porcentajeVendedorEdit: pctVendedor // Sobre 100% de la comisión
      };
    }) || []);
  };
  
  // Actualizar comisión en el detalle editado
  const actualizarComisionDetalle = (index, campo, valor) => {
    setDetalleEditado(prev => {
      const nuevos = [...prev];
      const item = { ...nuevos[index] };
      const valorNum = parseFloat(valor) || 0;
      
      if (campo === 'comisionBaseEdit') {
        // Si cambia la comisión base, mantener el reparto actual
        item.comisionBaseEdit = Math.max(0, Math.min(100, valorNum));
      } else if (campo === 'porcentajeAgenteEdit') {
        // Si cambia agente, vendedor = 100 - agente
        item.porcentajeAgenteEdit = Math.max(0, Math.min(100, valorNum));
        item.porcentajeVendedorEdit = 100 - item.porcentajeAgenteEdit;
      } else if (campo === 'porcentajeVendedorEdit') {
        // Si cambia vendedor, agente = 100 - vendedor
        item.porcentajeVendedorEdit = Math.max(0, Math.min(100, valorNum));
        item.porcentajeAgenteEdit = 100 - item.porcentajeVendedorEdit;
      }
      
      // Recalcular montos basados en el reparto
      const comisionTotal = item.prima * (item.comisionBaseEdit / 100);
      item.comisionTotal = comisionTotal;
      item.comisionAgente = comisionTotal * (item.porcentajeAgenteEdit / 100);
      item.comisionVendedor = comisionTotal * (item.porcentajeVendedorEdit / 100);
      
      // Guardar porcentajes reales (sobre prima) para el cálculo final
      item.porcentajeProducto = item.comisionBaseEdit;
      item.porcentajeAgente = item.comisionBaseEdit * (item.porcentajeAgenteEdit / 100);
      item.porcentajeVendedor = item.comisionBaseEdit * (item.porcentajeVendedorEdit / 100);
      
      nuevos[index] = item;
      return nuevos;
    });
  };
  
  // Aplicar cambios del modal al empleado
  const aplicarCambiosDetalle = () => {
    if (!empleadoDetalle) return;
    
    // Calcular nueva comisión total del empleado
    const esAgente = empleadoDetalle.perfil === 'Agente';
    const nuevaComision = detalleEditado.reduce((sum, det) => {
      return sum + (esAgente ? det.comisionAgente : det.comisionVendedor);
    }, 0);
    
    // Actualizar datosNomina
    setDatosNomina(prev => prev.map(emp => {
      if (emp.empleado_id === empleadoDetalle.empleado_id) {
        const nuevoSubtotal = emp.sueldo + nuevaComision;
        return {
          ...emp,
          comisiones: Math.round(nuevaComision * 100) / 100,
          detalleComisiones: detalleEditado,
          subtotal: Math.round(nuevoSubtotal * 100) / 100,
          total_pagar: Math.round((nuevoSubtotal - emp.descuentos - emp.cobro_prestamo) * 100) / 100
        };
      }
      return emp;
    }));
    
    toast.success('Comisiones actualizadas');
    setEmpleadoDetalle(null);
  };
  
  // Calcular totales
  const totales = useMemo(() => {
    if (!datosNomina.length) return { sueldos: 0, comisiones: 0, descuentos: 0, prestamos: 0, cobros: 0, neto: 0 };
    
    return {
      sueldos: datosNomina.reduce((sum, item) => sum + (item.sueldo || 0), 0),
      comisiones: datosNomina.reduce((sum, item) => sum + (item.comisiones || 0), 0),
      descuentos: datosNomina.reduce((sum, item) => sum + (item.descuentos || 0), 0),
      prestamos: datosNomina.reduce((sum, item) => sum + (item.prestamo_nuevo || 0), 0),
      cobros: datosNomina.reduce((sum, item) => sum + (item.cobro_prestamo || 0), 0),
      neto: datosNomina.reduce((sum, item) => sum + (item.total_pagar || 0), 0)
    };
  }, [datosNomina]);
  
  // Guardar nómina en BD (borrador)
  const guardarNomina = async () => {
    if (!datosNomina.length) {
      toast.error('No hay datos de nómina para guardar');
      return;
    }
    
    setLoading(true);
    try {
      // Preparar datos para el backend
      const nominaData = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo_periodo: 'Quincenal',
        detalles: datosNomina.map(emp => ({
          empleado_id: emp.empleado_id,
          sueldo: emp.sueldo,
          comisiones: emp.comisiones,
          descuentos: emp.descuentos,
          motivo_descuento: emp.motivo_descuento,
          prestamo_nuevo: emp.prestamo_nuevo,
          cobro_prestamo: emp.cobro_prestamo,
          // Incluir detalle de comisiones para registrar en comisiones_pagadas
          detalle_comisiones: emp.detalleComisiones?.map(det => ({
            expediente_id: det.expediente_id,
            recibo_id: det.recibo_id,
            monto_comision: det.comision,
            porcentaje_aplicado: det.porcentajeProducto,
            es_comision_compartida: det.tipo === 'Compartida'
          })) || []
        }))
      };
      
      const response = await fetch(`${API_URL}/api/nominas/generar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        },
        body: JSON.stringify(nominaData)
      });
      
      if (response.ok) {
        const result = await response.json();
        setNominaId(result.id);
        setNominaGuardada(true);
        toast.success(`Nómina guardada con código: ${result.codigo}`);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar la nómina');
      }
    } catch (error) {
      console.error('Error al guardar nómina:', error);
      toast.error(error.message || 'Error al guardar la nómina');
    } finally {
      setLoading(false);
    }
  };
  
  // Actualizar nómina en BD (editar descuentos, préstamos)
  const actualizarNominaEnBD = async () => {
    if (!nominaId) {
      toast.error('Primero debes guardar la nómina');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/nominas/${nominaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        },
        body: JSON.stringify({
          detalles: datosNomina.map(emp => ({
            empleado_id: emp.empleado_id,
            descuentos: emp.descuentos,
            motivo_descuento: emp.motivo_descuento,
            prestamo_nuevo: emp.prestamo_nuevo,
            cobro_prestamo: emp.cobro_prestamo
          }))
        })
      });
      
      if (response.ok) {
        toast.success('Nómina actualizada');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error al actualizar nómina:', error);
      toast.error(error.message || 'Error al actualizar la nómina');
    } finally {
      setLoading(false);
    }
  };
  
  // Cerrar nómina (ya no se puede editar, registra comisiones como pagadas)
  const cerrarNomina = async () => {
    if (!confirm('¿Estás seguro de cerrar esta nómina? Una vez cerrada no podrás editarla.')) return;
    
    // Si no está guardada en BD, primero guardarla
    if (!nominaGuardada) {
      await guardarNomina();
      if (!nominaId) return; // Si falló el guardado, no continuar
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/nominas/${nominaId}/cerrar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        toast.success('Nómina cerrada exitosamente. Las comisiones han sido registradas.');
        setNominaGenerada(false);
        setDatosNomina([]);
        setNominaId(null);
        setNominaGuardada(false);
        cargarHistorialNominas();
        cargarPrestamosEmpleados(); // Recargar saldos de préstamos
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al cerrar la nómina');
      }
    } catch (error) {
      console.error('Error al cerrar nómina:', error);
      // Si el endpoint no existe aún, simular éxito para desarrollo
      if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
        toast.success('Nómina cerrada exitosamente (modo desarrollo)');
        setNominaGenerada(false);
        setDatosNomina([]);
        setNominaId(null);
        setNominaGuardada(false);
      } else {
        toast.error(error.message || 'Error al cerrar la nómina');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Marcar nómina como pagada
  const marcarComoPagada = async (idNomina) => {
    if (!confirm('¿Confirmas que esta nómina ya fue pagada/depositada?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/nominas/${idNomina}/pagar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        toast.success('Nómina marcada como pagada');
        cargarHistorialNominas();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al marcar como pagada');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al marcar como pagada');
    }
  };
  
  // Cancelar generación de nómina
  const cancelarNomina = () => {
    if (nominaGuardada && !confirm('La nómina ya fue guardada en BD. ¿Deseas descartarla?')) return;
    setNominaGenerada(false);
    setDatosNomina([]);
    setNominaId(null);
    setNominaGuardada(false);
  };
  
  // ============== FUNCIONES DE PRÉSTAMOS ==============
  
  // Obtener nombre del empleado por ID
  const getNombreEmpleado = (empleadoId) => {
    const emp = empleados.find(e => e.id === empleadoId);
    if (!emp) return 'Desconocido';
    return `${emp.nombre || ''} ${emp.apellidoPaterno || ''}`.trim();
  };
  
  // Crear nuevo préstamo
  const crearPrestamo = async (datos) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/prestamos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        },
        body: JSON.stringify(datos)
      });
      
      if (response.ok) {
        toast.success('Préstamo registrado correctamente');
        cargarPrestamosEmpleados();
        setModalPrestamo(false);
        setPrestamoEditando(null);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear préstamo');
      }
    } catch (error) {
      console.error('Error:', error);
      // Modo desarrollo: simular éxito
      if (error.message.includes('Failed to fetch')) {
        const nuevoPrestamo = {
          id: Date.now(),
          ...datos,
          saldo_pendiente: datos.monto,
          fecha_prestamo: new Date().toISOString().split('T')[0],
          estatus: 'Activo',
          created_at: new Date().toISOString()
        };
        setListaPrestamos(prev => [...prev, nuevoPrestamo]);
        // Actualizar saldos
        setPrestamosEmpleados(prev => ({
          ...prev,
          [datos.empleado_id]: (prev[datos.empleado_id] || 0) + parseFloat(datos.monto)
        }));
        toast.success('Préstamo registrado (modo desarrollo)');
        setModalPrestamo(false);
        setPrestamoEditando(null);
      } else {
        toast.error(error.message || 'Error al crear préstamo');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Liquidar préstamo manualmente
  const liquidarPrestamo = async (prestamoId) => {
    if (!confirm('¿Estás seguro de marcar este préstamo como liquidado?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/prestamos/${prestamoId}/liquidar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        toast.success('Préstamo liquidado');
        cargarPrestamosEmpleados();
      } else {
        throw new Error('Error al liquidar');
      }
    } catch (error) {
      // Modo desarrollo
      setListaPrestamos(prev => prev.map(p => 
        p.id === prestamoId ? { ...p, estatus: 'Liquidado', saldo_pendiente: 0 } : p
      ));
      toast.success('Préstamo liquidado (modo desarrollo)');
    }
  };
  
  // Filtrar préstamos según filtro activo
  const prestamosFiltrados = useMemo(() => {
    if (filtroPrestamos === 'todos') return listaPrestamos;
    return listaPrestamos.filter(p => p.estatus === filtroPrestamos);
  }, [listaPrestamos, filtroPrestamos]);
  
  // Calcular totales de préstamos
  const totalesPrestamos = useMemo(() => {
    const activos = listaPrestamos.filter(p => p.estatus === 'Activo');
    return {
      cantidadActivos: activos.length,
      montoTotal: activos.reduce((sum, p) => sum + parseFloat(p.monto_original || p.monto || 0), 0),
      saldoPendiente: activos.reduce((sum, p) => sum + parseFloat(p.saldo_pendiente || 0), 0)
    };
  }, [listaPrestamos]);
  
  const formatMoney = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="mb-0">
              <FileText className="me-2" size={32} />
              Reportes
            </h2>
          </div>
        </div>
      </div>
      
      {/* Tabs de reportes */}
      <div className="row mb-4">
        <div className="col-12">
          <ul className="nav nav-tabs">
            <li className="nav-item">
              <button
                className={`nav-link ${reporteActivo === 'nomina' ? 'active' : ''}`}
                onClick={() => setReporteActivo('nomina')}
              >
                <DollarSign size={18} className="me-2" />
                Nómina / Comisiones
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${reporteActivo === 'prestamos' ? 'active' : ''}`}
                onClick={() => setReporteActivo('prestamos')}
              >
                <Banknote size={18} className="me-2" />
                Préstamos
                {totalesPrestamos.cantidadActivos > 0 && (
                  <span className="badge bg-warning text-dark ms-2">{totalesPrestamos.cantidadActivos}</span>
                )}
              </button>
            </li>
            {/* Próximos reportes */}
            <li className="nav-item">
              <button
                className="nav-link disabled"
                disabled
              >
                <TrendingUp size={18} className="me-2" />
                Ventas (Próximamente)
              </button>
            </li>
            <li className="nav-item">
              <button
                className="nav-link disabled"
                disabled
              >
                <Users size={18} className="me-2" />
                Clientes (Próximamente)
              </button>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Contenido del reporte de nómina */}
      {reporteActivo === 'nomina' && (
        <>
          {/* Sub-navegación: Generar / Historial */}
          <div className="row mb-3">
            <div className="col-12">
              <div className="btn-group" role="group">
                <button
                  className={`btn ${vistaActual === 'generar' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setVistaActual('generar')}
                >
                  <Plus size={16} className="me-1" />
                  Generar Nómina
                </button>
                <button
                  className={`btn ${vistaActual === 'historial' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setVistaActual('historial')}
                >
                  <History size={16} className="me-1" />
                  Historial de Nóminas
                </button>
              </div>
            </div>
          </div>

          {/* Vista: Generar Nómina */}
          {vistaActual === 'generar' && (
            <>
              {/* Filtros */}
              <div className="card mb-4">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">
                    <Calendar size={20} className="me-2" />
                    Período de Nómina
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3 align-items-end">
                    <div className="col-md-3">
                      <label className="form-label">Fecha Inicio</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        disabled={nominaGenerada}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Fecha Fin</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        disabled={nominaGenerada}
                      />
                    </div>
                    <div className="col-md-3">
                      {!nominaGenerada ? (
                        <button
                          className="btn btn-primary w-100"
                          onClick={generarNomina}
                          disabled={loading || loadingEmpleados}
                        >
                          {loading || loadingEmpleados ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              {loadingEmpleados ? 'Cargando empleados...' : 'Generando...'}
                            </>
                          ) : (
                            <>
                              <FileText size={18} className="me-2" />
                              Generar Nómina ({empleados.length})
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          className="btn btn-outline-secondary w-100"
                          onClick={cancelarNomina}
                          disabled={loading}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                    {nominaGenerada && (
                      <div className="col-md-3">
                        <div className="btn-group w-100">
                          {!nominaGuardada && (
                            <button
                              className="btn btn-info"
                              onClick={guardarNomina}
                              disabled={loading}
                              title="Guardar como borrador en BD"
                            >
                              {loading ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                <>
                                  <Wallet size={16} className="me-1" />
                                  Guardar
                                </>
                              )}
                            </button>
                          )}
                          <button
                            className="btn btn-success"
                            onClick={cerrarNomina}
                            disabled={loading}
                            title="Cerrar nómina y registrar comisiones"
                          >
                            {loading ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <>
                                <Lock size={16} className="me-1" />
                                Cerrar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Tarjetas de resumen */}
              {nominaGenerada && datosNomina.length > 0 && (
                <div className="row mb-4">
                  <div className="col-md-2">
                    <div className="card bg-info text-white">
                      <div className="card-body py-2">
                        <small className="text-white-50">Sueldos</small>
                        <h5 className="mb-0">{formatMoney(totales.sueldos)}</h5>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="card bg-success text-white">
                      <div className="card-body py-2">
                        <small className="text-white-50">Comisiones</small>
                        <h5 className="mb-0">{formatMoney(totales.comisiones)}</h5>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="card bg-danger text-white">
                      <div className="card-body py-2">
                        <small className="text-white-50">Descuentos</small>
                        <h5 className="mb-0">{formatMoney(totales.descuentos)}</h5>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="card bg-warning text-dark">
                      <div className="card-body py-2">
                        <small className="text-dark-50">Préstamos</small>
                        <h5 className="mb-0">{formatMoney(totales.prestamos)}</h5>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="card bg-secondary text-white">
                      <div className="card-body py-2">
                        <small className="text-white-50">Cobros Prést.</small>
                        <h5 className="mb-0">{formatMoney(totales.cobros)}</h5>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="card bg-primary text-white">
                      <div className="card-body py-2">
                        <small className="text-white-50">Total a Pagar</small>
                        <h5 className="mb-0">{formatMoney(totales.neto)}</h5>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Tabla de nómina */}
              <div className="card">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    {nominaGenerada ? 'Detalle de Nómina' : 'Resultados'}
                  </h5>
                  {nominaGenerada && datosNomina.length > 0 && (
                    <button className="btn btn-sm btn-success" onClick={() => toast.info('Exportación en desarrollo')}>
                      <Download size={16} className="me-2" />
                      Exportar Excel
                    </button>
                  )}
                </div>
                <div className="card-body p-0">
                  {!nominaGenerada ? (
                    <div className="text-center py-5 text-muted">
                      <FileText size={48} className="mb-3" />
                      <p>Selecciona el período y da clic en "Generar Nómina"</p>
                    </div>
                  ) : datosNomina.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <AlertCircle size={48} className="mb-3" />
                      <p>No hay empleados activos para generar nómina</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-striped table-hover table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                        <thead className="table-dark">
                          <tr>
                            <th style={{ minWidth: '200px' }}>Empleado</th>
                            <th className="text-center" style={{ width: '80px' }}>Perfil</th>
                            <th className="text-end" style={{ width: '100px' }}>Sueldo</th>
                            <th className="text-end" style={{ width: '100px' }}>Comisiones</th>
                            <th className="text-end" style={{ width: '100px' }}>Subtotal</th>
                            <th className="text-center" style={{ width: '100px' }}>Descuentos</th>
                            <th className="text-end" style={{ width: '90px' }}>Saldo Prést.</th>
                            <th className="text-center" style={{ width: '90px' }}>Prestar (+)</th>
                            <th className="text-center" style={{ width: '90px' }}>Cobrar (-)</th>
                            <th className="text-end" style={{ width: '100px' }}>Por Pagar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {datosNomina.map((item, index) => (
                            <tr key={item.empleado_id}>
                              <td>
                                <div className="d-flex justify-content-between align-items-center">
                                  <div>
                                    <strong>{item.nombre}</strong>
                                  </div>
                                  {item.detalleComisiones?.length > 0 && (
                                    <button
                                      className="btn btn-sm btn-outline-success py-0 px-1"
                                      onClick={() => abrirDetalleEmpleado(item)}
                                      title="Ver/Editar detalle de comisiones"
                                    >
                                      <Eye size={14} className="me-1" />
                                      {item.detalleComisiones.length}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${
                                  item.perfil === 'Agente' ? 'bg-success' :
                                  item.perfil === 'Vendedor' ? 'bg-info' :
                                  item.perfil === 'Ejecutivo' ? 'bg-warning' :
                                  item.perfil === 'Administrador' ? 'bg-danger' : 'bg-secondary'
                                }`}>
                                  {item.perfil}
                                </span>
                              </td>
                              <td className="text-end">{formatMoney(item.sueldo)}</td>
                              <td className="text-end text-success fw-bold">{formatMoney(item.comisiones)}</td>
                              <td className="text-end fw-bold">{formatMoney(item.subtotal)}</td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-end"
                                  value={item.descuentos || ''}
                                  onChange={(e) => actualizarCampoNomina(index, 'descuentos', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                />
                              </td>
                              <td className="text-end">
                                {item.saldo_prestamo > 0 ? (
                                  <span className="text-danger">{formatMoney(item.saldo_prestamo)}</span>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-end"
                                  value={item.prestamo_nuevo || ''}
                                  onChange={(e) => actualizarCampoNomina(index, 'prestamo_nuevo', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm text-end"
                                  value={item.cobro_prestamo || ''}
                                  onChange={(e) => actualizarCampoNomina(index, 'cobro_prestamo', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  min="0"
                                  max={item.saldo_prestamo || 999999}
                                  step="0.01"
                                />
                              </td>
                              <td className="text-end fw-bold text-primary" style={{ fontSize: '1rem' }}>
                                {formatMoney(item.total_pagar)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <th colSpan="2" className="text-end">TOTALES:</th>
                            <th className="text-end">{formatMoney(totales.sueldos)}</th>
                            <th className="text-end text-success">{formatMoney(totales.comisiones)}</th>
                            <th className="text-end">{formatMoney(totales.sueldos + totales.comisiones)}</th>
                            <th className="text-end text-danger">{formatMoney(totales.descuentos)}</th>
                            <th></th>
                            <th className="text-end text-warning">{formatMoney(totales.prestamos)}</th>
                            <th className="text-end">{formatMoney(totales.cobros)}</th>
                            <th className="text-end text-primary" style={{ fontSize: '1.1rem' }}>{formatMoney(totales.neto)}</th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Vista: Historial de Nóminas */}
          {vistaActual === 'historial' && (
            <div className="card">
              <div className="card-header bg-light">
                <h5 className="mb-0">
                  <History size={20} className="me-2" />
                  Historial de Nóminas Generadas
                </h5>
              </div>
              <div className="card-body">
                {historialNominas.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <History size={48} className="mb-3" />
                    <p>No hay nóminas generadas aún</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-dark">
                        <tr>
                          <th>Código</th>
                          <th>Período</th>
                          <th className="text-end">Total Sueldos</th>
                          <th className="text-end">Total Comisiones</th>
                          <th className="text-end">Total Neto</th>
                          <th className="text-center">Estatus</th>
                          <th className="text-center">Fecha Generación</th>
                          <th className="text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialNominas.map((nomina) => (
                          <tr key={nomina.id}>
                            <td><strong>{nomina.codigo}</strong></td>
                            <td>
                              {new Date(nomina.fecha_inicio).toLocaleDateString('es-MX')} - {new Date(nomina.fecha_fin).toLocaleDateString('es-MX')}
                            </td>
                            <td className="text-end">{formatMoney(nomina.total_sueldos)}</td>
                            <td className="text-end text-success">{formatMoney(nomina.total_comisiones)}</td>
                            <td className="text-end fw-bold">{formatMoney(nomina.total_neto)}</td>
                            <td className="text-center">
                              <span className={`badge ${
                                nomina.estatus === 'Pagada' ? 'bg-success' :
                                nomina.estatus === 'Cerrada' ? 'bg-warning' : 'bg-secondary'
                              }`}>
                                {nomina.estatus}
                              </span>
                            </td>
                            <td className="text-center">
                              {new Date(nomina.created_at).toLocaleDateString('es-MX')}
                            </td>
                            <td className="text-center">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => { setNominaSeleccionada(nomina); setVistaActual('detalle'); }}
                                  title="Ver detalle"
                                >
                                  <Eye size={14} />
                                </button>
                                {nomina.estatus === 'Cerrada' && (
                                  <button
                                    className="btn btn-success"
                                    onClick={() => marcarComoPagada(nomina.id)}
                                    title="Marcar como pagada"
                                  >
                                    <Check size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* ======================== CONTENIDO DE PRÉSTAMOS ======================== */}
      {reporteActivo === 'prestamos' && (
        <>
          {/* Tarjetas de resumen */}
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card bg-warning text-dark">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-dark">Préstamos Activos</small>
                      <h3 className="mb-0">{totalesPrestamos.cantidadActivos}</h3>
                    </div>
                    <Banknote size={40} className="opacity-50" />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card bg-info text-white">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-white-50">Monto Total Prestado</small>
                      <h3 className="mb-0">{formatMoney(totalesPrestamos.montoTotal)}</h3>
                    </div>
                    <PlusCircle size={40} className="opacity-50" />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card bg-danger text-white">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-white-50">Saldo Pendiente Total</small>
                      <h3 className="mb-0">{formatMoney(totalesPrestamos.saldoPendiente)}</h3>
                    </div>
                    <MinusCircle size={40} className="opacity-50" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de acciones */}
          <div className="card mb-4">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="btn-group" role="group">
                  <button
                    className={`btn btn-sm ${filtroPrestamos === 'Activo' ? 'btn-warning' : 'btn-outline-warning'}`}
                    onClick={() => setFiltroPrestamos('Activo')}
                  >
                    Activos
                  </button>
                  <button
                    className={`btn btn-sm ${filtroPrestamos === 'Liquidado' ? 'btn-success' : 'btn-outline-success'}`}
                    onClick={() => setFiltroPrestamos('Liquidado')}
                  >
                    Liquidados
                  </button>
                  <button
                    className={`btn btn-sm ${filtroPrestamos === 'todos' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                    onClick={() => setFiltroPrestamos('todos')}
                  >
                    Todos
                  </button>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => { setPrestamoEditando(null); setModalPrestamo(true); }}
                >
                  <Plus size={18} className="me-1" />
                  Nuevo Préstamo
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de préstamos */}
          <div className="card">
            <div className="card-header bg-light">
              <h5 className="mb-0">
                <Banknote size={20} className="me-2" />
                Lista de Préstamos ({prestamosFiltrados.length})
              </h5>
            </div>
            <div className="card-body p-0">
              {prestamosFiltrados.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <Banknote size={48} className="mb-3" />
                  <p>No hay préstamos {filtroPrestamos !== 'todos' ? filtroPrestamos.toLowerCase() + 's' : ''} registrados</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-dark">
                      <tr>
                        <th style={{ minWidth: '180px' }}>Empleado</th>
                        <th className="text-center" style={{ width: '120px' }}>Fecha</th>
                        <th className="text-end" style={{ width: '120px' }}>Monto Original</th>
                        <th className="text-end" style={{ width: '120px' }}>Saldo Pendiente</th>
                        <th style={{ minWidth: '150px' }}>Motivo</th>
                        <th className="text-center" style={{ width: '100px' }}>Cuota/Quincena</th>
                        <th className="text-center" style={{ width: '100px' }}>Estatus</th>
                        <th className="text-center" style={{ width: '120px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prestamosFiltrados.map((prestamo) => (
                        <tr key={prestamo.id}>
                          <td>
                            <strong>{getNombreEmpleado(prestamo.empleado_id)}</strong>
                          </td>
                          <td className="text-center">
                            {prestamo.fecha_prestamo ? new Date(prestamo.fecha_prestamo).toLocaleDateString('es-MX') : '-'}
                          </td>
                          <td className="text-end">{formatMoney(prestamo.monto_original || prestamo.monto)}</td>
                          <td className="text-end">
                            {prestamo.estatus === 'Activo' ? (
                              <span className="text-danger fw-bold">{formatMoney(prestamo.saldo_pendiente)}</span>
                            ) : (
                              <span className="text-success">{formatMoney(0)}</span>
                            )}
                          </td>
                          <td>
                            <small>{prestamo.motivo || prestamo.descripcion || '-'}</small>
                          </td>
                          <td className="text-center">
                            {prestamo.cuota_quincenal ? formatMoney(prestamo.cuota_quincenal) : '-'}
                          </td>
                          <td className="text-center">
                            <span className={`badge ${prestamo.estatus === 'Activo' ? 'bg-warning text-dark' : 'bg-success'}`}>
                              {prestamo.estatus}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="btn-group btn-group-sm">
                              {prestamo.estatus === 'Activo' && (
                                <>
                                  <button
                                    className="btn btn-outline-primary"
                                    onClick={() => { setPrestamoEditando(prestamo); setModalPrestamo(true); }}
                                    title="Editar préstamo"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    className="btn btn-success"
                                    onClick={() => liquidarPrestamo(prestamo.id)}
                                    title="Liquidar préstamo"
                                  >
                                    <Check size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <th colSpan="2" className="text-end">TOTALES:</th>
                        <th className="text-end">
                          {formatMoney(prestamosFiltrados.reduce((s, p) => s + parseFloat(p.monto_original || p.monto || 0), 0))}
                        </th>
                        <th className="text-end text-danger">
                          {formatMoney(prestamosFiltrados.reduce((s, p) => s + parseFloat(p.saldo_pendiente || 0), 0))}
                        </th>
                        <th colSpan="4"></th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal para crear/editar préstamo */}
      {modalPrestamo && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalPrestamo(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <Banknote size={20} className="me-2" />
                  {prestamoEditando ? 'Editar Préstamo' : 'Nuevo Préstamo'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setModalPrestamo(false)}></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                crearPrestamo({
                  empleado_id: formData.get('empleado_id'),
                  monto: parseFloat(formData.get('monto')),
                  cuota_quincenal: parseFloat(formData.get('cuota_quincenal')) || 0,
                  motivo: formData.get('motivo'),
                  fecha_prestamo: formData.get('fecha_prestamo') || new Date().toISOString().split('T')[0]
                });
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Empleado <span className="text-danger">*</span></label>
                    <select
                      name="empleado_id"
                      className="form-select"
                      defaultValue={prestamoEditando?.empleado_id || ''}
                      required
                    >
                      <option value="">Seleccionar empleado...</option>
                      {empleados.filter(e => e.activo !== false).map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {`${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim()} - {emp.perfil}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Monto del Préstamo <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          name="monto"
                          className="form-control"
                          defaultValue={prestamoEditando?.monto || ''}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Cuota por Quincena</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          name="cuota_quincenal"
                          className="form-control"
                          defaultValue={prestamoEditando?.cuota_quincenal || ''}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Fecha del Préstamo</label>
                    <input
                      type="date"
                      name="fecha_prestamo"
                      className="form-control"
                      defaultValue={prestamoEditando?.fecha_prestamo || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Motivo / Descripción</label>
                    <textarea
                      name="motivo"
                      className="form-control"
                      rows="2"
                      defaultValue={prestamoEditando?.motivo || prestamoEditando?.descripcion || ''}
                      placeholder="Motivo del préstamo..."
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalPrestamo(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? (
                      <span className="spinner-border spinner-border-sm me-1" />
                    ) : (
                      <Check size={16} className="me-1" />
                    )}
                    {prestamoEditando ? 'Actualizar' : 'Registrar'} Préstamo
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Comisiones del Empleado */}
      {empleadoDetalle && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setEmpleadoDetalle(null)}>
          <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <DollarSign size={20} className="me-2" />
                  Detalle de Comisiones - {empleadoDetalle.nombre}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEmpleadoDetalle(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-4">
                    <div className="card bg-light">
                      <div className="card-body py-2 text-center">
                        <small className="text-muted">Perfil</small>
                        <h6 className="mb-0">{empleadoDetalle.perfil}</h6>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-light">
                      <div className="card-body py-2 text-center">
                        <small className="text-muted">Pólizas</small>
                        <h6 className="mb-0">{empleadoDetalle.detalleComisiones?.length || 0}</h6>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-success text-white">
                      <div className="card-body py-2 text-center">
                        <small className="text-white-50">Total Comisiones</small>
                        <h6 className="mb-0">{formatMoney(empleadoDetalle.comisiones)}</h6>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="mb-2" style={{fontSize: '0.8rem'}}>Pólizas que generan comisión <small className="text-muted">(editables)</small>:</p>
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0 text-center" style={{fontSize: '0.7rem'}}>
                    <thead className="table-dark">
                      <tr>
                        <th style={{fontSize: '0.65rem'}}>Aseg / Póliza</th>
                        <th style={{fontSize: '0.65rem'}}>Producto</th>
                        <th style={{fontSize: '0.65rem'}}>Vendedor</th>
                        <th style={{fontSize: '0.65rem'}}>Prima</th>
                        <th style={{fontSize: '0.65rem'}}>%Com</th>
                        <th style={{fontSize: '0.65rem', backgroundColor: '#198754'}}>%Ag</th>
                        <th style={{fontSize: '0.65rem', backgroundColor: '#198754'}}>$Agente</th>
                        <th style={{fontSize: '0.65rem', backgroundColor: '#0dcaf0'}}>%Ve</th>
                        <th style={{fontSize: '0.65rem', backgroundColor: '#0dcaf0'}}>$Vendedor</th>
                        <th style={{fontSize: '0.65rem'}}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleEditado.map((det, idx) => (
                        <tr key={idx}>
                          <td className="text-start" style={{padding: '4px'}}>
                            <small className="text-muted d-block" style={{fontSize: '0.6rem'}}>{det.compania}</small>
                            <strong style={{fontSize: '0.65rem'}}>{det.poliza}</strong>
                          </td>
                          <td style={{padding: '4px'}}>
                            <span className="badge bg-primary" style={{fontSize: '0.6rem'}}>{det.producto}</span>
                            <small className="text-muted d-block" style={{fontSize: '0.55rem'}}>{det.clave}</small>
                          </td>
                          <td style={{padding: '4px', fontSize: '0.65rem'}}>
                            {det.nombreVendedor || '-'}
                          </td>
                          <td style={{fontSize: '0.65rem', padding: '4px'}}>{formatMoney(det.prima)}</td>
                          <td style={{padding: '4px'}}>
                            <input
                              type="number"
                              className="form-control form-control-sm text-center"
                              style={{fontSize: '0.7rem'}}
                              value={det.comisionBaseEdit || 0}
                              onChange={(e) => actualizarComisionDetalle(idx, 'comisionBaseEdit', e.target.value)}
                              min="0"
                              max="100"
                            />
                          </td>
                          <td style={{padding: '4px'}}>
                            <input
                              type="number"
                              className="form-control form-control-sm text-center"
                              style={{fontSize: '0.7rem'}}
                              value={det.porcentajeAgenteEdit || 0}
                              onChange={(e) => actualizarComisionDetalle(idx, 'porcentajeAgenteEdit', e.target.value)}
                              min="0"
                              max="100"
                            />
                          </td>
                          <td className="text-success" style={{fontSize: '0.65rem', padding: '4px', verticalAlign: 'middle'}}>
                            <strong>{formatMoney(det.comisionAgente || 0)}</strong>
                          </td>
                          <td style={{padding: '4px'}}>
                            <input
                              type="number"
                              className="form-control form-control-sm text-center"
                              style={{fontSize: '0.7rem'}}
                              value={det.porcentajeVendedorEdit || 0}
                              onChange={(e) => actualizarComisionDetalle(idx, 'porcentajeVendedorEdit', e.target.value)}
                              min="0"
                              max="100"
                              disabled={det.tipo === 'Directa'}
                            />
                          </td>
                          <td className="text-info" style={{fontSize: '0.65rem', padding: '4px', verticalAlign: 'middle'}}>
                            <strong>{det.tipo === 'Compartida' ? formatMoney(det.comisionVendedor || 0) : '-'}</strong>
                          </td>
                          <td style={{fontSize: '0.65rem', padding: '4px', verticalAlign: 'middle'}}>
                            <strong>{formatMoney(det.comisionTotal || det.comision || 0)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <th colSpan="6" className="text-end" style={{fontSize: '0.65rem'}}>TOTALES:</th>
                        <th className="text-success" style={{fontSize: '0.65rem'}}>
                          {formatMoney(detalleEditado.reduce((s, d) => s + (d.comisionAgente || 0), 0))}
                        </th>
                        <th></th>
                        <th className="text-info" style={{fontSize: '0.65rem'}}>
                          {formatMoney(detalleEditado.reduce((s, d) => s + (d.comisionVendedor || 0), 0))}
                        </th>
                        <th style={{fontSize: '0.65rem'}}>
                          {formatMoney(detalleEditado.reduce((s, d) => s + (d.comisionTotal || d.comision || 0), 0))}
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                <div className="alert alert-info mt-3 py-2" style={{fontSize: '0.85rem'}}>
                  <strong>Tip:</strong> % Agente + % Vendedor siempre suman 100% de la comisión. 
                  Si cambias uno, el otro se ajusta automáticamente.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEmpleadoDetalle(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-success" onClick={aplicarCambiosDetalle}>
                  <Check size={16} className="me-1" />
                  Aplicar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reportes;
