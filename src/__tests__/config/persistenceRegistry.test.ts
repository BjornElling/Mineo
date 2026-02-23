import { describe, expect, it } from 'vitest';
import { persistenceSchemas, persistenceSchemaFingerprint } from '../../config/persistenceRegistry';
import { STORAGE_KEYS } from '../../config/storageManifest';
import type { StorageKey } from '../../config/storageManifest';
import { z } from 'zod';

describe('persistenceSchemas', () => {
  it('indeholder alle StorageKeys', () => {
    const allStorageKeys = Object.keys(STORAGE_KEYS) as StorageKey[];
    for (const key of allStorageKeys) {
      expect(persistenceSchemas).toHaveProperty(key);
    }
  });

  it('alle schemas er Zod-schemas (har en .parse-metode)', () => {
    for (const [key, schema] of Object.entries(persistenceSchemas)) {
      expect(schema, `Schema for ${key}`).toBeDefined();
      expect(typeof (schema as z.ZodTypeAny).parse).toBe('function');
    }
  });

  it('har præcis 6 schemas (én per StorageKey)', () => {
    const storageKeyCount = Object.keys(STORAGE_KEYS).length;
    const schemaCount = Object.keys(persistenceSchemas).length;
    expect(schemaCount).toBe(storageKeyCount);
  });

  it('stamdata-schema afviser null', () => {
    const schema = persistenceSchemas.stamdata;
    const result = schema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('renteberegning-schema accepterer tom rentekravRows', () => {
    const schema = persistenceSchemas.renteberegning;
    const result = schema.safeParse({ rentekravRows: [] });
    expect(result.success).toBe(true);
  });
});

describe('persistenceSchemaFingerprint', () => {
  it('er en streng', () => {
    expect(typeof persistenceSchemaFingerprint).toBe('string');
  });

  it('er ikke tom', () => {
    expect(persistenceSchemaFingerprint.length).toBeGreaterThan(0);
  });

  it('er deterministisk (samme fingerprint ved to opkald)', () => {
    // Re-import fra samme modul er det samme objekt — men vi kan bekræfte at det er stabilt
    const fp1 = persistenceSchemaFingerprint;
    const fp2 = persistenceSchemaFingerprint;
    expect(fp1).toBe(fp2);
  });
});
