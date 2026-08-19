import { moneyOre } from '../../domain/money/money';
import {
  eoFileDataSchema,
  eoFileDataLoadSchema,
  eoFileContainerSchema,
  eoFileContainerLoadSchema,
} from '../../schemas/eoFileSchema';
import { FILE_FORMAT_VERSION } from '../../config/version';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { toISODateString } from '../../types/branded';

// ─── eoFileDataSchema ─────────────────────────────────────────────────────────

describe('eoFileDataSchema', () => {
  it('tomt objekt → success (alle sektioner er optional)', () => {
    const result = eoFileDataSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('null → fejler (nullToUndefinedDeep gør null til undefined, og objekt-schemaet kræver et objekt)', () => {
    // `nullToUndefinedDeep(null)` returnerer `undefined`; det indre `z.object(...).strict()`
    // er ikke optional, så `undefined` afvises. Tidligere asserterede testen kun at resultatet
    // var en boolean (altid sandt) – en false-green der ikke fangede nogen adfærd.
    const result = eoFileDataSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('ukendt sektion → fejler (strict schema)', () => {
    const result = eoFileDataSchema.safeParse({ ukendt_sektion: {} });
    expect(result.success).toBe(false);
  });

  it('afledt/ukendt felt INDE i en sektion → fejler (derived-not-persisted, fail-closed)', () => {
    // Kontrakt: en `.eo`-fil må kun indeholde schema-defineret brugerinput – aldrig afledte
    // værdier (genberegnes efter load). Save-schemaet er strict også PR. SEKTION, så et felt
    // der ligner et afledt resultat (her `derivedTotalOre`) afvises med `unrecognized_keys`
    // frem for at blive gemt. Det er den strukturelle garanti mod stille persistering af
    // afledt state, hvis et sådant felt nogensinde skulle smutte ind i committed state.
    const result = eoFileDataSchema.safeParse({
      stamdata: { journalnr: 'J-1', derivedTotalOre: moneyOre(999) },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('null-værdier i felter konverteres til undefined via preprocessor', () => {
    // nullToUndefinedDeep konverterer null → undefined for alle sektioner
    const result = eoFileDataSchema.safeParse({
      stamdata: null,
      aarsloen: null,
    });
    // null konverteres til undefined, som er OK (sektioner er optional)
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stamdata).toBeUndefined();
      expect(result.data.aarsloen).toBeUndefined();
    }
  });

  it('accepterer de nye sektioner med fuldt udfyldte, schema-gyldige værdier', () => {
    const result = eoFileDataSchema.safeParse({
      stamdata: {
        skadelidteFodselsdato: toISODateString('1990-01-01'),
      },
      faellesAarsloen: {
        aslAarsloen: { kind: 'number', value: 450000 },
        ealAarsloen: { kind: 'expression', expression: '250000 + 250000', value: 500000 },
      },
      forsoergertab: {
        efterladteFodselsdato: toISODateString('1988-03-04'),
        beregningsdato: toISODateString('2025-01-15'),
        virkningsdato: toISODateString('2025-01-01'),
        tilkendtForPeriodeAar: 5,
      },
      erhvervsevnetab: {
        beregningsdato: toISODateString('2025-01-15'),
        koen: 'Mand',
        aslAfgoerelser: [
          {
            id: 'eet_asl_1',
            afgoerelsesDato: toISODateString('2025-01-15'),
            virkningsDato: toISODateString('2025-01-01'),
            eetPct: 15,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
        ealEetPct: 20,
        eetDifferencekravBilagSelection: {
          loebendeYdelser: true,
          kapitalisering: true,
          eetEfterEal: true,
          proformaKapitalisering: false,
    merErstatningPensionsalder: false,
          visUdvidetSpecifikation: false,
          visUdvidetSpecifikationLoebendeYdelserBilag: false,
        },
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('eoFileDataLoadSchema', () => {
  it('tomt objekt → success', () => {
    const result = eoFileDataLoadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepterer ukendte sektioner under load', () => {
    const result = eoFileDataLoadSchema.safeParse({
      stamdata: { journalnr: '123' },
      ukendtSektion: { noget: true },
    });
    expect(result.success).toBe(true);
  });

  it('konverterer null-sektion til undefined via preprocessor', () => {
    const result = eoFileDataLoadSchema.safeParse({
      stamdata: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as Record<string, unknown>).stamdata).toBeUndefined();
  });
});

// ─── eoFileContainerSchema ────────────────────────────────────────────────────

describe('eoFileContainerSchema', () => {
  it('gyldigt container med version og tom data → success', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        persistedDataVersion: PERSISTED_DATA_VERSION,
        fieldCount: 0,
      },
      data: {},
    });
    expect(result.success).toBe(true);
  });

  it('mangler version → fejler', () => {
    const result = eoFileContainerSchema.safeParse({
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('mangler data → fejler', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it('ukendt felt → fejler (strict schema)', () => {
    const result = eoFileContainerSchema.safeParse({
      version: '1.0',
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 0,
      },
      data: {},
      ukendt: 'felt',
    });
    expect(result.success).toBe(false);
  });

  it('med _metadata → success', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        persistedDataVersion: PERSISTED_DATA_VERSION,
        fieldCount: 42,
      },
      data: {},
    });
    expect(result.success).toBe(true);
  });

  it('_metadata uden fieldCount → fejler', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
      },
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('mangler _metadata → fejler', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('_metadata med negativ fieldCount → fejler', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: toISODateString('2024-01-01'),
        appVersion: '1.0',
        fieldCount: -1,
      },
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('data med ukendt sektion → fejler (strict indre schema)', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 0,
      },
      data: { ukendtSektion: {} },
    });
    expect(result.success).toBe(false);
  });

  it('load-schema accepterer ukendt sektion i data', () => {
    const result = eoFileContainerLoadSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 1,
      },
      data: { ukendtSektion: {} },
    });
    expect(result.success).toBe(true);
  });

  it('save-schema kræver current persistedDataVersion', () => {
    const result = eoFileContainerSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 0,
      },
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('load-schema accepterer legacy-fil uden persistedDataVersion', () => {
    const result = eoFileContainerLoadSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 0,
      },
      data: {},
    });
    expect(result.success).toBe(true);
  });

  it('load-schema accepterer ukendt nyere dataversion, men afviser tom eller ikke-streng version', () => {
    const container = {
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 0,
      },
      data: {},
    };

    expect(eoFileContainerLoadSchema.safeParse({
      ...container,
      _metadata: { ...container._metadata, persistedDataVersion: '99.0' },
    }).success).toBe(true);
    expect(eoFileContainerLoadSchema.safeParse({
      ...container,
      _metadata: { ...container._metadata, persistedDataVersion: '   ' },
    }).success).toBe(false);
    expect(eoFileContainerLoadSchema.safeParse({
      ...container,
      _metadata: { ...container._metadata, persistedDataVersion: 99 },
    }).success).toBe(false);
  });

  it('load-schema afviser metadata uden fieldCount', () => {
    const result = eoFileContainerLoadSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
      },
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('load-schema afviser helt manglende _metadata', () => {
    const result = eoFileContainerLoadSchema.safeParse({
      version: FILE_FORMAT_VERSION,
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('load-schema afviser forkert formatversion', () => {
    const result = eoFileContainerLoadSchema.safeParse({
      version: '0.9.0',
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        fieldCount: 1,
      },
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('inferred type EoFileContainer har korrekte nøgler', () => {
    const container = {
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2024-01-01T00:00:00Z',
        appVersion: '1.2.3',
        persistedDataVersion: PERSISTED_DATA_VERSION,
        fieldCount: 0,
      },
      data: {},
    };
    const result = eoFileContainerSchema.parse(container);
    expect(result.version).toBe(FILE_FORMAT_VERSION);
    expect(result.data).toBeDefined();
  });
});
