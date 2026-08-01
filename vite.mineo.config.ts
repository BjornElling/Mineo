import { defineConfig, mergeConfig } from 'vite';
import path from 'node:path';
import baseConfig from './vite.config';

export default defineConfig(
  mergeConfig(baseConfig, {
    build: {
      outDir: 'dist/mineo',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
        },
      },
    },
  })
);
