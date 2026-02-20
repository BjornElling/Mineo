import { describe, expect, it } from 'vitest';
import { applyDefaultsDeep, stripUnknownFieldsBySchema } from '../../utils/persistenceLoadSanitization';
import { buildPersistenceDefaults } from '../../config/persistenceDefaults';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import { erstatningsopgoerelseSchema } from '../../schemas/formSchemas';

describe('persistence load sanitization', () => {
  it('fills missing defaults without overriding existing values', () => {
    const defaults = buildPersistenceDefaults(DEFAULT_APP_SETTINGS);
    const filled = applyDefaultsDeep(
      { indsaetUdkastStempel: 'Nej' },
      defaults.erstatningsopgoerelse
    );

    const parsed = erstatningsopgoerelseSchema.safeParse(filled);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.indsaetUdkastStempel).toBe('Nej');
  });

  it('applies defaults for missing fields', () => {
    const defaults = buildPersistenceDefaults(DEFAULT_APP_SETTINGS);
    const filled = applyDefaultsDeep({}, defaults.erstatningsopgoerelse);

    const parsed = erstatningsopgoerelseSchema.safeParse(filled);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.indsaetUdkastStempel).toBe('Ja');
  });

  it('detects and strips unknown fields (root + nested)', () => {
    const input = {
      indsaetUdkastStempel: 'Ja',
      legacyField: 'x',
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'ansaettelsesforhold_1',
          harOverenskomst: true,
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Ja',
          loenPaaHelligdage: 'Almindelig løn',
          indtaegtsoplysningerTableData: [],
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingManuelTableData: [],
          overenskomstFilter: {
            loenmodtager: undefined,
            arbejdsgiver: undefined,
          },
          extra: 'x',
        },
      ],
    };

    const result = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, input);
    expect(result.unknownPaths).toContainEqual(['legacyField']);
    expect(result.unknownPaths).toContainEqual(['loenindkomstAnsaettelsesforhold', 0, 'extra']);

    const sanitized = result.sanitized as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'legacyField')).toBe(false);
    const af = (sanitized.loenindkomstAnsaettelsesforhold as Array<Record<string, unknown>>)[0];
    expect(Object.prototype.hasOwnProperty.call(af, 'extra')).toBe(false);
  });

  it('handles missing + unknown fields in same section', () => {
    const defaults = buildPersistenceDefaults(DEFAULT_APP_SETTINGS);
    const input = {
      legacyField: 'x',
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'ansaettelsesforhold_1',
          harOverenskomst: true,
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          loenperiode: 'maaned',
          fuldLoenUnderFerie: 'Ja',
          loenPaaHelligdage: 'Almindelig løn',
          indtaegtsoplysningerTableData: [],
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingManuelTableData: [],
          overenskomstFilter: {
            loenmodtager: undefined,
            arbejdsgiver: undefined,
          },
          extra: 'x',
        },
      ],
    };

    const stripped = stripUnknownFieldsBySchema(erstatningsopgoerelseSchema, input);
    expect(stripped.unknownPaths).toContainEqual(['legacyField']);
    expect(stripped.unknownPaths).toContainEqual(['loenindkomstAnsaettelsesforhold', 0, 'extra']);

    const withDefaults = applyDefaultsDeep(stripped.sanitized, defaults.erstatningsopgoerelse);
    const parsed = erstatningsopgoerelseSchema.safeParse(withDefaults);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.indsaetUdkastStempel).toBe('Ja');
  });

  it('normalizes loaded AmountValue values to 2 decimals before calculations consume them', () => {
    const defaults = buildPersistenceDefaults(DEFAULT_APP_SETTINGS);
    const loaded = structuredClone(defaults.erstatningsopgoerelse) as Record<string, unknown>;

    loaded.tidligereModtagetTaf = { kind: 'number', value: 1.005 };
    loaded.oevrigeKravPerioder = [
      {
        id: 'k1',
        dato: '2024-01-01',
        udgiftTil: 'Test',
        beloeb: { kind: 'expression', expression: '1,005', value: 1.005 },
      },
    ];

    const parsed = erstatningsopgoerelseSchema.safeParse(loaded);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.tidligereModtagetTaf?.value).toBe(1.01);
    expect(parsed.data.oevrigeKravPerioder[0]?.beloeb?.value).toBe(1.01);
  });
});
