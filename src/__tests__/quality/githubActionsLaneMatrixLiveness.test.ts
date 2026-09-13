import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type MatrixEntry = Readonly<{
  project: string;
  browser: string;
}>;

const repoRoot = process.cwd();
const workflowPath = join(repoRoot, '.github', 'workflows', 'ci.yml');

const EXPECTED_LANE_MATRIX: readonly MatrixEntry[] = [
  { project: 'chrome-desktop', browser: 'chromium' },
  { project: 'edge-desktop', browser: 'chromium' },
  { project: 'firefox-desktop', browser: 'firefox' },
  { project: 'safari-webkit-desktop', browser: 'webkit' },
  { project: 'chrome-desktop-1536x730', browser: 'chromium' },
  { project: 'chrome-desktop-1366x620', browser: 'chromium' },
];

const getWorkflowJob = (workflow: string, jobId: string, nextJobId?: string): string => {
  const startMarker = `\n  ${jobId}:\n`;
  const start = workflow.indexOf(startMarker);
  if (start < 0) return '';

  const contentStart = start + startMarker.length;
  const end = nextJobId === undefined
    ? workflow.length
    : workflow.indexOf(`\n  ${nextJobId}:\n`, contentStart);
  return workflow.slice(contentStart, end < 0 ? workflow.length : end);
};

/** Læser kun aktive `project`/`browser`-poster i E2E-jobbets matrix. */
const readE2eMatrix = (workflow: string): readonly MatrixEntry[] => {
  const lines = getWorkflowJob(workflow, 'e2e', 'deploy').split(/\r?\n/);
  const includeStart = lines.findIndex((line) => line === '        include:');
  if (includeStart < 0) return [];

  const entries: MatrixEntry[] = [];
  for (let index = includeStart + 1; index < lines.length; index += 1) {
    if (lines[index] === '    steps:') break;

    const project = /^ {10}- project: ([A-Za-z0-9_-]+)$/.exec(lines[index]);
    if (!project) continue;

    const browser = /^ {12}browser: ([A-Za-z0-9_-]+)$/.exec(lines[index + 1] ?? '');
    if (browser) entries.push({ project: project[1]!, browser: browser[1]! });
  }

  return entries;
};

const readLaneMatrix = (workflow: string): readonly MatrixEntry[] => {
  const expectedProjects = new Set(EXPECTED_LANE_MATRIX.map(({ project }) => project));
  return readE2eMatrix(workflow).filter(({ project }) => expectedProjects.has(project));
};

describe('GitHub Actions – den almindelige E2E-lane-matrix er levende', () => {
  it('kører alle seks lokale lane-projekter med den deklarerede browser', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(readLaneMatrix(workflow)).toEqual(EXPECTED_LANE_MATRIX);
  });

  it('afviser en syntetisk matrix, hvor en viewportlane er fjernet', () => {
    const workflow = [
      'jobs:',
      '  e2e:',
      '    strategy:',
      '      matrix:',
      '        include:',
      '          - project: chrome-desktop',
      '            browser: chromium',
      '          - project: edge-desktop',
      '            browser: chromium',
      '          - project: firefox-desktop',
      '            browser: firefox',
      '          - project: safari-webkit-desktop',
      '            browser: webkit',
      '          - project: chrome-desktop-1536x730',
      '            browser: chromium',
      '    steps:',
      '  deploy:',
    ].join('\n');

    expect(readLaneMatrix(workflow)).not.toEqual(EXPECTED_LANE_MATRIX);
  });
});
