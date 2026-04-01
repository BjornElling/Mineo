import { stripUnknownFieldsBySchema } from '../../utils/persistenceLoadSanitization';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { z } from 'zod';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

describe('persistenceLoadSanitization', () => {
  it('stripper ukendte felter og rapporterer deres stier', () => {
    const result = stripUnknownFieldsBySchema(stamdataSchema, {
      journalnr: 'J-1',
      skadelidte: 'Test',
      uventetFelt: 'fjern mig',
    });

    expect(result.unknownPaths).toContainEqual(['uventetFelt']);
    expect(result.sanitized).toEqual({
      journalnr: 'J-1',
      skadelidte: 'Test',
    });
  });

  it('stripper ukendte felter gennem pipe-wrappere som preprocess/transform bruger i Zod v4', () => {
    const schema = z.preprocess(
      (value) => value,
      z.object({
        navn: z.string(),
      }).strict()
    );

    const result = stripUnknownFieldsBySchema(schema, {
      navn: 'Test',
      uventetFelt: true,
    });

    expect(result.unknownPaths).toContainEqual(['uventetFelt']);
    expect(result.sanitized).toEqual({
      navn: 'Test',
    });
  });

  it('stripper ukendte felter i objekter inde i et array og rapporterer indekserede stier', () => {
    const schema = z.object({
      items: z.array(
        z.object({
          id: z.string(),
          value: z.number(),
        })
      ),
    });

    const result = stripUnknownFieldsBySchema(schema, {
      items: [
        { id: 'a', value: 1, uventetFelt: 'fjern' },
        { id: 'b', value: 2 },
        { id: 'c', value: 3, etAndetUventetFelt: true },
      ],
    });

    expect(result.unknownPaths).toContainEqual(['items', 0, 'uventetFelt']);
    expect(result.unknownPaths).toContainEqual(['items', 2, 'etAndetUventetFelt']);
    expect(result.unknownPaths).toHaveLength(2);

    const sanitized = result.sanitized as { items: Array<Record<string, unknown>> };
    expect(sanitized.items[0]).toEqual({ id: 'a', value: 1 });
    expect(sanitized.items[1]).toEqual({ id: 'b', value: 2 });
    expect(sanitized.items[2]).toEqual({ id: 'c', value: 3 });
  });

  it('stripper fjernede EO-felter før strict load-parse af gamle filer', () => {
    const legacyPayload = {
      ...createErstatningsopgoerelseInitialValues(),
      sfggAlleSygeperioderErTafPerioder: true,
    };

    const result = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, legacyPayload);

    expect(result.unknownPaths).toContainEqual(['sfggAlleSygeperioderErTafPerioder']);
    expect(erstatningsopgoerelseSchema.safeParse(result.sanitized).success).toBe(true);
  });
});
