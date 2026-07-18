import fs from 'node:fs';
import path from 'node:path';

/**
 * EET-domæne-isolation.
 *
 * Det GENERELLE forbud mod persisted tværside-opslag ind i erhvervsevnetab
 * (`getPersistedData`/`usePersistedSection`/`commitSection('erhvervsevnetab')`) er migreret
 * til det AST-baserede arkitektur-harness som reglen `domain/eet-cross-domain-persisted-lookup`
 * (se `architecture/architectureRules.ts`).
 *
 * Tilbage her: de fil-specifikke wiring-checks — at EO-EET-felterne bindes i EO-oplysninger-
 * sektionerne, at kontrol/PDF læser EET fra EO-values, og at Erhvervsevnetab-siden kun rører den
 * delte forligs-slice (domain-boundary-contract.md §10).
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');
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

describe('eetDomainIsolation — wiring', () => {
  it('bevarer aktive EO-EET felter i EO-oplysninger-sektionerne', () => {
    const source = readEoOplysningerSectionSources();

    expect(source).toContain('field={eoMidlertidigtEETAfgorelseField.bind()}');
    expect(source).toContain('field={eoEndeligtEETAfgorelseField.bind()}');
    expect(source).toContain('field={eoMidlertidigEETAfgoerelseDatoField.bind()}');
    expect(source).toContain('field={eoEndeligEETAfgoerelseDatoField.bind()}');
    expect(source).toContain('field={eoVerserendeKlageEetField.bind()}');
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

    expect(source).not.toMatch(/getPersistedData\(\s*['"`]erstatningsopgoerelse['"`]\s*\)/);
    expect(source).not.toMatch(/usePersistedSection\(\s*['"`]erstatningsopgoerelse['"`]\s*\)/);

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
