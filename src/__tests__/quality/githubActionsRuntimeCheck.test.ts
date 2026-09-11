import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// @ts-expect-error – kontrollen er et .mjs-script uden typedeklarationer.
import { validateGitHubActionsRuntime } from '../../../scripts/check-github-actions-runtime.mjs';

const repoRoot = resolve(__dirname, '../../..');

const getWorkflowJob = (workflow: string, jobId: string, nextJobId?: string): string => {
  const startMarker = `\n  ${jobId}:\n`;
  const start = workflow.indexOf(startMarker);
  if (start < 0) throw new Error(`Workflow-fixture mangler jobben ${jobId}`);
  const contentStart = start + startMarker.length;
  const end = nextJobId === undefined
    ? workflow.length
    : workflow.indexOf(`\n  ${nextJobId}:\n`, contentStart);
  if (end < 0) throw new Error(`Workflow-fixture mangler slutjobben ${nextJobId}`);
  return workflow.slice(contentStart, end);
};

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

  it('kobler verify-, E2E- og deploy-job til samme dist-artefakt', () => {
    const workflow = readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
    const verifyJob = getWorkflowJob(workflow, 'verify', 'e2e');
    const e2eJob = getWorkflowJob(workflow, 'e2e', 'deploy');
    const deployJob = getWorkflowJob(workflow, 'deploy');

    // Et statisk værn er passende her: CI-kontrakten skal være synlig i workflow-filen, og
    // ellers kan en separat test-build igen blive forvekslet med det artefakt, der deployes.
    expect(verifyJob).toContain('uses: actions/upload-artifact@v7');
    expect(verifyJob).toContain('name: dist');
    expect(verifyJob).toContain('path: dist/');
    expect(verifyJob).toContain('e2e/production-artifact-smoke.spec.ts');

    expect(e2eJob).toContain('needs: verify');
    expect(e2eJob).toContain('uses: actions/download-artifact@v8');
    expect(e2eJob).toContain('name: dist');
    expect(e2eJob).toContain('path: dist/');
    expect(e2eJob).toContain('node scripts/serve-e2e-builds.mjs');
    expect(e2eJob).not.toContain('npm run build');

    expect(deployJob).toContain('needs: [verify, e2e]');
    expect(deployJob).toContain('uses: actions/download-artifact@v8');
    expect(deployJob).toContain('name: dist');
    expect(deployJob).toContain('path: dist/');
    expect(deployJob).toContain('command: deploy --config wrangler.mineo.json');
    expect(deployJob).toContain('command: deploy --config wrangler.minprocesrente.json');
  });
});
