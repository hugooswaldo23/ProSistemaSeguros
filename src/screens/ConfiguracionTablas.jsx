import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Settings, Plus, Edit, Trash2, Save, X, FileText, Users,
  Building2, UserCircle, File, Tag, Share2, UserCheck,
  AlertCircle, CheckCircle, Search, ChevronLeft, ChevronRight,
  Package, Hash, Calendar, Shield, Briefcase, Target,
  TrendingUp, Globe, MessageCircle, Mail, Phone, Star,
  Lock, Eye, EyeOff, AlertTriangle, Database, Layers,
  FolderOpen, Activity, BarChart3, Zap, Award, ClipboardList, Clock, Info,
  Car, Heart, Home
} from 'lucide-react';

// Hook de paginación reutilizable
const usePaginacion = (items, itemsPorPagina = 10) => {
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');

  const itemsFiltrados = useMemo(() => {
    if (!busqueda) return items;
    const busquedaLower = busqueda.toLowerCase();
    return items.filter(item =>
      JSON.stringify(item).toLowerCase().includes(busquedaLower)
    );
  }, [items, busqueda]);

  const totalPaginas = Math.ceil(itemsFiltrados.length / itemsPorPagina);

  const itemsPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return itemsFiltrados.slice(inicio, fin);
  }, [itemsFiltrados, paginaActual, itemsPorPagina]);

  const irAPagina = useCallback((pagina) => {
    setPaginaActual(Math.max(1, Math.min(pagina, totalPaginas)));
  }, [totalPaginas]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  return {
    itemsPaginados,
    paginaActual,
    totalPaginas,
    setPaginaActual: irAPagina,
    busqueda,
    setBusqueda,
    totalItems: itemsFiltrados.length
  };
};

// Componente de Paginación
const Paginacion = React.memo(({ paginaActual, totalPaginas, setPaginaActual }) => {
  if (totalPaginas <= 1) return null;

  const paginas = [];
  const maxPaginas = 5;
  let inicio = Math.max(1, paginaActual - Math.floor(maxPaginas / 2));
  let fin = Math.min(totalPaginas, inicio + maxPaginas - 1);

  if (fin - inicio + 1 < maxPaginas) {
    inicio = Math.max(1, fin - maxPaginas + 1);
  }

  for (let i = inicio; i <= fin; i++) {
    paginas.push(i);
  }

  return (
    <nav>
      <ul className="pagination justify-content-center mb-0">
        <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
          <button
            className="page-link"
            onClick={() => setPaginaActual(paginaActual - 1)}
            disabled={paginaActual === 1}
          >
            <ChevronLeft size={16} />
          </button>
        </li>
        {inicio > 1 && (
          <>
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(1)}>1</button>
            </li>
            {inicio > 2 && <li className="page-item disabled"><span className="page-link">...</span></li>}
          </>
        )}
        {paginas.map(pagina => (
          <li key={pagina} className={`page-item ${paginaActual === pagina ? 'active' : ''}`}>
            <button
              className="page-link"
              onClick={() => setPaginaActual(pagina)}
            >
              {pagina}
            </button>
          </li>
        ))}
        {fin < totalPaginas && (
          <>
            {fin < totalPaginas - 1 && <li className="page-item disabled"><span className="page-link">...</span></li>}
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(totalPaginas)}>{totalPaginas}</button>
            </li>
          </>
        )}
        <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
          <button
            className="page-link"
            onClick={() => setPaginaActual(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
          >
            <ChevronRight size={16} />
          </button>
        </li>
      </ul>
    </nav>
  );
});

// Barra de búsqueda
const BarraBusqueda = React.memo(({ busqueda, setBusqueda, placeholder = "Buscar..." }) => (
  <div className="input-group mb-3">
    <span className="input-group-text">
      <Search size={20} />
    </span>
    <input
      type="text"
      className="form-control"
      placeholder={placeholder}
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
    />
    {busqueda && (
      <button
        className="btn btn-outline-secondary"
        type="button"
        onClick={() => setBusqueda('')}
      >
        <X size={16} />
      </button>
    )}
  </div>
));

const ModuloConfiguracionCatalogos = () => {
  // Estados para navegación
  const [vistaActual, setVistaActual] = useState('menu');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  // ========== CATÁLOGOS DE DATOS ==========
  // 1. Tipos de Documentos - Persona Física
  const [documentosPersonaFisica, setDocumentosPersonaFisica] = useState([
    { id: 1, nombre: 'Identificación Oficial (INE/Pasaporte)', codigo: 'DOC_PF_001', obligatorio: true, vigenciaDias: 0, activo: true, orden: 1 },
    { id: 2, nombre: 'Comprobante de Domicilio', codigo: 'DOC_PF_002', obligatorio: true, vigenciaDias: 90, activo: true, orden: 2 },
    { id: 3, nombre: 'CURP', codigo: 'DOC_PF_003', obligatorio: false, vigenciaDias: 0, activo: true, orden: 3 },
    { id: 4, nombre: 'RFC', codigo: 'DOC_PF_004', obligatorio: false, vigenciaDias: 0, activo: true, orden: 4 },
    { id: 5, nombre: 'Comprobante de Ingresos', codigo: 'DOC_PF_005', obligatorio: false, vigenciaDias: 30, activo: true, orden: 5 },
    { id: 6, nombre: 'Estado de Cuenta Bancario', codigo: 'DOC_PF_006', obligatorio: false, vigenciaDias: 30, activo: true, orden: 6 }
  ]);

  // 2. Tipos de Documentos - Persona Moral
  const [documentosPersonaMoral, setDocumentosPersonaMoral] = useState([
    { id: 1, nombre: 'Acta Constitutiva', codigo: 'DOC_PM_001', obligatorio: true, vigenciaDias: 0, activo: true, orden: 1 },
    { id: 2, nombre: 'Poder Notarial', codigo: 'DOC_PM_002', obligatorio: true, vigenciaDias: 0, activo: true, orden: 2 },
    { id: 3, nombre: 'Identificación del Representante Legal', codigo: 'DOC_PM_003', obligatorio: true, vigenciaDias: 0, activo: true, orden: 3 },
    { id: 4, nombre: 'Comprobante de Domicilio Fiscal', codigo: 'DOC_PM_004', obligatorio: true, vigenciaDias: 90, activo: true, orden: 4 },
    { id: 5, nombre: 'RFC de la Empresa', codigo: 'DOC_PM_005', obligatorio: true, vigenciaDias: 0, activo: true, orden: 5 },
    { id: 6, nombre: 'Constancia de Situación Fiscal', codigo: 'DOC_PM_006', obligatorio: false, vigenciaDias: 30, activo: true, orden: 6 },
    { id: 7, nombre: 'Estados Financieros', codigo: 'DOC_PM_007', obligatorio: false, vigenciaDias: 365, activo: true, orden: 7 }
  ]);

  // 3. Canales de Venta (Origen del Cliente)
  const [canalesVenta, setCanalesVenta] = useState([
    { id: 1, nombre: 'Directo', codigo: 'CV_001', descripcion: 'Cliente que llega directamente a la empresa', icono: 'UserCheck', color: 'primary', activo: true, orden: 1 },
    { id: 2, nombre: 'Recomendación', codigo: 'CV_002', descripcion: 'Cliente referido por otro cliente', icono: 'Users', color: 'success', activo: true, orden: 2 },
    { id: 3, nombre: 'Redes Sociales', codigo: 'CV_003', descripcion: 'Cliente captado por Facebook, Instagram, etc.', icono: 'Share2', color: 'info', activo: true, orden: 3 },
    { id: 4, nombre: 'Google Ads', codigo: 'CV_004', descripcion: 'Cliente por publicidad en Google', icono: 'Globe', color: 'danger', activo: true, orden: 4 },
    { id: 5, nombre: 'Llamada en Frío', codigo: 'CV_005', descripcion: 'Cliente contactado telefónicamente', icono: 'Phone', color: 'warning', activo: true, orden: 5 },
    { id: 6, nombre: 'Email Marketing', codigo: 'CV_006', descripcion: 'Cliente por campañas de correo', icono: 'Mail', color: 'secondary', activo: true, orden: 6 },
    { id: 7, nombre: 'Página Web', codigo: 'CV_007', descripcion: 'Cliente desde el sitio web', icono: 'Globe', color: 'primary', activo: true, orden: 7 },
    { id: 8, nombre: 'WhatsApp Business', codigo: 'CV_008', descripcion: 'Cliente por WhatsApp', icono: 'MessageCircle', color: 'success', activo: true, orden: 8 }
  ]);

  // 4. Categorías de Clientes
  const [categoriasClientes, setCategoriaClientes] = useState([
    { id: 1, nombre: 'Normal', codigo: 'CAT_001', descripcion: 'Cliente estándar', color: 'secondary', activo: true, orden: 1 },
    { id: 2, nombre: 'VIP', codigo: 'CAT_002', descripcion: 'Cliente preferencial con alto valor', color: 'warning', activo: true, orden: 2 },
    { id: 3, nombre: 'Premium', codigo: 'CAT_003', descripcion: 'Cliente con beneficios especiales', color: 'primary', activo: true, orden: 3 },
    { id: 4, nombre: 'Digital', codigo: 'CAT_004', descripcion: 'Cliente que opera principalmente online', color: 'info', activo: true, orden: 4 },
    { id: 5, nombre: 'Corporativo', codigo: 'CAT_005', descripcion: 'Grandes empresas', color: 'dark', activo: true, orden: 5 },
    { id: 6, nombre: 'Nuevo', codigo: 'CAT_006', descripcion: 'Cliente recién registrado', color: 'success', activo: true, orden: 6 }
  ]);

  // 5. Tipos de Trámites
  const [tiposTramites, setTiposTramites] = useState([
    { id: 1, nombre: 'MOVIMIENTO GENERAL EN PÓLIZA', codigo: 'TRAM_001', descripcion: 'Modificaciones generales en la póliza', tiempoEstimado: 24, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001', 'DOC_PF_002'], activo: true, orden: 1 },
    { id: 2, nombre: 'CANCELACIÓN', codigo: 'TRAM_002', descripcion: 'Cancelación de póliza o servicio', tiempoEstimado: 48, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001'], activo: true, orden: 2 },
    { id: 3, nombre: 'ALTA DE ASEGURADO', codigo: 'TRAM_003', descripcion: 'Registro de nuevo asegurado', tiempoEstimado: 24, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001', 'DOC_PF_002', 'DOC_PF_003'], activo: true, orden: 3 },
    { id: 4, nombre: 'BAJA DE ASEGURADO', codigo: 'TRAM_004', descripcion: 'Eliminación de asegurado', tiempoEstimado: 24, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001'], activo: true, orden: 4 },
    { id: 5, nombre: 'CORRECCIÓN DE SERIE', codigo: 'TRAM_005', descripcion: 'Corrección de número de serie', tiempoEstimado: 12, requiereDocumentos: false, documentosRequeridos: [], activo: true, orden: 5 },
    { id: 6, nombre: 'CORRECCIÓN DE PLACAS', codigo: 'TRAM_006', descripcion: 'Corrección de placas vehiculares', tiempoEstimado: 12, requiereDocumentos: false, documentosRequeridos: [], activo: true, orden: 6 },
    { id: 7, nombre: 'DEVOLUCIÓN DE PRIMAS', codigo: 'TRAM_007', descripcion: 'Reembolso de primas pagadas', tiempoEstimado: 72, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001', 'DOC_PF_006'], activo: true, orden: 7 },
    { id: 8, nombre: 'FACTURA FISCAL', codigo: 'TRAM_008', descripcion: 'Emisión de factura fiscal', tiempoEstimado: 24, requiereDocumentos: false, documentosRequeridos: [], activo: true, orden: 8 },
    { id: 9, nombre: 'ENDOSO DE INCREMENTO', codigo: 'TRAM_009', descripcion: 'Aumento en cobertura o suma asegurada', tiempoEstimado: 48, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001', 'DOC_PF_005'], activo: true, orden: 9 },
    { id: 10, nombre: 'ENDOSO DE DECREMENTO', codigo: 'TRAM_010', descripcion: 'Disminución en cobertura o suma asegurada', tiempoEstimado: 48, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001'], activo: true, orden: 10 },
    { id: 11, nombre: 'ENDOSO ACLARATORIO', codigo: 'TRAM_011', descripcion: 'Aclaraciones en la póliza', tiempoEstimado: 24, requiereDocumentos: false, documentosRequeridos: [], activo: true, orden: 11 },
    { id: 12, nombre: 'APLICACIÓN DE PAGO', codigo: 'TRAM_012', descripcion: 'Registro de pago realizado', tiempoEstimado: 12, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_006'], activo: true, orden: 12 },
    { id: 13, nombre: 'ACLARACIÓN DE PAGO', codigo: 'TRAM_013', descripcion: 'Aclaración sobre pagos realizados', tiempoEstimado: 24, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_006'], activo: true, orden: 13 },
    { id: 14, nombre: 'CAMBIO DE AGENTE', codigo: 'TRAM_014', descripcion: 'Cambio de agente asignado', tiempoEstimado: 48, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001'], activo: true, orden: 14 },
    { id: 15, nombre: 'RECONOCIMIENTO DE ANTIGÜEDAD', codigo: 'TRAM_015', descripcion: 'Reconocimiento de tiempo previo', tiempoEstimado: 72, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001', 'DOC_PF_002'], activo: true, orden: 15 },
    { id: 16, nombre: 'ENDOSO DE BENEFICIARIO PREFERENTE', codigo: 'TRAM_016', descripcion: 'Cambio de beneficiario preferente', tiempoEstimado: 48, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001'], activo: true, orden: 16 },
    { id: 17, nombre: 'RENOVACIÓN', codigo: 'TRAM_017', descripcion: 'Renovación de póliza', tiempoEstimado: 48, requiereDocumentos: true, documentosRequeridos: ['DOC_PF_001', 'DOC_PF_002'], activo: true, orden: 17 },
    { id: 18, nombre: 'COTIZACIÓN', codigo: 'TRAM_018', descripcion: 'Solicitud de cotización', tiempoEstimado: 24, requiereDocumentos: false, documentosRequeridos: [], activo: true, orden: 18 }
  ]);

  // 6. Tipos de Productos
  const [tiposProductos, setTiposProductos] = useState([
    { id: 1, nombre: 'Autos Individual', codigo: 'PROD_001', descripcion: 'Seguros para vehículos individuales', icono: 'car', color: 'primary', activo: true, orden: 1 },
    { id: 2, nombre: 'Autos Flotilla', codigo: 'PROD_002', descripcion: 'Seguros para flotillas de vehículos', icono: 'car', color: 'info', activo: true, orden: 2 },
    { id: 3, nombre: 'Equipo Pesado Individual', codigo: 'PROD_003', descripcion: 'Seguros para maquinaria pesada individual', icono: 'package', color: 'warning', activo: true, orden: 3 },
    { id: 4, nombre: 'Equipo Pesado Flotilla', codigo: 'PROD_004', descripcion: 'Seguros para flotillas de equipo pesado', icono: 'package', color: 'secondary', activo: true, orden: 4 },
    { id: 5, nombre: 'Maquinaria', codigo: 'PROD_005', descripcion: 'Seguros para maquinaria industrial y equipo especializado', icono: 'activity', color: 'dark', activo: true, orden: 5 },
    { id: 6, nombre: 'Vida', codigo: 'PROD_006', descripcion: 'Seguros de vida y planes de protección personal', icono: 'heart', color: 'danger', activo: true, orden: 6 },
    { id: 7, nombre: 'Daños', codigo: 'PROD_007', descripcion: 'Seguros para bienes inmuebles y patrimoniales', icono: 'home', color: 'success', activo: true, orden: 7 },
    { id: 8, nombre: 'Gastos Médicos', codigo: 'PROD_008', descripcion: 'Seguros de gastos médicos mayores y menores', icono: 'shield', color: 'primary', activo: true, orden: 8 }
  ]);

  // Estados de formularios
  const [formularioDocumento, setFormularioDocumento] = useState({
    id: null,
    nombre: '',
    codigo: '',
    obligatorio: false,
    vigenciaDias: 0,
    activo: true,
    orden: 1
  });

  const [formularioCanal, setFormularioCanal] = useState({
    id: null,
    nombre: '',
    codigo: '',
    descripcion: '',
    icono: 'UserCheck',
    color: 'primary',
    activo: true,
    orden: 1
  });

  const [formularioCategoria, setFormularioCategoria] = useState({
    id: null,
    nombre: '',
    codigo: '',
    descripcion: '',
    color: 'secondary',
    activo: true,
    orden: 1
  });

  const [formularioTramite, setFormularioTramite] = useState({
    id: null,
    nombre: '',
    descripcion: '',
    tiempoEstimado: 24,
    requiereDocumentos: true,
    documentosRequeridos: [],
    activo: true,
    orden: 1
  });

  const [formularioProducto, setFormularioProducto] = useState({
    id: null,
    nombre: '',
    codigo: '',
    descripcion: '',
    icono: 'package',
    color: 'primary',
    activo: true,
    orden: 1
  });

  // Hooks de paginación
  const paginacionDocsFisica = usePaginacion(documentosPersonaFisica, 10);
  const paginacionDocsMoral = usePaginacion(documentosPersonaMoral, 10);
  const paginacionCanales = usePaginacion(canalesVenta, 10);
  const paginacionCategorias = usePaginacion(categoriasClientes, 10);
  const paginacionTramites = usePaginacion(tiposTramites, 10);
  const paginacionProductos = usePaginacion(tiposProductos, 10);

  // Iconos disponibles para canales
  const iconosDisponibles = [
    { valor: 'UserCheck', icono: <UserCheck size={16} />, nombre: 'Usuario Check' },
    { valor: 'Users', icono: <Users size={16} />, nombre: 'Usuarios' },
    { valor: 'Share2', icono: <Share2 size={16} />, nombre: 'Compartir' },
    { valor: 'Globe', icono: <Globe size={16} />, nombre: 'Globo' },
    { valor: 'Phone', icono: <Phone size={16} />, nombre: 'Teléfono' },
    { valor: 'Mail', icono: <Mail size={16} />, nombre: 'Correo' },
    { valor: 'MessageCircle', icono: <MessageCircle size={16} />, nombre: 'Mensaje' },
    { valor: 'Star', icono: <Star size={16} />, nombre: 'Estrella' },
    { valor: 'Target', icono: <Target size={16} />, nombre: 'Objetivo' },
    { valor: 'TrendingUp', icono: <TrendingUp size={16} />, nombre: 'Tendencia' },
    { valor: 'Briefcase', icono: <Briefcase size={16} />, nombre: 'Maletín' },
    { valor: 'Zap', icono: <Zap size={16} />, nombre: 'Rayo' }
  ];

  // Iconos disponibles para productos
  const iconosProductos = [
    { valor: 'car', icono: <Car size={16} />, nombre: 'Auto' },
    { valor: 'heart', icono: <Heart size={16} />, nombre: 'Vida' },
    { valor: 'home', icono: <Home size={16} />, nombre: 'Casa' },
    { valor: 'package', icono: <Package size={16} />, nombre: 'Paquete' },
    { valor: 'shield', icono: <Shield size={16} />, nombre: 'Escudo' },
    { valor: 'briefcase', icono: <Briefcase size={16} />, nombre: 'Maletín' },
    { valor: 'building2', icono: <Building2 size={16} />, nombre: 'Edificio' },
    { valor: 'activity', icono: <Activity size={16} />, nombre: 'Actividad' },
    { valor: 'target', icono: <Target size={16} />, nombre: 'Objetivo' },
    { valor: 'layers', icono: <Layers size={16} />, nombre: 'Capas' },
    { valor: 'zap', icono: <Zap size={16} />, nombre: 'Energía' }
  ];

  // Colores disponibles
  const coloresDisponibles = [
    { valor: 'primary', nombre: 'Azul', clase: 'bg-primary' },
    { valor: 'secondary', nombre: 'Gris', clase: 'bg-secondary' },
    { valor: 'success', nombre: 'Verde', clase: 'bg-success' },
    { valor: 'danger', nombre: 'Rojo', clase: 'bg-danger' },
    { valor: 'warning', nombre: 'Amarillo', clase: 'bg-warning' },
    { valor: 'info', nombre: 'Celeste', clase: 'bg-info' },
    { valor: 'dark', nombre: 'Negro', clase: 'bg-dark' },
    { valor: 'light', nombre: 'Blanco', clase: 'bg-light border' }
  ];

  // Función para generar código automático
  const generarCodigo = (prefijo, lista) => {
    const numeros = lista.map(item => {
      const match = item.codigo?.match(new RegExp(`${prefijo}_(\\d+)`));
      return match ? parseInt(match[1]) : 0;
    });
    const maxNum = Math.max(0, ...numeros);
    return `${prefijo}_${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Función para obtener el ícono por valor
  const obtenerIcono = (valorIcono, tipo = 'canal') => {
    const listaIconos = tipo === 'producto' ? iconosProductos : iconosDisponibles;
    const iconoEncontrado = listaIconos.find(i => i.valor === valorIcono);
    const iconoPorDefecto = tipo === 'producto' ? <Package size={16} /> : <UserCheck size={16} />;
    return iconoEncontrado ? iconoEncontrado.icono : iconoPorDefecto;
  };

  // Función para obtener información del documento por código
  const obtenerDocumentoPorCodigo = (codigo) => {
    const todosDocumentos = [...documentosPersonaFisica, ...documentosPersonaMoral];
    return todosDocumentos.find(doc => doc.codigo === codigo);
  };

  // Funciones CRUD genéricas
  const guardarItem = (tipo) => {
    let datos, setDatos, formulario, setFormulario, prefijo;

    switch(tipo) {
      case 'docFisica':
        datos = documentosPersonaFisica;
        setDatos = setDocumentosPersonaFisica;
        formulario = formularioDocumento;
        setFormulario = setFormularioDocumento;
        prefijo = 'DOC_PF';
        break;
      case 'docMoral':
        datos = documentosPersonaMoral;
        setDatos = setDocumentosPersonaMoral;
        formulario = formularioDocumento;
        setFormulario = setFormularioDocumento;
        prefijo = 'DOC_PM';
        break;
      case 'canal':
        datos = canalesVenta;
        setDatos = setCanalesVenta;
        formulario = formularioCanal;
        setFormulario = setFormularioCanal;
        prefijo = 'CV';
        break;
      case 'categoria':
        datos = categoriasClientes;
        setDatos = setCategoriaClientes;
        formulario = formularioCategoria;
        setFormulario = setFormularioCategoria;
        prefijo = 'CAT';
        break;
      case 'tramite':
        datos = tiposTramites;
        setDatos = setTiposTramites;
        formulario = formularioTramite;
        setFormulario = setFormularioTramite;
        prefijo = 'TRAM';
        break;
      case 'producto':
        datos = tiposProductos;
        setDatos = setTiposProductos;
        formulario = formularioProducto;
        setFormulario = setFormularioProducto;
        prefijo = 'PROD';
        break;
      default:
        return;
    }

    // Validaciones
    if (!formulario.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    if (formulario.id) {
      // Editar
      if (tipo === 'tramite') {
        // Para trámites, mantener el código original y limpiar documentos si no requiere
        const itemOriginal = datos.find(item => item.id === formulario.id);
        const tramiteActualizado = {
          ...formulario,
          codigo: itemOriginal.codigo,
          documentosRequeridos: formulario.requiereDocumentos ? formulario.documentosRequeridos : []
        };
        setDatos(datos.map(item =>
          item.id === formulario.id ? tramiteActualizado : item
        ));
      } else {
        setDatos(datos.map(item =>
          item.id === formulario.id ? { ...formulario } : item
        ));
      }
    } else {
      // Crear nuevo
      let nuevoItem;
      if (tipo === 'tramite') {
        nuevoItem = {
          ...formulario,
          id: Date.now(),
          codigo: generarCodigo(prefijo, datos),
          documentosRequeridos: formulario.requiereDocumentos ? formulario.documentosRequeridos : [],
          orden: datos.length + 1
        };
      } else {
        nuevoItem = {
          ...formulario,
          id: Date.now(),
          codigo: formulario.codigo || generarCodigo(prefijo, datos),
          orden: datos.length + 1
        };
      }
      setDatos([...datos, nuevoItem]);
    }

    // Limpiar formulario
    limpiarFormulario(tipo);
    setMostrarFormulario(false);
    setItemEditando(null);
  };

  const limpiarFormulario = (tipo) => {
    switch(tipo) {
      case 'docFisica':
      case 'docMoral':
        setFormularioDocumento({
          id: null,
          nombre: '',
          codigo: '',
          obligatorio: false,
          vigenciaDias: 0,
          activo: true,
          orden: 1
        });
        break;
      case 'canal':
        setFormularioCanal({
          id: null,
          nombre: '',
          codigo: '',
          descripcion: '',
          icono: 'UserCheck',
          color: 'primary',
          activo: true,
          orden: 1
        });
        break;
      case 'categoria':
        setFormularioCategoria({
          id: null,
          nombre: '',
          codigo: '',
          descripcion: '',
          color: 'secondary',
          activo: true,
          orden: 1
        });
        break;
      case 'tramite':
        setFormularioTramite({
          id: null,
          nombre: '',
          descripcion: '',
          tiempoEstimado: 24,
          requiereDocumentos: true,
          documentosRequeridos: [],
          activo: true,
          orden: 1
        });
        break;
      case 'producto':
        setFormularioProducto({
          id: null,
          nombre: '',
          codigo: '',
          descripcion: '',
          icono: 'package',
          color: 'primary',
          activo: true,
          orden: 1
        });
        break;
    }
  };

  const editarItem = (item, tipo) => {
    setItemEditando(item);
    switch(tipo) {
      case 'docFisica':
      case 'docMoral':
        setFormularioDocumento(item);
        break;
      case 'canal':
        setFormularioCanal(item);
        break;
      case 'categoria':
        setFormularioCategoria(item);
        break;
      case 'tramite':
        const { codigo, ...tramiteSinCodigo } = item;
        setFormularioTramite({
          ...tramiteSinCodigo,
          documentosRequeridos: tramiteSinCodigo.documentosRequeridos || []
        });
        break;
      case 'producto':
        setFormularioProducto(item);
        break;
    }
    setMostrarFormulario(true);
  };

  const eliminarItem = (id, tipo) => {
    if (!window.confirm('¿Está seguro de eliminar este elemento? Esta acción no se puede deshacer.')) {
      return;
    }

    switch(tipo) {
      case 'docFisica':
        setDocumentosPersonaFisica(prev => prev.filter(item => item.id !== id));
        break;
      case 'docMoral':
        setDocumentosPersonaMoral(prev => prev.filter(item => item.id !== id));
        break;
      case 'canal':
        setCanalesVenta(prev => prev.filter(item => item.id !== id));
        break;
      case 'categoria':
        setCategoriaClientes(prev => prev.filter(item => item.id !== id));
        break;
      case 'tramite':
        setTiposTramites(prev => prev.filter(item => item.id !== id));
        break;
      case 'producto':
        setTiposProductos(prev => prev.filter(item => item.id !== id));
        break;
      default:
        console.error('Tipo no reconocido:', tipo);
    }
  };

  const cambiarEstado = (id, tipo) => {
    switch(tipo) {
      case 'docFisica':
        setDocumentosPersonaFisica(prev => prev.map(item =>
          item.id === id ? { ...item, activo: !item.activo } : item
        ));
        break;
      case 'docMoral':
        setDocumentosPersonaMoral(prev => prev.map(item =>
          item.id === id ? { ...item, activo: !item.activo } : item
        ));
        break;
      case 'canal':
        setCanalesVenta(prev => prev.map(item =>
          item.id === id ? { ...item, activo: !item.activo } : item
        ));
        break;
      case 'categoria':
        setCategoriaClientes(prev => prev.map(item =>
          item.id === id ? { ...item, activo: !item.activo } : item
        ));
        break;
      case 'tramite':
        setTiposTramites(prev => prev.map(item =>
          item.id === id ? { ...item, activo: !item.activo } : item
        ));
        break;
      case 'producto':
        setTiposProductos(prev => prev.map(item =>
          item.id === id ? { ...item, activo: !item.activo } : item
        ));
        break;
      default:
        console.error('Tipo no reconocido:', tipo);
    }
  };

  // Exportar configuración
  const exportarConfiguracion = () => {
    const configuracion = {
      documentosPersonaFisica,
      documentosPersonaMoral,
      canalesVenta,
      categoriasClientes,
      tiposTramites,
      tiposProductos,
      fechaExportacion: new Date().toISOString()
    };

    const dataStr = JSON.stringify(configuracion, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `configuracion_catalogos_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Renderizado del menú principal
  const renderMenu = () => (
    <div className="p-4">
      {/* Header con información del módulo */}
      <div className="alert alert-warning border-0 shadow-sm mb-4">
        <div className="d-flex align-items-center">
          <Lock size={24} className="me-3" />
          <div>
            <h6 className="alert-heading mb-1">Módulo de Administración</h6>
            <small>Este módulo está restringido solo para usuarios administradores. Los cambios realizados aquí afectarán los catálogos disponibles en todo el sistema.</small>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <Settings size={28} className="me-2" />
            Configuración de Catálogos
          </h2>
          <p className="text-muted">Gestione los catálogos maestros del sistema de clientes</p>
        </div>
        <button className="btn btn-outline-primary" onClick={exportarConfiguracion}>
          <Database size={16} className="me-2" />
          Exportar Configuración
        </button>
      </div>

      <div className="row g-4">
        {/* Card de Documentos */}
        <div className="col-lg-6">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-4">
                <div className="rounded-circle bg-primary bg-opacity-10 p-3">
                  <FileText size={32} className="text-primary" />
                </div>
                <div className="ms-3">
                  <h4 className="mb-0">Tipos de Documentos</h4>
                  <small className="text-muted">Configure los documentos requeridos para clientes</small>
                </div>
              </div>
              <div className="list-group">
                <button
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3"
                  onClick={() => setVistaActual('docFisica')}
                >
                  <div>
                    <UserCircle size={20} className="me-2 text-info" />
                    <span className="fw-semibold">Persona Física</span>
                    <small className="d-block text-muted ms-4 ps-2">Documentos para personas físicas</small>
                  </div>
                  <div className="text-end">
                    <span className="badge bg-info rounded-pill">{documentosPersonaFisica.length}</span>
                    <ChevronRight size={20} className="ms-2 text-muted" />
                  </div>
                </button>
                <button
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3"
                  onClick={() => setVistaActual('docMoral')}
                >
                  <div>
                    <Building2 size={20} className="me-2 text-success" />
                    <span className="fw-semibold">Persona Moral</span>
                    <small className="d-block text-muted ms-4 ps-2">Documentos para empresas</small>
                  </div>
                  <div className="text-end">
                    <span className="badge bg-success rounded-pill">{documentosPersonaMoral.length}</span>
                    <ChevronRight size={20} className="ms-2 text-muted" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Canales de Venta */}
        <div className="col-lg-6">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-4">
                <div className="rounded-circle bg-warning bg-opacity-10 p-3">
                  <Share2 size={32} className="text-warning" />
                </div>
                <div className="ms-3">
                  <h4 className="mb-0">Canales de Venta</h4>
                  <small className="text-muted">Origen y fuente de captación de clientes</small>
                </div>
              </div>
              <button
                className="btn btn-outline-warning w-100 py-3"
                onClick={() => setVistaActual('canales')}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <TrendingUp size={20} className="me-2" />
                    <span className="fw-semibold">Gestionar Canales</span>
                  </div>
                  <div>
                    <span className="badge bg-warning">{canalesVenta.length} canales</span>
                    <ChevronRight size={20} className="ms-2" />
                  </div>
                </div>
              </button>
              <div className="mt-3">
                <small className="text-muted d-block mb-2">Canales activos:</small>
                <div className="d-flex flex-wrap gap-1">
                  {canalesVenta.filter(c => c.activo).slice(0, 5).map(canal => (
                    <span key={canal.id} className={`badge bg-${canal.color} bg-opacity-75`}>
                      {obtenerIcono(canal.icono, 'canal')}
                      <span className="ms-1">{canal.nombre}</span>
                    </span>
                  ))}
                  {canalesVenta.filter(c => c.activo).length > 5 && (
                    <span className="badge bg-secondary">+{canalesVenta.filter(c => c.activo).length - 5} más</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Categorías */}
        <div className="col-lg-6">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-4">
                <div className="rounded-circle bg-success bg-opacity-10 p-3">
                  <Award size={32} className="text-success" />
                </div>
                <div className="ms-3">
                  <h4 className="mb-0">Categorías de Clientes</h4>
                  <small className="text-muted">Clasificación y tipos de clientes</small>
                </div>
              </div>
              <button
                className="btn btn-outline-success w-100 py-3"
                onClick={() => setVistaActual('categorias')}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <Target size={20} className="me-2" />
                    <span className="fw-semibold">Gestionar Categorías</span>
                  </div>
                  <div>
                    <span className="badge bg-success">{categoriasClientes.length} categorías</span>
                    <ChevronRight size={20} className="ms-2" />
                  </div>
                </div>
              </button>
              <div className="mt-3">
                <small className="text-muted d-block mb-2">Categorías configuradas:</small>
                <div className="row g-2">
                  {categoriasClientes.slice(0, 4).map(cat => (
                    <div key={cat.id} className="col-6">
                      <div className="d-flex align-items-center">
                        <div className={`badge bg-${cat.color} bg-opacity-25 text-${cat.color} me-2`}>
                          {cat.codigo}
                        </div>
                        <small>{cat.nombre}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Tipos de Trámites */}
        <div className="col-lg-6">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-4">
                <div className="rounded-circle bg-info bg-opacity-10 p-3">
                  <ClipboardList size={32} className="text-info" />
                </div>
                <div className="ms-3">
                  <h4 className="mb-0">Tipos de Trámites</h4>
                  <small className="text-muted">Gestión de procesos y trámites disponibles</small>
                </div>
              </div>
              <button
                className="btn btn-outline-info w-100 py-3"
                onClick={() => setVistaActual('tramites')}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <ClipboardList size={20} className="me-2" />
                    <span className="fw-semibold">Gestionar Trámites</span>
                  </div>
                  <div>
                    <span className="badge bg-info">{tiposTramites.length} trámites</span>
                    <ChevronRight size={20} className="ms-2" />
                  </div>
                </div>
              </button>
              <div className="mt-3">
                <small className="text-muted d-block mb-2">Trámites más comunes:</small>
                <div className="d-flex flex-wrap gap-1">
                  {tiposTramites.filter(t => t.activo).slice(0, 4).map(tramite => (
                    <span key={tramite.id} className="badge bg-info bg-opacity-75">
                      <Clock size={12} className="me-1" />
                      {tramite.nombre.length > 20 ? tramite.nombre.substring(0, 20) + '...' : tramite.nombre}
                    </span>
                  ))}
                  {tiposTramites.filter(t => t.activo).length > 4 && (
                    <span className="badge bg-secondary">+{tiposTramites.filter(t => t.activo).length - 4} más</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Tipos de Productos */}
        <div className="col-lg-6">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center mb-4">
                <div className="rounded-circle bg-dark bg-opacity-10 p-3">
                  <Package size={32} className="text-dark" />
                </div>
                <div className="ms-3">
                  <h4 className="mb-0">Tipos de Productos</h4>
                  <small className="text-muted">Categorización de productos disponibles</small>
                </div>
              </div>
              <button
                className="btn btn-outline-dark w-100 py-3"
                onClick={() => setVistaActual('productos')}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <Package size={20} className="me-2" />
                    <span className="fw-semibold">Gestionar Productos</span>
                  </div>
                  <div>
                    <span className="badge bg-dark">{tiposProductos.length} productos</span>
                    <ChevronRight size={20} className="ms-2" />
                  </div>
                </div>
              </button>
              <div className="mt-3">
                <small className="text-muted d-block mb-2">Productos disponibles:</small>
                <div className="d-flex flex-wrap gap-1">
                  {tiposProductos.filter(p => p.activo).slice(0, 6).map(producto => (
                    <span key={producto.id} className={`badge bg-${producto.color} bg-opacity-75`}>
                      {obtenerIcono(producto.icono, 'producto')}
                      <span className="ms-1">{producto.nombre}</span>
                    </span>
                  ))}
                  {tiposProductos.filter(p => p.activo).length > 6 && (
                    <span className="badge bg-secondary">+{tiposProductos.filter(p => p.activo).length - 6} más</span>
                  )}
                </div>
                <small className="text-info d-block mt-2">
                  <Info size={12} className="me-1" />
                  Se conectará con el sistema de productos
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Estadísticas */}
        <div className="col-lg-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title">
                <BarChart3 size={20} className="me-2" />
                Resumen del Sistema
              </h5>
              <div className="row g-3 mt-2">
                <div className="col-md-4 col-6">
                  <div className="d-flex align-items-center">
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-primary bg-opacity-10 rounded">
                        <FileText size={24} className="text-primary" />
                      </div>
                    </div>
                    <div className="ms-3">
                      <h4 className="mb-0">{documentosPersonaFisica.length + documentosPersonaMoral.length}</h4>
                      <small className="text-muted">Total Documentos</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 col-6">
                  <div className="d-flex align-items-center">
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-warning bg-opacity-10 rounded">
                        <Share2 size={24} className="text-warning" />
                      </div>
                    </div>
                    <div className="ms-3">
                      <h4 className="mb-0">{canalesVenta.filter(c => c.activo).length}</h4>
                      <small className="text-muted">Canales Activos</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 col-6">
                  <div className="d-flex align-items-center">
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-success bg-opacity-10 rounded">
                        <Target size={24} className="text-success" />
                      </div>
                    </div>
                    <div className="ms-3">
                      <h4 className="mb-0">{categoriasClientes.filter(c => c.activo).length}</h4>
                      <small className="text-muted">Categorías Activas</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 col-6">
                  <div className="d-flex align-items-center">
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-info bg-opacity-10 rounded">
                        <ClipboardList size={24} className="text-info" />
                      </div>
                    </div>
                    <div className="ms-3">
                      <h4 className="mb-0">{tiposTramites.filter(t => t.activo).length}</h4>
                      <small className="text-muted">Trámites Activos</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 col-6">
                  <div className="d-flex align-items-center">
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-dark bg-opacity-10 rounded">
                        <Package size={24} className="text-dark" />
                      </div>
                    </div>
                    <div className="ms-3">
                      <h4 className="mb-0">{tiposProductos.filter(p => p.activo).length}</h4>
                      <small className="text-muted">Productos Activos</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 col-6">
                  <div className="d-flex align-items-center">
                    <div className="flex-shrink-0">
                      <div className="p-2 bg-secondary bg-opacity-10 rounded">
                        <Activity size={24} className="text-secondary" />
                      </div>
                    </div>
                    <div className="ms-3">
                      <h4 className="mb-0">
                        {Math.round((
                          documentosPersonaFisica.filter(d => d.activo).length +
                          documentosPersonaMoral.filter(d => d.activo).length +
                          canalesVenta.filter(c => c.activo).length +
                          categoriasClientes.filter(c => c.activo).length +
                          tiposTramites.filter(t => t.activo).length +
                          tiposProductos.filter(p => p.activo).length
                        ) / (
                          documentosPersonaFisica.length +
                          documentosPersonaMoral.length +
                          canalesVenta.length +
                          categoriasClientes.length +
                          tiposTramites.length +
                          tiposProductos.length
                        ) * 100)}%
                      </h4>
                      <small className="text-muted">Total Activos</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizado de lista de documentos
  const renderListaDocumentos = (tipo) => {
    const esPersonaFisica = tipo === 'docFisica';
    const datos = esPersonaFisica ? documentosPersonaFisica : documentosPersonaMoral;
    const paginacion = esPersonaFisica ? paginacionDocsFisica : paginacionDocsMoral;
    const titulo = esPersonaFisica ? 'Documentos - Persona Física' : 'Documentos - Persona Moral';
    const icono = esPersonaFisica ? <UserCircle size={24} className="me-2" /> : <Building2 size={24} className="me-2" />;

    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">
              {icono}
              {titulo}
            </h3>
            <button
              className="btn btn-link p-0"
              onClick={() => setVistaActual('menu')}
            >
              ← Volver al menú principal
            </button>
          </div>
          <button
            onClick={() => {
              setMostrarFormulario(true);
              setItemEditando(null);
              limpiarFormulario(tipo);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Agregar Documento
          </button>
        </div>

        {datos.length > 0 && (
          <div className="row mb-3">
            <div className="col-md-6">
              <BarraBusqueda
                busqueda={paginacion.busqueda}
                setBusqueda={paginacion.setBusqueda}
                placeholder="Buscar documentos..."
              />
            </div>
            <div className="col-md-6 text-end">
              <small className="text-muted">
                Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} documentos
              </small>
            </div>
          </div>
        )}

        <div className="card">
          {datos.length === 0 ? (
            <div className="card-body text-center py-5">
              <FileText size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay documentos configurados</h5>
              <p className="text-muted">Comience agregando el primer tipo de documento</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th width="80">Orden</th>
                      <th>Código</th>
                      <th>Nombre del Documento</th>
                      <th>Obligatorio</th>
                      <th>Vigencia (días)</th>
                      <th>Estado</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacion.itemsPaginados.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <span className="badge bg-secondary">{doc.orden}</span>
                        </td>
                        <td>
                          <code>{doc.codigo}</code>
                        </td>
                        <td>
                          <div>
                            <div className="fw-semibold">{doc.nombre}</div>
                          </div>
                        </td>
                        <td>
                          {doc.obligatorio ? (
                            <span className="badge bg-danger">Obligatorio</span>
                          ) : (
                            <span className="badge bg-secondary">Opcional</span>
                          )}
                        </td>
                        <td>
                          {doc.vigenciaDias > 0 ? (
                            <span>{doc.vigenciaDias} días</span>
                          ) : (
                            <span className="text-muted">Sin vencimiento</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => cambiarEstado(doc.id, tipo)}
                            className={`btn btn-sm ${doc.activo ? 'btn-success' : 'btn-secondary'}`}
                          >
                            {doc.activo ? (
                              <>
                                <Eye size={14} className="me-1" />
                                Activo
                              </>
                            ) : (
                              <>
                                <EyeOff size={14} className="me-1" />
                                Inactivo
                              </>
                            )}
                          </button>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              onClick={() => editarItem(doc, tipo)}
                              className="btn btn-outline-primary"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarItem(doc.id, tipo)}
                              className="btn btn-outline-danger"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginacion.totalPaginas > 1 && (
                <div className="card-footer">
                  <Paginacion
                    paginaActual={paginacion.paginaActual}
                    totalPaginas={paginacion.totalPaginas}
                    setPaginaActual={paginacion.setPaginaActual}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de formulario */}
        {mostrarFormulario && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {itemEditando ? 'Editar Documento' : 'Nuevo Documento'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario(tipo);
                    }}
                  />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Código <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioDocumento.codigo}
                      onChange={(e) => setFormularioDocumento({...formularioDocumento, codigo: e.target.value})}
                      placeholder={`Ej: ${esPersonaFisica ? 'DOC_PF_XXX' : 'DOC_PM_XXX'}`}
                    />
                    <small className="text-muted">Se generará automáticamente si se deja vacío</small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nombre del Documento <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioDocumento.nombre}
                      onChange={(e) => setFormularioDocumento({...formularioDocumento, nombre: e.target.value})}
                      placeholder="Ej: Identificación Oficial"
                      required
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Vigencia (días)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formularioDocumento.vigenciaDias}
                          onChange={(e) => setFormularioDocumento({...formularioDocumento, vigenciaDias: parseInt(e.target.value) || 0})}
                          min="0"
                        />
                        <small className="text-muted">0 = Sin vencimiento</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Orden de visualización</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formularioDocumento.orden}
                          onChange={(e) => setFormularioDocumento({...formularioDocumento, orden: parseInt(e.target.value) || 1})}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formularioDocumento.obligatorio}
                      onChange={(e) => setFormularioDocumento({...formularioDocumento, obligatorio: e.target.checked})}
                      id="checkObligatorio"
                    />
                    <label className="form-check-label" htmlFor="checkObligatorio">
                      Documento obligatorio
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formularioDocumento.activo}
                      onChange={(e) => setFormularioDocumento({...formularioDocumento, activo: e.target.checked})}
                      id="checkActivo"
                    />
                    <label className="form-check-label" htmlFor="checkActivo">
                      Activo
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario(tipo);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => guardarItem(tipo)}
                  >
                    <Save size={16} className="me-2" />
                    {itemEditando ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizado de lista de canales
  const renderListaCanales = () => {
    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">
              <Share2 size={24} className="me-2" />
              Canales de Venta / Origen de Clientes
            </h3>
            <button
              className="btn btn-link p-0"
              onClick={() => setVistaActual('menu')}
            >
              ← Volver al menú principal
            </button>
          </div>
          <button
            onClick={() => {
              setMostrarFormulario(true);
              setItemEditando(null);
              limpiarFormulario('canal');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Agregar Canal
          </button>
        </div>

        {canalesVenta.length > 0 && (
          <div className="row mb-3">
            <div className="col-md-6">
              <BarraBusqueda
                busqueda={paginacionCanales.busqueda}
                setBusqueda={paginacionCanales.setBusqueda}
                placeholder="Buscar canales..."
              />
            </div>
            <div className="col-md-6 text-end">
              <small className="text-muted">
                Mostrando {paginacionCanales.itemsPaginados.length} de {paginacionCanales.totalItems} canales
              </small>
            </div>
          </div>
        )}

        <div className="card">
          {canalesVenta.length === 0 ? (
            <div className="card-body text-center py-5">
              <Share2 size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay canales configurados</h5>
              <p className="text-muted">Comience agregando el primer canal de venta</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th width="80">Orden</th>
                      <th>Código</th>
                      <th>Canal</th>
                      <th>Descripción</th>
                      <th>Visual</th>
                      <th>Estado</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacionCanales.itemsPaginados.map((canal) => (
                      <tr key={canal.id}>
                        <td>
                          <span className="badge bg-secondary">{canal.orden}</span>
                        </td>
                        <td>
                          <code>{canal.codigo}</code>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className={`rounded-circle bg-${canal.color} bg-opacity-10 p-2 me-2`}>
                              {obtenerIcono(canal.icono, 'canal')}
                            </div>
                            <div>
                              <div className="fw-semibold">{canal.nombre}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <small className="text-muted">{canal.descripcion}</small>
                        </td>
                        <td>
                          <span className={`badge bg-${canal.color}`}>
                            {canal.nombre}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => cambiarEstado(canal.id, 'canal')}
                            className={`btn btn-sm ${canal.activo ? 'btn-success' : 'btn-secondary'}`}
                          >
                            {canal.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              onClick={() => editarItem(canal, 'canal')}
                              className="btn btn-outline-primary"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarItem(canal.id, 'canal')}
                              className="btn btn-outline-danger"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginacionCanales.totalPaginas > 1 && (
                <div className="card-footer">
                  <Paginacion
                    paginaActual={paginacionCanales.paginaActual}
                    totalPaginas={paginacionCanales.totalPaginas}
                    setPaginaActual={paginacionCanales.setPaginaActual}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de formulario de canal */}
        {mostrarFormulario && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {itemEditando ? 'Editar Canal de Venta' : 'Nuevo Canal de Venta'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('canal');
                    }}
                  />
                </div>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Código <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          value={formularioCanal.codigo}
                          onChange={(e) => setFormularioCanal({...formularioCanal, codigo: e.target.value})}
                          placeholder="Ej: CV_XXX"
                        />
                        <small className="text-muted">Se generará automáticamente si se deja vacío</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Orden de visualización</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formularioCanal.orden}
                          onChange={(e) => setFormularioCanal({...formularioCanal, orden: parseInt(e.target.value) || 1})}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nombre del Canal <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCanal.nombre}
                      onChange={(e) => setFormularioCanal({...formularioCanal, nombre: e.target.value})}
                      placeholder="Ej: Redes Sociales"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formularioCanal.descripcion}
                      onChange={(e) => setFormularioCanal({...formularioCanal, descripcion: e.target.value})}
                      placeholder="Descripción del canal..."
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Icono</label>
                        <select
                          className="form-select"
                          value={formularioCanal.icono}
                          onChange={(e) => setFormularioCanal({...formularioCanal, icono: e.target.value})}
                        >
                          {iconosDisponibles.map(icono => (
                            <option key={icono.valor} value={icono.valor}>
                              {icono.nombre}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2">
                          <span className="me-2">Vista previa:</span>
                          <span className={`badge bg-${formularioCanal.color} p-2`}>
                            {obtenerIcono(formularioCanal.icono, 'canal')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Color</label>
                        <select
                          className="form-select"
                          value={formularioCanal.color}
                          onChange={(e) => setFormularioCanal({...formularioCanal, color: e.target.value})}
                        >
                          {coloresDisponibles.map(color => (
                            <option key={color.valor} value={color.valor}>
                              {color.nombre}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 d-flex gap-1">
                          {coloresDisponibles.map(color => (
                            <div
                              key={color.valor}
                              className={`${color.clase} rounded`}
                              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                              onClick={() => setFormularioCanal({...formularioCanal, color: color.valor})}
                              title={color.nombre}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formularioCanal.activo}
                      onChange={(e) => setFormularioCanal({...formularioCanal, activo: e.target.checked})}
                      id="checkCanalActivo"
                    />
                    <label className="form-check-label" htmlFor="checkCanalActivo">
                      Canal activo
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('canal');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => guardarItem('canal')}
                  >
                    <Save size={16} className="me-2" />
                    {itemEditando ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizado de lista de categorías
  const renderListaCategorias = () => {
    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">
              <Target size={24} className="me-2" />
              Categorías de Clientes
            </h3>
            <button
              className="btn btn-link p-0"
              onClick={() => setVistaActual('menu')}
            >
              ← Volver al menú principal
            </button>
          </div>
          <button
            onClick={() => {
              setMostrarFormulario(true);
              setItemEditando(null);
              limpiarFormulario('categoria');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Agregar Categoría
          </button>
        </div>

        {categoriasClientes.length > 0 && (
          <div className="row mb-3">
            <div className="col-md-6">
              <BarraBusqueda
                busqueda={paginacionCategorias.busqueda}
                setBusqueda={paginacionCategorias.setBusqueda}
                placeholder="Buscar categorías..."
              />
            </div>
            <div className="col-md-6 text-end">
              <small className="text-muted">
                Mostrando {paginacionCategorias.itemsPaginados.length} de {paginacionCategorias.totalItems} categorías
              </small>
            </div>
          </div>
        )}

        <div className="card">
          {categoriasClientes.length === 0 ? (
            <div className="card-body text-center py-5">
              <Target size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay categorías configuradas</h5>
              <p className="text-muted">Comience agregando la primera categoría de clientes</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th width="80">Orden</th>
                      <th>Código</th>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th>Visual</th>
                      <th>Estado</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacionCategorias.itemsPaginados.map((cat) => (
                      <tr key={cat.id}>
                        <td>
                          <span className="badge bg-secondary">{cat.orden}</span>
                        </td>
                        <td>
                          <code>{cat.codigo}</code>
                        </td>
                        <td>
                          <div className="fw-semibold">{cat.nombre}</div>
                        </td>
                        <td>
                          <small className="text-muted">{cat.descripcion}</small>
                        </td>
                        <td>
                          <span className={`badge bg-${cat.color}`}>
                            {cat.nombre}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => cambiarEstado(cat.id, 'categoria')}
                            className={`btn btn-sm ${cat.activo ? 'btn-success' : 'btn-secondary'}`}
                          >
                            {cat.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              onClick={() => editarItem(cat, 'categoria')}
                              className="btn btn-outline-primary"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarItem(cat.id, 'categoria')}
                              className="btn btn-outline-danger"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginacionCategorias.totalPaginas > 1 && (
                <div className="card-footer">
                  <Paginacion
                    paginaActual={paginacionCategorias.paginaActual}
                    totalPaginas={paginacionCategorias.totalPaginas}
                    setPaginaActual={paginacionCategorias.setPaginaActual}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de formulario de categoría */}
        {mostrarFormulario && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {itemEditando ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('categoria');
                    }}
                  />
                </div>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Código <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          value={formularioCategoria.codigo}
                          onChange={(e) => setFormularioCategoria({...formularioCategoria, codigo: e.target.value})}
                          placeholder="Ej: CAT_XXX"
                        />
                        <small className="text-muted">Se generará automáticamente si se deja vacío</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Orden de visualización</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formularioCategoria.orden}
                          onChange={(e) => setFormularioCategoria({...formularioCategoria, orden: parseInt(e.target.value) || 1})}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nombre de la Categoría <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCategoria.nombre}
                      onChange={(e) => setFormularioCategoria({...formularioCategoria, nombre: e.target.value})}
                      placeholder="Ej: VIP"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formularioCategoria.descripcion}
                      onChange={(e) => setFormularioCategoria({...formularioCategoria, descripcion: e.target.value})}
                      placeholder="Descripción de la categoría..."
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Color</label>
                    <select
                      className="form-select"
                      value={formularioCategoria.color}
                      onChange={(e) => setFormularioCategoria({...formularioCategoria, color: e.target.value})}
                    >
                      {coloresDisponibles.map(color => (
                        <option key={color.valor} value={color.valor}>
                          {color.nombre}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2">
                      <span className="me-2">Vista previa:</span>
                      <span className={`badge bg-${formularioCategoria.color}`}>
                        {formularioCategoria.nombre || 'Ejemplo'}
                      </span>
                    </div>
                    <div className="mt-2 d-flex gap-1">
                      {coloresDisponibles.map(color => (
                        <div
                          key={color.valor}
                          className={`${color.clase} rounded`}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          onClick={() => setFormularioCategoria({...formularioCategoria, color: color.valor})}
                          title={color.nombre}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formularioCategoria.activo}
                      onChange={(e) => setFormularioCategoria({...formularioCategoria, activo: e.target.checked})}
                      id="checkCategoriaActivo"
                    />
                    <label className="form-check-label" htmlFor="checkCategoriaActivo">
                      Categoría activa
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('categoria');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => guardarItem('categoria')}
                  >
                    <Save size={16} className="me-2" />
                    {itemEditando ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizado de lista de tipos de trámites
  const renderListaTramites = () => {
    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">
              <ClipboardList size={24} className="me-2" />
              Tipos de Trámites
            </h3>
            <button
              className="btn btn-link p-0"
              onClick={() => setVistaActual('menu')}
            >
              ← Volver al menú principal
            </button>
          </div>
          <button
            onClick={() => {
              setMostrarFormulario(true);
              setItemEditando(null);
              limpiarFormulario('tramite');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Agregar Trámite
          </button>
        </div>

        {tiposTramites.length > 0 && (
          <div className="row mb-3">
            <div className="col-md-6">
              <BarraBusqueda
                busqueda={paginacionTramites.busqueda}
                setBusqueda={paginacionTramites.setBusqueda}
                placeholder="Buscar trámites..."
              />
            </div>
            <div className="col-md-6 text-end">
              <small className="text-muted">
                Mostrando {paginacionTramites.itemsPaginados.length} de {paginacionTramites.totalItems} trámites
              </small>
            </div>
          </div>
        )}

        <div className="card">
          {tiposTramites.length === 0 ? (
            <div className="card-body text-center py-5">
              <ClipboardList size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay tipos de trámites configurados</h5>
              <p className="text-muted">Comience agregando el primer tipo de trámite</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th width="80">Orden</th>
                      <th>Código</th>
                      <th>Tipo de Trámite</th>
                      <th>Descripción</th>
                      <th>Tiempo Estimado</th>
                      <th>Documentos</th>
                      <th>Estado</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacionTramites.itemsPaginados.map((tramite) => (
                      <tr key={tramite.id}>
                        <td>
                          <span className="badge bg-secondary">{tramite.orden}</span>
                        </td>
                        <td>
                          <code>{tramite.codigo}</code>
                        </td>
                        <td>
                          <div className="fw-semibold">{tramite.nombre}</div>
                        </td>
                        <td>
                          <small className="text-muted">{tramite.descripcion}</small>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <Clock size={16} className="text-info me-1" />
                            <span>{tramite.tiempoEstimado} hrs</span>
                          </div>
                        </td>
                        <td>
                          {tramite.requiereDocumentos ? (
                            <div>
                              <span className="badge bg-warning mb-1">Requeridos</span>
                              {tramite.documentosRequeridos && tramite.documentosRequeridos.length > 0 && (
                                <div>
                                  <button
                                    className="btn btn-sm btn-link p-0 text-decoration-none"
                                    type="button"
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="top"
                                    title={tramite.documentosRequeridos.map(codigo => {
                                      const doc = obtenerDocumentoPorCodigo(codigo);
                                      return doc ? `${doc.codigo}: ${doc.nombre}` : codigo;
                                    }).join(' | ')}
                                  >
                                    <small className="text-primary">
                                      <FileText size={14} className="me-1" />
                                      {tramite.documentosRequeridos.length} documento(s)
                                    </small>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="badge bg-secondary">No requeridos</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => cambiarEstado(tramite.id, 'tramite')}
                            className={`btn btn-sm ${tramite.activo ? 'btn-success' : 'btn-secondary'}`}
                          >
                            {tramite.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              onClick={() => editarItem(tramite, 'tramite')}
                              className="btn btn-outline-primary"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarItem(tramite.id, 'tramite')}
                              className="btn btn-outline-danger"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginacionTramites.totalPaginas > 1 && (
                <div className="card-footer">
                  <Paginacion
                    paginaActual={paginacionTramites.paginaActual}
                    totalPaginas={paginacionTramites.totalPaginas}
                    setPaginaActual={paginacionTramites.setPaginaActual}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de formulario de trámite */}
        {mostrarFormulario && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {itemEditando ? 'Editar Tipo de Trámite' : 'Nuevo Tipo de Trámite'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('tramite');
                    }}
                  />
                </div>
                <div className="modal-body">
                  <div className="alert alert-info py-2 d-flex align-items-center">
                    <Info size={16} className="me-2" />
                    <small>
                      <strong>Nota:</strong> El código del trámite se generará automáticamente por el sistema.
                      {itemEditando && tiposTramites.find(t => t.id === itemEditando.id) && (
                        <span> Código actual: <code>{itemEditando.codigo}</code></span>
                      )}
                    </small>
                  </div>
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Orden de visualización</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formularioTramite.orden}
                          onChange={(e) => setFormularioTramite({...formularioTramite, orden: parseInt(e.target.value) || 1})}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nombre del Trámite <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioTramite.nombre}
                      onChange={(e) => setFormularioTramite({...formularioTramite, nombre: e.target.value})}
                      placeholder="Ej: ALTA DE ASEGURADO"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formularioTramite.descripcion}
                      onChange={(e) => setFormularioTramite({...formularioTramite, descripcion: e.target.value})}
                      placeholder="Descripción del trámite..."
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Tiempo Estimado (horas)</label>
                        <div className="input-group">
                          <span className="input-group-text">
                            <Clock size={16} />
                          </span>
                          <input
                            type="number"
                            className="form-control"
                            value={formularioTramite.tiempoEstimado}
                            onChange={(e) => setFormularioTramite({...formularioTramite, tiempoEstimado: parseInt(e.target.value) || 24})}
                            min="1"
                            max="720"
                          />
                          <span className="input-group-text">horas</span>
                        </div>
                        <small className="text-muted">Tiempo promedio para completar el trámite</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Requiere Documentos</label>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={formularioTramite.requiereDocumentos}
                            onChange={(e) => setFormularioTramite({
                              ...formularioTramite, 
                              requiereDocumentos: e.target.checked,
                              documentosRequeridos: e.target.checked ? formularioTramite.documentosRequeridos : []
                            })}
                            id="checkRequiereDocumentos"
                          />
                          <label className="form-check-label" htmlFor="checkRequiereDocumentos">
                            {formularioTramite.requiereDocumentos ? 'Sí requiere documentación' : 'No requiere documentación'}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  {formularioTramite.requiereDocumentos && (
                    <div className="mb-3">
                      <label className="form-label">Documentos Requeridos</label>
                      <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <div className="mb-2">
                          <strong className="text-muted small">Persona Física:</strong>
                        </div>
                        {documentosPersonaFisica.filter(d => d.activo).map(doc => (
                          <div key={doc.codigo} className="form-check mb-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`doc_${doc.codigo}`}
                              checked={formularioTramite.documentosRequeridos.includes(doc.codigo)}
                              onChange={(e) => {
                                const newDocs = e.target.checked
                                  ? [...formularioTramite.documentosRequeridos, doc.codigo]
                                  : formularioTramite.documentosRequeridos.filter(d => d !== doc.codigo);
                                setFormularioTramite({
                                  ...formularioTramite,
                                  documentosRequeridos: newDocs
                                });
                              }}
                            />
                            <label className="form-check-label" htmlFor={`doc_${doc.codigo}`}>
                              <code className="me-2">{doc.codigo}</code>
                              {doc.nombre}
                              {doc.obligatorio && <span className="badge bg-danger ms-2">Obligatorio</span>}
                            </label>
                          </div>
                        ))}
                        <div className="mt-3 mb-2">
                          <strong className="text-muted small">Persona Moral:</strong>
                        </div>
                        {documentosPersonaMoral.filter(d => d.activo).map(doc => (
                          <div key={doc.codigo} className="form-check mb-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`doc_${doc.codigo}`}
                              checked={formularioTramite.documentosRequeridos.includes(doc.codigo)}
                              onChange={(e) => {
                                const newDocs = e.target.checked
                                  ? [...formularioTramite.documentosRequeridos, doc.codigo]
                                  : formularioTramite.documentosRequeridos.filter(d => d !== doc.codigo);
                                setFormularioTramite({
                                  ...formularioTramite,
                                  documentosRequeridos: newDocs
                                });
                              }}
                            />
                            <label className="form-check-label" htmlFor={`doc_${doc.codigo}`}>
                              <code className="me-2">{doc.codigo}</code>
                              {doc.nombre}
                              {doc.obligatorio && <span className="badge bg-danger ms-2">Obligatorio</span>}
                            </label>
                          </div>
                        ))}
                      </div>
                      {formularioTramite.documentosRequeridos.length > 0 && (
                        <small className="text-muted mt-2 d-block">
                          <Info size={12} className="me-1" />
                          {formularioTramite.documentosRequeridos.length} documento(s) seleccionado(s)
                        </small>
                      )}
                    </div>
                  )}
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formularioTramite.activo}
                      onChange={(e) => setFormularioTramite({...formularioTramite, activo: e.target.checked})}
                      id="checkTramiteActivo"
                    />
                    <label className="form-check-label" htmlFor="checkTramiteActivo">
                      Trámite activo
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('tramite');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => guardarItem('tramite')}
                  >
                    <Save size={16} className="me-2" />
                    {itemEditando ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizado de lista de tipos de productos
  const renderListaProductos = () => {
    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">
              <Package size={24} className="me-2" />
              Tipos de Productos
            </h3>
            <button
              className="btn btn-link p-0"
              onClick={() => setVistaActual('menu')}
            >
              ← Volver al menú principal
            </button>
          </div>
          <button
            onClick={() => {
              setMostrarFormulario(true);
              setItemEditando(null);
              limpiarFormulario('producto');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Agregar Producto
          </button>
        </div>

        {tiposProductos.length > 0 && (
          <div className="row mb-3">
            <div className="col-md-6">
              <BarraBusqueda
                busqueda={paginacionProductos.busqueda}
                setBusqueda={paginacionProductos.setBusqueda}
                placeholder="Buscar productos..."
              />
            </div>
            <div className="col-md-6 text-end">
              <small className="text-muted">
                Mostrando {paginacionProductos.itemsPaginados.length} de {paginacionProductos.totalItems} productos
              </small>
            </div>
          </div>
        )}

        <div className="card">
          {tiposProductos.length === 0 ? (
            <div className="card-body text-center py-5">
              <Package size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay tipos de productos configurados</h5>
              <p className="text-muted">Comience agregando el primer tipo de producto</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th width="80">Orden</th>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Descripción</th>
                      <th>Visual</th>
                      <th>Estado</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacionProductos.itemsPaginados.map((producto) => (
                      <tr key={producto.id}>
                        <td>
                          <span className="badge bg-secondary">{producto.orden}</span>
                        </td>
                        <td>
                          <code>{producto.codigo}</code>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className={`rounded-circle bg-${producto.color} bg-opacity-10 p-2 me-2`}>
                              {obtenerIcono(producto.icono, 'producto')}
                            </div>
                            <div>
                              <div className="fw-semibold">{producto.nombre}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <small className="text-muted">{producto.descripcion}</small>
                        </td>
                        <td>
                          <span className={`badge bg-${producto.color}`}>
                            {obtenerIcono(producto.icono, 'producto')}
                            <span className="ms-1">{producto.nombre}</span>
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => cambiarEstado(producto.id, 'producto')}
                            className={`btn btn-sm ${producto.activo ? 'btn-success' : 'btn-secondary'}`}
                          >
                            {producto.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              onClick={() => editarItem(producto, 'producto')}
                              className="btn btn-outline-primary"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarItem(producto.id, 'producto')}
                              className="btn btn-outline-danger"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginacionProductos.totalPaginas > 1 && (
                <div className="card-footer">
                  <Paginacion
                    paginaActual={paginacionProductos.paginaActual}
                    totalPaginas={paginacionProductos.totalPaginas}
                    setPaginaActual={paginacionProductos.setPaginaActual}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de formulario de producto */}
        {mostrarFormulario && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {itemEditando ? 'Editar Tipo de Producto' : 'Nuevo Tipo de Producto'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('producto');
                    }}
                  />
                </div>
                <div className="modal-body">
                  <div className="alert alert-info py-2 d-flex align-items-center">
                    <Info size={16} className="me-2" />
                    <small>
                      <strong>Nota:</strong> En el futuro, este catálogo se sincronizará automáticamente con el sistema de productos principal.
                    </small>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Código <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          value={formularioProducto.codigo}
                          onChange={(e) => setFormularioProducto({...formularioProducto, codigo: e.target.value})}
                          placeholder="Ej: PROD_XXX"
                        />
                        <small className="text-muted">Se generará automáticamente si se deja vacío</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Orden de visualización</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formularioProducto.orden}
                          onChange={(e) => setFormularioProducto({...formularioProducto, orden: parseInt(e.target.value) || 1})}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nombre del Producto <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioProducto.nombre}
                      onChange={(e) => setFormularioProducto({...formularioProducto, nombre: e.target.value})}
                      placeholder="Ej: Autos"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formularioProducto.descripcion}
                      onChange={(e) => setFormularioProducto({...formularioProducto, descripcion: e.target.value})}
                      placeholder="Descripción del tipo de producto..."
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Icono</label>
                        <select
                          className="form-select"
                          value={formularioProducto.icono}
                          onChange={(e) => setFormularioProducto({...formularioProducto, icono: e.target.value})}
                        >
                          {iconosProductos.map(icono => (
                            <option key={icono.valor} value={icono.valor}>
                              {icono.nombre}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2">
                          <span className="me-2">Vista previa:</span>
                          <span className={`badge bg-${formularioProducto.color} p-2`}>
                            {obtenerIcono(formularioProducto.icono, 'producto')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Color</label>
                        <select
                          className="form-select"
                          value={formularioProducto.color}
                          onChange={(e) => setFormularioProducto({...formularioProducto, color: e.target.value})}
                        >
                          {coloresDisponibles.map(color => (
                            <option key={color.valor} value={color.valor}>
                              {color.nombre}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 d-flex gap-1">
                          {coloresDisponibles.map(color => (
                            <div
                              key={color.valor}
                              className={`${color.clase} rounded`}
                              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                              onClick={() => setFormularioProducto({...formularioProducto, color: color.valor})}
                              title={color.nombre}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formularioProducto.activo}
                      onChange={(e) => setFormularioProducto({...formularioProducto, activo: e.target.checked})}
                      id="checkProductoActivo"
                    />
                    <label className="form-check-label" htmlFor="checkProductoActivo">
                      Producto activo
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarFormulario(false);
                      setItemEditando(null);
                      limpiarFormulario('producto');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => guardarItem('producto')}
                  >
                    <Save size={16} className="me-2" />
                    {itemEditando ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizado principal
  return (
    <div>
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css"
        rel="stylesheet"
      />
      {vistaActual === 'menu' && renderMenu()}
      {vistaActual === 'docFisica' && renderListaDocumentos('docFisica')}
      {vistaActual === 'docMoral' && renderListaDocumentos('docMoral')}
      {vistaActual === 'canales' && renderListaCanales()}
      {vistaActual === 'categorias' && renderListaCategorias()}
      {vistaActual === 'tramites' && renderListaTramites()}
      {vistaActual === 'productos' && renderListaProductos()}
    </div>
  );
};

export default ModuloConfiguracionCatalogos;