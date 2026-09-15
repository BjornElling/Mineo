import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type CiTriggers = Readonly<{
  pullRequest: boolean;
  pushToMain: boolean;
}>;

const workflowPath = join(process.cwd(), '.github', 'workflows', 'ci.yml');

const readTopLevelTriggerBlock = (workflow: string): readonly string[] => {
  const lines = workflow.split(/\r?\n/);
  const triggerStart = lines.findIndex((line) => line === 'on:');
  if (triggerStart < 0) return [];

  const triggerEnd = lines.findIndex(
    (line, index) => index > triggerStart && line !== '' && !line.startsWith(' ') && !line.startsWith('#')
  );
  return lines.slice(triggerStart + 1, triggerEnd < 0 ? lines.length : triggerEnd);
};

const readCiTriggers = (workflow: string): CiTriggers => {
  const triggerLines = readTopLevelTriggerBlock(workflow);
  const pullRequest = triggerLines.some((line) => line === '  pull_request:');
  const pushStart = triggerLines.findIndex((line) => line === '  push:');
  const pushEnd = triggerLines.findIndex(
    (line, index) => index > pushStart && line.startsWith('  ') && !line.startsWith('    ')
  );
  const pushLines = triggerLines.slice(pushStart + 1, pushEnd < 0 ? triggerLines.length : pushEnd);
  const pushToMain = pushLines.some((line) => line === '    branches: [ main ]');

  return { pullRequest, pushToMain };
};

const hasRequiredCiTriggers = (workflow: string): boolean => {
  const triggers = readCiTriggers(workflow);
  return triggers.pullRequest && triggers.pushToMain;
};

describe('GitHub Actions – CI-triggerens liveness', () => {
  it('holder releasegaten live på pull requests og pushes til main', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(readCiTriggers(workflow)).toEqual({ pullRequest: true, pushToMain: true });
    expect(hasRequiredCiTriggers(workflow)).toBe(true);
  });

  it('afviser en syntetisk workflow uden pull-request-trigger', () => {
    const workflow = [
      'name: CI',
      '',
      'on:',
      '  push:',
      '    branches: [ main ]',
      '',
      'jobs:',
      '  verify:',
      '    steps:',
      '      - run: npm run verify:release:core',
    ].join('\n');

    expect(readCiTriggers(workflow)).toEqual({ pullRequest: false, pushToMain: true });
    expect(hasRequiredCiTriggers(workflow)).toBe(false);
  });

  it('afviser en syntetisk workflow uden push-til-main-trigger', () => {
    const workflow = [
      'name: CI',
      '',
      'on:',
      '  pull_request:',
      '  push:',
      '    branches: [ release ]',
      '',
      'jobs:',
      '  verify:',
      '    steps:',
      '      - run: npm run verify:release:core',
    ].join('\n');

    expect(readCiTriggers(workflow)).toEqual({ pullRequest: true, pushToMain: false });
    expect(hasRequiredCiTriggers(workflow)).toBe(false);
  });
});
