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

type RawMatrixEntry = MatrixEntry & Readonly<{ shard?: string }>;

/** Læser kun aktive `project`/`browser`(/`shard`)-poster i E2E-jobbets matrix. */
const readE2eMatrix = (workflow: string): readonly RawMatrixEntry[] => {
  const lines = getWorkflowJob(workflow, 'e2e', 'deploy').split(/\r?\n/);
  const includeStart = lines.findIndex((line) => line === '        include:');
  if (includeStart < 0) return [];

  const entries: RawMatrixEntry[] = [];
  for (let index = includeStart + 1; index < lines.length; index += 1) {
    if (lines[index] === '    steps:') break;

    const project = /^ {10}- project: ([A-Za-z0-9_-]+)$/.exec(lines[index]);
    if (!project) continue;

    const browser = /^ {12}browser: ([A-Za-z0-9_-]+)$/.exec(lines[index + 1] ?? '');
    const shard = /^ {12}shard: (\d+\/\d+)$/.exec(lines[index + 2] ?? '');
    if (browser) {
      entries.push({
        project: project[1]!,
        browser: browser[1]!,
        ...(shard ? { shard: shard[1]! } : {}),
      });
    }
  }

  return entries;
};

/**
 * Et projekt er kun dækket, når det enten kører helt (uden shard) eller med ALLE sine shards 1..N af N.
 * En manglende shard ville tavst springe en fjerdedel af basisbanen over; den regnes derfor som et
 * manglende projekt.
 */
const readLaneMatrix = (workflow: string): readonly MatrixEntry[] => {
  const expectedProjects = new Set(EXPECTED_LANE_MATRIX.map(({ project }) => project));
  const byProject = new Map<string, RawMatrixEntry[]>();
  for (const entry of readE2eMatrix(workflow)) {
    if (!expectedProjects.has(entry.project)) continue;
    byProject.set(entry.project, [...(byProject.get(entry.project) ?? []), entry]);
  }

  const covered: MatrixEntry[] = [];
  for (const [project, entries] of byProject) {
    const browsers = new Set(entries.map(({ browser }) => browser));
    if (browsers.size !== 1) continue;
    const shards = entries.map(({ shard }) => shard);
    const unsharded = shards.length === 1 && shards[0] === undefined;
    const total = Number(shards[0]?.split('/')[1]);
    const completeShards = Number.isInteger(total)
      && total > 1
      && shards.length === total
      && new Set(shards).size === total
      && shards.every((shard) => shard !== undefined && Number(shard.split('/')[1]) === total)
      && Array.from({ length: total }, (_, i) => `${i + 1}/${total}`).every((s) => shards.includes(s));
    if (unsharded || completeShards) covered.push({ project, browser: [...browsers][0]! });
  }
  return covered;
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

  const shardedWorkflow = (chromeShards: readonly string[]): string => [
    'jobs:',
    '  e2e:',
    '    strategy:',
    '      matrix:',
    '        include:',
    ...chromeShards.flatMap((shard) => [
      '          - project: chrome-desktop',
      '            browser: chromium',
      `            shard: ${shard}`,
    ]),
    ...EXPECTED_LANE_MATRIX.slice(1).flatMap(({ project, browser }) => [
      `          - project: ${project}`,
      `            browser: ${browser}`,
    ]),
    '    steps:',
    '  deploy:',
  ].join('\n');

  it('godtager en basisbane delt i alle sine shards', () => {
    expect(readLaneMatrix(shardedWorkflow(['1/3', '2/3', '3/3']))).toEqual(EXPECTED_LANE_MATRIX);
  });

  it('afviser en basisbane, hvor en shard mangler', () => {
    expect(readLaneMatrix(shardedWorkflow(['1/3', '3/3']))).not.toEqual(EXPECTED_LANE_MATRIX);
  });

  it('afviser en basisbane med en dubleret shard i stedet for den manglende', () => {
    expect(readLaneMatrix(shardedWorkflow(['1/3', '1/3', '3/3']))).not.toEqual(EXPECTED_LANE_MATRIX);
  });
});
