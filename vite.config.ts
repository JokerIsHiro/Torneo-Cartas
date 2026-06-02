import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa-icon-192.png',
        'pwa-icon-512.png',
      ],
      manifest: {
        name: 'AetherHub YuGiOh',
        short_name: 'AetherHub',
        description: 'Gestor movil de rondas, emparejamientos y standings para torneos de YuGiOh.',
        lang: 'es',
        theme_color: '#06070d',
        background_color: '#06070d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-assets',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase')) return 'firebase'
          if (id.includes('react') || id.includes('zustand')) return 'react-vendor'
          if (id.includes('html2canvas')) return 'html2canvas'
          if (id.includes('qrcode.react')) return 'qrcode'
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      "/api/riftscribe": {
        target: "https://riftscribe.gg",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/riftscribe/, ""),
      },
    },
  },
})
