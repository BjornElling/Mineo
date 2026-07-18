import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const EO_PAGE_ROOT = path.resolve(SRC_ROOT, 'components/pages/erstatningsopgoerelse');
const TABLE_ROOT = path.resolve(SRC_ROOT, 'components/tables');

const collectSourceFiles = (root: string): string[] => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = path.resolve(root, entry.name);
  if (entry.isDirectory()) return collectSourceFiles(absolutePath);
  return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
});

const eoSurfaceFiles = (): string[] => [
  path.resolve(SRC_ROOT, 'components/pages/Erstatningsopgoerelse.tsx'),
  ...collectSourceFiles(EO_PAGE_ROOT),
  ...fs.readdirSync(TABLE_ROOT)
    .filter((fileName) => /^Greenfield.*\.tsx$/.test(fileName))
    .map((fileName) => path.resolve(TABLE_ROOT, fileName)),
  path.resolve(TABLE_ROOT, 'useGreenfieldCollectionTable.ts'),
];

const FORBIDDEN_LEGACY_SURFACE_MARKERS = [
  'usePersistedForm(',
  'useRowDrafts(',
  'useSliceRowDrafts(',
  'useGridRowPersistenceCore(',
  'CellInvalidDraftScopeProvider',
  'useFormFieldErrorReporter',
  'setEOValues',
  'onTableDataChange',
] as const;

describe('erstatningsopgørelse greenfield-overflade', () => {
  it('har ingen persisted editor- eller tabelveje gennem legacy-formmotoren', () => {
    const violations = eoSurfaceFiles().flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return FORBIDDEN_LEGACY_SURFACE_MARKERS
        .filter((marker) => source.includes(marker))
        .map((marker) => `${path.relative(SRC_ROOT, filePath)}: ${marker}`);
    });

    expect(violations).toEqual([]);
  });
});
