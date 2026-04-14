import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { assertPathExists, collectSourceFiles, toRepoRelativePath } from './testUtils';

const PAGES_ROOT = path.resolve(process.cwd(), 'src/components/pages');
const HOOKS_ROOT = path.resolve(process.cwd(), 'src/hooks');
const COMMIT_SENSITIVE_ROOTS = [
  path.resolve(process.cwd(), 'src/components'),
  path.resolve(process.cwd(), 'src/hooks'),
  path.resolve(process.cwd(), 'src/utils'),
  path.resolve(process.cwd(), 'src/rowDrafts'),
] as const;

const EFFECT_WRITE_PATTERNS = [
  'setValues(',
  'replaceValues(',
  'setFormValues(',
  'replaceFormValues(',
  'onAnsaettelsesforholdChange(',
] as const;

const ALLOWED_EFFECT_WRITES = new Map<string, readonly string[]>([
  [
    'src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx',
    ['Decision note: dette er en bevidst kontrakt-undtagelse.'],
  ],
]);

const ALLOWED_QUEUE_MICROTASK_CALLS = new Map<string, readonly string[]>([
  [
    'src/components/tables/gridCore/tableKeyboardNavigation.ts',
    ['Decision note: this microtask is an infrastructure exception to the normal form rule.'],
  ],
]);

const ALLOWED_PROMISE_RESOLVE_TICKS = new Map<string, readonly string[]>([
  [
    'src/utils/commitFlush.ts',
    ['Decision note: this Promise tick is an infrastructure exception to the normal form rule.'],
  ],
]);

const isUseEffectCall = (node: ts.CallExpression): boolean => {
  const { expression } = node;
  return (
    ts.isIdentifier(expression) && expression.text === 'useEffect'
  ) || (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'React' &&
    expression.name.text === 'useEffect'
  );
};

const getEffectWindows = (source: string, filePath: string): string[] => {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const windows: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isUseEffectCall(node)) {
      windows.push(node.getText(sourceFile));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return windows;
};

describe('formContractIsolation', () => {
  it('forventede roots findes', () => {
    assertPathExists(PAGES_ROOT, 'Quality-test page-root');
    assertPathExists(HOOKS_ROOT, 'Quality-test hook-root');
    for (const root of COMMIT_SENSITIVE_ROOTS) {
      assertPathExists(root, 'Quality-test commit-sensitive root');
    }
  });

  it('forbyder persisted writes fra React-effects uden eksplicit dokumenteret undtagelse', { timeout: 20000 }, () => {
    const violations: string[] = [];

    for (const root of COMMIT_SENSITIVE_ROOTS) {
      for (const absolutePath of collectSourceFiles(root)) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        const effectWindows = getEffectWindows(source, absolutePath);
        const effectWindowsWithForbiddenWrites = effectWindows.filter((windowText) =>
          EFFECT_WRITE_PATTERNS.some((pattern) => windowText.includes(pattern))
        );
        if (effectWindowsWithForbiddenWrites.length === 0) continue;

        const allowedMarkers = ALLOWED_EFFECT_WRITES.get(relativePath);
        if (!allowedMarkers) {
          violations.push(relativePath);
          continue;
        }

        for (const marker of allowedMarkers) {
          expect(effectWindowsWithForbiddenWrites.some((windowText) => windowText.includes(marker)),
            `${relativePath} mangler beslutningsnote i samme useEffect-vindue som tilladt effect-write`
          ).toBe(true);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbyder queueMicrotask i commit-sensitive kode uden eksplicit infrastruktureundtagelse', () => {
    // Scope note:
    // queueMicrotask- og Promise-tick-allowlists nedenfor er path-scoped best-effort guards.
    // De beviser ikke semantisk, at noten sidder ved det præcise callsite, kun at filen er
    // auditeret som infrastrukturel undtagelse.
    const violations: string[] = [];

    for (const root of COMMIT_SENSITIVE_ROOTS) {
      for (const absolutePath of collectSourceFiles(root)) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        if (!source.includes('queueMicrotask(')) continue;

        const allowedMarkers = ALLOWED_QUEUE_MICROTASK_CALLS.get(relativePath);
        if (!allowedMarkers) {
          violations.push(relativePath);
          continue;
        }

        for (const marker of allowedMarkers) {
          expect(
            source.includes(marker),
            `${relativePath} mangler beslutningsnote for tilladt queueMicrotask`
          ).toBe(true);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbyder Promise-ticks i commit-sensitive kode uden eksplicit infrastruktureundtagelse', () => {
    const violations: string[] = [];

    for (const root of COMMIT_SENSITIVE_ROOTS) {
      for (const absolutePath of collectSourceFiles(root)) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        const usesPromiseTick =
          source.includes('await Promise.resolve();') ||
          source.includes('Promise.resolve().then(');
        if (!usesPromiseTick) continue;

        const allowedMarkers = ALLOWED_PROMISE_RESOLVE_TICKS.get(relativePath);
        if (!allowedMarkers) {
          violations.push(relativePath);
          continue;
        }

        for (const marker of allowedMarkers) {
          expect(
            source.includes(marker),
            `${relativePath} mangler beslutningsnote for tilladt Promise-tick`
          ).toBe(true);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
