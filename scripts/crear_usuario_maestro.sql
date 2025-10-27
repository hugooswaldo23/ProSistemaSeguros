-- Script para crear usuario maestro/administrador
-- Ejecutar este script en la base de datos para crear o restaurar acceso

-- Insertar usuario maestro en equipo_de_trabajo
INSERT INTO equipo_de_trabajo (
  id,
  codigo,
  nombre,
  apellido_paterno,
  apellido_materno,
  perfil,
  usuario,
  contrasena,
  activo,
  fecha_ingreso,
  fecha_registro,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'ADMIN001',
  'Administrador',
  'Sistema',
  'ProSeguros',
  'Administrador',
  'admin',
  'admin123', -- Cambiar esta contraseña después del primer acceso
  true,
  CURRENT_DATE,
  CURRENT_DATE,
  NOW(),
  NOW()
)
ON CONFLICT (usuario) DO UPDATE
SET 
  contrasena = 'admin123',
  activo = true,
  updated_at = NOW();

-- Mensaje de confirmación
SELECT 'Usuario maestro creado/restaurado exitosamente' as mensaje,
       'Usuario: admin' as usuario,
       'Contraseña: admin123' as contrasena,
       '⚠️ IMPORTANTE: Cambiar la contraseña después del primer acceso' as nota;
