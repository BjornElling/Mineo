import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const DAY_MS_PATTERNS: ReadonlyArray<RegExp> = [
  /\/\s*86400000\b/,
  /\/\s*\(\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000\s*\)/,
  /\/\s*\(\s*1000\s*\*\s*60\s*\*\s*60\s*\*\s*24\s*\)/,
];

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
        if (entry.name === '__tests__' || entry.name === 'test' || entry.name === 'contracts') continue;
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

describe('date-contract guard', () => {
  it('forbyder ms-diff day count mønstre i production-kode', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      if (absolutePath.endsWith(`${path.sep}utils${path.sep}utcDayMath.ts`)) continue;

      const source = fs.readFileSync(absolutePath, 'utf8');
      const relativePath = path.relative(process.cwd(), absolutePath);
      for (const pattern of DAY_MS_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relativePath}: ${pattern.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
