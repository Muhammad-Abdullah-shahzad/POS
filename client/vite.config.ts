import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // './' makes all asset paths relative so they work under both
  // http:// (web server) and file:// (Electron packaged app).
  base: './',
})
