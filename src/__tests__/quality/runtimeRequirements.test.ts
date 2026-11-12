import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const guardUrl = pathToFileURL(join(repoRoot, 'scripts', 'runtime-requirements.mjs')).href;

/** Kør værnet i en frisk Node-proces, der udgiver sig for at være `simuleretVersion`. */
const runGuard = (simuleretVersion: string) => spawnSync(process.execPath, [
  '--input-type=module',
  '-e',
  `Object.defineProperty(process, 'versions', { value: { ...process.versions, node: ${JSON.stringify(simuleretVersion)} } });
   const { assertSupportedNode } = await import(${JSON.stringify(guardUrl)});
   assertSupportedNode();
   console.log('accepteret');`,
], { encoding: 'utf8' });

describe('runtime-værnet (scripts/runtime-requirements.mjs)', () => {
  it('afviser en lavere lokal Node og anviser opgradering frem for at sænke kravet', () => {
    const result = runGuard('24.18.0');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('kører på Node 24.18.0');
    expect(result.stderr).toContain('winget upgrade --id OpenJS.NodeJS.LTS');
  });

  it('accepterer den version, .nvmrc fastlægger', () => {
    const nvmrc = readFileSync(join(repoRoot, '.nvmrc'), 'utf8').trim();
    const result = runGuard(nvmrc);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe('accepteret');
  });

  it('lader npm afvise `npm run` på forkert Node via devEngines.runtime med samme interval som engines', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      engines: { node: string };
      devEngines?: { runtime?: { name: string; version: string; onFail: string } };
    };
    expect(pkg.devEngines?.runtime).toEqual({ name: 'node', version: pkg.engines.node, onFail: 'error' });
  });
});
