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

  // Load-bearing invariant (jf. schema-evolution-kontrakt §): fingerprintet bygger KUN på
  // toJSONSchema({io:'input'}). Runtime-only-ændringer (.refine/.superRefine/.preprocess) ændrer
  // ikke input-JSON-skemaet og må derfor IKKE flytte fingerprintet – ellers ville en ren
  // valideringstilføjelse fejlagtigt kræve et PERSISTED_DATA_VERSION-bump. Hvis disse tests
  // begynder at fejle efter en Zod-opgradering, er drift-antagelsen brudt og skal revurderes.
  it('.refine ændrer ikke fingerprintet (runtime-only validering)', () => {
    const base = z.object({ navn: z.string() });
    const refined = z.object({ navn: z.string() }).refine((v) => v.navn.length > 0);
    expect(computeSchemaFingerprint({ s: refined })).toBe(computeSchemaFingerprint({ s: base }));
  });

  it('.superRefine ændrer ikke fingerprintet', () => {
    const base = z.object({ navn: z.string() });
    const refined = z.object({ navn: z.string() }).superRefine(() => {});
    expect(computeSchemaFingerprint({ s: refined })).toBe(computeSchemaFingerprint({ s: base }));
  });

  it('.preprocess ændrer ikke fingerprintet når output-skemaet er uændret', () => {
    const base = z.number();
    const preprocessed = z.preprocess((v) => Number(v), z.number());
    expect(computeSchemaFingerprint({ s: preprocessed })).toBe(computeSchemaFingerprint({ s: base }));
  });

  it('felt skiftet fra required til optional → andet fingerprint (reel strukturændring)', () => {
    // Modsætning til runtime-only: optionalitet ÆNDRER input-JSON-skemaet og SKAL flytte fingerprintet.
    const required = z.object({ navn: z.string() });
    const optional = z.object({ navn: z.string().optional() });
    expect(computeSchemaFingerprint({ s: required })).not.toBe(computeSchemaFingerprint({ s: optional }));
  });
});
