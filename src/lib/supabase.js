const API_BASE_URL = import.meta.env.VITE_API_URL;
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Función helper para manejar errores
export const handleSupabaseError = (error) => {
  console.error('Error de Supabase:', error)
  return {
    success: false,
    error: error.message || 'Error desconocido'
  }
}

// Función helper para respuestas exitosas
export const handleSupabaseSuccess = (data) => {
  return {
    success: true,
    data
  }
}