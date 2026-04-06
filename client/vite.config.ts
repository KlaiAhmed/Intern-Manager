import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,        // The default port to start on
    strictPort: false, // When false, Vite tries 5173, then 5174, etc.
  },
})