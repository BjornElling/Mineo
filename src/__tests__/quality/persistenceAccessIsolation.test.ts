import path from 'node:path';
import fs from 'node:fs';
import { assertPathExists, collectSourceFiles, toRepoRelativePath } from './testUtils';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const USE_FORM_PERSISTENCE_IMPORT_PATTERN =
  /from\s+['"][^'"]*contexts\/useFormPersistence['"]/;
const FORM_PERSISTENCE_CONTEXT_IMPORT_PATTERN =
  /from\s+['"][^'"]*FormPersistenceContext(?:\.shared)?['"]/;
const FORM_PERSISTENCE_STORE_IMPORT_PATTERN =
  /from\s+['"][^'"]*stores\/formPersistenceStore['"]/;

const ALLOWED_USE_FORM_PERSISTENCE_IMPORTS = new Set([
  'src/components/layout/MainLayout.tsx',
  'src/hooks/useFormFieldErrors.ts',
  'src/hooks/usePersistedForm.ts',
]);

const ALLOWED_FORM_PERSISTENCE_CONTEXT_IMPORTS = new Set([
  'src/App.tsx',
  'src/contexts/FormPersistenceContext.tsx',
  'src/contexts/FormPersistenceContext.shared.ts',
  'src/contexts/useFormPersistence.ts',
  'src/hooks/useFileSaveLoad.ts',
  'src/utils/persistenceLoadApply.ts',
]);
const ALLOWED_FORM_PERSISTENCE_STORE_IMPORTS = new Set([
  'src/contexts/FormPersistenceContext.tsx',
  'src/hooks/useFormPersistenceSelectors.ts',
  'src/hooks/useUndoRedo.ts',
  // Domain-specific read model: subscribes directly to the store to build one cached,
  // schema-validated tværsektion snapshot for EO's midlertidigt EET insert-flow.
  // This is an audited exception, not a precedent for ordinary hooks/pages.
  'src/hooks/useMidlertidigtEetInsertSource.ts',
  'src/stores/undoRedoStore.ts',
  'src/utils/persistenceSnapshotStorage.ts',
]);

describe('persistenceAccessIsolation', () => {
  it('forventet src-root findes', () => {
    assertPathExists(SRC_ROOT, 'Quality-test src-root');
  });

  it('begrænser useFormPersistence til infrastruktur og kanoniske imperative hooks', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (!USE_FORM_PERSISTENCE_IMPORT_PATTERN.test(source)) continue;

      const relativePath = toRepoRelativePath(absolutePath);
      if (!ALLOWED_USE_FORM_PERSISTENCE_IMPORTS.has(relativePath)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbyder direkte import af FormPersistenceContext uden for contexts-infrastrukturen', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (!FORM_PERSISTENCE_CONTEXT_IMPORT_PATTERN.test(source)) continue;

      const relativePath = toRepoRelativePath(absolutePath);
      if (!ALLOWED_FORM_PERSISTENCE_CONTEXT_IMPORTS.has(relativePath)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbyder direkte formPersistenceStore-import uden for kanoniske adgangspunkter', () => {
    // Scope note:
    // This guard enforces import boundaries only. It does not by itself prove that code avoids
    // local React-state mirrors of persisted committed state; that pattern is covered separately
    // by persistenceCommittedMirrorIsolation.test.ts.
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (!FORM_PERSISTENCE_STORE_IMPORT_PATTERN.test(source)) continue;

      const relativePath = toRepoRelativePath(absolutePath);
      if (!ALLOWED_FORM_PERSISTENCE_STORE_IMPORTS.has(relativePath)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
