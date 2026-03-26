import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,   // escucha en 0.0.0.0, accesible desde la red local
    port: 5173,
  },
})
