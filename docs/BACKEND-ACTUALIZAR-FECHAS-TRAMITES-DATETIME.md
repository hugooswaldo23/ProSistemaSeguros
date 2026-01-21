# Backend: Actualizar campos de fecha en tabla tramites a DATETIME

## Fecha: 21 de enero de 2026

## Descripción del cambio

Se requiere actualizar los campos `fecha_inicio` y `fecha_limite` de la tabla `tramites` de tipo `DATE` a `DATETIME` para poder registrar y consultar la hora exacta de los trámites.

## Motivo

El frontend ahora permite capturar fecha y hora en los campos de inicio y límite de trámites. Sin embargo, la base de datos actual solo almacena la fecha (sin hora), perdiendo la información de tiempo.

## SQL para aplicar el cambio

```sql
-- Actualizar campos de DATE a DATETIME
ALTER TABLE tramites 
  MODIFY COLUMN fecha_inicio DATETIME,
  MODIFY COLUMN fecha_limite DATETIME;
```

## Verificación

Después de aplicar el cambio, verificar con:

```sql
DESCRIBE tramites;
```

Los campos `fecha_inicio` y `fecha_limite` deben mostrar tipo `datetime`.

## Impacto

- **Registros existentes**: Mantendrán su fecha con hora 00:00:00
- **Nuevos registros**: Almacenarán la hora correctamente
- **Compatibilidad**: El frontend ya está preparado para manejar ambos formatos

## Estado

- [ ] Pendiente de aplicar en producción
