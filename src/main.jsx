import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      gutter={8}
      containerStyle={{
        top: 20,
        right: 20
      }}
      toastOptions={{
        // Duración corta para no estorbar
        duration: 2500,
        style: {
          fontSize: '0.9rem',
          padding: '10px 14px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxWidth: '350px'
        },
        success: {
          duration: 2000,
          iconTheme: { primary: '#198754', secondary: '#fff' }
        },
        error: {
          duration: 4000,
          iconTheme: { primary: '#dc3545', secondary: '#fff' }
        }
      }}
    />
  </StrictMode>,
)