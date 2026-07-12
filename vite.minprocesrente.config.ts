import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import baseConfig from './vite.config';

// Kør altid `npm run build:minprocesrente`; package-scriptet tilføjer index.html
// og fjerner Mineo-specifikke public/PWA-filer efter Vite-buildet.
// MinProcesrente bruger KUN de tunge PDF-vendorer (jspdf, jspdf-autotable, html2canvas)
// via en dynamisk import() af standalone-rente-PDF-tjenesten (jf. MinProcesrenteCalculatorPage).
// Base-configens `manualChunks` tvinger dem ellers ind i navngivne vendor-chunks, hvilket gør
// dem til *initiale* chunks (modulepreload i HTML) selv når intet i entry-grafen importerer dem
// statisk — så jsPDF (~400 KiB) hentes på first load uden at blive brugt. Ved at lade dem falde
// naturligt ud i den dynamiske chunk bliver de først hentet når brugeren downloader.
// Mineo-buildet er urørt og beholder sin vendor-splitting.
const minprocesrenteManualChunks = (id: string): string | undefined => {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('/jspdf/') || id.includes('/jspdf-autotable/') || id.includes('/html2canvas/')) {
    return undefined;
  }
  if (id.includes('/zod/')) return 'vendor-zod';
  if (id.includes('/zustand/')) return 'vendor-zustand';
  return undefined;
};

export default defineConfig(
  mergeConfig(baseConfig, {
    build: {
      outDir: 'dist/minprocesrente',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'minprocesrente.html'),
        },
        output: {
          manualChunks: minprocesrenteManualChunks,
        },
      },
    },
  })
);
