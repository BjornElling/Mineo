import { z } from 'zod';
import { nonIdKeysFromSchema, isEmptyByKeys } from '../../utils/schemaRowEmpty';
import { tafPeriodeRowSchema } from '../../schemas/formSchemas';
import { rentekravRowSchema } from '../../schemas/formSchemas/sections/renteberegningSchemas';

describe('nonIdKeysFromSchema', () => {
  it('ekskluderer id-nøglen og bevarer resten', () => {
    const schema = z.object({
      id: z.string(),
      fra: z.string().optional(),
      til: z.string().optional(),
    });
    expect(nonIdKeysFromSchema(schema)).toEqual(['fra', 'til']);
  });

  it('schema uden id → alle nøgler bevares', () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    expect(nonIdKeysFromSchema(schema)).toEqual(['a', 'b']);
  });

  // Invariant-værn (jf. doc i schemaRowEmpty.ts): alle faktiske række-schemas bruger
  // nøglen 'id' til rækkens identitet, så den altid ekskluderes fra tomheds-tjekket.
  it('faktiske række-schemas: id ekskluderet, men findes i shapet', () => {
    expect(Object.keys(tafPeriodeRowSchema.shape)).toContain('id');
    expect(nonIdKeysFromSchema(tafPeriodeRowSchema)).not.toContain('id');

    expect(Object.keys(rentekravRowSchema.shape)).toContain('id');
    expect(nonIdKeysFromSchema(rentekravRowSchema)).not.toContain('id');
  });
});

describe('isEmptyByKeys', () => {
  it('alle angivne nøgler undefined → tom', () => {
    expect(isEmptyByKeys({ id: 'x', fra: undefined, til: undefined }, ['fra', 'til'])).toBe(true);
  });

  it('mindst én nøgle defineret → ikke tom', () => {
    expect(isEmptyByKeys({ id: 'x', fra: '2024-01-01', til: undefined }, ['fra', 'til'])).toBe(false);
  });

  it('0 og tom streng tæller som "defineret" (kun undefined er tom)', () => {
    expect(isEmptyByKeys({ a: 0 }, ['a'])).toBe(false);
    expect(isEmptyByKeys({ a: '' }, ['a'])).toBe(false);
  });

  it('tom nøgleliste → altid tom', () => {
    expect(isEmptyByKeys({ a: 1 }, [])).toBe(true);
  });
});
