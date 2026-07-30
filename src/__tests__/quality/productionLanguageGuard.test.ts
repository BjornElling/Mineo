import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const SRC_ROOT = resolve(process.cwd(), 'src');
const CONTRACT_ROOT = join(SRC_ROOT, 'contracts');

const walk = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name);
  if (path === join(SRC_ROOT, '__tests__')) return [];
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const PROJECT_HISTORY_MARKERS = [
  /\bWI-\d+\b/i,
  /\b[A-Z][A-Z0-9]*-F\d+\b/i,
  /\bFase\s+\d+(?:\.\d+)?\b/,
  /\bpass\s+\d+\b/i,
  /\bgreenfield\b/i,
  /\bcutover\b/i,
  /\breview[- ]?(?:plan|fund|punkt|spor|historik)\b/i,
  /\brunde\s+\d+\b/i,
] as const;

const filesInScope = walk(SRC_ROOT).filter((path) => {
  const extension = extname(path);
  return extension === '.ts'
    || extension === '.tsx'
    || (path.startsWith(CONTRACT_ROOT) && extension === '.md');
});

describe('produktionssprog beskriver sluttilstanden', () => {
  it('indeholder ikke implementeringsfaser, work-items eller overgangsmarkører', () => {
    const findings = filesInScope.flatMap((path) => readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .flatMap((line, index) => PROJECT_HISTORY_MARKERS.some((pattern) => pattern.test(line))
        ? [`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`]
        : []));

    expect(findings).toEqual([]);
  });
});
