import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // we already have a <link rel="manifest">; keep using it
      manifest: false,
      workbox: {
        // cache app shell & assets; send all navigations to index.html (SPA)
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}']
      }
    })
  ],
  build: { sourcemap: false },
  server: { host: true }
})
