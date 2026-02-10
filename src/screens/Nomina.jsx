import React, { useState, useEffect, useMemo } from 'react';
import { FileText, DollarSign, Download, Calendar, Plus, Eye, Lock, Check, History, AlertCircle, Wallet, Trash2, ChevronDown, ChevronUp, Users, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;

const Nomina = () => {
  const [loading, setLoading] = useState(false);
  const [vistaActual, setVistaActual] = useState('generar'); // 'generar' | 'historial' | 'detalle'
  
  // Estados para filtros del reporte de nómina
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoNomina, setTipoNomina] = useState('completa'); // 'completa' | 'solo_sueldos' | 'solo_comisiones'
  
  // Usar el hook de equipo de trabajo
  const { equipoDeTrabajo: empleados, loading: loadingEmpleados } = useEquipoDeTrabajo();
  
  // Estados para datos
  const [datosNomina, setDatosNomina] = useState([]);
  const [faseNomina, setFaseNomina] = useState('agentes'); // 'agentes' = solo agentes | 'completa' = distribuido a vendedores
  const [datosPeriodicosSueldo, setDatosPeriodicosSueldo] = useState(null); // datos de sueldo para empleados no-agentes
  const [historialNominas, setHistorialNominas] = useState([]);
  const [nominaSeleccionada, setNominaSeleccionada] = useState(null);
  const [detalleNominaConsulta, setDetalleNominaConsulta] = useState(null);
  const [nominaGenerada, setNominaGenerada] = useState(false);
  const [nominaId, setNominaId] = useState(null);
  const [nominaGuardada, setNominaGuardada] = useState(false);
  const [empleadoDetalle, setEmpleadoDetalle] = useState(null);
  const [detalleEditado, setDetalleEditado] = useState([]);
  const [comisionesConsulta, setComisionesConsulta] = useState(null);
  const [prestamosEmpleados, setPrestamosEmpleados] = useState({});
  const [empleadoExpandido, setEmpleadoExpandido] = useState(null); // id del empleado con row expandido
  
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
      
      const comisionesPorAgente = {};
      const detalleComisionesPorAgente = {};
      
      // Si el tipo de nómina es solo sueldos, omitir el cálculo de comisiones
      if (tipoNomina === 'solo_sueldos') {
        // No calcular comisiones - saltar directamente a generar empleados
      } else {
      // FASE 1: Asignar TODAS las comisiones a los agentes (100% del total)
      // Las compartidas se marcan con info del vendedor para distribuir después
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
        
        if (!agente) return;
        
        const vendedor = nombreSubAgente ? empleados.find(emp => {
          const nombreCompleto = `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim().toLowerCase();
          return nombreCompleto.includes(nombreSubAgente) || nombreSubAgente.includes(nombreCompleto.split(' ').slice(0, 2).join(' '));
        }) : null;
        
        const nombreAgenteCompleto = `${agente.nombre || ''} ${agente.apellidoPaterno || ''}`.trim();
        
        // Construir descripción del bien asegurado
        const bienAsegurado = recibo.expediente.marca || recibo.expediente.modelo
          ? `${recibo.expediente.marca || ''} ${recibo.expediente.modelo || ''}`.trim()
          : `${recibo.expediente.nombre || ''} ${recibo.expediente.apellido_paterno || ''}`.trim();
        
        // Determinar porcentaje sugerido del vendedor (para mostrar en preview)
        let porcentajeVendedorSugerido = 0;
        let nombreVendedorCompleto = '';
        let vendedorId = null;
        
        if (vendedor) {
          nombreVendedorCompleto = `${vendedor.nombre || ''} ${vendedor.apellidoPaterno || ''}`.trim();
          vendedorId = vendedor.id;
          if (vendedor.comisionesCompartidas && Array.isArray(vendedor.comisionesCompartidas)) {
            const configComision = vendedor.comisionesCompartidas.find(cc => cc.clave === claveAgente);
            if (configComision) {
              porcentajeVendedorSugerido = parseFloat(configComision.porcentajeVendedor) || 0;
            }
          }
        }
        
        const esCompartida = !!vendedor;
        
        if (!comisionesPorAgente[agente.id]) {
          comisionesPorAgente[agente.id] = 0;
          detalleComisionesPorAgente[agente.id] = [];
        }
        // En fase agentes, el agente ve la comisión TOTAL de la póliza
        comisionesPorAgente[agente.id] += comisionTotal;
        
        detalleComisionesPorAgente[agente.id].push({
          expediente_id: recibo.expediente.id,
          recibo_id: recibo.id,
          poliza: recibo.expediente.numero_poliza,
          compania: recibo.compania,
          clave: claveAgente,
          producto: recibo.producto,
          tipo_cobertura: recibo.expediente.tipo_cobertura || '',
          bien_asegurado: bienAsegurado,
          anio: recibo.expediente.anio || '',
          prima: primaBase,
          comision: comisionTotal,
          comisionTotal: comisionTotal,
          porcentajeProducto: porcentajeComision,
          tipo: esCompartida ? 'Compartida' : 'Directa',
          nombreAgente: nombreAgenteCompleto,
          porcentajeAgente: esCompartida ? (100 - porcentajeVendedorSugerido) : 100,
          comisionAgente: esCompartida ? comisionTotal * ((100 - porcentajeVendedorSugerido) / 100) : comisionTotal,
          nombreVendedor: nombreVendedorCompleto,
          vendedorId: vendedorId,
          porcentajeVendedor: porcentajeVendedorSugerido,
          comisionVendedor: esCompartida ? comisionTotal * (porcentajeVendedorSugerido / 100) : 0
        });
      });
      } // end if tipoNomina !== 'solo_sueldos'
      
      // FASE 1: Solo mostrar agentes con todas sus pólizas
      const agentesActivos = empleados.filter(emp => emp.activo !== false && emp.perfil === 'Agente');
      
      const nominaAgentes = agentesActivos.map(emp => {
        const sueldoDiario = parseFloat(emp.sueldoDiario) || 0;
        
        // Calcular días ya pagados que se solapan con el período actual
        let diasYaPagados = 0;
        const periodos = periodosYaPagados[emp.id] || [];
        const inicioMs = inicio.getTime();
        const finMs = fin.getTime();
        
        for (const [pInicio, pFin] of periodos) {
          const overlapInicio = Math.max(inicioMs, pInicio);
          const overlapFin = Math.min(finMs, pFin);
          if (overlapInicio <= overlapFin) {
            const diasOverlap = Math.ceil((overlapFin - overlapInicio) / (1000 * 60 * 60 * 24)) + 1;
            diasYaPagados += diasOverlap;
          }
        }
        
        const diasAPagar = Math.max(0, diasPeriodo - diasYaPagados);
        const sueldo = tipoNomina === 'solo_comisiones' ? 0 : sueldoDiario * diasAPagar;
        // En fase agentes, la comisión es el total (antes de distribuir a vendedores)
        const comisionesTotal = comisionesPorAgente[emp.id] || 0;
        const detalleComisiones = detalleComisionesPorAgente[emp.id] || [];
        const saldoPrestamo = prestamosEmpleados[emp.id] || 0;
        const subtotal = Math.round((sueldo + comisionesTotal) * 100) / 100;
        
        return {
          empleado_id: emp.id,
          nombre: `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim(),
          perfil: emp.perfil || 'Agente',
          esquemaCompensacion: emp.esquemaCompensacion || 'mixto',
          sueldoDiario: sueldoDiario,
          diasPeriodo: diasPeriodo,
          diasYaPagados: diasYaPagados,
          diasAPagar: diasAPagar,
          sueldo: Math.round(sueldo * 100) / 100,
          comisiones: Math.round(comisionesTotal * 100) / 100,
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
      
      // Guardar datos de sueldo para empleados no-agentes (se usarán al distribuir)
      const datosNoAgentes = empleados.filter(emp => emp.activo !== false && emp.perfil !== 'Agente').map(emp => {
        const sueldoDiario = parseFloat(emp.sueldoDiario) || 0;
        let diasYaPagados = 0;
        const periodos = periodosYaPagados[emp.id] || [];
        const inicioMs = inicio.getTime();
        const finMs = fin.getTime();
        for (const [pInicio, pFin] of periodos) {
          const overlapInicio = Math.max(inicioMs, pInicio);
          const overlapFin = Math.min(finMs, pFin);
          if (overlapInicio <= overlapFin) {
            diasYaPagados += Math.ceil((overlapFin - overlapInicio) / (1000 * 60 * 60 * 24)) + 1;
          }
        }
        const diasAPagar = Math.max(0, diasPeriodo - diasYaPagados);
        return {
          empleado_id: emp.id,
          nombre: `${emp.nombre || ''} ${emp.apellidoPaterno || ''} ${emp.apellidoMaterno || ''}`.trim(),
          perfil: emp.perfil || 'Empleado',
          esquemaCompensacion: emp.esquemaCompensacion || 'mixto',
          sueldoDiario, diasPeriodo, diasYaPagados, diasAPagar,
          saldo_prestamo: prestamosEmpleados[emp.id] || 0
        };
      });
      setDatosPeriodicosSueldo(datosNoAgentes);
      
      // Si es solo sueldos, ir directo a fase completa con todos los empleados
      if (tipoNomina === 'solo_sueldos') {
        const todosEmpleados = [...nominaAgentes, ...datosNoAgentes.map(emp => ({
          ...emp,
          sueldo: Math.round((emp.sueldoDiario * emp.diasAPagar) * 100) / 100,
          comisiones: 0,
          detalleComisiones: [],
          subtotal: Math.round((emp.sueldoDiario * emp.diasAPagar) * 100) / 100,
          descuentos: 0,
          motivo_descuento: '',
          prestamo_nuevo: 0,
          cobro_prestamo: 0,
          total_pagar: Math.round((emp.sueldoDiario * emp.diasAPagar) * 100) / 100
        }))];
        setDatosNomina(todosEmpleados);
        setFaseNomina('completa');
        setNominaGenerada(true);
        toast.success(`Nómina (Solo Sueldos) generada: ${todosEmpleados.length} empleados.`);
      } else {
        setDatosNomina(nominaAgentes);
        setFaseNomina('agentes');
        setNominaGenerada(true);
        
        const polizasEncontradas = recibosPagadosEnPeriodo.length;
        const agentesConComision = nominaAgentes.filter(a => a.comisiones > 0).length;
        toast.success(`Fase 1: ${agentesConComision} agentes con ${polizasEncontradas} pólizas. Revisa y edita antes de distribuir a vendedores.`);
      }
      
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
      item.comision = comisionTotal; // Mantener en sync para display en fila expandida
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
    // En fase agentes: mostrar comisión TOTAL por póliza (antes de distribuir)
    // En fase completa: mostrar solo la parte de esta persona
    const nuevaComision = detalleEditado.reduce((sum, det) => {
      if (faseNomina === 'agentes') {
        return sum + (det.comisionTotal || det.comision || 0);
      }
      return sum + (det.comisionAgente || det.comision || 0);
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
    
    toast.success('Comisiones del agente actualizadas');
    setEmpleadoDetalle(null);
  };
  
  // FASE 2: Distribuir comisiones a vendedores y agregar todos los empleados
  const distribuirVendedores = () => {
    // Recopilar comisiones para vendedores desde los detalles de los agentes
    const comisionesPorVendedor = {};
    const detalleComisionesPorVendedor = {};
    
    // Recalcular las comisiones de agentes (solo su parte, no el total)
    const agentesActualizados = datosNomina.map(agente => {
      let comisionRealAgente = 0;
      const detallesActualizados = agente.detalleComisiones.map(det => {
        if (det.tipo === 'Compartida' && det.vendedorId) {
          // Calcular split
          const comisionAgente = det.comisionAgente || 0;
          const comisionVendedor = det.comisionVendedor || 0;
          comisionRealAgente += comisionAgente;
          
          // Acumular para el vendedor
          if (!comisionesPorVendedor[det.vendedorId]) {
            comisionesPorVendedor[det.vendedorId] = 0;
            detalleComisionesPorVendedor[det.vendedorId] = [];
          }
          comisionesPorVendedor[det.vendedorId] += comisionVendedor;
          detalleComisionesPorVendedor[det.vendedorId].push({
            ...det,
            comision: comisionVendedor // La parte del vendedor
          });
          
          return { ...det, comision: comisionAgente }; // La parte del agente
        } else {
          // Directa: el agente se queda todo
          comisionRealAgente += (det.comisionTotal || det.comision || 0);
          return { ...det, comision: det.comisionTotal || det.comision || 0 };
        }
      });
      
      const sueldo = agente.sueldo;
      const comisiones = Math.round(comisionRealAgente * 100) / 100;
      const subtotal = Math.round((sueldo + comisiones) * 100) / 100;
      
      return {
        ...agente,
        comisiones,
        detalleComisiones: detallesActualizados,
        subtotal,
        total_pagar: Math.round((subtotal - agente.descuentos - agente.cobro_prestamo + (agente.prestamo_nuevo || 0)) * 100) / 100
      };
    });
    
    // Crear entradas para vendedores y otros empleados
    const empleadosNoAgentes = (datosPeriodicosSueldo || []).map(emp => {
      const sueldo = tipoNomina === 'solo_comisiones' ? 0 : (emp.sueldoDiario * emp.diasAPagar);
      const comisiones = comisionesPorVendedor[emp.empleado_id] || 0;
      const detalleComisiones = detalleComisionesPorVendedor[emp.empleado_id] || [];
      const subtotal = Math.round((sueldo + comisiones) * 100) / 100;
      
      return {
        empleado_id: emp.empleado_id,
        nombre: emp.nombre,
        perfil: emp.perfil,
        esquemaCompensacion: emp.esquemaCompensacion,
        sueldoDiario: emp.sueldoDiario,
        diasPeriodo: emp.diasPeriodo,
        diasYaPagados: emp.diasYaPagados,
        diasAPagar: emp.diasAPagar,
        sueldo: Math.round(sueldo * 100) / 100,
        comisiones: Math.round(comisiones * 100) / 100,
        detalleComisiones: detalleComisiones,
        subtotal,
        descuentos: 0,
        motivo_descuento: '',
        saldo_prestamo: emp.saldo_prestamo || 0,
        prestamo_nuevo: 0,
        cobro_prestamo: 0,
        total_pagar: subtotal
      };
    });
    
    // Combinar: agentes actualizados + vendedores/empleados
    setDatosNomina([...agentesActualizados, ...empleadosNoAgentes]);
    setFaseNomina('completa');
    
    const vendedoresConComision = Object.keys(comisionesPorVendedor).length;
    toast.success(`Distribución completa: ${vendedoresConComision} vendedor(es) con comisiones asignadas. Nómina lista para guardar.`);
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
        tipo_nomina: tipoNomina,
        detalles: datosNomina.map(emp => ({
          empleado_id: emp.empleado_id, sueldo: emp.sueldo, comisiones: emp.comisiones,
          descuentos: emp.descuentos, motivo_descuento: emp.motivo_descuento,
          prestamo_nuevo: emp.prestamo_nuevo, cobro_prestamo: emp.cobro_prestamo,
          sueldo_diario: emp.sueldoDiario, dias_periodo: emp.diasPeriodo, dias_pagados: emp.diasAPagar,
          detalle_comisiones: emp.detalleComisiones?.map(det => ({
            expediente_id: det.expediente_id, recibo_id: det.recibo_id,
            monto_comision: det.comision, porcentaje_aplicado: det.porcentajeProducto,
            es_comision_compartida: det.tipo === 'Compartida',
            poliza: det.poliza,
            compania: det.compania,
            producto: det.producto,
            tipo_cobertura: det.tipo_cobertura,
            bien_asegurado: det.bien_asegurado,
            anio: det.anio,
            clave: det.clave,
            prima: det.prima,
            comision_total: det.comisionTotal,
            tipo: det.tipo,
            nombre_agente: det.nombreAgente,
            porcentaje_agente: det.porcentajeAgente,
            comision_agente: det.comisionAgente,
            nombre_vendedor: det.nombreVendedor,
            porcentaje_vendedor: det.porcentajeVendedor,
            comision_vendedor: det.comisionVendedor
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
        setFaseNomina('agentes'); setDatosPeriodicosSueldo(null);
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
        setFaseNomina('agentes'); setDatosPeriodicosSueldo(null);
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
  
  const cargarDetalleNomina = async (nomina) => {
    setNominaSeleccionada(nomina);
    setDetalleNominaConsulta(null);
    setVistaActual('detalle');
    try {
      const response = await fetch(`${API_URL}/api/nominas/${nomina.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ss_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDetalleNominaConsulta(data);
      } else {
        toast.error('Error al cargar detalle de nómina');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar detalle');
    }
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
    setEmpleadoExpandido(null); setFaseNomina('agentes'); setDatosPeriodicosSueldo(null);
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
                <div className="col-md-2">
                  <label className="form-label">Tipo de Nómina</label>
                  <select className="form-select" value={tipoNomina} onChange={(e) => setTipoNomina(e.target.value)} disabled={nominaGenerada}>
                    <option value="completa">Completa</option>
                    <option value="solo_sueldos">Solo Sueldos</option>
                    <option value="solo_comisiones">Solo Comisiones</option>
                  </select>
                </div>
                <div className="col-md-2">
                  {!nominaGenerada ? (
                    <button className="btn btn-primary w-100" onClick={generarNomina} disabled={loading || loadingEmpleados}>
                      {loading || loadingEmpleados ? (
                        <><span className="spinner-border spinner-border-sm me-2" />{loadingEmpleados ? 'Cargando empleados...' : 'Generando...'}</>
                      ) : (
                        <><FileText size={18} className="me-2" />Generar ({empleados.length})</>
                      )}
                    </button>
                  ) : (
                    <button className="btn btn-outline-secondary w-100" onClick={cancelarNomina} disabled={loading}>Cancelar</button>
                  )}
                </div>
                {nominaGenerada && (
                  <div className="col-md-3">
                    {faseNomina === 'agentes' && tipoNomina !== 'solo_sueldos' ? (
                      <button className="btn btn-warning w-100 fw-bold" onClick={distribuirVendedores} disabled={loading} title="Distribuir comisiones compartidas a vendedores y agregar empleados">
                        <Users size={16} className="me-1" />Distribuir a Vendedores <ArrowRight size={16} className="ms-1" />
                      </button>
                    ) : (
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {nominaGenerada && datosNomina.length > 0 && (
            <>
            {faseNomina === 'agentes' && tipoNomina !== 'solo_sueldos' && (
              <div className="alert alert-warning py-2 mb-3 d-flex align-items-center" style={{ fontSize: '0.85rem' }}>
                <AlertCircle size={18} className="me-2 flex-shrink-0" />
                <span><strong>Fase 1 — Solo Agentes:</strong> Los montos de comisión mostrados son el <strong>total por póliza</strong> (antes de distribuir a vendedores). 
                Revisa cada agente, edita % si necesitas, y luego da clic en <strong>"Distribuir a Vendedores"</strong> para calcular los splits y ver la nómina completa.</span>
              </div>
            )}
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
            </>
          )}
          
          <div className="card">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0 d-inline">
                  {nominaGenerada 
                    ? faseNomina === 'agentes' 
                      ? 'Fase 1: Revisión de Comisiones por Agente' 
                      : 'Nómina Completa' 
                    : 'Resultados'}
                </h5>
                {nominaGenerada && faseNomina === 'agentes' && tipoNomina !== 'solo_sueldos' && (
                  <small className="text-muted ms-2">Revisa las pólizas y % de cada agente, luego da clic en "Distribuir a Vendedores"</small>
                )}
              </div>
              {nominaGenerada && datosNomina.length > 0 && faseNomina === 'completa' && (
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
                        <React.Fragment key={item.empleado_id}>
                        <tr>
                          <td>
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center">
                                <button className="btn btn-sm btn-link p-0 me-1" onClick={() => setEmpleadoExpandido(empleadoExpandido === item.empleado_id ? null : item.empleado_id)} title="Ver desglose">
                                  {empleadoExpandido === item.empleado_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <strong>{item.nombre}</strong>
                              </div>
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
                        {/* Fila expandida con desglose del empleado */}
                        {empleadoExpandido === item.empleado_id && (
                          <tr>
                            <td colSpan="10" className="p-0">
                              <div className="bg-light border-start border-4 border-primary p-3" style={{ fontSize: '0.8rem' }}>
                                <div className="row g-2">
                                  {/* Columna Sueldo */}
                                  <div className="col-md-4">
                                    <div className="card h-100">
                                      <div className="card-header bg-info text-white py-1"><small className="fw-bold">Desglose Sueldo</small></div>
                                      <div className="card-body py-2">
                                        {item.sueldo > 0 ? (
                                          <table className="table table-sm mb-0" style={{ fontSize: '0.75rem' }}>
                                            <tbody>
                                              <tr><td>Sueldo diario:</td><td className="text-end">{formatMoney(item.sueldoDiario)}</td></tr>
                                              <tr><td>Días del período:</td><td className="text-end">{item.diasPeriodo}</td></tr>
                                              {item.diasYaPagados > 0 && <tr className="text-danger"><td>Días ya pagados:</td><td className="text-end">-{item.diasYaPagados}</td></tr>}
                                              <tr><td>Días a pagar:</td><td className="text-end fw-bold">{item.diasAPagar}</td></tr>
                                              <tr className="table-info"><td className="fw-bold">Total sueldo:</td><td className="text-end fw-bold">{formatMoney(item.sueldo)}</td></tr>
                                            </tbody>
                                          </table>
                                        ) : (
                                          <p className="text-muted mb-0 text-center"><small>{tipoNomina === 'solo_comisiones' ? 'No incluido (Solo Comisiones)' : 'Sin sueldo configurado'}</small></p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Columna Comisiones */}
                                  <div className="col-md-4">
                                    <div className="card h-100">
                                      <div className="card-header bg-success text-white py-1"><small className="fw-bold">Comisiones ({item.detalleComisiones?.length || 0} pólizas)</small></div>
                                      <div className="card-body py-2">
                                        {item.detalleComisiones?.length > 0 ? (
                                          <>
                                            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                              {item.detalleComisiones.map((det, i) => (
                                                <div key={i} className={`border-bottom py-1 ${det.tipo === 'Compartida' ? 'bg-warning bg-opacity-10' : ''}`} style={{ fontSize: '0.7rem' }}>
                                                  <div className="d-flex justify-content-between">
                                                    <span className="fw-bold">{det.poliza}</span>
                                                    <span className="text-success fw-bold text-nowrap">{formatMoney(det.comision)}</span>
                                                  </div>
                                                  <div className="text-muted" style={{ fontSize: '0.6rem' }}>
                                                    {det.compania} · {det.producto} {det.tipo_cobertura ? `(${det.tipo_cobertura})` : ''}
                                                  </div>
                                                  {det.bien_asegurado && (
                                                    <div style={{ fontSize: '0.6rem' }}>{det.bien_asegurado} {det.anio ? `(${det.anio})` : ''}</div>
                                                  )}
                                                  {det.tipo === 'Compartida' && (
                                                    <div style={{ fontSize: '0.6rem' }}>
                                                      <span className="badge bg-warning text-dark" style={{ fontSize: '0.55rem' }}>Compartida</span>
                                                      <span className="ms-1">con {item.perfil === 'Agente' ? det.nombreVendedor : det.nombreAgente}</span>
                                                      <span className="ms-1 text-muted">({item.perfil === 'Agente' ? `${det.porcentajeAgente}% tuyo` : `${det.porcentajeVendedor}% tuyo`})</span>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                            <div className="text-end mt-1 pt-1 border-top">
                                              <strong className="text-success">{formatMoney(item.comisiones)}</strong>
                                            </div>
                                          </>
                                        ) : (
                                          <p className="text-muted mb-0 text-center"><small>{tipoNomina === 'solo_sueldos' ? 'No incluido (Solo Sueldos)' : 'Sin comisiones en este período'}</small></p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Columna Resumen */}
                                  <div className="col-md-4">
                                    <div className="card h-100">
                                      <div className="card-header bg-primary text-white py-1"><small className="fw-bold">Resumen de Pago</small></div>
                                      <div className="card-body py-2">
                                        <table className="table table-sm mb-0" style={{ fontSize: '0.75rem' }}>
                                          <tbody>
                                            <tr><td>Sueldo:</td><td className="text-end">{formatMoney(item.sueldo)}</td></tr>
                                            <tr><td>Comisiones:</td><td className="text-end text-success">{formatMoney(item.comisiones)}</td></tr>
                                            <tr><td className="fw-bold">Subtotal:</td><td className="text-end fw-bold">{formatMoney(item.subtotal)}</td></tr>
                                            {item.descuentos > 0 && <tr className="text-danger"><td>Descuentos:</td><td className="text-end">-{formatMoney(item.descuentos)}</td></tr>}
                                            {item.cobro_prestamo > 0 && <tr><td>Cobro préstamo:</td><td className="text-end">-{formatMoney(item.cobro_prestamo)}</td></tr>}
                                            {item.prestamo_nuevo > 0 && <tr className="text-warning"><td>Préstamo nuevo:</td><td className="text-end">+{formatMoney(item.prestamo_nuevo)}</td></tr>}
                                            <tr className="table-primary"><td className="fw-bold">Total a pagar:</td><td className="text-end fw-bold text-primary" style={{ fontSize: '0.9rem' }}>{formatMoney(item.total_pagar)}</td></tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
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
                            <button className="btn btn-outline-primary" onClick={() => cargarDetalleNomina(nomina)} title="Ver detalle"><Eye size={14} /></button>
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

      {/* Vista: Detalle de Nómina (solo consulta) */}
      {vistaActual === 'detalle' && nominaSeleccionada && (
        <div>
          <button className="btn btn-outline-secondary mb-3" onClick={() => setVistaActual('historial')}>
            ← Volver al Historial
          </button>
          
          <div className="card mb-4">
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><FileText size={20} className="me-2" />Nómina {nominaSeleccionada.codigo}</h5>
              <span className={`badge ${nominaSeleccionada.estatus === 'Pagada' ? 'bg-success' : nominaSeleccionada.estatus === 'Cerrada' ? 'bg-warning' : 'bg-secondary'}`}>{nominaSeleccionada.estatus}</span>
            </div>
            <div className="card-body py-2">
              <div className="row text-center">
                <div className="col-md-2"><small className="text-muted d-block">Período</small><strong>{new Date(nominaSeleccionada.fecha_inicio).toLocaleDateString('es-MX')} - {new Date(nominaSeleccionada.fecha_fin).toLocaleDateString('es-MX')}</strong></div>
                <div className="col-md-2"><small className="text-muted d-block">Sueldos</small><strong className="text-info">{formatMoney(nominaSeleccionada.total_sueldos)}</strong></div>
                <div className="col-md-2"><small className="text-muted d-block">Comisiones</small><strong className="text-success">{formatMoney(nominaSeleccionada.total_comisiones)}</strong></div>
                <div className="col-md-2"><small className="text-muted d-block">Descuentos</small><strong className="text-danger">{formatMoney(nominaSeleccionada.total_descuentos)}</strong></div>
                <div className="col-md-2"><small className="text-muted d-block">Préstamos</small><strong className="text-warning">{formatMoney(nominaSeleccionada.total_prestamos_otorgados)}</strong></div>
                <div className="col-md-2"><small className="text-muted d-block">Total Neto</small><h5 className="text-primary mb-0">{formatMoney(nominaSeleccionada.total_neto)}</h5></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-light">
              <h5 className="mb-0">Detalle por Empleado</h5>
            </div>
            <div className="card-body p-0">
              {!detalleNominaConsulta ? (
                <div className="text-center py-5">
                  <span className="spinner-border" /><p className="mt-2 text-muted">Cargando detalle...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-dark">
                      <tr>
                        <th style={{ minWidth: '200px' }}>Empleado</th>
                        <th className="text-end" style={{ width: '100px' }}>Sueldo</th>
                        <th className="text-end" style={{ width: '100px' }}>Comisiones</th>
                        <th className="text-end" style={{ width: '100px' }}>Subtotal</th>
                        <th className="text-end" style={{ width: '100px' }}>Descuentos</th>
                        <th className="text-end" style={{ width: '100px' }}>Préstamo (+)</th>
                        <th className="text-end" style={{ width: '100px' }}>Cobro (-)</th>
                        <th className="text-end" style={{ width: '120px' }}>Total Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleNominaConsulta.detalles?.map((det) => {
                        const emp = empleados.find(e => e.id === det.empleado_id);
                        const nombre = emp ? `${emp.nombre || ''} ${emp.apellidoPaterno || ''}`.trim() : `Empleado #${det.empleado_id}`;
                        const sueldo = parseFloat(det.sueldo || 0);
                        const comisiones = parseFloat(det.comisiones || 0);
                        const subtotal = sueldo + comisiones;
                        const descuentos = parseFloat(det.descuentos || 0);
                        const prestamoNuevo = parseFloat(det.prestamo_nuevo || 0);
                        const cobroPrestamo = parseFloat(det.cobro_prestamo || 0);
                        const totalPagar = parseFloat(det.total_pagar || 0);
                        return (
                          <tr key={det.id}>
                            <td>
                              <strong>{nombre}</strong>
                              {det.detalle_comisiones?.length > 0 && (
                                <button className="btn btn-sm btn-outline-success py-0 px-1 ms-2" style={{ fontSize: '0.65rem' }} onClick={() => setComisionesConsulta({ nombre, comisiones, detalle: det.detalle_comisiones })} title="Ver detalle de comisiones">
                                  <Eye size={12} className="me-1" />{det.detalle_comisiones.length} pólizas
                                </button>
                              )}
                            </td>
                            <td className="text-end">{formatMoney(sueldo)}</td>
                            <td className="text-end text-success fw-bold">{formatMoney(comisiones)}</td>
                            <td className="text-end fw-bold">{formatMoney(subtotal)}</td>
                            <td className="text-end text-danger">{descuentos > 0 ? formatMoney(descuentos) : '-'}</td>
                            <td className="text-end text-warning">{prestamoNuevo > 0 ? formatMoney(prestamoNuevo) : '-'}</td>
                            <td className="text-end">{cobroPrestamo > 0 ? formatMoney(cobroPrestamo) : '-'}</td>
                            <td className="text-end fw-bold text-primary" style={{ fontSize: '1rem' }}>{formatMoney(totalPagar)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <th className="text-end">TOTALES:</th>
                        <th className="text-end">{formatMoney(nominaSeleccionada.total_sueldos)}</th>
                        <th className="text-end text-success">{formatMoney(nominaSeleccionada.total_comisiones)}</th>
                        <th className="text-end">{formatMoney(parseFloat(nominaSeleccionada.total_sueldos || 0) + parseFloat(nominaSeleccionada.total_comisiones || 0))}</th>
                        <th className="text-end text-danger">{formatMoney(nominaSeleccionada.total_descuentos)}</th>
                        <th className="text-end text-warning">{formatMoney(nominaSeleccionada.total_prestamos_otorgados)}</th>
                        <th className="text-end">{formatMoney(nominaSeleccionada.total_prestamos_cobrados)}</th>
                        <th className="text-end text-primary" style={{ fontSize: '1.1rem' }}>{formatMoney(nominaSeleccionada.total_neto)}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal consulta de comisiones (solo lectura, desde vista detalle) */}
      {comisionesConsulta && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setComisionesConsulta(null)}>
          <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title"><DollarSign size={20} className="me-2" />Comisiones - {comisionesConsulta.nombre}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setComisionesConsulta(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <div className="card bg-light"><div className="card-body py-2 text-center"><small className="text-muted">Pólizas</small><h6 className="mb-0">{comisionesConsulta.detalle.length}</h6></div></div>
                  </div>
                  <div className="col-md-6">
                    <div className="card bg-success text-white"><div className="card-body py-2 text-center"><small className="text-white-50">Total Comisiones</small><h6 className="mb-0">{formatMoney(comisionesConsulta.comisiones)}</h6></div></div>
                  </div>
                </div>
                {/* Detectar si la data tiene los campos enriquecidos */}
                {comisionesConsulta.detalle[0]?.poliza || comisionesConsulta.detalle[0]?.compania ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0 text-center" style={{ fontSize: '0.75rem' }}>
                      <thead className="table-dark">
                        <tr>
                          <th style={{ fontSize: '0.65rem' }}>Aseg / Póliza</th>
                          <th style={{ fontSize: '0.65rem' }}>Producto / Asegurado</th>
                          <th style={{ fontSize: '0.65rem' }}>Tipo</th>
                          <th style={{ fontSize: '0.65rem' }}>Vendedor</th>
                          <th style={{ fontSize: '0.65rem' }}>Prima</th>
                          <th style={{ fontSize: '0.65rem' }}>%Com</th>
                          <th style={{ fontSize: '0.65rem', backgroundColor: '#198754', color: '#fff' }}>%Ag</th>
                          <th style={{ fontSize: '0.65rem', backgroundColor: '#198754', color: '#fff' }}>$Agente</th>
                          <th style={{ fontSize: '0.65rem', backgroundColor: '#0dcaf0' }}>%Ve</th>
                          <th style={{ fontSize: '0.65rem', backgroundColor: '#0dcaf0' }}>$Vendedor</th>
                          <th style={{ fontSize: '0.65rem' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comisionesConsulta.detalle.map((com, idx) => (
                          <tr key={idx}>
                            <td className="text-start" style={{ padding: '4px' }}>
                              <small className="text-muted d-block" style={{ fontSize: '0.6rem' }}>{com.compania}</small>
                              <strong style={{ fontSize: '0.65rem' }}>{com.poliza}</strong>
                            </td>
                            <td className="text-start" style={{ padding: '4px' }}>
                              <span className="badge bg-primary" style={{ fontSize: '0.6rem' }}>{com.producto}</span>
                              {com.tipo_cobertura && <small className="text-muted ms-1" style={{ fontSize: '0.55rem' }}>{com.tipo_cobertura}</small>}
                              {com.bien_asegurado && <div style={{ fontSize: '0.55rem' }} className="text-truncate" title={com.bien_asegurado}>{com.bien_asegurado} {com.anio ? `(${com.anio})` : ''}</div>}
                            </td>
                            <td style={{ padding: '4px', fontSize: '0.6rem' }}>
                              {com.es_comision_compartida ? <span className="badge bg-warning text-dark" style={{ fontSize: '0.55rem' }}>Compartida</span> : <span className="badge bg-secondary" style={{ fontSize: '0.55rem' }}>Directa</span>}
                            </td>
                            <td style={{ padding: '4px', fontSize: '0.65rem' }}>{com.nombre_vendedor || '-'}</td>
                            <td style={{ fontSize: '0.65rem', padding: '4px' }}>{formatMoney(com.prima)}</td>
                            <td style={{ fontSize: '0.65rem', padding: '4px' }}>{com.porcentaje_aplicado}%</td>
                            <td style={{ fontSize: '0.65rem', padding: '4px' }}>{com.porcentaje_agente != null ? `${parseFloat(com.porcentaje_agente).toFixed(0)}%` : '-'}</td>
                            <td className="text-success" style={{ fontSize: '0.65rem', padding: '4px' }}><strong>{formatMoney(com.comision_agente || 0)}</strong></td>
                            <td style={{ fontSize: '0.65rem', padding: '4px' }}>{com.porcentaje_vendedor != null ? `${parseFloat(com.porcentaje_vendedor).toFixed(0)}%` : '-'}</td>
                            <td className="text-info" style={{ fontSize: '0.65rem', padding: '4px' }}><strong>{com.es_comision_compartida ? formatMoney(com.comision_vendedor || 0) : '-'}</strong></td>
                            <td style={{ fontSize: '0.65rem', padding: '4px' }}><strong>{formatMoney(com.comision_total || com.monto_comision || 0)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-light">
                        <tr>
                          <th colSpan="7" className="text-end" style={{ fontSize: '0.65rem' }}>TOTALES:</th>
                          <th className="text-success" style={{ fontSize: '0.65rem' }}>{formatMoney(comisionesConsulta.detalle.reduce((s, c) => s + parseFloat(c.comision_agente || 0), 0))}</th>
                          <th></th>
                          <th className="text-info" style={{ fontSize: '0.65rem' }}>{formatMoney(comisionesConsulta.detalle.reduce((s, c) => s + parseFloat(c.comision_vendedor || 0), 0))}</th>
                          <th style={{ fontSize: '0.65rem' }}>{formatMoney(comisionesConsulta.detalle.reduce((s, c) => s + parseFloat(c.comision_total || c.monto_comision || 0), 0))}</th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  /* Fallback para datos guardados con formato antiguo (sin campos enriquecidos) */
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.8rem' }}>
                      <thead className="table-dark">
                        <tr>
                          <th>Expediente</th>
                          <th>Recibo</th>
                          <th className="text-end">Comisión</th>
                          <th className="text-center">% Aplicado</th>
                          <th className="text-center">Compartida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comisionesConsulta.detalle.map((com, idx) => (
                          <tr key={idx}>
                            <td>#{com.expediente_id}</td>
                            <td>#{com.recibo_id}</td>
                            <td className="text-end text-success fw-bold">{formatMoney(com.monto_comision)}</td>
                            <td className="text-center">{com.porcentaje_aplicado}%</td>
                            <td className="text-center">{com.es_comision_compartida ? <span className="badge bg-info">Sí</span> : <span className="badge bg-secondary">No</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-light">
                        <tr>
                          <th colSpan="2" className="text-end">TOTAL:</th>
                          <th className="text-end text-success">{formatMoney(comisionesConsulta.detalle.reduce((s, c) => s + parseFloat(c.monto_comision || 0), 0))}</th>
                          <th colSpan="2"></th>
                        </tr>
                      </tfoot>
                    </table>
                    <div className="alert alert-warning mt-2 py-2" style={{ fontSize: '0.8rem' }}>
                      <AlertCircle size={14} className="me-1" />
                      Esta nómina fue guardada con el formato anterior. Las nuevas nóminas mostrarán el detalle completo con vendedor, agente y splits.
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setComisionesConsulta(null)}>Cerrar</button>
              </div>
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
                        <th style={{fontSize: '0.65rem'}}>Producto / Asegurado</th>
                        <th style={{fontSize: '0.65rem'}}>Tipo</th>
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
                          <td className="text-start" style={{padding: '4px'}}>
                            <span className="badge bg-primary" style={{fontSize: '0.6rem'}}>{det.producto}</span>
                            {det.tipo_cobertura && <small className="text-muted ms-1" style={{fontSize: '0.55rem'}}>{det.tipo_cobertura}</small>}
                            {det.bien_asegurado && <div style={{fontSize: '0.55rem'}} className="text-truncate" title={det.bien_asegurado}>{det.bien_asegurado} {det.anio ? `(${det.anio})` : ''}</div>}
                          </td>
                          <td style={{padding: '4px', fontSize: '0.6rem'}}>
                            {det.tipo === 'Compartida' ? <span className="badge bg-warning text-dark" style={{fontSize: '0.55rem'}}>Compartida</span> : <span className="badge bg-secondary" style={{fontSize: '0.55rem'}}>Directa</span>}
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
                        <th colSpan="7" className="text-end" style={{fontSize: '0.65rem'}}>TOTALES:</th>
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
