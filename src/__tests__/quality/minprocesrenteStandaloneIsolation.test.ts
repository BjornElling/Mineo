import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const standaloneRoots = [
  path.join(repoRoot, 'src/apps/minprocesrente'),
  path.join(repoRoot, 'src/components/pages/minprocesrente'),
];

const collectSourceFiles = (root: string): string[] => {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
};

const readStandaloneSource = (): string => {
  return standaloneRoots
    .flatMap(collectSourceFiles)
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
};

describe('MinProcesrente standalone isolation', () => {
  it('importerer ikke Mineos auth-, route-, PWA- eller service worker-flow', () => {
    const source = readStandaloneSource();

    expect(source).not.toContain('AuthGate');
    expect(source).not.toContain('../../App');
    expect(source).not.toContain('pwaLaunchQueue');
    expect(source).not.toContain('serviceWorker');
  });

  it('læser ikke stamdata, indstillinger eller andre Mineo-sektioner som brugerdata', () => {
    const source = readStandaloneSource();

    expect(source).not.toContain("usePersistedSectionSelector('stamdata')");
    expect(source).not.toContain('useAppSettings');
    expect(source).not.toContain('AppSettingsProvider');
    expect(source).not.toContain("'stamdata'");
    expect(source).not.toContain("'indstillinger'");
    expect(source).toContain("'renteberegning'");
  });
});
