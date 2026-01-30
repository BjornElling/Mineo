// vite.config.ts
// Standard Vite-konfiguration for React med SWC (hurtig kompilering)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    open: true,
  },

  test: {
    environment: 'jsdom',

    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },

    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
  },
});
