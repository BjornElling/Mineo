import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import baseConfig from './vite.config';

// Kør altid `npm run build:minprocesrente`; package-scriptet tilføjer index.html
// og fjerner Mineo-specifikke public/PWA-filer efter Vite-buildet.
export default defineConfig(
  mergeConfig(baseConfig, {
    build: {
      outDir: 'dist/minprocesrente',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'minprocesrente.html'),
        },
      },
    },
  })
);
