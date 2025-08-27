import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Database, 
  Users, 
  Shield, 
  Bell, 
  Mail, 
  Globe, 
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';

const Configuracion = () => {
  // Estados para diferentes secciones de configuración
  const [configuracionGeneral, setConfiguracionGeneral] = useState({
    nombreEmpresa: 'Sistema de Seguros',
    rfc: '',
    direccion: '',
    telefono: '',
    email: '',
    sitioWeb: '',
    logo: '',
    monedaPredeterminada: 'MXN',
    zonaHoraria: 'America/Mexico_City',
    idioma: 'es'
  });

  const [configuracionBaseDatos, setConfiguracionBaseDatos] = useState({
    host: '',
    puerto: '3306',
    nombreBD: 'sistemaseguros',
    usuario: '',
    password: '',
    ssl: false,
    poolMinimo: 5,
    poolMaximo: 20
  });

  const [configuracionNotificaciones, setConfiguracionNotificaciones] = useState({
    emailNotificaciones: true,
    notificacionesPago: true,
    notificacionesVencimiento: true,
    notificacionesRenovacion: true,
    diasAnticipacionVencimiento: 30,
    diasAnticipacionRenovacion: 60,
    emailRemitente: '',
    servidorSMTP: '',
    puertoSMTP: 587,
    usuarioSMTP: '',
    passwordSMTP: '',
    usarTLS: true
  });

  const [configuracionSeguridad, setConfiguracionSeguridad] = useState({
    sesionExpira: 480, // minutos
    intentosLoginMaximos: 5,
    bloqueoTiempo: 30, // minutos
    requierePasswordComplejo: true,
    cambioPasswordObligatorio: 90, // días
    backupAutomatico: true,
    frecuenciaBackup: 'diario',
    retencionBackups: 30 // días
  });

  const [configuracionSistema, setConfiguracionSistema] = useState({
    modoMantenimiento: false,
    registroAuditoria: true,
    nivelLog: 'info',
    limpiezaLogsAutomatica: true,
    diasRetencionLogs: 90,
    versionSistema: '1.0.0',
    ultimaActualizacion: new Date().toISOString().split('T')[0]
  });

  // Estados de UI
  const [seccionActiva, setSeccionActiva] = useState('general');
  const [mostrarPasswords, setMostrarPasswords] = useState({
    bd: false,
    smtp: false
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [probandoConexion, setProbandoConexion] = useState(false);

  // Secciones de configuración
  const secciones = useMemo(() => [
    { id: 'general', nombre: 'General', icono: Settings },
    { id: 'basedatos', nombre: 'Base de Datos', icono: Database },
    { id: 'notificaciones', nombre: 'Notificaciones', icono: Bell },
    { id: 'seguridad', nombre: 'Seguridad', icono: Shield },
    { id: 'sistema', nombre: 'Sistema', icono: Globe }
  ], []);

  // Cargar configuración desde localStorage al montar
  useEffect(() => {
    const cargarConfiguracion = () => {
      try {
        const configGuardada = localStorage.getItem('sistemaseguros_configuracion');
        if (configGuardada) {
          const config = JSON.parse(configGuardada);
          setConfiguracionGeneral(prev => ({ ...prev, ...config.general }));
          setConfiguracionBaseDatos(prev => ({ ...prev, ...config.baseDatos }));
          setConfiguracionNotificaciones(prev => ({ ...prev, ...config.notificaciones }));
          setConfiguracionSeguridad(prev => ({ ...prev, ...config.seguridad }));
          setConfiguracionSistema(prev => ({ ...prev, ...config.sistema }));
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
      }
    };

    cargarConfiguracion();
  }, []);

  // Función para guardar configuración
  const guardarConfiguracion = useCallback(async () => {
    setGuardando(true);
    try {
      const configuracionCompleta = {
        general: configuracionGeneral,
        baseDatos: configuracionBaseDatos,
        notificaciones: configuracionNotificaciones,
        seguridad: configuracionSeguridad,
        sistema: {
          ...configuracionSistema,
          ultimaActualizacion: new Date().toISOString().split('T')[0]
        }
      };

      localStorage.setItem('sistemaseguros_configuracion', JSON.stringify(configuracionCompleta));
      
      setMensaje({ tipo: 'success', texto: 'Configuración guardada exitosamente' });
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar la configuración' });
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
    } finally {
      setGuardando(false);
    }
  }, [configuracionGeneral, configuracionBaseDatos, configuracionNotificaciones, configuracionSeguridad, configuracionSistema]);

  // Función para probar conexión a base de datos
  const probarConexionBD = useCallback(async () => {
    setProbandoConexion(true);
    try {
      // Simular prueba de conexión
      await new Promise(resolve => setTimeout(resolve, 2000));
      setMensaje({ tipo: 'success', texto: 'Conexión a base de datos exitosa' });
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al conectar con la base de datos' });
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000);
    } finally {
      setProbandoConexion(false);
    }
  }, []);

  // Función para resetear configuración
  const resetearConfiguracion = useCallback(() => {
    if (confirm('¿Está seguro de resetear toda la configuración? Esta acción no se puede deshacer.')) {
      localStorage.removeItem('sistemaseguros_configuracion');
      window.location.reload();
    }
  }, []);

  // Componente de Configuración General
  const ConfiguracionGeneral = () => (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title border-bottom pb-2 mb-4">
          <Settings className="me-2" size={20} />
          Configuración General
        </h5>
        
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Nombre de la Empresa</label>
            <input
              type="text"
              className="form-control"
              value={configuracionGeneral.nombreEmpresa}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                nombreEmpresa: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">RFC</label>
            <input
              type="text"
              className="form-control"
              value={configuracionGeneral.rfc}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                rfc: e.target.value.toUpperCase()
              }))}
              maxLength="13"
            />
          </div>
          
          <div className="col-12">
            <label className="form-label">Dirección</label>
            <textarea
              className="form-control"
              rows="2"
              value={configuracionGeneral.direccion}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                direccion: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Teléfono</label>
            <input
              type="tel"
              className="form-control"
              value={configuracionGeneral.telefono}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                telefono: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={configuracionGeneral.email}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                email: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Sitio Web</label>
            <input
              type="url"
              className="form-control"
              value={configuracionGeneral.sitioWeb}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                sitioWeb: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Moneda Predeterminada</label>
            <select
              className="form-select"
              value={configuracionGeneral.monedaPredeterminada}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                monedaPredeterminada: e.target.value
              }))}
            >
              <option value="MXN">Peso Mexicano (MXN)</option>
              <option value="USD">Dólar Americano (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Zona Horaria</label>
            <select
              className="form-select"
              value={configuracionGeneral.zonaHoraria}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                zonaHoraria: e.target.value
              }))}
            >
              <option value="America/Mexico_City">Ciudad de México</option>
              <option value="America/Tijuana">Tijuana</option>
              <option value="America/Cancun">Cancún</option>
            </select>
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Idioma</label>
            <select
              className="form-select"
              value={configuracionGeneral.idioma}
              onChange={(e) => setConfiguracionGeneral(prev => ({
                ...prev,
                idioma: e.target.value
              }))}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente de Configuración de Base de Datos
  const ConfiguracionBaseDatos = () => (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title border-bottom pb-2 mb-4">
          <Database className="me-2" size={20} />
          Configuración de Base de Datos
        </h5>
        
        <div className="alert alert-warning">
          <AlertTriangle className="me-2" size={16} />
          <strong>Precaución:</strong> Cambios incorrectos en esta configuración pueden afectar el funcionamiento del sistema.
        </div>
        
        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label">Host/Servidor</label>
            <input
              type="text"
              className="form-control"
              value={configuracionBaseDatos.host}
              onChange={(e) => setConfiguracionBaseDatos(prev => ({
                ...prev,
                host: e.target.value
              }))}
              placeholder="localhost o IP del servidor"
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Puerto</label>
            <input
              type="number"
              className="form-control"
              value={configuracionBaseDatos.puerto}
              onChange={(e) => setConfiguracionBaseDatos(prev => ({
                ...prev,
                puerto: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Nombre de la Base de Datos</label>
            <input
              type="text"
              className="form-control"
              value={configuracionBaseDatos.nombreBD}
              onChange={(e) => setConfiguracionBaseDatos(prev => ({
                ...prev,
                nombreBD: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Usuario</label>
            <input
              type="text"
              className="form-control"
              value={configuracionBaseDatos.usuario}
              onChange={(e) => setConfiguracionBaseDatos(prev => ({
                ...prev,
                usuario: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Contraseña</label>
            <div className="input-group">
              <input
                type={mostrarPasswords.bd ? "text" : "password"}
                className="form-control"
                value={configuracionBaseDatos.password}
                onChange={(e) => setConfiguracionBaseDatos(prev => ({
                  ...prev,
                  password: e.target.value
                }))}
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setMostrarPasswords(prev => ({
                  ...prev,
                  bd: !prev.bd
                }))}
              >
                {mostrarPasswords.bd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Usar SSL</label>
            <div className="form-check form-switch mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionBaseDatos.ssl}
                onChange={(e) => setConfiguracionBaseDatos(prev => ({
                  ...prev,
                  ssl: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Conexión SSL habilitada
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Pool Mínimo de Conexiones</label>
            <input
              type="number"
              className="form-control"
              value={configuracionBaseDatos.poolMinimo}
              onChange={(e) => setConfiguracionBaseDatos(prev => ({
                ...prev,
                poolMinimo: parseInt(e.target.value) || 5
              }))}
              min="1"
              max="50"
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Pool Máximo de Conexiones</label>
            <input
              type="number"
              className="form-control"
              value={configuracionBaseDatos.poolMaximo}
              onChange={(e) => setConfiguracionBaseDatos(prev => ({
                ...prev,
                poolMaximo: parseInt(e.target.value) || 20
              }))}
              min="5"
              max="100"
            />
          </div>
          
          <div className="col-12">
            <button
              className="btn btn-info"
              onClick={probarConexionBD}
              disabled={probandoConexion}
            >
              {probandoConexion ? (
                <>
                  <RefreshCw className="me-2 spin" size={16} />
                  Probando Conexión...
                </>
              ) : (
                <>
                  <Database className="me-2" size={16} />
                  Probar Conexión
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente de Configuración de Notificaciones
  const ConfiguracionNotificaciones = () => (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title border-bottom pb-2 mb-4">
          <Bell className="me-2" size={20} />
          Configuración de Notificaciones
        </h5>
        
        <div className="row g-3">
          <div className="col-12">
            <h6 className="text-muted">Tipos de Notificaciones</h6>
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionNotificaciones.emailNotificaciones}
                onChange={(e) => setConfiguracionNotificaciones(prev => ({
                  ...prev,
                  emailNotificaciones: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Notificaciones por Email
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionNotificaciones.notificacionesPago}
                onChange={(e) => setConfiguracionNotificaciones(prev => ({
                  ...prev,
                  notificacionesPago: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Notificaciones de Pagos
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionNotificaciones.notificacionesVencimiento}
                onChange={(e) => setConfiguracionNotificaciones(prev => ({
                  ...prev,
                  notificacionesVencimiento: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Notificaciones de Vencimiento
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionNotificaciones.notificacionesRenovacion}
                onChange={(e) => setConfiguracionNotificaciones(prev => ({
                  ...prev,
                  notificacionesRenovacion: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Notificaciones de Renovación
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Días de Anticipación - Vencimiento</label>
            <input
              type="number"
              className="form-control"
              value={configuracionNotificaciones.diasAnticipacionVencimiento}
              onChange={(e) => setConfiguracionNotificaciones(prev => ({
                ...prev,
                diasAnticipacionVencimiento: parseInt(e.target.value) || 30
              }))}
              min="1"
              max="90"
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Días de Anticipación - Renovación</label>
            <input
              type="number"
              className="form-control"
              value={configuracionNotificaciones.diasAnticipacionRenovacion}
              onChange={(e) => setConfiguracionNotificaciones(prev => ({
                ...prev,
                diasAnticipacionRenovacion: parseInt(e.target.value) || 60
              }))}
              min="1"
              max="180"
            />
          </div>
          
          <div className="col-12 mt-4">
            <h6 className="text-muted">Configuración SMTP</h6>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Email Remitente</label>
            <input
              type="email"
              className="form-control"
              value={configuracionNotificaciones.emailRemitente}
              onChange={(e) => setConfiguracionNotificaciones(prev => ({
                ...prev,
                emailRemitente: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Servidor SMTP</label>
            <input
              type="text"
              className="form-control"
              value={configuracionNotificaciones.servidorSMTP}
              onChange={(e) => setConfiguracionNotificaciones(prev => ({
                ...prev,
                servidorSMTP: e.target.value
              }))}
              placeholder="smtp.gmail.com"
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Puerto SMTP</label>
            <input
              type="number"
              className="form-control"
              value={configuracionNotificaciones.puertoSMTP}
              onChange={(e) => setConfiguracionNotificaciones(prev => ({
                ...prev,
                puertoSMTP: parseInt(e.target.value) || 587
              }))}
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Usuario SMTP</label>
            <input
              type="text"
              className="form-control"
              value={configuracionNotificaciones.usuarioSMTP}
              onChange={(e) => setConfiguracionNotificaciones(prev => ({
                ...prev,
                usuarioSMTP: e.target.value
              }))}
            />
          </div>
          
          <div className="col-md-4">
            <label className="form-label">Contraseña SMTP</label>
            <div className="input-group">
              <input
                type={mostrarPasswords.smtp ? "text" : "password"}
                className="form-control"
                value={configuracionNotificaciones.passwordSMTP}
                onChange={(e) => setConfiguracionNotificaciones(prev => ({
                  ...prev,
                  passwordSMTP: e.target.value
                }))}
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setMostrarPasswords(prev => ({
                  ...prev,
                  smtp: !prev.smtp
                }))}
              >
                {mostrarPasswords.smtp ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionNotificaciones.usarTLS}
                onChange={(e) => setConfiguracionNotificaciones(prev => ({
                  ...prev,
                  usarTLS: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Usar TLS/SSL
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente de Configuración de Seguridad
  const ConfiguracionSeguridad = () => (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title border-bottom pb-2 mb-4">
          <Shield className="me-2" size={20} />
          Configuración de Seguridad
        </h5>
        
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Tiempo de Expiración de Sesión (minutos)</label>
            <input
              type="number"
              className="form-control"
              value={configuracionSeguridad.sesionExpira}
              onChange={(e) => setConfiguracionSeguridad(prev => ({
                ...prev,
                sesionExpira: parseInt(e.target.value) || 480
              }))}
              min="30"
              max="1440"
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Intentos de Login Máximos</label>
            <input
              type="number"
              className="form-control"
              value={configuracionSeguridad.intentosLoginMaximos}
              onChange={(e) => setConfiguracionSeguridad(prev => ({
                ...prev,
                intentosLoginMaximos: parseInt(e.target.value) || 5
              }))}
              min="3"
              max="10"
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Tiempo de Bloqueo (minutos)</label>
            <input
              type="number"
              className="form-control"
              value={configuracionSeguridad.bloqueoTiempo}
              onChange={(e) => setConfiguracionSeguridad(prev => ({
                ...prev,
                bloqueoTiempo: parseInt(e.target.value) || 30
              }))}
              min="5"
              max="120"
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Cambio de Contraseña Obligatorio (días)</label>
            <input
              type="number"
              className="form-control"
              value={configuracionSeguridad.cambioPasswordObligatorio}
              onChange={(e) => setConfiguracionSeguridad(prev => ({
                ...prev,
                cambioPasswordObligatorio: parseInt(e.target.value) || 90
              }))}
              min="30"
              max="365"
            />
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionSeguridad.requierePasswordComplejo}
                onChange={(e) => setConfiguracionSeguridad(prev => ({
                  ...prev,
                  requierePasswordComplejo: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Requerir Contraseña Compleja
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionSeguridad.backupAutomatico}
                onChange={(e) => setConfiguracionSeguridad(prev => ({
                  ...prev,
                  backupAutomatico: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Backup Automático
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Frecuencia de Backup</label>
            <select
              className="form-select"
              value={configuracionSeguridad.frecuenciaBackup}
              onChange={(e) => setConfiguracionSeguridad(prev => ({
                ...prev,
                frecuenciaBackup: e.target.value
              }))}
              disabled={!configuracionSeguridad.backupAutomatico}
            >
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Retención de Backups (días)</label>
            <input
              type="number"
              className="form-control"
              value={configuracionSeguridad.retencionBackups}
              onChange={(e) => setConfiguracionSeguridad(prev => ({
                ...prev,
                retencionBackups: parseInt(e.target.value) || 30
              }))}
              min="7"
              max="365"
              disabled={!configuracionSeguridad.backupAutomatico}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Componente de Configuración del Sistema
  const ConfiguracionSistema = () => (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title border-bottom pb-2 mb-4">
          <Globe className="me-2" size={20} />
          Configuración del Sistema
        </h5>
        
        <div className="row g-3">
          <div className="col-md-6">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionSistema.modoMantenimiento}
                onChange={(e) => setConfiguracionSistema(prev => ({
                  ...prev,
                  modoMantenimiento: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Modo Mantenimiento
              </label>
            </div>
            <small className="text-muted">
              Bloquea el acceso al sistema para usuarios normales
            </small>
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionSistema.registroAuditoria}
                onChange={(e) => setConfiguracionSistema(prev => ({
                  ...prev,
                  registroAuditoria: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Registro de Auditoría
              </label>
            </div>
            <small className="text-muted">
              Registra todas las acciones de los usuarios
            </small>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Nivel de Logs</label>
            <select
              className="form-select"
              value={configuracionSistema.nivelLog}
              onChange={(e) => setConfiguracionSistema(prev => ({
                ...prev,
                nivelLog: e.target.value
              }))}
            >
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Retención de Logs (días)</label>
            <input
              type="number"
              className="form-control"
              value={configuracionSistema.diasRetencionLogs}
              onChange={(e) => setConfiguracionSistema(prev => ({
                ...prev,
                diasRetencionLogs: parseInt(e.target.value) || 90
              }))}
              min="7"
              max="365"
              disabled={!configuracionSistema.limpiezaLogsAutomatica}
            />
          </div>
          
          <div className="col-md-6">
            <div className="form-check form-switch mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                checked={configuracionSistema.limpiezaLogsAutomatica}
                onChange={(e) => setConfiguracionSistema(prev => ({
                  ...prev,
                  limpiezaLogsAutomatica: e.target.checked
                }))}
              />
              <label className="form-check-label">
                Limpieza Automática de Logs
              </label>
            </div>
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Versión del Sistema</label>
            <input
              type="text"
              className="form-control"
              value={configuracionSistema.versionSistema}
              readOnly
              disabled
            />
          </div>
          
          <div className="col-md-6">
            <label className="form-label">Última Actualización</label>
            <input
              type="date"
              className="form-control"
              value={configuracionSistema.ultimaActualizacion}
              readOnly
              disabled
            />
          </div>
          
          <div className="col-12 mt-4">
            <div className="alert alert-danger">
              <AlertTriangle className="me-2" size={16} />
              <strong>Zona de Peligro</strong>
              <hr />
              <button
                className="btn btn-outline-danger"
                onClick={resetearConfiguracion}
              >
                Resetear Toda la Configuración
              </button>
              <small className="d-block mt-2">
                Esta acción eliminará toda la configuración y no se puede deshacer.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">Configuración del Sistema</h3>
            <p className="text-muted mb-0">Administra la configuración general del sistema</p>
          </div>
          <div className="d-flex gap-2">
            <button
              onClick={guardarConfiguracion}
              className="btn btn-primary"
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <RefreshCw className="me-2 spin" size={16} />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="me-2" size={16} />
                  Guardar Configuración
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mensaje de estado */}
        {mensaje.texto && (
          <div className={`alert alert-${mensaje.tipo === 'success' ? 'success' : 'danger'} alert-dismissible fade show`}>
            {mensaje.tipo === 'success' ? (
              <Check className="me-2" size={16} />
            ) : (
              <X className="me-2" size={16} />
            )}
            {mensaje.texto}
          </div>
        )}

        <div className="row">
          {/* Navegación lateral */}
          <div className="col-md-3">
            <div className="card">
              <div className="card-body p-0">
                <div className="list-group list-group-flush">
                  {secciones.map(seccion => {
                    const IconoSeccion = seccion.icono;
                    return (
                      <button
                        key={seccion.id}
                        className={`list-group-item list-group-item-action d-flex align-items-center ${
                          seccionActiva === seccion.id ? 'active' : ''
                        }`}
                        onClick={() => setSeccionActiva(seccion.id)}
                      >
                        <IconoSeccion className="me-2" size={18} />
                        {seccion.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Contenido de configuración */}
          <div className="col-md-9">
            {seccionActiva === 'general' && <ConfiguracionGeneral />}
            {seccionActiva === 'basedatos' && <ConfiguracionBaseDatos />}
            {seccionActiva === 'notificaciones' && <ConfiguracionNotificaciones />}
            {seccionActiva === 'seguridad' && <ConfiguracionSeguridad />}
            {seccionActiva === 'sistema' && <ConfiguracionSistema />}
          </div>
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Configuracion;