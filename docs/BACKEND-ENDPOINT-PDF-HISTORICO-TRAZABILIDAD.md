# Backend: Abrir PDFs Historicos desde Trazabilidad

## Objetivo

Permitir que el timeline abra PDFs historicos de poliza y endoso usando la `pdf_key` guardada en `datos_adicionales` del historial.

Casos de uso:
- abrir poliza inicial despues de que el PDF vigente fue reemplazado por un endoso
- abrir PDF anterior desde `pdf_cambios.anterior_key`
- abrir PDF nuevo desde un evento historico aunque ya exista otro endoso posterior

## Endpoint propuesto

`POST /api/expedientes/:expedienteId/poliza/url-by-key?expiration=3600`

### Body

```json
{
  "pdf_key": "polizas/2026/expediente-123/POLIZA(2).pdf"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "signed_url": "https://bucket.s3.amazonaws.com/...",
    "expires_in": 3600,
    "pdf_key": "polizas/2026/expediente-123/POLIZA(2).pdf"
  }
}
```

## Validaciones

- verificar autenticacion igual que el endpoint vigente `GET /api/expedientes/:id/poliza/url`
- verificar que el expediente exista
- verificar que la `pdf_key` pertenezca al expediente o al menos a su prefijo esperado en S3
- rechazar keys fuera del namespace permitido

## Logica sugerida

1. recibir `expedienteId` y `pdf_key`
2. validar que `pdf_key` no venga vacia
3. opcional: consultar historial del expediente y confirmar que la key exista en `datos_adicionales.pdf_documento.nuevo_key` o `datos_adicionales.pdf_cambios.(anterior_key|nuevo_key)`
4. generar signed URL con la misma utilidad S3 usada para el PDF vigente
5. devolver `signed_url`

## Motivo

El frontend ya guarda estas referencias en trazabilidad:
- captura inicial: `datos_adicionales.pdf_documento.nuevo_key`
- endoso/edicion: `datos_adicionales.pdf_cambios.anterior_key` y `nuevo_key`

Sin este endpoint, solo puede abrirse el PDF vigente del expediente porque el endpoint actual firma unicamente `expedientes.pdf_key`.

## Frontend ya preparado

El frontend ya intenta consumir este endpoint desde:

- `src/services/pdfService.js` -> `obtenerURLFirmadaPDFPorKey(expedienteId, pdfKey)`

Y lo usa en el timeline para:

- PDF inicial historico
- PDF anterior de un reemplazo
- PDFs historicos posteriores guardados en trazabilidad