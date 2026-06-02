import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const DAY_MS_PATTERNS: ReadonlyArray<RegExp> = [
  /\/\s*86400000\b/,
  /\/\s*\(\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000\s*\)/,
  /\/\s*\(\s*1000\s*\*\s*60\s*\*\s*60\s*\*\s*24\s*\)/,
];

const MATERIALIZE_TO_COUNT_PATTERNS: ReadonlyArray<RegExp> = [
  /collectIsoDatesInclusive\([^)]*\)\.length/,
  /buildIsoDateSetInclusive\([^)]*\)\.size/,
];

const MANUAL_DAY_LOOP_PATTERN =
  /while\s*\([^)]*(?:<=|<)[^)]*\)\s*{[\s\S]{0,1200}\.setUTCDate\([^)]*\.getUTCDate\(\)\s*\+\s*1\s*\)/;

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

  it('forbyder materialisering af ISO-dage kun for at tælle', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      const relativePath = path.relative(process.cwd(), absolutePath);
      for (const pattern of MATERIALIZE_TO_COUNT_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relativePath}: ${pattern.source}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbyder nye håndskrevne dag-for-dag-løkker uden for den kanoniske helper', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      if (absolutePath.endsWith(`${path.sep}utils${path.sep}isoDateHelpers.ts`)) continue;

      const source = fs.readFileSync(absolutePath, 'utf8');
      if (MANUAL_DAY_LOOP_PATTERN.test(source)) {
        violations.push(path.relative(process.cwd(), absolutePath));
      }
    }

    expect(violations).toEqual([]);
  });

  // Selv-test: bevis at hvert mønster faktisk fanger en syntetisk overtrædelse OG afviser ren kode.
  // Uden dette ville et brudt regex (fx en forkert escape under en refaktor) lade vagten passere
  // vakuøst — alle scan-testene ville være grønne, mens kontrakten reelt var uden håndhævelse.
  describe('mønstrene er ikke inerte (selv-test mod syntetiske overtrædelser)', () => {
    it('DAY_MS_PATTERNS fanger ms-diff dag-optælling', () => {
      expect(DAY_MS_PATTERNS.some((p) => p.test('const d = diffMs / 86400000;'))).toBe(true);
      expect(DAY_MS_PATTERNS.some((p) => p.test('const d = diffMs / (24 * 60 * 60 * 1000);'))).toBe(true);
      expect(DAY_MS_PATTERNS.some((p) => p.test('const d = diffMs / (1000 * 60 * 60 * 24);'))).toBe(true);
      // Ren kode (kanonisk helper) matcher ikke.
      expect(DAY_MS_PATTERNS.some((p) => p.test('const d = countInclusiveUtcDays(a, b);'))).toBe(false);
    });

    it('MATERIALIZE_TO_COUNT_PATTERNS fanger materialisér-for-at-tælle', () => {
      expect(MATERIALIZE_TO_COUNT_PATTERNS.some((p) => p.test('const n = collectIsoDatesInclusive(a, b).length;'))).toBe(true);
      expect(MATERIALIZE_TO_COUNT_PATTERNS.some((p) => p.test('const n = buildIsoDateSetInclusive(a, b).size;'))).toBe(true);
      expect(MATERIALIZE_TO_COUNT_PATTERNS.some((p) => p.test('const n = countInclusiveUtcDays(a, b);'))).toBe(false);
    });

    it('MANUAL_DAY_LOOP_PATTERN fanger en håndskreven dag-for-dag-løkke', () => {
      const violation = 'while (cur <= end) { rows.push(cur); cur.setUTCDate(cur.getUTCDate() + 1); }';
      expect(MANUAL_DAY_LOOP_PATTERN.test(violation)).toBe(true);
      expect(MANUAL_DAY_LOOP_PATTERN.test('iterateDatesInclusive(a, b, (d) => rows.push(d));')).toBe(false);
    });
  });
});
