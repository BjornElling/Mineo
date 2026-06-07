// vite.config.ts
// Standard Vite-konfiguration for React

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  plugins: [react()],
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
