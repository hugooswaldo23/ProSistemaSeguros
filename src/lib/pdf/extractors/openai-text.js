/**
 * Extractor Universal con OpenAI GPT-4o mini (HÍBRIDO texto/imagen)
 * 
 * - Intenta con texto primero (1-2 seg)
 * - Si texto es malo, usa imagen (6-8 seg)
 * - Adaptativo según calidad del PDF
 */

import * as pdfjsLib from 'pdfjs-dist';

async function convertirPaginaAImagen(page) {
  const scale = 1.5;
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.90);
}

export async function extraer({ pdfDocument, textoCompleto }) {
  console.log('🤖 Iniciando extracción con OpenAI GPT-4o mini...');
  
  const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!API_KEY) {
    throw new Error('❌ No se encontró VITE_OPENAI_API_KEY');
  }

  try {
    // Decidir si usar texto o imagen
    const textoValido = textoCompleto && textoCompleto.trim().length > 500;
    
    if (textoValido) {
      console.log(`📄 Modo TEXTO (${textoCompleto.length} chars) - RÁPIDO ⚡`);
      return await extraerConTexto(textoCompleto, API_KEY);
    } else {
      console.log('🖼️ Texto insuficiente, modo IMAGEN - LENTO 🐢');
      const page = await pdfDocument.getPage(1);
      const imagen = await convertirPaginaAImagen(page);
      return await extraerConImagen(imagen, API_KEY);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function extraerConTexto(textoCompleto, API_KEY) {
  const prompt = `Extrae datos de esta póliza. Responde SOLO JSON:

TEXTO:
${textoCompleto.substring(0, 8000)}

FORMATO JSON:
{
  "asegurado": {"tipo_persona": "", "nombre": "", "apellido_paterno": "", "apellido_materno": "", "razonSocial": "", "rfc": ""},
  "poliza": {"numero_poliza": "", "aseguradora": "", "producto": "", "tipo_cobertura": "", "forma_pago": ""},
  "vehiculo": {"marca": "", "modelo": "", "anio": "", "version": "", "placas": "", "serie": "", "uso": ""},
  "fechas": {"fecha_emision": "", "fecha_inicio_vigencia": "", "fecha_fin_vigencia": ""},
  "montos": {"prima_neta": "", "gastos_expedicion": "", "cargo_pago_fraccionado": "", "subtotal": "", "iva": "", "total": "", "suma_asegurada": "", "deducible": ""},
  "agente": {"clave_agente": "", "agente": ""},
  "coberturas": []
}`;

  console.log('🌐 Enviando a OpenAI...');
  const start = Date.now();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{role: "user", content: prompt}],
      max_tokens: 2048,
      temperature: 0.1
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OpenAI error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  console.log(`⏱️ ${((Date.now() - start) / 1000).toFixed(2)}s`);

  const texto = data.choices[0]?.message?.content;
  if (!texto) throw new Error('Sin respuesta');

  const json = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const datos = JSON.parse(json);
  
  return normalizarDatos(datos);
}

async function extraerConImagen(imagen, API_KEY) {
  const prompt = `Extrae datos de esta póliza de seguros. Responde SOLO JSON:

{
  "asegurado": {"tipo_persona": "", "nombre": "", "apellido_paterno": "", "apellido_materno": "", "razonSocial": "", "rfc": ""},
  "poliza": {"numero_poliza": "", "aseguradora": "", "producto": "", "tipo_cobertura": "", "forma_pago": ""},
  "vehiculo": {"marca": "", "modelo": "", "anio": "", "version": "", "placas": "", "serie": "", "uso": ""},
  "fechas": {"fecha_emision": "", "fecha_inicio_vigencia": "", "fecha_fin_vigencia": ""},
  "montos": {"prima_neta": "", "gastos_expedicion": "", "cargo_pago_fraccionado": "", "subtotal": "", "iva": "", "total": "", "suma_asegurada": "", "deducible": ""},
  "agente": {"clave_agente": "", "agente": ""},
  "coberturas": []
}`;

  console.log('🌐 Enviando imagen a OpenAI...');
  const start = Date.now();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          {type: "text", text: prompt},
          {type: "image_url", image_url: {url: imagen, detail: "high"}}
        ]
      }],
      max_tokens: 2048,
      temperature: 0.1
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OpenAI error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  console.log(`⏱️ ${((Date.now() - start) / 1000).toFixed(2)}s`);

  const texto = data.choices[0]?.message?.content;
  if (!texto) throw new Error('Sin respuesta');

  const json = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const datos = JSON.parse(json);
  
  return normalizarDatos(datos);
}

function normalizarDatos(datos) {
  return {
    tipo_persona: datos.asegurado?.tipo_persona || '',
    nombre: datos.asegurado?.nombre || '',
    apellido_paterno: datos.asegurado?.apellido_paterno || '',
    apellido_materno: datos.asegurado?.apellido_materno || '',
    razonSocial: datos.asegurado?.razonSocial || '',
    rfc: datos.asegurado?.rfc || '',
    numero_poliza: datos.poliza?.numero_poliza || '',
    aseguradora: datos.poliza?.aseguradora || '',
    producto: datos.poliza?.producto || '',
    tipo_cobertura: datos.poliza?.tipo_cobertura || '',
    forma_pago: datos.poliza?.forma_pago || '',
    marca: datos.vehiculo?.marca || '',
    modelo: datos.vehiculo?.modelo || '',
    anio: datos.vehiculo?.anio || '',
    version: datos.vehiculo?.version || '',
    placas: datos.vehiculo?.placas || '',
    serie: datos.vehiculo?.serie || '',
    uso: datos.vehiculo?.uso || '',
    fecha_emision: datos.fechas?.fecha_emision || '',
    fecha_inicio_vigencia: datos.fechas?.fecha_inicio_vigencia || '',
    fecha_fin_vigencia: datos.fechas?.fecha_fin_vigencia || '',
    prima_neta: limpiar(datos.montos?.prima_neta),
    gastos_expedicion: limpiar(datos.montos?.gastos_expedicion),
    cargo_pago_fraccionado: limpiar(datos.montos?.cargo_pago_fraccionado),
    subtotal: limpiar(datos.montos?.subtotal),
    iva: limpiar(datos.montos?.iva),
    total: limpiar(datos.montos?.total),
    suma_asegurada: limpiar(datos.montos?.suma_asegurada),
    deducible: limpiarDed(datos.montos?.deducible),
    clave_agente: datos.agente?.clave_agente || '',
    agente: datos.agente?.agente || '',
    coberturas: datos.coberturas || []
  };
}

function limpiar(v) {
  if (!v) return '';
  const s = String(v).replace(/[$,\s]/g, '').replace('MXN', '').trim();
  const n = parseFloat(s);
  return !isNaN(n) ? n.toFixed(2) : s;
}

function limpiarDed(v) {
  if (!v) return '';
  const s = String(v).trim();
  return s.includes('%') ? s.replace(/\s/g, '') : limpiar(s);
}
