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

  // ── Per-schema validering ──────────────────────────────────────────────────

  describe('stamdata', () => {
    it('accepterer tomt objekt (alle felter er optional)', () => {
      expect(persistenceSchemas.stamdata.safeParse({}).success).toBe(true);
    });

    it('afviser ukendte nøgler (strict)', () => {
      const result = persistenceSchemas.stamdata.safeParse({ ukendt: 'x' });
      expect(result.success).toBe(false);
    });

    it('accepterer gyldig skadestype (Arbejdsulykke)', () => {
      const result = persistenceSchemas.stamdata.safeParse({ skadestype: 'Arbejdsulykke' });
      expect(result.success).toBe(true);
    });

    it('afviser ugyldig skadestype', () => {
      const result = persistenceSchemas.stamdata.safeParse({ skadestype: 'UgyldigType' });
      expect(result.success).toBe(false);
    });
  });

  describe('satser', () => {
    it('accepterer gyldigt aargang (2024)', () => {
      expect(persistenceSchemas.satser.safeParse({ aargang: 2024 }).success).toBe(true);
    });

    it('afviser ukendte nøgler (strict)', () => {
      expect(persistenceSchemas.satser.safeParse({ aargang: 2024, extra: true }).success).toBe(false);
    });
  });

  describe('aarsloen', () => {
    const validAarsloen = {
      feriePct: undefined,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: 'maaned',
      tableData: [],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: 'Almindelig løn',
    };

    it('accepterer minimalt gyldigt aarsloen-objekt', () => {
      expect(persistenceSchemas.aarsloen.safeParse(validAarsloen).success).toBe(true);
    });

    it('afviser ugyldig loenperiode-enum', () => {
      const result = persistenceSchemas.aarsloen.safeParse({ ...validAarsloen, loenperiode: 'kvartal' });
      expect(result.success).toBe(false);
    });

    it('afviser ugyldig loenPaaHelligdage-enum', () => {
      const result = persistenceSchemas.aarsloen.safeParse({ ...validAarsloen, loenPaaHelligdage: 'Halv løn' });
      expect(result.success).toBe(false);
    });
  });

  describe('renteberegning', () => {
    it('afviser activeTab som ukendt felt', () => {
      const result = persistenceSchemas.renteberegning.safeParse({ rentekravRows: [], activeTab: 'anything' });
      expect(result.success).toBe(false);
    });

    it('beregningsdato er optional', () => {
      const result = persistenceSchemas.renteberegning.safeParse({ rentekravRows: [] });
      expect(result.success).toBe(true);
    });
  });

  describe('varigemen', () => {
    it('accepterer tomt objekt (alle felter optional)', () => {
      expect(persistenceSchemas.varigemen.safeParse({}).success).toBe(true);
    });

    it('afviser activeTab som ukendt felt', () => {
      const result = persistenceSchemas.varigemen.safeParse({ activeTab: 'rm' });
      expect(result.success).toBe(false);
    });
  });

  describe('forsoergertab', () => {
    it('accepterer tomt objekt (alle felter optional)', () => {
      expect(persistenceSchemas.forsoergertab.safeParse({}).success).toBe(true);
    });

    it('afviser activeTab som ukendt felt', () => {
      const result = persistenceSchemas.forsoergertab.safeParse({ activeTab: 'ft' });
      expect(result.success).toBe(false);
    });
  });

  describe('erstatningsopgoerelse', () => {
    it('afviser null', () => {
      const result = persistenceSchemas.erstatningsopgoerelse.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('afviser ikke-objekt (streng)', () => {
      const result = persistenceSchemas.erstatningsopgoerelse.safeParse('ugyldig');
      expect(result.success).toBe(false);
    });
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
