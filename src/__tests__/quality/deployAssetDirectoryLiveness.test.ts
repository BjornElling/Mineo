import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type JsonObject = Readonly<Record<string, unknown>>;
type DeployVariant = Readonly<{
  name: string;
  wranglerConfig: string;
  viteConfig: string;
  outputDirectory: string;
}>;

const repoRoot = process.cwd();

const DEPLOY_VARIANTS: readonly DeployVariant[] = [
  {
    name: 'Mineo',
    wranglerConfig: 'wrangler.mineo.json',
    viteConfig: 'vite.mineo.config.ts',
    outputDirectory: 'dist/mineo',
  },
  {
    name: 'MinProcesrente',
    wranglerConfig: 'wrangler.minprocesrente.json',
    viteConfig: 'vite.minprocesrente.config.ts',
    outputDirectory: 'dist/minprocesrente',
  },
];

const isJsonObject = (value: unknown): value is JsonObject => (
  typeof value === 'object' && value !== null
);

const readAssetDirectory = (relativePath: string): string => {
  const parsed: unknown = JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'));
  if (!isJsonObject(parsed) || !isJsonObject(parsed.assets) || typeof parsed.assets.directory !== 'string') {
    throw new Error(`${relativePath} mangler en typed assets.directory.`);
  }
  return parsed.assets.directory;
};

describe('release-artifaktets deploy-liveness', () => {
  it('peger hver deployvariant på sit eget Vite-output', () => {
    for (const variant of DEPLOY_VARIANTS) {
      expect(readAssetDirectory(variant.wranglerConfig), variant.name).toBe(`./${variant.outputDirectory}`);
      expect(readFileSync(join(repoRoot, variant.viteConfig), 'utf8'), variant.name)
        .toContain(`outDir: '${variant.outputDirectory}'`);
    }
  });
});
