import { generateEoCase, type EoCaseMode } from './eoRuntimeInputArbitrary';
import { eoRuntimeStats, runEoPage, type Failure } from './eoRuntimePage';

// Runtime-fuzzingen af alle EO-inputfelter, fordelt på shards.
//
// Hele fuzzingen (2 × 150 seeds) lå i én testfil og tog ~150 s – næsten hele Vitest-suitens varighed, fordi
// en testfil kører serielt i én worker. Seeds er uafhængige, så de fordeles på flere filer, der kører
// parallelt. Tilsammen dækker de stadig præcis samme seedinterval; `EO_FUZZ_CASES`/`EO_FUZZ_SEED` virker
// som før og fordeles ligeligt.

export const FUZZ_SHARD_COUNT = 3;

const CASES = Number(process.env.EO_FUZZ_CASES ?? 150);
const FIRST_SEED = Number(process.env.EO_FUZZ_SEED ?? 1);

const shardSeeds = (shard: number): readonly number[] => {
  const seeds: number[] = [];
  for (let seed = FIRST_SEED; seed < FIRST_SEED + CASES; seed += 1) {
    if ((seed - FIRST_SEED) % FUZZ_SHARD_COUNT === shard) seeds.push(seed);
  }
  return seeds;
};

const fuzz = (mode: EoCaseMode, shard: number): readonly string[] => {
  eoRuntimeStats.status = {};
  const failures: Failure[] = [];
  for (const seed of shardSeeds(shard)) {
    failures.push(...runEoPage(generateEoCase(seed, mode)));
  }
  // Gruppér efter stage + besked, så én rodårsag ikke drukner rapporten.
  const grouped = new Map<string, number[]>();
  for (const failure of failures) {
    const key = `${failure.stage} :: ${failure.message}`;
    grouped.set(key, [...(grouped.get(key) ?? []), failure.seed]);
  }
  return [...grouped.entries()].map(([key, seeds]) =>
    `${key} (seeds: ${seeds.slice(0, 8).join(', ')}${seeds.length > 8 ? ', …' : ''}; ${String(seeds.length)} stk.)`);
};

/** Definerer én fuzz-shard for én generatortilstand. */
export const defineFuzzShard = (mode: EoCaseMode, shard: number): void => {
  it(`kaster aldrig og ender aldrig i runtime_exception (${mode}, shard ${String(shard + 1)}/${String(FUZZ_SHARD_COUNT)})`, () => {
    expect(fuzz(mode, shard)).toEqual([]);
    if (mode === 'sammenhaengende') {
      // Den sammenhængende generator skal faktisk nå gyldige beregninger, ellers fuzzer den kun fejlgrene.
      expect((eoRuntimeStats.status.ok ?? 0) + (eoRuntimeStats.status.warning ?? 0)).toBeGreaterThan(0);
    }
  }, 600_000);
};
