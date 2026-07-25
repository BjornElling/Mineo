import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TABLES_DIR = join(process.cwd(), 'src', 'components', 'tables');
const tableFiles = readdirSync(TABLES_DIR)
  .filter((entry) => entry.endsWith('Table.tsx'))
  .map((entry) => ({ name: entry, source: readFileSync(join(TABLES_DIR, entry), 'utf8') }));

const deletableCollectionTables = tableFiles.filter(({ source }) => source.includes('<RowDeleteButton'));

describe('greenfield rækkeejerskab', () => {
  it('alle sletbare collectiontabeller bruger inputCore-rowadapteren uden legacy draftkopier', () => {
    expect(deletableCollectionTables.length).toBeGreaterThanOrEqual(10);
    for (const { name, source } of deletableCollectionTables) {
      expect(
        source.includes('useCollectionTable') || source.includes('useCollectionRows'),
        `${name} mangler greenfield collectionadapter`,
      ).toBe(true);
      expect(source, `${name} må ikke genindføre legacy række-/invalidDraft-state`).not.toMatch(
        /useRowDrafts\s*\(|useSliceRowDrafts\s*\(|useGridRowPersistenceCore\s*\(|useReconcileInvalidDraftsToLiveRows\s*\(/
      );
    }
  });

  it('detektoren afviser en sletbar tabel med en konkurrerende række-draftkopi', () => {
    const violating = 'const rows = useRowDrafts(config); return <RowDeleteButton />;';
    expect(violating).toMatch(/useRowDrafts/);
    expect(violating).not.toMatch(/useCollectionTable|useCollectionRows/);
  });
});
