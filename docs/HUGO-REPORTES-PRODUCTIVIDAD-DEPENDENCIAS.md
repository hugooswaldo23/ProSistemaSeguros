# 📊 Nuevas Pantallas de Reportes de Productividad — Dependencias Backend

**Fecha:** 20 de febrero 2026  
**Prioridad:** Media  
**Frontend listo:** ✅ Sí, ya está subido y funcionando

---

## Resumen

Se agregaron 3 nuevas pantallas de reportes en el frontend:

1. **Producción y Cartera** (`/reportes/produccion-cartera`) — Reporte consolidado de producción por ramo, aseguradora y agente con drill-down y filtros por agente/vendedor
2. **Cobranza y Estado Financiero** (`/reportes/cobranza`) — KPIs de cobranza: pagados, pendientes, vencidos, por vencer
3. **Salud de Cartera** (`/reportes/salud-cartera`) — Diagnóstico de salud: pólizas vigentes, por vencer, vencidas, tasa de retención

---

## ¿Qué necesitamos de Backend?

### ✅ Producción y Cartera — NO necesita nada nuevo

Esta pantalla funciona con endpoints que **ya existen**:
- `GET /api/expedientes` — lista de pólizas/expedientes
- `GET /api/equipo-de-trabajo` — catálogo de agentes y vendedores

**No se requiere ningún cambio backend para esta pantalla.**

---

### ⚠️ Cobranza y Salud de Cartera — Requieren confirmar 1 endpoint

Ambas pantallas necesitan obtener **TODOS los recibos de pago** en una sola petición:

```
GET /api/recibos
```

> ⚠️ **Hugo:** ¿Ya está implementado este endpoint (sin parámetro `/:expediente_id`)?  
> Ya se documentó previamente en `BACKEND-ENDPOINT-GET-TODOS-RECIBOS.md`.

#### Campos mínimos necesarios por recibo:

| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | number | Identificador |
| `expediente_id` | string/number | Ligar recibo a su póliza |
| `numero_recibo` | number | Qué recibo es (1, 2, 3...) |
| `monto` | decimal | Sumar montos para KPIs |
| `estatus` | string | "Pagado", "Pendiente", "Vencido", etc. |
| `fecha_vencimiento` | date | Para clasificar vencidos/por vencer |
| `fecha_pago_real` | date/null | Cuándo se pagó |
| `created_at` | datetime | Fecha de creación del recibo |

#### Respuesta esperada:
```json
[
  {
    "id": 1,
    "expediente_id": 514,
    "numero_recibo": 1,
    "monto": 2500.00,
    "estatus": "Pagado",
    "fecha_vencimiento": "2026-01-15",
    "fecha_pago_real": "2026-01-10",
    "created_at": "2026-01-01T10:00:00"
  },
  ...
]
```

---

## Resumen de Acciones para Hugo

| # | Acción | Prioridad |
|---|--------|-----------|
| 1 | **Confirmar** si `GET /api/recibos` (sin parámetro) ya existe | 🔴 Alta |
| 2 | Si NO existe, **crearlo** según spec de `BACKEND-ENDPOINT-GET-TODOS-RECIBOS.md` | 🔴 Alta |
| 3 | Verificar que el endpoint devuelve los campos listados arriba | 🟡 Media |

> **Nota:** Si el endpoint ya existe, no hay nada que hacer. Las 3 pantallas quedan funcionales automáticamente.

---

## Cambios realizados en Frontend (referencia)

- `src/screens/ProduccionCartera.jsx` — **NUEVO** — Reporte de producción consolidado
- `src/screens/CobranzaEstadoFinanciero.jsx` — **NUEVO** — Reporte de cobranza
- `src/screens/SaludCartera.jsx` — **NUEVO** — Diagnóstico de salud de cartera
- `src/components/Sidebar.jsx` — **MODIFICADO** — Menú reorganizado con grupos "Ingresos y Egresos" y "Productividad"
- `src/App.jsx` — **MODIFICADO** — 3 nuevas rutas lazy-loaded
