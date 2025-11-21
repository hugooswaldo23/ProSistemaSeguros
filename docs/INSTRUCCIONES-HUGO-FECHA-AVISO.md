# 📋 Instrucciones para Hugo - Campo fecha_aviso_renovacion

## 🎯 Objetivo
Optimizar el sistema para manejar miles de pólizas agregando un campo precalculado que evite recalcular vigencias constantemente.

## 📁 Archivo SQL
Ejecutar: `scripts/agregar_fecha_aviso_renovacion.sql`

## 📊 Campo a agregar
```sql
fecha_aviso_renovacion DATE NULL
```

**Fórmula:** `termino_vigencia - 30 días`

## ✅ Verificaciones post-ejecución

1. **Verificar que se agregó la columna:**
```sql
DESCRIBE expedientes;
```
Debe aparecer `fecha_aviso_renovacion` con tipo DATE

2. **Verificar que se calculó para pólizas existentes:**
```sql
SELECT 
    numero_poliza,
    termino_vigencia,
    fecha_aviso_renovacion,
    DATEDIFF(termino_vigencia, fecha_aviso_renovacion) as dias_diferencia
FROM expedientes 
WHERE termino_vigencia IS NOT NULL
LIMIT 20;
```
`dias_diferencia` debe ser **30** para todas las pólizas

3. **Verificar índice:**
```sql
SHOW INDEX FROM expedientes WHERE Key_name = 'idx_fecha_aviso_renovacion';
```
Debe existir el índice

## 🚀 Queries optimizadas que usaremos

### Pólizas próximas a vencer (hoy):
```sql
SELECT * FROM expedientes 
WHERE fecha_aviso_renovacion = CURDATE()
AND etapa_activa != 'Cancelada';
```

### Pólizas próximas a vencer (próximos 7 días):
```sql
SELECT * FROM expedientes 
WHERE fecha_aviso_renovacion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
AND etapa_activa != 'Cancelada'
ORDER BY fecha_aviso_renovacion;
```

### Pólizas vencidas:
```sql
SELECT * FROM expedientes 
WHERE termino_vigencia < CURDATE()
AND etapa_activa NOT IN ('Cancelada', 'Renovada', 'Vencida')
ORDER BY termino_vigencia DESC;
```

## 📈 Beneficios
- ✅ **Escalable**: Funciona igual con 10 o 100,000 pólizas
- ✅ **Rápido**: Query simple con índice vs recálculo masivo
- ✅ **Preciso**: Cálculo una sola vez al guardar/editar
- ✅ **Dashboard**: Widgets de "Próximas a renovar" super rápidos
- ✅ **Calendario**: Base para calendario de renovaciones

## 🔧 Futuro: Job programado (backend)
Una vez validado, crear job diario que:
1. Query pólizas con `fecha_aviso_renovacion = CURDATE()`
2. Registrar evento `POLIZA_PROXIMA_VENCER` en historial
3. Query pólizas con `termino_vigencia < CURDATE()`
4. Cambiar etapa a "Vencida" y registrar evento

## 📝 Notas
- El frontend ya calcula automáticamente el campo al guardar/editar
- El campo se incluye en el payload de creación/actualización
- No requiere cambios en el backend (solo agregar columna)
