import { PERSISTED_SECTION_KEYS, persistenceSchemas } from '../../config/persistenceRegistry';
import { z } from 'zod';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';

/**
 * Den forventede sektionsmængde er skrevet UD i fuld længde med vilje. Registry'et er nu den ENE
 * kilde til hvilke persisterede sektioner der findes (`.eo`-load itererer den, og `PersistedSectionKey`
 * udledes af den), så en test der blot sammenlignede registry'et med sig selv ville være vakuøs.
 * En sektion, der forsvinder herfra, ville ellers tavst blive sprunget over ved load — dvs. datatab.
 */
const EXPECTED_SECTION_KEYS = [
  'aarsloen',
  'erhvervsevnetab',
  'erstatningsopgoerelse',
  'faellesAarsloen',
  'forsoergertab',
  'renteberegning',
  'satser',
  'stamdata',
  'varigemen',
] as const;

describe('persistenceSchemas', () => {
  it('dækker præcis den forventede sektionsmængde (ændring = datatab ved load)', () => {
    expect([...PERSISTED_SECTION_KEYS].sort()).toEqual([...EXPECTED_SECTION_KEYS]);
  });

  it('alle schemas er Zod-schemas (har en .parse-metode)', () => {
    for (const [key, schema] of Object.entries(persistenceSchemas)) {
      expect(schema, `Schema for ${key}`).toBeDefined();
      expect(typeof (schema as z.ZodTypeAny).parse).toBe('function');
    }
  });


  it('stamdata-schema afviser null', () => {
    const schema = persistenceSchemas.stamdata;
    const result = schema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('renteberegning-schema bevarer tom rentekravRows som canonical input', () => {
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
      const result = persistenceSchemas.renteberegning.safeParse({ ...createRenteberegningInitialValues(), activeTab: 'anything' });
      expect(result.success).toBe(false);
    });

    it('beregningsdato er optional', () => {
      const result = persistenceSchemas.renteberegning.safeParse({
        ...createRenteberegningInitialValues(),
        beregningsdato: undefined,
      });
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
