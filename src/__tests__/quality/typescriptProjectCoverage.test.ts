import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/**
 * Værn for TypeScript-projekternes dækning.
 *
 * **Problemet det findes for.** Repoet har fire adskilte projekter, fordi de har forskellige globale
 * typer. Adskillelsen er rigtig, men den havde to tavse huller:
 *
 *  1. **Filer uden for ethvert projekt.** `vite.mineo.config.ts` og `vite.minprocesrente.config.ts` stod
 *     i ingen `include`. Ingen kommando typecheckede dem – og editoren kunne ikke placere dem, så den
 *     faldt tilbage på et «inferred project» uden vores indstillinger og viste fejl, der ikke fandtes.
 *     Det samme gjaldt hele `e2e/`, fordi tsserver kun leder efter filer ved navn `tsconfig.json`.
 *  2. **Et projekt uden en kommando.** `tsconfig.node.json` var ikke koblet på `check:types`. Da den
 *     for første gang blev kørt, fejlede den med 31 fejl, den havde båret uset.
 *
 * Begge huller er af samme slags: noget ser dækket ud, fordi det står i en fil, men ingen kører det.
 * Værnet måler den faktiske dækning i stedet – hvilke filer projekterne rent faktisk trækker ind, og
 * hvilke projekter kommandoen rent faktisk kører.
 */

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Solution-filen, der binder projekterne sammen for editoren. Typechecker intet selv. */
const SOLUTION_CONFIG = 'tsconfig.json';

/** Den kommando, der skal køre dem alle. */
const AGGREGATE_SCRIPT = 'check:types';

const readJson = (relativePath: string): Record<string, unknown> =>
  ts.parseConfigFileTextToJson(relativePath, fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'))
    .config as Record<string, unknown>;

const listRootConfigs = (): readonly string[] =>
  fs.readdirSync(REPO_ROOT)
    .filter((name) => /^tsconfig\..+\.json$/.test(name))
    .sort();

const referencedProjects = (): readonly string[] => {
  const references = readJson(SOLUTION_CONFIG).references as readonly { path: string }[] | undefined;
  return (references ?? []).map((reference) => reference.path.replace(/^\.\//, ''));
};

/** De filer, et projekt faktisk trækker ind – ikke hvad dets `include` ligner. */
const projectFiles = (relativePath: string): readonly string[] => {
  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(path.join(REPO_ROOT, relativePath), ts.sys.readFile).config,
    ts.sys,
    REPO_ROOT,
  );
  return parsed.fileNames.map((file) => path.relative(REPO_ROOT, file).split(path.sep).join('/'));
};

const trackedTypeScriptFiles = (): readonly string[] =>
  execFileSync('git', ['ls-files', '*.ts', '*.tsx'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    // `git ls-files` also lists a file that is deleted in the working tree until the deletion is staged.
    // Coverage concerns the files that exist and can be opened by the editor; otherwise an ordinary
    // refactor with an unstaged deletion makes this guard report a phantom unowned file.
    .filter((file) => fs.existsSync(path.join(REPO_ROOT, file)));

/** Ren regel, så selv-testen kan fodre den en konstrueret tilstand. */
export const findUnownedFiles = (
  tracked: readonly string[],
  owned: ReadonlySet<string>,
): readonly string[] => tracked.filter((file) => !owned.has(file));

const packageScripts = (): Record<string, string> =>
  (JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }).scripts;

/** Kommandoerne bag et npm-script, fladet ud gennem `npm run <navn>`-kæderne. */
const expandScript = (name: string, scripts: Record<string, string>, seen = new Set<string>()): string => {
  if (seen.has(name)) return '';
  seen.add(name);
  const body = scripts[name] ?? '';
  return body.replace(/npm run ([\w:-]+)/g, (_match, referenced: string) =>
    expandScript(referenced, scripts, seen));
};

describe('TypeScript-projekterne dækker repoet, og kommandoen dækker projekterne', () => {
  it('solution-filen refererer hvert projekt i roden', () => {
    const missing = listRootConfigs().filter((config) => !referencedProjects().includes(config));

    expect(
      missing,
      `Disse projekter står i roden, men er ikke refereret fra ${SOLUTION_CONFIG}. Editoren kan ikke `
      + 'placere deres filer og falder tilbage på et inferred project med forkerte indstillinger.\n'
      + missing.map((config) => `  ${config}`).join('\n'),
    ).toEqual([]);
  });

  it(`${AGGREGATE_SCRIPT} kører hvert refereret projekt`, () => {
    const scripts = packageScripts();
    const commands = expandScript(AGGREGATE_SCRIPT, scripts);
    const missing = referencedProjects().filter((config) => !commands.includes(config));

    expect(
      missing,
      `Disse projekter er refereret, men køres ikke af \`npm run ${AGGREGATE_SCRIPT}\`. Et projekt uden `
      + 'en kommando samler fejl op, som ingen ser – det var præcis tilfældet for tsconfig.node.json.\n'
      + missing.map((config) => `  ${config}`).join('\n'),
    ).toEqual([]);
  });

  it('hver sporet .ts/.tsx-fil hører til mindst ét projekt', () => {
    const owned = new Set(referencedProjects().flatMap((config) => projectFiles(config)));
    const unowned = findUnownedFiles(trackedTypeScriptFiles(), owned);

    expect(
      unowned,
      'Disse filer ligger uden for ethvert TypeScript-projekt. De bliver hverken typechecket af '
      + `\`npm run ${AGGREGATE_SCRIPT}\` eller placeret rigtigt af editoren.\n`
      + unowned.map((file) => `  ${file}`).join('\n'),
    ).toEqual([]);
  });

  /**
   * Selv-test (jf. guard-selvtest-princippet): reglen skal kunne FEJLE, og målet skal FINDES.
   */
  describe('værnet kan faktisk fejle', () => {
    it('fanger en fil, intet projekt ejer', () => {
      expect(findUnownedFiles(['a.ts', 'b.ts'], new Set(['a.ts']))).toEqual(['b.ts']);
    });

    it('måler et levende mål: der findes projekter, og de ejer filer', () => {
      const projects = referencedProjects();
      expect(projects.length).toBeGreaterThanOrEqual(4);
      for (const project of projects) {
        expect(projectFiles(project).length, `${project} trækker ingen filer ind.`).toBeGreaterThan(0);
      }
    });

    it('måler et levende mål: der findes sporede TypeScript-filer at kontrollere', () => {
      expect(trackedTypeScriptFiles().length).toBeGreaterThan(100);
    });

    it('flader npm run-kæder ud, så et projekt gemt bag et mellemled stadig tælles med', () => {
      const scripts = { a: 'npm run b', b: 'tsc -p tsconfig.dybt.json' };
      expect(expandScript('a', scripts)).toContain('tsconfig.dybt.json');
    });
  });
});
