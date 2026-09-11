import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

type StrykerConfig = {
  testRunner: string;
  command: string;
  mutate: string[];
  coverageAnalysis: string;
  concurrency: number;
  timeoutMS: number;
  dryRunTimeoutMinutes: number;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const configPath = join(repoRoot, 'stryker.config.json');
const mutationTarget = 'src/domain/money/money.ts';
const selectedTestCommand = 'npx vitest run src/__tests__/domain/money/money.test.ts --reporter=dot';

const isJsonRecord = (value: unknown): value is JsonRecord => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const readJsonRecord = (filePath: string): JsonRecord => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!isJsonRecord(parsed)) throw new Error(`${filePath} skal indeholde et JSON-objekt.`);
  return parsed;
};

const requiredString = (record: JsonRecord, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`${key} skal være en streng.`);
  return value;
};

const requiredNumber = (record: JsonRecord, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number') throw new Error(`${key} skal være et tal.`);
  return value;
};

const requiredStringArray = (record: JsonRecord, key: string): string[] => {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((entry): entry is string => typeof entry === 'string')) {
    throw new Error(`${key} skal være en strengliste.`);
  }
  return value;
};

const readStrykerConfig = (): StrykerConfig => {
  const config = readJsonRecord(configPath);
  const commandRunner = config.commandRunner;
  if (!isJsonRecord(commandRunner)) throw new Error('commandRunner skal være et JSON-objekt.');

  return {
    testRunner: requiredString(config, 'testRunner'),
    command: requiredString(commandRunner, 'command'),
    mutate: requiredStringArray(config, 'mutate'),
    coverageAnalysis: requiredString(config, 'coverageAnalysis'),
    concurrency: requiredNumber(config, 'concurrency'),
    timeoutMS: requiredNumber(config, 'timeoutMS'),
    dryRunTimeoutMinutes: requiredNumber(config, 'dryRunTimeoutMinutes'),
  };
};

describe('Stryker command-runner-konfiguration', () => {
  it('er koblet til package-scriptet og bruger den eksplicitte command-runner', () => {
    const packageJson = readJsonRecord(join(repoRoot, 'package.json'));
    const scripts = packageJson.scripts;
    if (!isJsonRecord(scripts)) throw new Error('package.json.scripts skal være et JSON-objekt.');

    expect(scripts['test:mutation']).toBe('stryker run');
    expect(existsSync(configPath)).toBe(true);

    const config = readStrykerConfig();
    expect(config.testRunner).toBe('command');
    expect(config.command).toBe(selectedTestCommand);
  });

  it('muterer kun den versionsbundne, rene money-flade', () => {
    const config = readStrykerConfig();

    // En eksplicit fil er nødvendig: en bred glob kan ellers mutere testkode eller UI uden at
    // command-runnerens resultat længere siger noget præcist om auditfladen.
    expect(config.mutate).toEqual([mutationTarget]);
    expect(config.mutate.every((target) => !target.includes('*'))).toBe(true);
    expect(config.mutate.every((target) => existsSync(join(repoRoot, target)))).toBe(true);
    expect(config.mutate.every((target) => !target.includes('__tests__'))).toBe(true);
  });

  it('holder command-runneren seriel og uden ugyldig per-test coverage', () => {
    const config = readStrykerConfig();

    expect(config.coverageAnalysis).toBe('off');
    expect(config.concurrency).toBe(1);
    expect(config.timeoutMS).toBe(30000);
    expect(config.dryRunTimeoutMinutes).toBe(5);
  });
});
