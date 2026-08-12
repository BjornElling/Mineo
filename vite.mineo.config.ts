import { defineConfig, mergeConfig, type Plugin } from 'vite';
import path from 'node:path';
import baseConfig from './vite.config';

/**
 * Den aktive service worker læser manifestet under installation og cacher netop denne builds
 * immutable Vite-assets. Det gør en allerede åben PWA-version selvstændig, når en senere deploy
 * fjerner dens hash-navngivne lazy chunks.
 */
const mineoPwaAssetManifest = (): Plugin => ({
  name: 'mineo-pwa-asset-manifest',
  apply: 'build',
  generateBundle(_, bundle) {
    const assets = Object.keys(bundle)
      .filter((fileName) => fileName.startsWith('assets/'))
      .sort();

    this.emitFile({
      type: 'asset',
      fileName: 'pwa-assets.json',
      source: `${JSON.stringify({ assets })}\n`,
    });
  },
});

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [mineoPwaAssetManifest()],
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
