Basándome en el PDF de Zurich que subiste, voy a crear el extractor. Por favor carga el PDF en el sistema y yo podré ver el texto extraído para crear los patrones correctos.

Mientras tanto, te doy la estructura base del extractor de Zurich:

## 📋 ESTRUCTURA DEL EXTRACTOR ZURICH

### 1️⃣ **Detector Ligero** - Patrones únicos de Zurich:
- Texto "ZURICH" en mayúsculas
- Logo o marca registrada
- Teléfono característico
- Formato de póliza único

### 2️⃣ **Extractor específico** - `src/lib/pdf/extractors/zurich/autos.js`

**Campos a extraer:**
- RFC y tipo de persona
- Nombre completo / Razón Social  
- Domicilio completo
- Datos de vehículo (marca, modelo, año, serie, placas)
- Número de póliza
- Vigencias (inicio/fin/emisión)
- Agente
- Forma de pago
- Montos (prima, gastos, IVA, total)
- Coberturas

### 3️⃣ **Router** - `src/lib/pdf/extractors/zurich.js`
Redirige al extractor de autos (por ahora)

---

**¿Puedes cargar el PDF en el extractor del sistema para que vea el texto y te doy los patrones exactos?**
