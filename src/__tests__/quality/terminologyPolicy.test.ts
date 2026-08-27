import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

const PROJECT_ROOT = resolve(process.cwd());
const THIS_FILE = resolve(PROJECT_ROOT, 'src/__tests__/quality/terminologyPolicy.test.ts');
const SCAN_ROOTS = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  '.claude',
  '.agents',
  'docs',
  'e2e',
  'public',
  'scripts',
  'src',
  'sw',
] as const;
const TEXT_EXTENSIONS = new Set(['.d.ts', '.js', '.json', '.md', '.mjs', '.toml', '.ts', '.tsx', '.txt', '.yml', '.yaml']);

const joinWords = (...parts: string[]): string => parts.join('');

/**
 * Gamle formuleringer, hvor en ekstern bruger fejlagtigt står som den interne beslutningstager.
 * Delene samles først ved kørsel, så dette værn ikke selv bliver en forekomst, det skal finde.
 */
const FORBIDDEN_ROLE_FORMULATIONS: readonly string[] = [
  joinWords('bruger', 'beslutning'),
  joinWords('bruger', 'besluttede'),
  ['brugerens', ' afgørelse'].join(''),
  ['brugerens', ' beslutning'].join(''),
  ['brugerens', ' godkendelse'].join(''),
  ['brugerens', ' tilbagemeldinger'].join(''),
  ['brugerens', ' svar'].join(''),
  ['afgjort af ', 'brugeren'].join(''),
  ['accepteret af ', 'brugeren'].join(''),
  ['afvist af ', 'brugeren'].join(''),
  ['forelægges ', 'brugeren'].join(''),
  ['afventer ', 'bruger'].join(''),
  joinWords('bruger', 'godkendt'),
  joinWords('bruger', 'godkendte'),
  joinWords('udvik', 'lere'),
];
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const forbiddenRolePatterns = FORBIDDEN_ROLE_FORMULATIONS.map((formulation) => ({
  formulation,
  pattern: new RegExp(`\\b${escapeRegExp(formulation)}\\b`, 'iu'),
}));

const collectTextFiles = (relativeEntry: string): string[] => {
  const absoluteEntry = resolve(PROJECT_ROOT, relativeEntry);
  if (statSync(absoluteEntry).isFile()) return [absoluteEntry];

  return readdirSync(absoluteEntry).flatMap((name) => {
    const absolutePath = resolve(absoluteEntry, name);
    if (statSync(absolutePath).isDirectory()) return collectTextFiles(relative(`${PROJECT_ROOT}`, absolutePath));
    if (absolutePath === THIS_FILE || !TEXT_EXTENSIONS.has(extname(name))) return [];
    return [absolutePath];
  });
};

const files = SCAN_ROOTS.flatMap(collectTextFiles);

describe('Mineos terminologipolitik', () => {
  it('har et levende scope, så værnet ikke bliver grønt af tomhed', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('bruger bruger om eksterne brugere og udvikleren om Bjørn', () => {
    const findings: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const { formulation, pattern } of forbiddenRolePatterns) {
          if (pattern.test(line)) {
            findings.push(`${relative(PROJECT_ROOT, file)}:${index + 1}: ${formulation}`);
          }
        }
      });
    }

    expect(findings).toEqual([]);
  });
});
