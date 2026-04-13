/**
 * src/main.jsx
 *
 * Application entry point. Mounts React app + imports global CSS.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/canvas.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
