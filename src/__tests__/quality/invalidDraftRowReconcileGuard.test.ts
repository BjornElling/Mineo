// Værn: enhver tabel der både kan holde en celle-`invalidDraft` OG kan slette en række, SKAL rydde en
// slettet rækkes forældreløse draft via `useReconcileInvalidDraftsToLiveRows` — ellers blokerer draften
// Gem som et spøgelses-mål uden synligt felt (overlever F5). Dette er `invalidDrafts`-kanalens modstykke
// til `useTableCellErrorTracker`s read-time-filtrering mod gyldige rækker (B7-konsolidering).
//
// En glemt reconcile på en NY (eller ændret) tabel ville stille genindføre fejlklassen, så guarden
// scanner dynamisk alle tabel-komponenter frem for en hardkodet liste. Indeholder selv-test
// (vacuous-pass-værn) der beviser at detektoren faktisk fanger en overtrædelse.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TABLES_DIR = join(process.cwd(), 'src', 'components', 'tables');
const LOENINDKOMST_VIEW_MODEL = join(
  process.cwd(),
  'src',
  'components',
  'pages',
  'erstatningsopgoerelse',
  'loenindkomst',
  'useLoenindkomstViewModel.ts'
);

// En tabel KAN holde en celle-`invalidDraft`, hvis den (transitivt) rendrer celler via tableInput-laget.
const hasCellInput = (src: string): boolean =>
  /Table[A-Z][A-Za-z]*Input|hooks\/tableInput|useTableInputCore/.test(src);

// En tabel KAN slette en række (RowDeleteButton / onDeleteRow-prop / lokal handleDeleteRow).
const hasRowDelete = (src: string): boolean => /RowDeleteButton|onDeleteRow|handleDeleteRow/.test(src);

const callsRowReconcile = (src: string): boolean => src.includes('useReconcileInvalidDraftsToLiveRows');

const tableFiles = readdirSync(TABLES_DIR)
  .filter((entry) => entry.endsWith('Table.tsx'))
  .map((entry) => ({ name: entry, path: join(TABLES_DIR, entry), src: readFileSync(join(TABLES_DIR, entry), 'utf8') }));

const draftCapableDeletableTables = tableFiles.filter((f) => hasCellInput(f.src) && hasRowDelete(f.src));

describe('invalidDraft række-reconcile dækning', () => {
  it('scanner faktisk et meningsfuldt antal draft-bærende, sletbare tabeller (ikke vacuous)', () => {
    // De kendte legacy-celle-tabeller. BeregnetRenteTable og EetAslAfgoerelserTable er migreret til
    // greenfield-inputCore (grid-adapteren, ingen invalidDrafts-kanal) og indgår derfor IKKE længere i dette
    // legacy-værn (Renteberegning- og Erhvervsevnetab-slices, §2.5).
    // Resten af de legacy-tabeller er fortsat dækket, indtil deres slices migreres.
    expect(draftCapableDeletableTables.length).toBeGreaterThanOrEqual(8);
  });

  it.each(draftCapableDeletableTables.map((f) => [f.name, f.src] as const))(
    '%s kalder useReconcileInvalidDraftsToLiveRows',
    (_name, src) => {
      expect(callsRowReconcile(src)).toBe(true);
    }
  );

  it('loenindkomst-view-modellen rydder et slettet ansættelsesforholds (scope) drafts', () => {
    // Per-tabel reconcile kan ikke nå et SLETTET ansættelsesforholds drafts (dets tabeller er afmonteret),
    // så scope-niveau-oprydningen (useReconcileInvalidDraftScopes) SKAL kaldes her.
    const src = readFileSync(LOENINDKOMST_VIEW_MODEL, 'utf8');
    expect(src).toContain('useReconcileInvalidDraftScopes');
  });

  it('selv-test: detektoren fanger en draft-bærende sletbar tabel UDEN reconcile', () => {
    const violating = `
      import TableDateInput from './inputs/TableDateInput';
      const X = () => (<RowDeleteButton onClick={onDeleteRow} />);
    `;
    expect(hasCellInput(violating)).toBe(true);
    expect(hasRowDelete(violating)).toBe(true);
    expect(callsRowReconcile(violating)).toBe(false); // ← ville fejle række-dæknings-testen

    const compliant = violating + '\nuseReconcileInvalidDraftsToLiveRows(liveRowIds);';
    expect(callsRowReconcile(compliant)).toBe(true);
  });
});
