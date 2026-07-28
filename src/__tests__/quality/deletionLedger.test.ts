/**
 * Fase 7's afleveringsgate, betingelsen "alle slettelister er tomme" (WI-013).
 *
 * Planens fase 2-5 har fire slettelister (design-dokumentets §2.6, fase 3-afsnittet, fase 4's
 * sletteliste og trin 13), som alle er markeret "gennemført". Betingelsen kontrolleres her MASKINELT
 * frem for på ordet: en markering i et dokument er en påstand, og fase 6 blev netop genåbnet, fordi en
 * legacyklassifikation hvilede på tekstsøgning i stedet for på den faktiske tilstand.
 *
 * **Hvad denne test dækker, og hvad den ikke gør.** Den måler FYSISK fravær af de slettede filer og
 * mapper. Den overlapper med vilje ikke `legacy/forbidden-identifier` og
 * `input/deleted-legacy-architecture-import` i arkitektur-harnesset: de måler AST-identifiers og
 * imports, dvs. om noget BRUGER en legacy-mekanisme. Her måles, om filen overhovedet findes — en
 * midlertidig fysisk rest uden importer ville passere begge AST-regler, og præcis den rest er, hvad
 * planens fase 6 trin 1 pålægger fase 7 at verificere.
 *
 * Listen bæres her frem for i planen, fordi en markdownliste ikke kan fejle.
 */
import fs from 'node:fs';
import path from 'node:path';

import { LEGACY_MODULE_PATH_SELFTEST } from './architecture/rules/storageRules';

/** Sti der SKAL være fysisk væk, med den sletteliste den kommer fra. */
type DeletedPath = Readonly<{ path: string; list: string }>;

const DELETION_LEDGER: readonly DeletedPath[] = [
  // ── §2.6 (fase 2): editor-, write- og rækkekopiroller + invalidDrafts-familien ──────────────────
  { path: 'src/input/legacyInputCompatibility.ts', list: '§2.6' },
  { path: 'src/input/legacyGridTransactionBridge.ts', list: '§2.6' },
  { path: 'src/persistence/inputSessionMigration.ts', list: '§2.6' },
  { path: 'src/schemas/invalidDraftsSchema.ts', list: '§2.6' },
  { path: 'src/types/invalidDrafts.ts', list: '§2.6' },
  { path: 'src/config/invalidDraftsVersion.ts', list: '§2.6' },
  { path: 'src/config/cellInvalidDraftScopes.ts', list: '§2.6' },
  { path: 'src/config/entityInvalidDraftScopes.ts', list: '§2.6' },
  { path: 'src/utils/invalidDraftsStorage.ts', list: '§2.6' },
  { path: 'src/contexts/CellInvalidDraftScopeContext.tsx', list: '§2.6' },
  { path: 'src/hooks/useDraftField.ts', list: '§2.6' },
  { path: 'src/hooks/fieldState', list: '§2.6' },
  { path: 'src/hooks/tableInput', list: '§2.6' },
  { path: 'src/rowDrafts', list: '§2.6' },
  { path: 'src/components/tables/gridCore/useGridRowPersistenceCore.ts', list: '§2.6' },
  { path: 'src/stores/formPersistenceStore.ts', list: '§2.6' },
  { path: 'src/stores/formPersistenceReadModel.ts', list: '§2.6' },

  // ── Fase 3/4-slettelisten: fejlkanalens duplikater ─────────────────────────────────────────────
  { path: 'src/types/fieldErrors.ts', list: 'fase 3/4' },
  { path: 'src/hooks/useFormFieldErrors.ts', list: 'fase 3/4' },
  { path: 'src/utils/fieldErrorSelectors.ts', list: 'fase 3/4' },
  { path: 'src/hooks/useTableCellErrorTracker.ts', list: 'fase 3/4' },

  // ── Trin 13: hele den parallelle legacy-inputklynge ────────────────────────────────────────────
  { path: 'src/stores/inputRuntimeStore.ts', list: 'trin 13' },
  { path: 'src/input/inputTransactionRunner.ts', list: 'trin 13' },
  { path: 'src/criticalActions', list: 'trin 13' },
  { path: 'src/components/inputs/table', list: 'trin 13' },
  { path: 'src/hooks/useStyledFieldAdapter.ts', list: 'trin 13' },
  { path: 'src/hooks/useTwoStageInputActivation.ts', list: 'trin 13' },
  { path: 'src/hooks/useFormPersistenceSelectors.ts', list: 'trin 13' },
  { path: 'src/utils/saveBlockedFocus.ts', list: 'trin 13' },
  { path: 'src/contexts/FormPersistenceContext.tsx', list: 'trin 13' },
  { path: 'src/hooks/useFormPersistence.ts', list: 'trin 13' },
  { path: 'src/hooks/usePersistedForm.ts', list: 'trin 13' },
  { path: 'src/components/pages/stamdata/StamdataTestTab.tsx', list: 'trin 13' },
];

/**
 * Den forkastede pre-rebase Fase 0-4-implementering (24 filer i `src/input/`). Efter trin 13 må mappen
 * enten være helt væk eller kun indeholde levende greenfield-moduler — aldrig den gamle parallelle
 * inputmodel. Navnene her er dens kendetegnende moduler.
 */
const REJECTED_PARALLEL_INPUT_MODEL: readonly string[] = [
  'src/input/fieldAddress.ts',
  'src/input/fieldCatalog.ts',
  'src/input/inputReader.ts',
  'src/input/inputEnvelope.ts',
];

const exists = (relativePath: string): boolean =>
  fs.existsSync(path.resolve(process.cwd(), relativePath));

describe('slettelisterne er tomme (Fase 7 afleveringsgate)', () => {
  it('ingen fil eller mappe fra fase 2-5s slettelister findes fysisk', () => {
    const rester = DELETION_LEDGER
      .filter((entry) => exists(entry.path))
      .map((entry) => `${entry.path} (${entry.list})`);

    expect(rester, 'Fysiske rester fra en gennemført sletteliste').toEqual([]);
  });

  it('den forkastede parallelle inputmodel i src/input/ findes ikke', () => {
    expect(REJECTED_PARALLEL_INPUT_MODEL.filter(exists)).toEqual([]);
  });

  /**
   * Ét kanonisk slettelsesmanifest frem for to håndkopierede lister (tilføjet efter eksternt review,
   * WI-013 R5).
   *
   * Ledgeren ovenfor var manuelt afskrevet fra planens prosa og manglede derfor bl.a. de otte
   * `Styled*Field.tsx`. Roden er duplikering: arkitekturværnet
   * `input/deleted-legacy-architecture-import` fører allerede den autoritative liste over slettede
   * legacy-moduler — men det måler IMPORTER, ikke fysisk eksistens. De to kontroller er komplementære og
   * skal derfor dele kilde, ikke liste hver sit udsnit. Her læses den ene liste, så en fremtidig
   * tilføjelse ét sted automatisk dækkes af begge.
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
    // Og de otte `Styled*Field`, reviewet efterlyste, ER faktisk i manifestet.
    for (const name of ['Text', 'Amount', 'Date', 'Integer', 'Percent', 'Fraction', 'Week', 'Year']) {
      expect(
        LEGACY_MODULE_PATH_SELFTEST.paths,
        `Styled${name}Field mangler i det kanoniske manifest`
      ).toContain(`src/components/inputs/Styled${name}Field`);
    }
  });

  /**
   * Selvtest (fase 6's lære): en eksistens-kontrol, der ikke kan finde noget, ville rapportere grønt
   * for en vilkårlig liste. Kontrollen prøves derfor i modsat retning mod en fil, der beviseligt
   * FINDES — kan prædikatet ikke se den, er reglen selv i stykker, ikke træet rent.
   */
  it('eksistens-prædikatet virker i begge retninger (ikke vakuøst)', () => {
    expect(exists('src/__tests__/quality/deletionLedger.test.ts')).toBe(true);
    expect(exists('src/denne-fil-findes-bevisligt-ikke.ts')).toBe(false);
  });
});
