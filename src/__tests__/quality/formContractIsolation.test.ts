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
  'setFormValues(',
  'replaceFormValues(',
  'onAnsaettelsesforholdChange(',
] as const;

const ALLOWED_EFFECT_WRITES = new Map<string, readonly string[]>([
  [
    'src/components/pages/erstatningsopgoerelse/loenindkomst/useLoenindkomstViewModel.ts',
    ['Decision note: dette er en bevidst kontrakt-undtagelse.'],
  ],
]);

// De rene substring-forbud (queueMicrotask + Promise-tick i commit-sensitiv kode)
// håndhæves nu strukturelt af de AST-baserede regler
// `form/no-queue-microtask-in-commit-sensitive` og `form/no-promise-tick-in-commit-sensitive`
// (greenfield #48). Tilbage her står den AST-baserede effect-write-grænse, hvis
// undtagelse kræver en beslutningsnote i SAMME useEffect-vindue — en semantik der ikke
// reduceres til en sti-scoped allowlist.

let commitSensitiveSourceCache: Array<Readonly<{ absolutePath: string; relativePath: string; source: string }>> | null = null;

const readCommitSensitiveSources = (): Array<Readonly<{ absolutePath: string; relativePath: string; source: string }>> => {
  if (commitSensitiveSourceCache) return commitSensitiveSourceCache;

  const entries: Array<Readonly<{ absolutePath: string; relativePath: string; source: string }>> = [];
  for (const root of COMMIT_SENSITIVE_ROOTS) {
    for (const absolutePath of collectSourceFiles(root)) {
      entries.push({
        absolutePath,
        relativePath: toRepoRelativePath(absolutePath),
        source: fs.readFileSync(absolutePath, 'utf8'),
      });
    }
  }
  commitSensitiveSourceCache = entries;
  return entries;
};

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

    for (const { absolutePath, relativePath, source } of readCommitSensitiveSources()) {
      if (!source.includes('useEffect')) continue;
      if (!EFFECT_WRITE_PATTERNS.some((pattern) => source.includes(pattern))) continue;

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

    expect(violations).toEqual([]);
  });
});
