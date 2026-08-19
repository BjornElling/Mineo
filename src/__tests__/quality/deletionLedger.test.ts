/**
 * De afskaffede inputmodulers FYSISKE fravær.
 *
 * **Hvad denne test dækker, og hvad den ikke gør.** Den måler, om filen eller mappen overhovedet
 * findes. Den overlapper med vilje ikke `legacy/forbidden-identifier` og
 * `input/deleted-legacy-architecture-import` i arkitektur-harnesset: de måler AST-identifiers og
 * imports, dvs. om noget BRUGER en legacy-mekanisme. En fysisk rest uden importer ville passere
 * begge AST-regler, og denne test lukker netop det hul.
 *
 * Listen bæres i kode frem for i et dokument, fordi en markdownliste ikke kan fejle: en markering af
 * at noget er slettet er en påstand, mens filsystemet er den faktiske tilstand.
 */
import fs from 'node:fs';
import path from 'node:path';

import { LEGACY_MODULE_PATH_SELFTEST } from './architecture/rules/storageRules';

/** Sti der SKAL være fysisk væk, med den afskaffede klynge den hørte til. */
type DeletedPath = Readonly<{ path: string; cluster: string }>;

const DELETION_LEDGER: readonly DeletedPath[] = [
  // ── Editor-, write- og rækkekopiroller + invalidDrafts-familien ────────────────────────────────
  { path: 'src/input/legacyInputCompatibility.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/input/legacyGridTransactionBridge.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/persistence/inputSessionMigration.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/schemas/invalidDraftsSchema.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/types/invalidDrafts.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/config/invalidDraftsVersion.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/config/cellInvalidDraftScopes.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/config/entityInvalidDraftScopes.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/utils/invalidDraftsStorage.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/contexts/CellInvalidDraftScopeContext.tsx', cluster: 'felt-/rækkedrafts' },
  { path: 'src/hooks/useDraftField.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/hooks/fieldState', cluster: 'felt-/rækkedrafts' },
  { path: 'src/hooks/tableInput', cluster: 'felt-/rækkedrafts' },
  { path: 'src/rowDrafts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/components/tables/gridCore/useGridRowPersistenceCore.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/stores/formPersistenceStore.ts', cluster: 'felt-/rækkedrafts' },
  { path: 'src/stores/formPersistenceReadModel.ts', cluster: 'felt-/rækkedrafts' },

  // ── Fejlkanalens duplikater ────────────────────────────────────────────────────────────────────
  { path: 'src/types/fieldErrors.ts', cluster: 'fejlkanal' },
  { path: 'src/hooks/useFormFieldErrors.ts', cluster: 'fejlkanal' },
  { path: 'src/utils/fieldErrorSelectors.ts', cluster: 'fejlkanal' },
  { path: 'src/hooks/useTableCellErrorTracker.ts', cluster: 'fejlkanal' },

  // ── Hele den parallelle legacy-inputklynge ─────────────────────────────────────────────────────
  { path: 'src/stores/inputRuntimeStore.ts', cluster: 'parallel inputklynge' },
  { path: 'src/input/inputTransactionRunner.ts', cluster: 'parallel inputklynge' },
  { path: 'src/criticalActions', cluster: 'parallel inputklynge' },
  { path: 'src/components/inputs/table', cluster: 'parallel inputklynge' },
  { path: 'src/hooks/useStyledFieldAdapter.ts', cluster: 'parallel inputklynge' },
  { path: 'src/hooks/useTwoStageInputActivation.ts', cluster: 'parallel inputklynge' },
  { path: 'src/hooks/useFormPersistenceSelectors.ts', cluster: 'parallel inputklynge' },
  { path: 'src/utils/saveBlockedFocus.ts', cluster: 'parallel inputklynge' },
  { path: 'src/contexts/FormPersistenceContext.tsx', cluster: 'parallel inputklynge' },
  { path: 'src/hooks/useFormPersistence.ts', cluster: 'parallel inputklynge' },
  { path: 'src/hooks/usePersistedForm.ts', cluster: 'parallel inputklynge' },
  { path: 'src/components/pages/stamdata/StamdataTestTab.tsx', cluster: 'parallel inputklynge' },
];

/**
 * Den forkastede parallelle inputmodel i `src/input/`. Mappen skal enten være helt væk eller kun
 * indeholde levende moduler – aldrig den forkastede model. Navnene her er dens kendetegnende moduler.
 */
const REJECTED_PARALLEL_INPUT_MODEL: readonly string[] = [
  'src/input/fieldAddress.ts',
  'src/input/fieldCatalog.ts',
  'src/input/inputReader.ts',
  'src/input/inputEnvelope.ts',
];

const exists = (relativePath: string): boolean =>
  fs.existsSync(path.resolve(process.cwd(), relativePath));

describe('slettelisterne er tomme (fraværsgate)', () => {
  it('ingen fil eller mappe fra slettelisterne findes fysisk', () => {
    const rester = DELETION_LEDGER
      .filter((entry) => exists(entry.path))
      .map((entry) => `${entry.path} (${entry.cluster})`);

    expect(rester, 'Fysiske rester af en afskaffet inputklynge').toEqual([]);
  });

  it('den forkastede parallelle inputmodel i src/input/ findes ikke', () => {
    expect(REJECTED_PARALLEL_INPUT_MODEL.filter(exists)).toEqual([]);
  });

  /**
   * Ét kanonisk slettelsesmanifest frem for to håndkopierede lister.
   *
   * En håndskrevet ledger driver fra den autoritative liste og kommer til at mangle poster. Roden er
   * duplikering: arkitekturværnet `input/deleted-legacy-architecture-import` fører allerede den
   * autoritative liste over slettede legacy-moduler – men det måler IMPORTER, ikke fysisk eksistens.
   * De to kontroller er komplementære og skal derfor dele kilde, ikke liste hver sit udsnit. Her læses
   * den ene liste, så en fremtidig tilføjelse ét sted automatisk dækkes af begge.
   *
   * Stierne er udvidelsesløse modulstier; hver prøves med de relevante endelser (og som mappe).
   */
  it('ingen sti fra det kanoniske legacy-modulmanifest findes fysisk', () => {
    const candidates = (modulePath: string): readonly string[] => (
      modulePath.endsWith('/')
        ? [modulePath.replace(/\/$/, '')]
        : [modulePath, `${modulePath}.ts`, `${modulePath}.tsx`]
    );

    const rester = LEGACY_MODULE_PATH_SELFTEST.paths
      .flatMap((modulePath) => candidates(modulePath).filter(exists));

    expect(rester, 'Fysiske rester af moduler, arkitekturværnet erklærer slettede').toEqual([]);
  });

  it('det kanoniske manifest er ikke tomt (kontrollen kan ikke bestå vakuøst)', () => {
    // Blev listen tømt, ville kontrollen ovenfor være grøn uden at måle noget. Gulvet er den målte
    // størrelse, så en utilsigtet tømning ses.
    expect(LEGACY_MODULE_PATH_SELFTEST.paths.length).toBeGreaterThanOrEqual(30);
    // Og de otte `Styled*Field` ER faktisk i manifestet – de er den post, en håndskrevet ledger
    // lettest kommer til at mangle.
    for (const name of ['Text', 'Amount', 'Date', 'Integer', 'Percent', 'Fraction', 'Week', 'Year']) {
      expect(
        LEGACY_MODULE_PATH_SELFTEST.paths,
        `Styled${name}Field mangler i det kanoniske manifest`
      ).toContain(`src/components/inputs/Styled${name}Field`);
    }
  });

  /**
   * Selvtest: en eksistens-kontrol, der ikke kan finde noget, ville rapportere grønt
   * for en vilkårlig liste. Kontrollen prøves derfor i modsat retning mod en fil, der beviseligt
   * FINDES – kan prædikatet ikke se den, er reglen selv i stykker, ikke træet rent.
   */
  it('eksistens-prædikatet virker i begge retninger (ikke vakuøst)', () => {
    expect(exists('src/__tests__/quality/deletionLedger.test.ts')).toBe(true);
    expect(exists('src/denne-fil-findes-bevisligt-ikke.ts')).toBe(false);
  });
});
