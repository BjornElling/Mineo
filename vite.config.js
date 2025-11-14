// vite.config.js
// Kommentar (dansk): Standard Vite-konfiguration for React med SWC (hurtig kompilering)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Samme port som CRA brugte
    open: true  // Åbn automatisk i browser
  }
})
