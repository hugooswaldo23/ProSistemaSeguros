import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      gutter={10}
      // Centrar completamente (horizontal y vertical)
      containerStyle={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}
      toastOptions={{
        // Duración por defecto más visible (+1s)
        duration: 6000,
        // Estilos base más grandes y centrados visualmente
        style: {
          fontSize: '1rem',
          padding: '12px 14px',
          borderRadius: '10px',
          boxShadow: '0 10px 20px rgba(0,0,0,0.15)'
        },
        success: {
          duration: 5500,
          iconTheme: { primary: '#198754', secondary: '#fff' }
        },
        error: {
          duration: 7000,
          iconTheme: { primary: '#dc3545', secondary: '#fff' }
        }
      }}
    />
  </StrictMode>,
)