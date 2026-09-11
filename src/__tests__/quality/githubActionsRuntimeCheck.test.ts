import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// @ts-expect-error – kontrollen er et .mjs-script uden typedeklarationer.
import { validateGitHubActionsRuntime } from '../../../scripts/check-github-actions-runtime.mjs';

const repoRoot = resolve(__dirname, '../../..');

const withWorkflowFixture = (workflow: string, nodeVersion = 'v24.18.0'): string => {
  const fixtureRoot = mkdtempSync(join(repoRoot, 'tmp-github-actions-runtime-'));
  mkdirSync(join(fixtureRoot, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(fixtureRoot, '.nvmrc'), `${nodeVersion}\n`);
  writeFileSync(join(fixtureRoot, '.github', 'workflows', 'fixture.yml'), workflow);
  return fixtureRoot;
};

describe('check-github-actions-runtime', () => {
  afterEach(() => {
    for (const entry of readdirSync(repoRoot)) {
      if (!entry.startsWith('tmp-github-actions-runtime-')) continue;
      rmSync(join(repoRoot, entry), { recursive: true, force: true });
    }
  });

  it('måler alle de levende workflows med den deklarerede action-politik', () => {
    const result = validateGitHubActionsRuntime(repoRoot);

    expect(result.problems).toEqual([]);
    expect(result.workflowCount).toBeGreaterThan(0);
    expect(result.externalActionCount).toBeGreaterThan(0);
    expect(result.projectNodeMajor).toBe(24);
  });

  it('er koblet ind i den release-gate, der skal beskytte deployet', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['verify:release:core'])
      .toContain('npm run check:github-actions-runtime');
  });

  it('afviser en ukendt ekstern action i en syntetisk workflow', () => {
    const fixtureRoot = withWorkflowFixture('jobs:\n  check:\n    steps:\n      - uses: example/unknown-action@v1\n');

    expect(validateGitHubActionsRuntime(fixtureRoot).problems).toEqual([
      "fixture.yml:4: 'example/unknown-action' er ikke registreret med en dokumenteret Node-runtime.",
    ]);
  });

  it('afviser en action-major der ikke er den dokumenterede major', () => {
    const fixtureRoot = withWorkflowFixture('jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v6\n');

    expect(validateGitHubActionsRuntime(fixtureRoot).problems).toEqual([
      "fixture.yml:4: 'actions/checkout@v6' er ikke den godkendte major v7; opdatér action-politikken efter kontrol af dens Node-runtime.",
    ]);
  });

  it('afviser en godkendt action når projektet kræver en nyere Node-major', () => {
    const fixtureRoot = withWorkflowFixture(
      'jobs:\n  check:\n    steps:\n      - uses: actions/checkout@v7\n',
      'v25.0.0',
    );

    expect(validateGitHubActionsRuntime(fixtureRoot).problems).toEqual([
      "fixture.yml:4: 'actions/checkout@v7' kører på Node 24, men projektet kræver Node 25 eller nyere.",
    ]);
  });
});
