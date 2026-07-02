import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
// EO-oplysninger-fanen er dekomponeret i sektion-komponenter (jf. A1); EET-felternes markup bor nu
// i sektionerne. Guarden læser hele sektion-mappen, så feltbindingerne fanges uanset hvilken sektion.
const EO_OPLYSNINGER_SECTIONS_DIR = path.resolve(SRC_ROOT, 'components/pages/erstatningsopgoerelse/eoOplysninger/sections');

const readEoOplysningerSectionSources = (): string => {
  const files = fs
    .readdirSync(EO_OPLYSNINGER_SECTIONS_DIR)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => path.join(EO_OPLYSNINGER_SECTIONS_DIR, name));
  if (files.length === 0) {
    throw new Error(`Ingen sektion-filer fundet i ${EO_OPLYSNINGER_SECTIONS_DIR}`);
  }
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
};
const EO_DEBUG_PATH = path.resolve(SRC_ROOT, 'components/pages/erstatningsopgoerelse/EOInspektion.tsx');
const EO_DEBUG_VIEW_PATH = path.resolve(SRC_ROOT, 'domain/eoInspektion/eoInspektionPageViewModel.ts');
const EO_DEBUG_SNAPSHOT_VIEW_PATH = path.resolve(SRC_ROOT, 'domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView.ts');
const EO_PDF_MODEL_PATH = path.resolve(SRC_ROOT, 'domain/erstatningsopgoerelse/snapshot/eoPresentationModel.ts');
const EO_PDF_BUILDERS_PATH = path.resolve(SRC_ROOT, 'domain/erstatningsopgoerelse/snapshot/eoPresentationSectionBuilders.ts');
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

  it('bevarer aktive EO-EET felter i EO-oplysninger-sektionerne', () => {
    const source = readEoOplysningerSectionSources();

    expect(source).toContain("handleToggleChange('midlertidigtEETAfgorelse')");
    expect(source).toContain("handleToggleChange('endeligtEETAfgorelse')");
    expect(source).toContain('value={values.midlertidigEETAfgoerelseDato}');
    expect(source).toContain('value={values.endeligEETAfgoerelseDato}');
    expect(source).toContain('checked={getChecked(values.verserendeKlageEet)}');
  });

  it('læser EET-oplysninger i kontrol/PDF fra EO-values (ikke fra erhvervsevnetab-side)', () => {
    const inspektionSource = [
      fs.readFileSync(EO_DEBUG_PATH, 'utf8'),
      fs.readFileSync(EO_DEBUG_VIEW_PATH, 'utf8'),
      fs.readFileSync(EO_DEBUG_SNAPSHOT_VIEW_PATH, 'utf8'),
    ].join('\n');
    const pdfModelSource = fs.readFileSync(EO_PDF_MODEL_PATH, 'utf8');
    const pdfBuildersSource = fs.readFileSync(EO_PDF_BUILDERS_PATH, 'utf8');
    const pdfSource = `${pdfModelSource}\n${pdfBuildersSource}`;

    expect(inspektionSource).toContain('erstatningsopgoerelseValues.midlertidigtEETAfgorelse');
    expect(inspektionSource).toContain('erstatningsopgoerelseValues.endeligtEETAfgorelse');
    expect(pdfSource).toContain('values.midlertidigtEETAfgorelse');
    expect(pdfSource).toContain('values.endeligtEETAfgorelse');
  });

  it('begrænser Erhvervsevnetab-sidens erstatningsopgoerelse-adgang til den delte forligs-slice', () => {
    // domain-boundary-contract.md §10 (Delt forligsgrad mellem EO og differencekrav): forligs-
    // ansvarsgrad/-dato bor i EO-sektionen, men er en delt kilde Erhvervsevnetab må binde. Råt
    // snapshot-opslag af EO-beregnet output er fortsat forbudt — kun den schema-bundne forligs-slice
    // er tilladt, og siden må kun læse de tre forligs-felter (ikke øvrige EO-felter).
    const source = fs.readFileSync(ERHVERVSEVNETAB_PAGE_PATH, 'utf8');

    // Råt snapshot-/section-opslag (ville hente hele EO's committed/beregnede state) er stadig forbudt.
    expect(source).not.toMatch(/getPersistedData\(\s*['"`]erstatningsopgoerelse['"`]\s*\)/);
    expect(source).not.toMatch(/usePersistedSection\(\s*['"`]erstatningsopgoerelse['"`]\s*\)/);

    // Kun de tre autoriserede forligs-felter må læses fra den delte EO-binding.
    const ALLOWED_EO_FIELDS = new Set(['forligAnsvarsgradProcent', 'forligAnsvarsgradBroek', 'forligDato']);
    const accessedFields = Array.from(
      source.matchAll(/erstatningsopgoerelseValues\.(\w+)/g),
      (match) => match[1]
    );
    const unauthorizedFields = Array.from(new Set(accessedFields)).filter(
      (field) => !ALLOWED_EO_FIELDS.has(field)
    );
    expect(unauthorizedFields).toEqual([]);
  });
});
