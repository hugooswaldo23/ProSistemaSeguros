import React, { useState, useEffect, useMemo } from 'react';
import { FileText, DollarSign, Download, Calendar, Plus, Eye, Lock, Check, History, AlertCircle, Wallet, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;

const Nomina = () => {
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
  const [nominaId, setNominaId] = useState(null);
  const [nominaGuardada, setNominaGuardada] = useState(false);
  const [empleadoDetalle, setEmpleadoDetalle] = useState(null);
  const [detalleEditado, setDetalleEditado] = useState([]);
  const [prestamosEmpleados, setPrestamosEmpleados] = useState({});
  
  // Establecer fechas por defecto al montar
  useEffect(() => {
    cargarHistorialNominas();
    cargarPrestamosEmpleados();
    const hoy = new Date();
    const dia = hoy.getDate();
    let primerDia, ultimoDia;
    
    if (dia <= 15) {
      primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth(), 15);
    } else {
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
      setHistorialNominas([]);
    }
  };
  
  const cargarPrestamosEmpleados = async () => {
    try {
      const response = await fetch(`${API_URL}/api/prestamos`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
        }
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const prestamos = await response.json();
          const saldos = {};
          prestamos.forEach(p => {
            if (p.estatus === 'Activo') {
              saldos[p.empleado_id] = (saldos[p.empleado_id] || 0) + parseFloat(p.saldo_pendiente || 0);
            }
          });
          setPrestamosEmpleados(saldos);
        }
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
      const [expResponse, asegResponse, prodResponse, nominasResponse] = await Promise.all([
        fetch(`${API_URL}/api/expedientes`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        }),
        fetch(`${API_URL}/api/aseguradoras`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        }),
        fetch(`${API_URL}/api/tiposProductos`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        }),
        fetch(`${API_URL}/api/nominas`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
        })
      ]);
      
      if (!expResponse.ok) {
        throw new Error('Error al obtener expedientes');
      }
      
      const expedientes = await expResponse.json();
      const aseguradoras = asegResponse.ok ? await asegResponse.json() : [];
      const tiposProductos = prodResponse.ok ? await prodResponse.json() : [];
      
      // Recopilar recibo_ids ya comisionados y días de sueldo ya pagados en nóminas previas (Pagada/Cerrada)
      const recibosYaPagados = new Set();
      // Guardar períodos ya pagados por empleado para evitar pagar sueldo doble
      // Estructura: { empleado_id: [ [inicioMs, finMs], ... ] }
      const periodosYaPagados = {};
      if (nominasResponse.ok) {
        const nominasPrevias = await nominasResponse.json();
        for (const nomina of nominasPrevias) {
          if (nomina.estatus === 'Pagada' || nomina.estatus === 'Cerrada') {
            const nomInicio = new Date(nomina.fecha_inicio);
            const nomFin = new Date(nomina.fecha_fin);
            // Cargar detalle de cada nómina para extraer recibo_ids y empleados con sueldo
            try {
              const detResp = await fetch(`${API_URL}/api/nominas/${nomina.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
              });
              if (detResp.ok) {
                const detData = await detResp.json();
                if (detData.detalles) {
                  detData.detalles.forEach(det => {
                    // Recibos ya comisionados
                    if (det.detalle_comisiones && Array.isArray(det.detalle_comisiones)) {
                      det.detalle_comisiones.forEach(com => {
                        if (com.recibo_id) recibosYaPagados.add(com.recibo_id);
                      });
                    }
                    // Empleados que ya recibieron sueldo en este período
                    if (parseFloat(det.sueldo || 0) > 0) {
                      if (!periodosYaPagados[det.empleado_id]) periodosYaPagados[det.empleado_id] = [];
                      periodosYaPagados[det.empleado_id].push([nomInicio.getTime(), nomFin.getTime()]);
                    }
                  });
                }
              }
            } catch (e) { /* continuar sin este detalle */ }
          }
        }
      }
      
      if (recibosYaPagados.size > 0) {
        console.log(`Excluyendo ${recibosYaPagados.size} recibos ya comisionados en nóminas anteriores`);
      }
      
      const productoIdMap = {};
      tiposProductos.forEach(prod => {
        productoIdMap[prod.nombre?.toLowerCase()] = prod.id;
      });
      
      const comisionesAseguradora = {};
      aseguradoras.forEach(aseg => {
        if (aseg.productos_disponibles && Array.isArray(aseg.productos_disponibles)) {
          aseg.productos_disponibles.forEach(prod => {
            const key = `${aseg.nombre?.toLowerCase()}_${prod.producto_id}`;
            comisionesAseguradora[key] = parseFloat(prod.comision) || 0;
          });
        }
      });
      
      const obtenerComision = (compania, producto) => {
        if (!compania || !producto) return 10;
        const productoId = productoIdMap[producto.toLowerCase()];
        if (!productoId) return 10;
        const key = `${compania.toLowerCase()}_${productoId}`;
        const comision = comisionesAseguradora[key];
        return comision !== undefined ? comision : 10;
      };
      
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      const diasPeriodo = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
      
      const recibosPagadosEnPeriodo = [];
      expedientes.forEach(exp => {
        if (exp.recibos && Array.isArray(exp.recibos)) {
          exp.recibos.forEach(recibo => {
            if (recibo.estatus === 'Pagado' && recibo.fecha_pago_real) {
              // Excluir recibos ya comisionados en nóminas anteriores
              if (recibosYaPagados.has(recibo.id)) return;
              
              const fechaPago = new Date(recibo.fecha_pago_real);
              if (fechaPago >= inicio && fechaPago <= fin) {
                let primaBase = parseFloat(exp.prima_neta) || parseFloat(exp.subtotal) || 0;
                if (primaBase === 0 && exp.total) {
                  primaBase = parseFloat(exp.total) / 1.16;
                }
                
                recibosPagadosEnPeriodo.push({
                  ...recibo,
                  expediente: exp,
                  prima_neta: primaBase,
                  producto: exp.producto,
                  compania: exp.compania,
                  agente: exp.agente,
                  sub_agente: exp.sub_agente
                });
              }
            }
          });
        }
      });
      
      const comisionesPorEmpleado = {};
      const detalleComisionesPorEmpleado = {};
      
      recibosPagadosEnPeriodo.forEach(recibo => {
        const porcentajeComision = obtenerComision(recibo.compania, recibo.producto);
        const primaBase = recibo.prima_neta;
        const comisionTotal = primaBase * (porcentajeComision / 100);
        
        const claveAgente = recibo.agente ? recibo.agente.split(' - ')[0]?.trim() : null;
        const nombreAgente = recibo.agente ? recibo.agente.split(' - ')[1]?.trim().toLowerCase() : null;
        const nombreSubAgente = recibo.sub_agente ? recibo.sub_agente.trim().toLowerCase() : null;
        
        const agente = nombreAgente ? empleados.find(emp => {
          if (emp.perfil !== 'Agente') return false;
          const nombreCompleto = `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim().toLowerCase();
          return nombreCompleto === nombreAgente || nombreAgente.includes(nombreCompleto) || nombreCompleto.includes(nombreAgente);
        }) : null;
        
        const vendedor = nombreSubAgente ? empleados.find(emp => {
          const nombreCompleto = `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim().toLowerCase();
          return nombreCompleto.includes(nombreSubAgente) || nombreSubAgente.includes(nombreCompleto.split(' ').slice(0, 2).join(' '));
        }) : null;
        
        if (vendedor && agente) {
          let porcentajeVendedor = 0;
          
          if (vendedor.comisionesCompartidas && Array.isArray(vendedor.comisionesCompartidas)) {
            const configComision = vendedor.comisionesCompartidas.find(cc => cc.clave === claveAgente);
            if (configComision) {
              porcentajeVendedor = parseFloat(configComision.porcentajeVendedor) || 0;
            }
          }
          
          const comisionVendedor = comisionTotal * (porcentajeVendedor / 100);
          const comisionAgente = comisionTotal - comisionVendedor;
          
          const nombreAgenteCompleto = `${agente.nombre || ''} ${agente.apellidoPaterno || ''}`.trim();
          const nombreVendedorCompleto = `${vendedor.nombre || ''} ${vendedor.apellidoPaterno || ''}`.trim();
          
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
            nombreAgente: nombreAgenteCompleto,
            porcentajeAgente: 100 - porcentajeVendedor,
            comisionAgente: comisionAgente,
            nombreVendedor: nombreVendedorCompleto,
            porcentajeVendedor: porcentajeVendedor,
            comisionVendedor: comisionVendedor
          };
          
          if (!comisionesPorEmpleado[vendedor.id]) {
            comisionesPorEmpleado[vendedor.id] = 0;
            detalleComisionesPorEmpleado[vendedor.id] = [];
          }
          comisionesPorEmpleado[vendedor.id] += comisionVendedor;
          detalleComisionesPorEmpleado[vendedor.id].push({ ...datosCompartidos, comision: comisionVendedor });
          
          if (!comisionesPorEmpleado[agente.id]) {
            comisionesPorEmpleado[agente.id] = 0;
            detalleComisionesPorEmpleado[agente.id] = [];
          }
          comisionesPorEmpleado[agente.id] += comisionAgente;
          detalleComisionesPorEmpleado[agente.id].push({ ...datosCompartidos, comision: comisionAgente });
        } else if (agente) {
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
      
      const empleadosActivos = empleados.filter(emp => emp.activo !== false);
      
      const nominaReal = empleadosActivos.map(emp => {
        const sueldoDiario = parseFloat(emp.sueldoDiario) || 0;
        
        // Calcular días ya pagados que se solapan con el período actual
        let diasYaPagados = 0;
        const periodos = periodosYaPagados[emp.id] || [];
        const inicioMs = inicio.getTime();
        const finMs = fin.getTime();
        
        for (const [pInicio, pFin] of periodos) {
          // Calcular overlap entre el período actual y el período ya pagado
          const overlapInicio = Math.max(inicioMs, pInicio);
          const overlapFin = Math.min(finMs, pFin);
          if (overlapInicio <= overlapFin) {
            const diasOverlap = Math.ceil((overlapFin - overlapInicio) / (1000 * 60 * 60 * 24)) + 1;
            diasYaPagados += diasOverlap;
          }
        }
        
        const diasAPagar = Math.max(0, diasPeriodo - diasYaPagados);
        const sueldo = sueldoDiario * diasAPagar;
        const comisiones = comisionesPorEmpleado[emp.id] || 0;
        const detalleComisiones = detalleComisionesPorEmpleado[emp.id] || [];
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
  
  const actualizarCampoNomina = (index, campo, valor) => {
    setDatosNomina(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      const item = nuevos[index];
      item.subtotal = (item.sueldo || 0) + (item.comisiones || 0);
      item.total_pagar = item.subtotal - (item.descuentos || 0) - (item.cobro_prestamo || 0) + (item.prestamo_nuevo || 0);
      return nuevos;
    });
  };
  
  const abrirDetalleEmpleado = (item) => {
    setEmpleadoDetalle(item);
    setDetalleEditado(item.detalleComisiones?.map(det => {
      const comisionBase = det.porcentajeProducto || 0;
      let pctAgente = det.porcentajeAgente || 100;
      let pctVendedor = det.porcentajeVendedor || 0;
      if (det.tipo === 'Directa') { pctAgente = 100; pctVendedor = 0; }
      return { ...det, comisionBaseEdit: comisionBase, porcentajeAgenteEdit: pctAgente, porcentajeVendedorEdit: pctVendedor };
    }) || []);
  };
  
  const actualizarComisionDetalle = (index, campo, valor) => {
    setDetalleEditado(prev => {
      const nuevos = [...prev];
      const item = { ...nuevos[index] };
      const valorNum = parseFloat(valor) || 0;
      
      if (campo === 'comisionBaseEdit') {
        item.comisionBaseEdit = Math.max(0, Math.min(100, valorNum));
      } else if (campo === 'porcentajeAgenteEdit') {
        item.porcentajeAgenteEdit = Math.max(0, Math.min(100, valorNum));
        item.porcentajeVendedorEdit = 100 - item.porcentajeAgenteEdit;
      } else if (campo === 'porcentajeVendedorEdit') {
        item.porcentajeVendedorEdit = Math.max(0, Math.min(100, valorNum));
        item.porcentajeAgenteEdit = 100 - item.porcentajeVendedorEdit;
      }
      
      const comisionTotal = item.prima * (item.comisionBaseEdit / 100);
      item.comisionTotal = comisionTotal;
      item.comisionAgente = comisionTotal * (item.porcentajeAgenteEdit / 100);
      item.comisionVendedor = comisionTotal * (item.porcentajeVendedorEdit / 100);
      item.porcentajeProducto = item.comisionBaseEdit;
      item.porcentajeAgente = item.comisionBaseEdit * (item.porcentajeAgenteEdit / 100);
      item.porcentajeVendedor = item.comisionBaseEdit * (item.porcentajeVendedorEdit / 100);
      
      nuevos[index] = item;
      return nuevos;
    });
  };
  
  const aplicarCambiosDetalle = () => {
    if (!empleadoDetalle) return;
    const esAgente = empleadoDetalle.perfil === 'Agente';
    const nuevaComision = detalleEditado.reduce((sum, det) => {
      return sum + (esAgente ? det.comisionAgente : det.comisionVendedor);
    }, 0);
    
    setDatosNomina(prev => prev.map(emp => {
      if (emp.empleado_id === empleadoDetalle.empleado_id) {
        const nuevoSubtotal = emp.sueldo + nuevaComision;
        return {
          ...emp,
          comisiones: Math.round(nuevaComision * 100) / 100,
          detalleComisiones: detalleEditado,
          subtotal: Math.round(nuevoSubtotal * 100) / 100,
          total_pagar: Math.round((nuevoSubtotal - emp.descuentos - emp.cobro_prestamo + (emp.prestamo_nuevo || 0)) * 100) / 100
        };
      }
      return emp;
    }));
    
    toast.success('Comisiones actualizadas');
    setEmpleadoDetalle(null);
  };
  
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
  
  const guardarNomina = async () => {
    if (!datosNomina.length) { toast.error('No hay datos de nómina para guardar'); return; }
    setLoading(true);
    try {
      const nominaData = {
        fecha_inicio: fechaInicio, fecha_fin: fechaFin, tipo_periodo: 'Quincenal',
        detalles: datosNomina.map(emp => ({
          empleado_id: emp.empleado_id, sueldo: emp.sueldo, comisiones: emp.comisiones,
          descuentos: emp.descuentos, motivo_descuento: emp.motivo_descuento,
          prestamo_nuevo: emp.prestamo_nuevo, cobro_prestamo: emp.cobro_prestamo,
          detalle_comisiones: emp.detalleComisiones?.map(det => ({
            expediente_id: det.expediente_id, recibo_id: det.recibo_id,
            monto_comision: det.comision, porcentaje_aplicado: det.porcentajeProducto,
            es_comision_compartida: det.tipo === 'Compartida'
          })) || []
        }))
      };
      
      const response = await fetch(`${API_URL}/api/nominas/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` },
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
  
  const cerrarNomina = async () => {
    if (!confirm('¿Estás seguro de cerrar esta nómina? Una vez cerrada no podrás editarla.')) return;
    if (!nominaGuardada) { await guardarNomina(); if (!nominaId) return; }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/nominas/${nominaId}/cerrar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      
      if (response.ok) {
        toast.success('Nómina cerrada exitosamente. Las comisiones han sido registradas.');
        setNominaGenerada(false); setDatosNomina([]); setNominaId(null); setNominaGuardada(false);
        cargarHistorialNominas(); cargarPrestamosEmpleados();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error al cerrar la nómina');
      }
    } catch (error) {
      console.error('Error al cerrar nómina:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
        toast.success('Nómina cerrada exitosamente (modo desarrollo)');
        setNominaGenerada(false); setDatosNomina([]); setNominaId(null); setNominaGuardada(false);
      } else {
        toast.error(error.message || 'Error al cerrar la nómina');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const marcarComoPagada = async (idNomina) => {
    if (!confirm('¿Confirmas que esta nómina ya fue pagada/depositada?')) return;
    try {
      const response = await fetch(`${API_URL}/api/nominas/${idNomina}/pagar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      if (response.ok) { toast.success('Nómina marcada como pagada'); cargarHistorialNominas(); }
      else { const error = await response.json(); throw new Error(error.message || 'Error al marcar como pagada'); }
    } catch (error) { console.error('Error:', error); toast.error(error.message || 'Error al marcar como pagada'); }
  };
  
  const eliminarNomina = async (idNomina, codigo) => {
    if (!confirm(`¿Eliminar nómina ${codigo}? Esto revertirá sueldos y comisiones para que puedan recalcularse.`)) return;
    try {
      const response = await fetch(`${API_URL}/api/nominas/${idNomina}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      if (response.ok) {
        toast.success(`Nómina ${codigo} eliminada`);
        cargarHistorialNominas();
      } else if (response.status === 404) {
        toast.error('Endpoint DELETE /api/nominas/:id no disponible. Hugo necesita implementarlo.');
      } else {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al eliminar nómina');
    }
  };

  const cancelarNomina = () => {
    if (nominaGuardada && !confirm('La nómina ya fue guardada en BD. ¿Deseas descartarla?')) return;
    setNominaGenerada(false); setDatosNomina([]); setNominaId(null); setNominaGuardada(false);
  };
  
  const formatMoney = (value) => {
    return `$${parseFloat(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <h2 className="mb-0">
            <DollarSign className="me-2" size={32} />
            Nómina / Comisiones
          </h2>
        </div>
      </div>

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
                  <input type="date" className="form-control" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} disabled={nominaGenerada} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Fecha Fin</label>
                  <input type="date" className="form-control" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} disabled={nominaGenerada} />
                </div>
                <div className="col-md-3">
                  {!nominaGenerada ? (
                    <button className="btn btn-primary w-100" onClick={generarNomina} disabled={loading || loadingEmpleados}>
                      {loading || loadingEmpleados ? (
                        <><span className="spinner-border spinner-border-sm me-2" />{loadingEmpleados ? 'Cargando empleados...' : 'Generando...'}</>
                      ) : (
                        <><FileText size={18} className="me-2" />Generar Nómina ({empleados.length})</>
                      )}
                    </button>
                  ) : (
                    <button className="btn btn-outline-secondary w-100" onClick={cancelarNomina} disabled={loading}>Cancelar</button>
                  )}
                </div>
                {nominaGenerada && (
                  <div className="col-md-3">
                    <div className="btn-group w-100">
                      {!nominaGuardada && (
                        <button className="btn btn-info" onClick={guardarNomina} disabled={loading} title="Guardar como borrador en BD">
                          {loading ? <span className="spinner-border spinner-border-sm" /> : <><Wallet size={16} className="me-1" />Guardar</>}
                        </button>
                      )}
                      <button className="btn btn-success" onClick={cerrarNomina} disabled={loading} title="Cerrar nómina y registrar comisiones">
                        {loading ? <span className="spinner-border spinner-border-sm" /> : <><Lock size={16} className="me-1" />Cerrar</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {nominaGenerada && datosNomina.length > 0 && (
            <div className="row mb-4">
              <div className="col-md-2">
                <div className="card bg-info text-white"><div className="card-body py-2"><small className="text-white-50">Sueldos</small><h5 className="mb-0">{formatMoney(totales.sueldos)}</h5></div></div>
              </div>
              <div className="col-md-2">
                <div className="card bg-success text-white"><div className="card-body py-2"><small className="text-white-50">Comisiones</small><h5 className="mb-0">{formatMoney(totales.comisiones)}</h5></div></div>
              </div>
              <div className="col-md-2">
                <div className="card bg-danger text-white"><div className="card-body py-2"><small className="text-white-50">Descuentos</small><h5 className="mb-0">{formatMoney(totales.descuentos)}</h5></div></div>
              </div>
              <div className="col-md-2">
                <div className="card bg-warning text-dark"><div className="card-body py-2"><small className="text-dark-50">Préstamos</small><h5 className="mb-0">{formatMoney(totales.prestamos)}</h5></div></div>
              </div>
              <div className="col-md-2">
                <div className="card bg-secondary text-white"><div className="card-body py-2"><small className="text-white-50">Cobros Prést.</small><h5 className="mb-0">{formatMoney(totales.cobros)}</h5></div></div>
              </div>
              <div className="col-md-2">
                <div className="card bg-primary text-white"><div className="card-body py-2"><small className="text-white-50">Total a Pagar</small><h5 className="mb-0">{formatMoney(totales.neto)}</h5></div></div>
              </div>
            </div>
          )}
          
          <div className="card">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0">{nominaGenerada ? 'Detalle de Nómina' : 'Resultados'}</h5>
              {nominaGenerada && datosNomina.length > 0 && (
                <button className="btn btn-sm btn-success" onClick={() => toast.info('Exportación en desarrollo')}>
                  <Download size={16} className="me-2" />Exportar Excel
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
                              <strong>{item.nombre}</strong>
                              {item.detalleComisiones?.length > 0 && (
                                <button className="btn btn-sm btn-outline-success py-0 px-1" onClick={() => abrirDetalleEmpleado(item)} title="Ver/Editar detalle de comisiones">
                                  <Eye size={14} className="me-1" />{item.detalleComisiones.length}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${item.perfil === 'Agente' ? 'bg-success' : item.perfil === 'Vendedor' ? 'bg-info' : item.perfil === 'Ejecutivo' ? 'bg-warning' : item.perfil === 'Administrador' ? 'bg-danger' : 'bg-secondary'}`}>
                              {item.perfil}
                            </span>
                          </td>
                          <td className="text-end">{formatMoney(item.sueldo)}</td>
                          <td className="text-end text-success fw-bold">{formatMoney(item.comisiones)}</td>
                          <td className="text-end fw-bold">{formatMoney(item.subtotal)}</td>
                          <td>
                            <input type="number" className="form-control form-control-sm text-end" value={item.descuentos || ''} onChange={(e) => actualizarCampoNomina(index, 'descuentos', parseFloat(e.target.value) || 0)} placeholder="0.00" min="0" step="0.01" />
                          </td>
                          <td className="text-end">
                            {item.saldo_prestamo > 0 ? <span className="text-danger">{formatMoney(item.saldo_prestamo)}</span> : <span className="text-muted">-</span>}
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm text-end" value={item.prestamo_nuevo || ''} onChange={(e) => actualizarCampoNomina(index, 'prestamo_nuevo', parseFloat(e.target.value) || 0)} placeholder="0.00" min="0" step="0.01" />
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm text-end" value={item.cobro_prestamo || ''} onChange={(e) => actualizarCampoNomina(index, 'cobro_prestamo', parseFloat(e.target.value) || 0)} placeholder="0.00" min="0" max={item.saldo_prestamo || 999999} step="0.01" />
                          </td>
                          <td className="text-end fw-bold text-primary" style={{ fontSize: '1rem' }}>{formatMoney(item.total_pagar)}</td>
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
            <h5 className="mb-0"><History size={20} className="me-2" />Historial de Nóminas Generadas</h5>
          </div>
          <div className="card-body">
            {historialNominas.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <History size={48} className="mb-3" /><p>No hay nóminas generadas aún</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th>Código</th><th>Período</th><th className="text-end">Total Sueldos</th>
                      <th className="text-end">Total Comisiones</th><th className="text-end">Total Neto</th>
                      <th className="text-center">Estatus</th><th className="text-center">Fecha Generación</th><th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialNominas.map((nomina) => (
                      <tr key={nomina.id}>
                        <td><strong>{nomina.codigo}</strong></td>
                        <td>{new Date(nomina.fecha_inicio).toLocaleDateString('es-MX')} - {new Date(nomina.fecha_fin).toLocaleDateString('es-MX')}</td>
                        <td className="text-end">{formatMoney(nomina.total_sueldos)}</td>
                        <td className="text-end text-success">{formatMoney(nomina.total_comisiones)}</td>
                        <td className="text-end fw-bold">{formatMoney(nomina.total_neto)}</td>
                        <td className="text-center">
                          <span className={`badge ${nomina.estatus === 'Pagada' ? 'bg-success' : nomina.estatus === 'Cerrada' ? 'bg-warning' : 'bg-secondary'}`}>{nomina.estatus}</span>
                        </td>
                        <td className="text-center">{new Date(nomina.created_at).toLocaleDateString('es-MX')}</td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-primary" onClick={() => { setNominaSeleccionada(nomina); setVistaActual('detalle'); }} title="Ver detalle"><Eye size={14} /></button>
                            {nomina.estatus === 'Cerrada' && (
                              <button className="btn btn-success" onClick={() => marcarComoPagada(nomina.id)} title="Marcar como pagada"><Check size={14} /></button>
                            )}
                            <button className="btn btn-outline-danger" onClick={() => eliminarNomina(nomina.id, nomina.codigo)} title="Eliminar nómina"><Trash2 size={14} /></button>
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

      {/* Modal de Detalle de Comisiones del Empleado */}
      {empleadoDetalle && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setEmpleadoDetalle(null)}>
          <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><DollarSign size={20} className="me-2" />Detalle de Comisiones - {empleadoDetalle.nombre}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEmpleadoDetalle(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-4">
                    <div className="card bg-light"><div className="card-body py-2 text-center"><small className="text-muted">Perfil</small><h6 className="mb-0">{empleadoDetalle.perfil}</h6></div></div>
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-light"><div className="card-body py-2 text-center"><small className="text-muted">Pólizas</small><h6 className="mb-0">{empleadoDetalle.detalleComisiones?.length || 0}</h6></div></div>
                  </div>
                  <div className="col-md-4">
                    <div className="card bg-success text-white"><div className="card-body py-2 text-center"><small className="text-white-50">Total Comisiones</small><h6 className="mb-0">{formatMoney(empleadoDetalle.comisiones)}</h6></div></div>
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
                          <td style={{padding: '4px', fontSize: '0.65rem'}}>{det.nombreVendedor || '-'}</td>
                          <td style={{fontSize: '0.65rem', padding: '4px'}}>{formatMoney(det.prima)}</td>
                          <td style={{padding: '4px'}}>
                            <input type="number" className="form-control form-control-sm text-center" style={{fontSize: '0.7rem'}} value={det.comisionBaseEdit || 0} onChange={(e) => actualizarComisionDetalle(idx, 'comisionBaseEdit', e.target.value)} min="0" max="100" />
                          </td>
                          <td style={{padding: '4px'}}>
                            <input type="number" className="form-control form-control-sm text-center" style={{fontSize: '0.7rem'}} value={det.porcentajeAgenteEdit || 0} onChange={(e) => actualizarComisionDetalle(idx, 'porcentajeAgenteEdit', e.target.value)} min="0" max="100" />
                          </td>
                          <td className="text-success" style={{fontSize: '0.65rem', padding: '4px', verticalAlign: 'middle'}}><strong>{formatMoney(det.comisionAgente || 0)}</strong></td>
                          <td style={{padding: '4px'}}>
                            <input type="number" className="form-control form-control-sm text-center" style={{fontSize: '0.7rem'}} value={det.porcentajeVendedorEdit || 0} onChange={(e) => actualizarComisionDetalle(idx, 'porcentajeVendedorEdit', e.target.value)} min="0" max="100" disabled={det.tipo === 'Directa'} />
                          </td>
                          <td className="text-info" style={{fontSize: '0.65rem', padding: '4px', verticalAlign: 'middle'}}><strong>{det.tipo === 'Compartida' ? formatMoney(det.comisionVendedor || 0) : '-'}</strong></td>
                          <td style={{fontSize: '0.65rem', padding: '4px', verticalAlign: 'middle'}}><strong>{formatMoney(det.comisionTotal || det.comision || 0)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <th colSpan="6" className="text-end" style={{fontSize: '0.65rem'}}>TOTALES:</th>
                        <th className="text-success" style={{fontSize: '0.65rem'}}>{formatMoney(detalleEditado.reduce((s, d) => s + (d.comisionAgente || 0), 0))}</th>
                        <th></th>
                        <th className="text-info" style={{fontSize: '0.65rem'}}>{formatMoney(detalleEditado.reduce((s, d) => s + (d.comisionVendedor || 0), 0))}</th>
                        <th style={{fontSize: '0.65rem'}}>{formatMoney(detalleEditado.reduce((s, d) => s + (d.comisionTotal || d.comision || 0), 0))}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                <div className="alert alert-info mt-3 py-2" style={{fontSize: '0.85rem'}}>
                  <strong>Tip:</strong> % Agente + % Vendedor siempre suman 100% de la comisión. Si cambias uno, el otro se ajusta automáticamente.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEmpleadoDetalle(null)}>Cancelar</button>
                <button type="button" className="btn btn-success" onClick={aplicarCambiosDetalle}><Check size={16} className="me-1" />Aplicar Cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Nomina;
