import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,   // listen on 0.0.0.0 — reachable from other devices on the same WiFi
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
