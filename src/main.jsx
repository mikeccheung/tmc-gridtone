import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// PWA: register service worker
// (vite-plugin-pwa injects this virtual module)
import { registerSW } from 'virtual:pwa-register'
registerSW()

createRoot(document.getElementById('root')).render(<App />)
