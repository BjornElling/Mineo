import { computeSchemaFingerprint } from '../../utils/schemaFingerprint';
import { z } from 'zod';

// ─── computeSchemaFingerprint ─────────────────────────────────────────────────

describe('computeSchemaFingerprint', () => {
  it('returnerer en streng', () => {
    const result = computeSchemaFingerprint({ test: z.string() });
    expect(typeof result).toBe('string');
  });

  it('samme schemas → samme fingerprint (determinisme)', () => {
    const schemas = {
      navn: z.string(),
      alder: z.number(),
    };
    const fp1 = computeSchemaFingerprint(schemas);
    const fp2 = computeSchemaFingerprint(schemas);
    expect(fp1).toBe(fp2);
  });

  it('rækkefølge af nøgler er ligegyldig (stabil sortering)', () => {
    const fp1 = computeSchemaFingerprint({ a: z.string(), b: z.number() });
    const fp2 = computeSchemaFingerprint({ b: z.number(), a: z.string() });
    expect(fp1).toBe(fp2);
  });

  it('forskellige schemas → forskelligt fingerprint', () => {
    const fp1 = computeSchemaFingerprint({ navn: z.string() });
    const fp2 = computeSchemaFingerprint({ navn: z.number() });
    expect(fp1).not.toBe(fp2);
  });

  it('tilføjelse af felt → andet fingerprint', () => {
    const fp1 = computeSchemaFingerprint({ a: z.string() });
    const fp2 = computeSchemaFingerprint({ a: z.string(), b: z.boolean() });
    expect(fp1).not.toBe(fp2);
  });

  it('tomt schema → returnerer gyldig streng (fnv1a prefix)', () => {
    const result = computeSchemaFingerprint({});
    expect(result).toMatch(/^fnv1a-[0-9a-f]{8}$/);
  });

  it('fingerprint er fnv1a-format', () => {
    const result = computeSchemaFingerprint({ x: z.string() });
    expect(result).toMatch(/^fnv1a-[0-9a-f]{8}$/);
  });

  it('ændring af type (string → boolean) → andet fingerprint', () => {
    const fp1 = computeSchemaFingerprint({ navn: z.string() });
    const fp2 = computeSchemaFingerprint({ navn: z.boolean() });
    expect(fp1).not.toBe(fp2);
  });

  it('komplekst nested schema er deterministisk', () => {
    const schema = {
      bruger: z.object({
        id: z.string(),
        alder: z.number().int().nonnegative(),
        tags: z.array(z.string()),
      }),
    };
    const fp1 = computeSchemaFingerprint(schema);
    const fp2 = computeSchemaFingerprint(schema);
    expect(fp1).toBe(fp2);
  });

  it('to schemas med samme struktur men forskellige navne → forskelligt fingerprint', () => {
    const fp1 = computeSchemaFingerprint({ aaa: z.string() });
    const fp2 = computeSchemaFingerprint({ bbb: z.string() });
    expect(fp1).not.toBe(fp2);
  });

  it('separator-tegn i topnøgler kolliderer ikke', () => {
    const fp1 = computeSchemaFingerprint({ 'a:b|c': z.string() });
    const fp2 = computeSchemaFingerprint({ 'a:b': z.object({ c: z.string() }) });
    expect(fp1).not.toBe(fp2);
  });
});
