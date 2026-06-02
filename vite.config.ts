import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
