import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const standaloneRoots = [
  path.join(repoRoot, 'src/apps/minprocesrente'),
  path.join(repoRoot, 'src/components/pages/minprocesrente'),
];
/**
 * AL standalone-specifik kode ligger under de to rødder ovenfor: dokument-miljøet, de tre
 * definitioner og deres React-grænse bor i `src/apps/minprocesrente/document/`. Listen er derfor
 * tom — der findes ingen standalone-fil uden for rødderne.
 */
const standaloneFiles: readonly string[] = [];

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

  it('låser også Mineos default-namespace via entryens første import', () => {
    const entrypoint = readFileSync(path.join(repoRoot, 'src/main.tsx'), 'utf8');
    expect(entrypoint.indexOf("import './apps/mineo/mineoStorageNamespace'"))
      .toBeGreaterThanOrEqual(0);
    expect(entrypoint.indexOf("import { bootstrapClientApp"))
      .toBeGreaterThan(entrypoint.indexOf("import './apps/mineo/mineoStorageNamespace'"));
  });

  it('har variantens error boundary og styles ved entry-grænsen', () => {
    const mineoEntry = readFileSync(path.join(repoRoot, 'src/main.tsx'), 'utf8');
    const standaloneEntry = readFileSync(
      path.join(repoRoot, 'src/apps/minprocesrente/minprocesrenteMain.tsx'),
      'utf8'
    );
    const sharedShell = readFileSync(
      path.join(repoRoot, 'src/apps/shared/bootstrapClientApp.tsx'),
      'utf8'
    );

    expect(mineoEntry).toMatch(/<ErrorBoundary>[\s\S]*<AuthGate/);
    expect(standaloneEntry).toMatch(/<StandaloneErrorBoundary>[\s\S]*<MinProcesrenteApp/);
    expect(mineoEntry).toContain("loadAppStyles: () => import('./index.css')");
    expect(standaloneEntry).toContain("loadAppStyles: () => import('./minprocesrente.css')");
    expect(sharedShell).not.toContain("import('../../index.css')");
  });

  it('læser ikke stamdata eller indstillinger som brugerdata og bruger kun renteberegning-sektionen', () => {
    const source = readStandaloneSource();

    // Positivt brugerdata-forbud: standalone må ikke LÆSE Mineos øvrige sektioner (stamdata/indstillinger).
    // Dette er en section-read-grænse, ikke en import-grænse — de rene import-forbud (useAppSettings,
    // systemIssueReporter, BugReportButton, logStorage m.fl.) håndhæves nu strukturelt af
    // `layer/minprocesrente-standalone-import-boundary` (greenfield #48) og gentages derfor ikke her.
    // PDF-adapterens enhedstest kontrollerer separat at PDF-kaldet sendes videre uden stamdata og settings.
    expect(source).not.toContain("usePersistedSectionSelector('stamdata')");
    expect(source).not.toContain('usePersistedSectionSelector("stamdata")');
    expect(source).not.toMatch(/usePersistedForm\s*\([^)]*['"]stamdata['"]/);
    expect(source).not.toMatch(/usePersistedForm\s*\([^)]*['"]indstillinger['"]/);
    // Standalone bruger fortsat KUN renteberegning-sektionen. Den konkrete descriptor læses nu i den delte
    // Renteberegning-surface, mens den isolerede PDF-adapter kun modtager allerede projekterede data.
    expect(source).toMatch(/RenteberegningTab/);
  });
});
