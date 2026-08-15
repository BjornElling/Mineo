import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { toRepoRelativePath } from './testUtils';

/**
 * Værn mod platform-antagelser i `scripts/` — den ene mappe, hvis fejl først viser sig i CI.
 *
 * Baggrund: `check-tool-isolation.mjs` læste `node_modules/.bin/playwright` med `readFileSync`.
 * På Windows er den indgang en shim-FIL, hvis indhold nævner pakkestien, så alt så rigtigt ud
 * lokalt. På Linux — CI's platform — er den samme indgang et SYMLINK; `readFileSync` fulgte det
 * og læste Playwrights egen `cli.js`, hvor mønsteret intet fandt. Resultatet var en rød CI med
 * «peger på et ukendt sted», selv om afhængighedsgrafen var fuldstændig i orden.
 *
 * Hele `verify:release:core` køres lokalt kun på Windows, så den slags divergens er usynlig
 * indtil push. Reglen her gør den strukturel: rører et script `node_modules/.bin`, skal det
 * også forholde sig til, at indgangen kan være et symlink (`lstatSync`/`readlinkSync`/`realpathSync`).
 * Den erstatter ikke testene af den enkelte kontrol — den fanger *klassen*, så det næste script
 * ikke kan genindføre den samme blindhed på en ny måde.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptsRoot = join(repoRoot, 'scripts');

/** Funktioner der læser en sti og FØLGER et eventuelt symlink. */
const LINK_FOLLOWING_READS = new Set(['readFileSync', 'readFile', 'statSync', 'stat']);

/** Funktioner der erkender, at en sti kan VÆRE et symlink. */
const LINK_AWARE_CALLS = new Set(['lstatSync', 'lstat', 'readlinkSync', 'readlink', 'realpathSync', 'realpath']);

type ScriptEntry = Readonly<{ relativePath: string; text: string; ast: ts.SourceFile }>;

/**
 * Egen walk, fordi den delte `collectSourceFiles` kun ser `.ts`/`.tsx` — og scripts-mappen
 * er netop `.mjs`. Reglen skal måle de filer, der faktisk kører i CI.
 */
const collectScriptFiles = (root: string): readonly string[] => {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && (fullPath.endsWith('.mjs') || fullPath.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
  }
  return files;
};

const scriptFiles: readonly ScriptEntry[] = collectScriptFiles(scriptsRoot)
  .map((absolutePath) => {
    const text = readFileSync(absolutePath, 'utf8');
    return {
      relativePath: toRepoRelativePath(absolutePath),
      text,
      ast: ts.createSourceFile(absolutePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS),
    };
  });

const calledFunctionNames = (source: ts.SourceFile): ReadonlySet<string> => {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const { expression } = node;
      if (ts.isIdentifier(expression)) names.add(expression.text);
      // Også `fs.readFileSync(...)` og lignende kvalificerede kald.
      if (ts.isPropertyAccessExpression(expression)) names.add(expression.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

/** Scripts der overhovedet rører `.bin` — kun de kan ramme symlink-fælden. */
const scriptsTouchingBinDirectory = scriptFiles.filter(({ text }) => text.includes("'.bin'")
  || text.includes('".bin"')
  || text.includes('node_modules/.bin'));

describe('platform-antagelser i scripts/', () => {
  it('finder overhovedet scripts at måle på', () => {
    // Uden denne påstand ville reglerne nedenfor være grønne af tomhed, hvis mappen
    // eller filendelserne ændrede sig.
    expect(scriptFiles.length).toBeGreaterThan(5);
    expect(scriptFiles.map((entry) => entry.relativePath))
      .toContain('scripts/check-tool-isolation.mjs');
  });

  it('måler faktisk det script, hvor CI-fejlen opstod', () => {
    // Den konkrete sag skal blive ved med at være dækket af reglen — ikke bare klassen.
    expect(scriptsTouchingBinDirectory.map((entry) => entry.relativePath))
      .toContain('scripts/check-tool-isolation.mjs');
  });

  it('læser ikke en .bin-indgang uden at forholde sig til, at den kan være et symlink', () => {
    const offenders = scriptsTouchingBinDirectory
      .filter(({ ast }) => {
        const called = calledFunctionNames(ast);
        const følgerLink = [...LINK_FOLLOWING_READS].some((name) => called.has(name));
        const kenderLink = [...LINK_AWARE_CALLS].some((name) => called.has(name));
        return følgerLink && !kenderLink;
      })
      .map(({ relativePath }) => relativePath);

    expect(offenders, [
      'Et script læser en indgang i node_modules/.bin uden at bruge lstat/readlink/realpath.',
      'På Windows er indgangen en shim-fil, men på Linux (CI) er den et symlink, og readFileSync',
      'følger det og udleverer målets indhold i stedet. Netop den forskel gjorde CI rød, mens alt',
      'var grønt lokalt. Brug lstatSync + readlinkSync til at afgøre ejeren, som',
      'scripts/check-tool-isolation.mjs gør.',
    ].join(' ')).toEqual([]);
  });
});
