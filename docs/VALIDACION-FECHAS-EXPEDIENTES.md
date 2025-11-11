# Validación de Fechas Clave en Expedientes

Para evitar confusiones y asegurar que el Dashboard y los reportes funcionen correctamente, es indispensable que la base de datos de expedientes tenga **todas las fechas clave** bien definidas y pobladas.

## Fechas requeridas por expediente
- **fecha_emision**: Fecha en que la aseguradora creó la póliza (no cuando se envió al cliente).
- **fecha_pago**: Fecha en que el cliente realizó el pago.
- **fecha_vencimiento_pago**: Fecha límite para el pago actual (puede coincidir con proximo_pago).
- **fecha_cancelacion**: Fecha en que la póliza fue cancelada (si aplica).

## Acciones recomendadas para backend
1. **Validar que todas las columnas existen en la tabla expedientes**:
   - Si falta alguna, agregarla mediante migración SQL.
2. **Verificar que los endpoints GET/POST/PUT leen y escriben correctamente estas fechas.**
3. **Poblar fechas faltantes en expedientes existentes**:
   - Si hay pólizas sin fecha_emision, fecha_pago o fecha_vencimiento_pago, intentar poblarlas desde datos históricos o dejar explícito que están incompletas.
4. **Agregar fecha_cancelacion**:
   - Útil para auditoría y reportes, aunque no afecta el cálculo de emitidas/pagadas/vencidas.

## Reglas del Dashboard
- Si una póliza no tiene fecha_emision, **no se cuenta como emitida**.
- Si no tiene fecha_pago, **no se cuenta como pagada**.
- Si no tiene fecha_vencimiento_pago, **no se cuenta en por vencer/vencidas**.
- Si no tiene fecha_cancelacion, solo se marca como cancelada por etapa_activa.

## Siguiente paso
- Validar y poblar todas las fechas clave en expedientes.
- Confirmar que los endpoints y migraciones están alineados con estas reglas.

---
**Referencia:** Este documento resume los requisitos mínimos para que el Dashboard y los reportes sean confiables y claros para todos los usuarios.