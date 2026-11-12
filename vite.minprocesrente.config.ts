import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import baseConfig, { SHARED_CHUNK_GROUPS } from './vite.config.ts';

// Kør altid `npm run build:minprocesrente`; package-scriptet tilføjer index.html
// og fjerner Mineo-specifikke public/PWA-filer efter Vite-buildet.
// MinProcesrente bruger KUN de tunge PDF-vendorer (jspdf, jspdf-autotable, html2canvas)
// via en dynamisk import() af standalone-rente-PDF-tjenesten (jf. MinProcesrenteCalculatorPage).
// De får derfor ingen navngivne grupper her: en gruppe trækker delte afhængigheder med ind, så
// entry'en kan ende med at importere fra – og preloade – jsPDF-chunken (~400 KiB) på first load.
// Uden gruppe falder de naturligt ud i den dynamiske chunk og hentes først ved download.
export default defineConfig(
  mergeConfig(baseConfig, {
    build: {
      outDir: 'dist/minprocesrente',
      emptyOutDir: true,
      rolldownOptions: {
        input: {
          index: path.resolve(import.meta.dirname, 'minprocesrente.html'),
        },
        output: {
          codeSplitting: {
            groups: [...SHARED_CHUNK_GROUPS],
          },
        },
      },
    },
  })
);
