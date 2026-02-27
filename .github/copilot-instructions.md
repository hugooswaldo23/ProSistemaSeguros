<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

Este proyecto es una aplicación ReactJS creada con Vite. Usa las mejores prácticas de React y Vite para sugerencias de código.

## Extracción de datos de pólizas (PDF)

Cuando se trabaje con extractores de PDF, prompts de IA para extracción, o cualquier tarea relacionada con lectura/parseo de pólizas de seguros, **siempre** consultar el documento de referencia:

📄 `docs/CAMPOS-EXTRACCION-POLIZAS.md`

Reglas clave:
- **Regex (extractor específico por aseguradora):** Extraer los 50 campos para producto "autos".
- **IA (OpenAI / extracción genérica):** Campos 1–50 si es "autos"; campos 1–36 (universales, sin vehículo) para vida, GMM, daños y otros productos.
- Fechas siempre en formato `YYYY-MM-DD`.
- Montos como string numérico sin `$` ni comas: `"12345.67"`.
- Campos no encontrados devuelven cadena vacía `""`.
- `tipo_persona` se deduce del RFC (13 = Física, 12 = Moral).
- `fecha_captura` siempre es la fecha actual.
- Los extractores están en `src/lib/pdf/extractors/` organizados por aseguradora.
