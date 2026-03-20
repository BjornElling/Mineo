import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const EO_OPLYSNINGER_TAB_PATH = path.resolve(SRC_ROOT, 'components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx');
const EO_DEBUG_PATH = path.resolve(SRC_ROOT, 'components/pages/erstatningsopgoerelse/EODebug.tsx');
const EO_PDF_MODEL_PATH = path.resolve(SRC_ROOT, 'domain/erstatningsopgoerelse/eoPdfModel.ts');
const EO_PDF_BUILDERS_PATH = path.resolve(SRC_ROOT, 'domain/erstatningsopgoerelse/eoPdfBuilders.ts');
const ERHVERVSEVNETAB_PAGE_PATH = path.resolve(SRC_ROOT, 'components/pages/Erhvervsevnetab.tsx');

const FORBIDDEN_CROSS_DOMAIN_PATTERNS: ReadonlyArray<RegExp> = [
  /getPersistedData\(\s*['"`]erhvervsevnetab['"`]\s*\)/,
  /usePersistedSection\(\s*['"`]erhvervsevnetab['"`]\s*\)/,
  /commitSection\(\s*['"`]erhvervsevnetab['"`]\s*,/,
];

const collectSourceFiles = (root: string): string[] => {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'test') continue;
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  return files;
};

describe('eetDomainIsolation', () => {
  it('forbyder persisted tværside-opslag til erhvervsevnetab', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      const relativePath = path.relative(process.cwd(), absolutePath);
      for (const pattern of FORBIDDEN_CROSS_DOMAIN_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relativePath}: ${pattern.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('bevarer aktive EO-EET felter i EOOplysningerTab', () => {
    const source = fs.readFileSync(EO_OPLYSNINGER_TAB_PATH, 'utf8');

    expect(source).toContain("handleToggleChange('midlertidigtEetAfgorelse')");
    expect(source).toContain("handleToggleChange('endeligtEetAfgorelse')");
    expect(source).toContain('value={values.midlertidigEETAfgoerelseDato}');
    expect(source).toContain('value={values.endeligEETAfgoerelseDato}');
    expect(source).toContain('checked={getChecked(values.verserendeKlageEet)}');
  });

  it('læser EET-oplysninger i debug/PDF fra EO-values (ikke fra erhvervsevnetab-side)', () => {
    const debugSource = fs.readFileSync(EO_DEBUG_PATH, 'utf8');
    const pdfModelSource = fs.readFileSync(EO_PDF_MODEL_PATH, 'utf8');
    const pdfBuildersSource = fs.readFileSync(EO_PDF_BUILDERS_PATH, 'utf8');
    const pdfSource = `${pdfModelSource}\n${pdfBuildersSource}`;

    expect(debugSource).toContain('erstatningsopgoerelseValues.midlertidigtEetAfgorelse');
    expect(debugSource).toContain('erstatningsopgoerelseValues.endeligtEetAfgorelse');
    expect(pdfSource).toContain('values.midlertidigtEetAfgorelse');
    expect(pdfSource).toContain('values.endeligtEetAfgorelse');
  });

  it('forbyder at Erhvervsevnetab-siden læser EO/EET-data fra erstatningsopgoerelse-persistence', () => {
    const source = fs.readFileSync(ERHVERVSEVNETAB_PAGE_PATH, 'utf8');

    expect(source).not.toMatch(/getPersistedData\(\s*['"`]erstatningsopgoerelse['"`]\s*\)/);
    expect(source).not.toMatch(/usePersistedSection\(\s*['"`]erstatningsopgoerelse['"`]\s*\)/);
    expect(source).not.toMatch(/usePersistedForm\(\s*erstatningsopgoerelseSchema\s*,\s*['"`]erstatningsopgoerelse['"`]/);
  });
});
