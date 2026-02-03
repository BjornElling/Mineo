// vite.config.ts
// Standard Vite-konfiguration for React med SWC (hurtig kompilering)

import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mui/utils/isFocusVisible': path.resolve(__dirname, 'src/utils/mui/isFocusVisible.ts'),
    },
  },

  server: {
    host: '0.0.0.0',
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
