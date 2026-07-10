import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const standaloneRoots = [
  path.join(repoRoot, 'src/apps/minprocesrente'),
  path.join(repoRoot, 'src/components/pages/minprocesrente'),
];
const standaloneFiles = [
  path.join(repoRoot, 'src/pdf/infrastructure/standaloneRentePdfService.ts'),
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
    .concat(standaloneFiles)
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
};

// De rene import-forbud (Mineos auth-/route-/PWA-/settings-/diagnose-flows) håndhæves nu
// strukturelt af den AST-baserede regel `layer/minprocesrente-standalone-import-boundary`
// (greenfield #48). Tilbage her står de assertioner, der IKKE er import-grænser: den
// hoisting-følsomme namespace-rækkefølge og de positive brugerdata-/section-forbud.
describe('MinProcesrente standalone isolation', () => {
  it('isolerer sessionStorage fra Mineo ved at sætte et eget storage-namespace via en bivirknings-import der står først', () => {
    const namespaceModule = readFileSync(
      path.join(repoRoot, 'src/apps/minprocesrente/standaloneStorageNamespace.ts'),
      'utf8'
    );
    // Namespacet sættes i et dedikeret side-effect-only modul.
    expect(namespaceModule).toMatch(/setStorageNamespace\(\s*['"]minprocesrente['"]\s*\)/);

    const entrypoint = readFileSync(
      path.join(repoRoot, 'src/apps/minprocesrente/minprocesrenteMain.tsx'),
      'utf8'
    );
    // Selve namespacet må IKKE sættes inline i entrypointet — det ville køre efter App-importen
    // pga. import-hoisting. Det skal i stedet importeres som bivirkning.
    expect(entrypoint).not.toMatch(/setStorageNamespace\(/);
    expect(entrypoint).toMatch(/import\s+['"]\.\/standaloneStorageNamespace['"]/);

    // Bivirknings-importen skal stå FØR App-importen, ellers er hoisting-garantien tabt.
    const namespaceImportIndex = entrypoint.indexOf("import './standaloneStorageNamespace'");
    const appImportIndex = entrypoint.indexOf("import MinProcesrenteApp");
    expect(namespaceImportIndex).toBeGreaterThanOrEqual(0);
    expect(appImportIndex).toBeGreaterThan(namespaceImportIndex);
  });

  it('læser ikke stamdata, indstillinger eller andre Mineo-sektioner som brugerdata og bruger ikke Mineos diagnoseflow', () => {
    const source = readStandaloneSource();

    // Strengmatchene her er en guard mod direkte brugerdata-adgang. PDF-adapterens enhedstest
    // kontrollerer separat at PDF-kaldet sendes videre uden stamdata og settings.
    expect(source).not.toContain("usePersistedSectionSelector('stamdata')");
    expect(source).not.toContain('usePersistedSectionSelector("stamdata")');
    expect(source).not.toMatch(/usePersistedForm\s*\([^)]*['"]stamdata['"]/);
    expect(source).not.toMatch(/usePersistedForm\s*\([^)]*['"]indstillinger['"]/);
    expect(source).not.toContain('useAppSettings');
    expect(source).not.toContain('AppSettingsProvider');
    expect(source).not.toContain('systemIssueReporter');
    expect(source).not.toContain('reportSystemIssue');
    expect(source).not.toContain('BugReportButton');
    expect(source).not.toContain('logStorage');
    expect(source).toContain("'renteberegning'");
  });
});
