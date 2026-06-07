import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve('.env.build-info.local');

const readGit = (args: readonly string[]): string =>
  execFileSync('git', [...args], { encoding: 'utf8' }).trim();

const parseEnvFile = (content: string): Record<string, string> => {
  const parsed: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    parsed[line.slice(0, separatorIndex)] = JSON.parse(line.slice(separatorIndex + 1)) as string;
  }

  return parsed;
};

describe('generate-build-info', () => {
  const hadEnvFile = existsSync(ENV_FILE);
  const previousEnvFile = hadEnvFile ? readFileSync(ENV_FILE, 'utf8') : undefined;

  afterAll(() => {
    if (previousEnvFile !== undefined) {
      writeFileSync(ENV_FILE, previousEnvFile, 'utf8');
      return;
    }

    rmSync(ENV_FILE, { force: true });
  });

  it('skriver build-info med år.måned.commitnummer.hash6', () => {
    execFileSync('node', ['scripts/generate-build-info.mjs'], { encoding: 'utf8' });

    const env = parseEnvFile(readFileSync(ENV_FILE, 'utf8'));
    const commitDate = readGit(['log', '-1', '--format=%cd', '--date=format:%Y.%m']);
    const commitCount = readGit(['rev-list', '--count', 'HEAD']);
    const commit = readGit(['rev-parse', 'HEAD']);
    const commitShort = readGit(['rev-parse', '--short=6', 'HEAD']);

    expect(env.VITE_APP_VERSION).toBe(`${commitDate}.${commitCount}.${commitShort}`);
    expect(env.VITE_APP_VERSION).toMatch(/^\d{4}\.\d{2}\.\d+\.[0-9a-f]{6}$/);
    expect(env.VITE_APP_COMMIT_HASH).toBe(commit);
    expect(env.VITE_APP_COMMIT_SHORT).toBe(commitShort);
    expect(env.VITE_APP_BUILT_AT).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
