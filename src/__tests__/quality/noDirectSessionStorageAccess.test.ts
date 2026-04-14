import fs from 'node:fs';
import path from 'node:path';
import { isValidStorageKey } from '../../config/storageManifest';
import { collectSourceFiles } from './testUtils';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const SET_ITEM_LITERAL_PATTERN = /(?:window\.)?sessionStorage\.setItem\s*\(\s*(['"`])([^'"`]+)\1\s*,/g;

describe('noDirectSessionStorageAccess', () => {
  // Structural complement to sessionStorageBoundaryIsolation:
  // sessionStorageBoundaryIsolation limits *where* any direct sessionStorage access may exist.
  // This test applies to *all* source files and allows only manifest-registered literal keys
  // in any sessionStorage.setItem call, regardless of which file it appears in.
  it('allows only manifest-registered literal keys in sessionStorage.setItem calls', () => {
    const invalidLiteralSetItemCalls: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      const relativePath = path.relative(process.cwd(), absolutePath);
      const matches = source.matchAll(SET_ITEM_LITERAL_PATTERN);
      for (const match of matches) {
        const key = match[2];
        if (!isValidStorageKey(key)) {
          invalidLiteralSetItemCalls.push(`${relativePath}: ${key}`);
        }
      }
    }

    expect(invalidLiteralSetItemCalls).toEqual([]);
  });
});
