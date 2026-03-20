import fs from 'node:fs';
import path from 'node:path';
import { isValidStorageKey } from '../../config/storageManifest';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const SET_ITEM_LITERAL_PATTERN = /(?:window\.)?sessionStorage\.setItem\s*\(\s*(['"`])([^'"`]+)\1\s*,/g;

const collectSourceFiles = (root: string): string[] => {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'test') continue;
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  return files;
};

describe('noDirectSessionStorageAccess', () => {
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
