import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // clients update themselves
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png'
      ],
      manifest: {
        name: 'GridTone',
        short_name: 'GridTone',
        description: 'Plan your feed by feel — drag, reorder, preview color tone, and export.',
        theme_color: '#0f0f10',
        background_color: '#0f0f10',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      // ---- THIS fixes the build: give Workbox something to cache ----
      workbox: {
        globDirectory: 'dist',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // Cache app shell & static assets
        runtimeCaching: [
          {
            // same-origin navigation and static
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-shell',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            // images (including data URLs fetched via object URLs won’t be cached anyway)
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            // fonts (if any are requested)
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ],
        // make new SW take control immediately
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: false // ensure CI build mirrors production service worker behavior
      }
    })
  ]
})
