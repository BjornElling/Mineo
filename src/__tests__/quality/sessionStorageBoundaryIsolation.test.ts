import fs from 'node:fs';
import path from 'node:path';
import { collectSourceFiles, toRepoRelativePath } from './testUtils';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const DIRECT_SESSION_STORAGE_PATTERN = /(?:window\.)?sessionStorage\.(?:getItem|setItem|removeItem|clear|key|length)\b/;

const ALLOWED_DIRECT_ACCESS_FILES = new Set([
  'src/config/storageManifest.ts',
  'src/contexts/FormPersistenceContext.tsx',
  'src/utils/dataCollection.ts',
  'src/utils/persistenceSessionHydration.ts',
  'src/utils/safeSessionStorage.ts',
]);

describe('sessionStorage boundary isolation', () => {
  // Structural complement to noDirectSessionStorageAccess:
  // this test limits where any direct sessionStorage access may exist at all.
  it('begrænser direkte sessionStorage-adgang til persistence-infrastruktur og canonical helper', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const relativePath = toRepoRelativePath(absolutePath);
      if (ALLOWED_DIRECT_ACCESS_FILES.has(relativePath)) {
        continue;
      }

      const source = fs.readFileSync(absolutePath, 'utf8');
      if (DIRECT_SESSION_STORAGE_PATTERN.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
