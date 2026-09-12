import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const workflowPath = join(repoRoot, '.github', 'workflows', 'ci.yml');

/**
 * Finder den aktive release-step i det angivne job. Et substring-tjek kan ikke skelne en aktiv
 * YAML-linje fra en kommenteret linje, så en fjernet release-gate ellers kan se grøn ud.
 */
const hasActiveRunCommand = (workflow: string, jobId: string, command: string): boolean => {
  const lines = workflow.split(/\r?\n/);
  const jobStart = lines.findIndex((line) => line === `  ${jobId}:`);
  if (jobStart < 0) return false;

  const jobEnd = lines.findIndex(
    (line, index) => index > jobStart && /^\x20{2}[A-Za-z0-9_-]+:$/.test(line),
  );
  const jobLines = lines.slice(jobStart + 1, jobEnd < 0 ? lines.length : jobEnd);

  return jobLines.some((line) => line === `        run: ${command}`);
};

describe('GitHub Actions – release-gaten er en aktiv workflow-step', () => {
  it('finder den levende verify:release:core-step i verify-jobbet', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(hasActiveRunCommand(workflow, 'verify', 'npm run verify:release:core')).toBe(true);
  });

  it('afviser en workflow hvor release-gaten kun står i en kommentar', () => {
    const workflow = [
      'jobs:',
      '  verify:',
      '    steps:',
      '      - name: Verify release',
      '        # run: npm run verify:release:core',
      '        run: echo "kun en syntetisk kontrol"',
      '  deploy:',
      '    steps:',
      '      - run: echo deploy',
    ].join('\n');

    expect(hasActiveRunCommand(workflow, 'verify', 'npm run verify:release:core')).toBe(false);
  });
});
