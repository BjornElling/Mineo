// @vitest-environment jsdom
import { z } from 'zod';
import { persistedErstatningsopgoerelseSchema } from '../../../schemas/formSchemas';
import { getOverenskomstMetaById } from '../../../data/overenskomstRates';
import { generateEoCase, OVERENSKOMST_IDS } from './helpers/eoRuntimeInputArbitrary';

// Selve fuzzingen ligger i `eoInputRuntimeFuzz.<tilstand>.shardN.test.ts` (se `helpers/eoRuntimeFuzzShard.ts`).

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
});
