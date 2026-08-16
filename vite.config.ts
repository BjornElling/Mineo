// vite.config.ts
// Standard Vite-konfiguration for React

import { configDefaults, defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';
import { createThemeBootstrapScript } from './src/settings/themeBootstrap';

const BUILD_INFO_ENV_FILE = path.resolve(__dirname, '.env.build-info.local');

const parseGeneratedBuildInfoEnv = (): Record<string, string> => {
  if (!fs.existsSync(BUILD_INFO_ENV_FILE)) return {};

  const entries: Record<string, string> = {};
  const content = fs.readFileSync(BUILD_INFO_ENV_FILE, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    try {
      const parsed: unknown = JSON.parse(rawValue);
      entries[key] = typeof parsed === 'string' ? parsed : String(parsed);
    } catch {
      entries[key] = rawValue;
    }
  }

  return entries;
};

const generatedBuildInfoEnv = parseGeneratedBuildInfoEnv();
const defineBuildEnv = (key: string): string =>
  JSON.stringify(generatedBuildInfoEnv[key] ?? '');

const MINEO_THEME_BOOTSTRAP_MARKER = '<!-- MINEO_THEME_BOOTSTRAP -->';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mineo-theme-bootstrap',
      transformIndexHtml(html) {
        if (!html.includes(MINEO_THEME_BOOTSTRAP_MARKER)) return html;
        return html.replace(
          MINEO_THEME_BOOTSTRAP_MARKER,
          `<script>${createThemeBootstrapScript()}</script>`
        );
      },
    },
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': defineBuildEnv('VITE_APP_VERSION'),
    'import.meta.env.VITE_APP_COMMIT_HASH': defineBuildEnv('VITE_APP_COMMIT_HASH'),
    'import.meta.env.VITE_APP_COMMIT_SHORT': defineBuildEnv('VITE_APP_COMMIT_SHORT'),
    'import.meta.env.VITE_APP_BUILT_AT': defineBuildEnv('VITE_APP_BUILT_AT'),
  },
  resolve: {
    alias: {
      '@mui/utils/isFocusVisible': path.resolve(__dirname, 'src/utils/mui/isFocusVisible.ts'),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
    watch: {
      // Genererede test- og buildartefakter ligger under projektroden, men er
      // ikke appens kildetræ. Hvis de overvåges, bliver hver rapportfil til en
      // falsk HMR/full-reload, når test eller build kører parallelt med dev.
      ignored: ['**/coverage/**', '**/playwright-report/**', '**/test-results/**', '**/dist/**'],
    },
  },

  build: {
    manifest: true,
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
    // Playwright-specifikationer tilhører en separat browser-runner og må aldrig
    // blive indlæst som Vitest-suiter under den almindelige test- eller coverage-gate.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'node',
    // Testfilerne er isolerede, men fork-poolen kopierer Vite/MUI-modultræet
    // til hvert worker-process. Thread-poolen bevarer samme isolation og
    // parallelitet uden den gentagne proces- og hukommelsesomkostning.
    pool: 'threads',

    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },

    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
    // Enkelte første dynamiske imports af den tunge EO-/PDF-graf overstiger Vitests standard på 10 sekunder i en
    // parallel suite. Uden en eksplicit hook-timeout markeres efterfølgende tests fejlagtigt som skipped.
    hookTimeout: 30_000,
    // Interaktionstests deler CPU med de tunge domæne-golden-tests. 5 sekunder giver derfor falske timeouts i en
    // ellers færdig parallel suite.
    //
    // 15 sekunder rakte til den almindelige suite, men ikke til `test:coverage`: under v8-instrumentering koster
    // de tsc-/træscannende kvalitetstests 23-42 sekunder på en belastet maskine, mens de samme filer kører på ~10
    // sekunder tilsammen isoleret. Det gav vandrende timeouts i release-gaten — skiftende filer fra kørsel til
    // kørsel, aldrig de samme to gange, og grønt igen ved en isoleret kørsel af netop de filer.
    //
    // 60 sekunder er sat efter den målte værste kørsel (42 s) med luft til en langsommere CI-runner. Grænsen er
    // stadig en ægte fejlkilde: et flow, der hænger, fejler fortsat - blot uden at ramme raske kørsler.
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/utils/**', 'src/hooks/**', 'src/rowDrafts/**', 'src/contexts/**'],
      thresholds: {
        statements: 80,
        lines: 80,
        branches: 70,
        functions: 80,
      },
    },
  },
});
