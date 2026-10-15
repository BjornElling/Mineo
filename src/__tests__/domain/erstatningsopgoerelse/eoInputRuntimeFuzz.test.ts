// @vitest-environment jsdom
import { z } from 'zod';
import { persistedErstatningsopgoerelseSchema } from '../../../schemas/formSchemas';
import { getOverenskomstMetaById } from '../../../data/overenskomstRates';
import { generateEoCase, OVERENSKOMST_IDS, type EoCaseMode } from './helpers/eoRuntimeInputArbitrary';
import { eoRuntimeStats, runEoPage, type Failure } from './helpers/eoRuntimePage';

const CASES = Number(process.env.EO_FUZZ_CASES ?? 150);
const FIRST_SEED = Number(process.env.EO_FUZZ_SEED ?? 1);

const fuzz = (mode: EoCaseMode) => {
  eoRuntimeStats.status = {};
  const failures: Failure[] = [];
  for (let seed = FIRST_SEED; seed < FIRST_SEED + CASES; seed += 1) {
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

describe('Erstatningsopgørelse – runtime-fuzzing af alle inputfelter', () => {
  it('dækker hvert persisteret schemafelt, også i de nestede tabeller', () => {
    const samples = Array.from({ length: 30 }, (_, index) => generateEoCase(index + 1).erstatningsopgoerelse);
    const inspect = (schema: unknown, values: readonly unknown[], path: string): void => {
      if (schema instanceof z.ZodDefault || schema instanceof z.ZodOptional) {
        inspect(schema.unwrap(), values, path);
      } else if (schema instanceof z.ZodArray) {
        inspect(schema.element, values.flatMap((value) => Array.isArray(value) ? value : []), `${path}[]`);
      } else if (schema instanceof z.ZodObject) {
        const objects = values.filter((value): value is Record<string, unknown> =>
          value !== null && typeof value === 'object' && !Array.isArray(value));
        const keys = [...new Set(objects.flatMap(Object.keys))].sort();
        expect(keys, path).toEqual(Object.keys(schema.shape).sort());
        for (const [key, child] of Object.entries(schema.shape)) {
          inspect(child, objects.map((value) => value[key]), `${path}.${key}`);
        }
      }
    };
    inspect(persistedErstatningsopgoerelseSchema, samples, 'erstatningsopgoerelse');
  });

  it("genererer kun overenskomst-id'er, der findes i overenskomstdataene", () => {
    // Et forkert id gør hver overenskomstsag til en «ukendt overenskomst» og fjerner dermed de dybe grene fra fuzzingen.
    expect(OVERENSKOMST_IDS.filter((id) => getOverenskomstMetaById(id) === undefined)).toEqual([]);
  });

  it.each(['tilfaeldig', 'sammenhaengende'] as const)(
    'kaster aldrig og ender aldrig i runtime_exception (%s)',
    (mode) => {
      expect(fuzz(mode)).toEqual([]);
      if (mode === 'sammenhaengende') {
        expect((eoRuntimeStats.status.ok ?? 0) + (eoRuntimeStats.status.warning ?? 0)).toBeGreaterThan(0);
      }
    },
    600_000
  );
});
