// vite.config.ts
// Standard Vite-konfiguration for React

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import react from '@vitejs/plugin-react';

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
    open: false,
  },

  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/jspdf/')) {
            return 'vendor-jspdf';
          }

          if (id.includes('/jspdf-autotable/')) {
            return 'vendor-jspdf-autotable';
          }

          if (id.includes('/docx/')) {
            return 'vendor-docx';
          }

          if (id.includes('/html2canvas/')) {
            return 'vendor-html2canvas';
          }

          if (id.includes('/zod/')) {
            return 'vendor-zod';
          }

          if (id.includes('/zustand/')) {
            return 'vendor-zustand';
          }

          return undefined;
        },
      },
    },
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
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/utils/**', 'src/hooks/**', 'src/rowDrafts/**', 'src/contexts/**'],
      thresholds: {
        lines: 80,
        branches: 70,
      },
    },
  },
});
