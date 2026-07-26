import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TABLES_DIR = join(process.cwd(), 'src', 'components', 'tables');
const tableFiles = readdirSync(TABLES_DIR)
  .filter((entry) => entry.endsWith('Table.tsx'))
  .map((entry) => ({ name: entry, source: readFileSync(join(TABLES_DIR, entry), 'utf8') }));

const deletableCollectionTables = tableFiles.filter(({ source }) => source.includes('<RowDeleteButton'));

/**
 * Fase 6 omdøbte filen fra `invalidDraftRowReconcileGuard` til det, den faktisk beviser.
 *
 * Det gamle navn pinnede `invalidDrafts`-modellen, som blev slettet i trin 13 — et navn, der peger på
 * en mekanisme, der ikke findes, gør værnet svært at læse og ligner dækning af noget, der er væk.
 * INVARIANTEN lever derimod: en sletbar collectiontabel skal eje sine rækker gennem inputCore-
 * rowadapteren, så rækkeidentitet og undo/redo har præcis én kilde (jf. [[project_reconcile_rowid_dup]]).
 *
 * Den tidligere negative halvdel — "genindfør ikke `useRowDrafts`/`useSliceRowDrafts`/…" — er FJERNET
 * her, fordi `legacy/forbidden-identifier` i arkitektur-manifestet nu håndhæver de navne for HELE
 * kilde-grafen, ikke kun for tabelfilerne. To værn om samme forbud betyder blot, at det ene kan rådne
 * ubemærket.
 */
describe('greenfield rækkeejerskab', () => {
  it('alle sletbare collectiontabeller bruger inputCore-rowadapteren', () => {
    expect(deletableCollectionTables.length).toBeGreaterThanOrEqual(10);
    for (const { name, source } of deletableCollectionTables) {
      expect(
        source.includes('useCollectionTable') || source.includes('useCollectionRows'),
        `${name} mangler greenfield collectionadapter`,
      ).toBe(true);
    }
  });

  it('detektoren afviser en sletbar tabel uden collectionadapter', () => {
    const violating = 'const rows = useLocalRowState(config); return <RowDeleteButton />;';
    expect(violating).toContain('<RowDeleteButton');
    expect(violating).not.toMatch(/useCollectionTable|useCollectionRows/);
  });
});
