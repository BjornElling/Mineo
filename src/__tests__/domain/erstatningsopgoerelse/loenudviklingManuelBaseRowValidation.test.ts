import { describe, expect, it } from 'vitest';
import { validateLoenudviklingManualBaseRowSatser } from '../../../domain/erstatningsopgoerelse/loenudviklingManuelBaseRowValidation';
import type { LoenudviklingManuelRow } from '../../../schemas/formSchemas';

const makeBaseRow = (overrides: Partial<LoenudviklingManuelRow> = {}): LoenudviklingManuelRow => ({
  id: 'row-1',
  dato: '',
  grundloen: undefined,
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
  ...overrides,
});

describe('validateLoenudviklingManualBaseRowSatser', () => {
  it('giver ingen fejl når første række matcher satser på skadestidspunktet', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({
        feriepenge: '12,5',
        fritvalg: '2',
        shSoSats: '1,75',
        agPension: '10',
      }),
      {
        feriePct: 12.5,
        fritvalgPct: 2,
        shSoPct: 1.75,
        pensionPct: 10,
      }
    );

    expect(errors).toEqual({});
  });

  it('giver cellefejl når en eller flere værdier ikke matcher', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({
        feriepenge: '12,5',
        fritvalg: '2,5',
        shSoSats: '1,75',
        agPension: '',
      }),
      {
        feriePct: 12.5,
        fritvalgPct: 2,
        shSoPct: 1.75,
        pensionPct: 10,
      }
    );

    expect(errors.fritvalg).toBe('Værdien er ovenfor angivet til 2 %');
    expect(errors.agPension).toBe('Værdien er ovenfor angivet til 10 %');
    expect(errors.feriepenge).toBeUndefined();
    expect(errors.shSoSats).toBeUndefined();
  });

  it('giver fejl når sats på skadestidspunktet er udfyldt men tabelværdi mangler', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({
        feriepenge: '12,5',
        fritvalg: '',
        shSoSats: '1,75',
        agPension: '10',
      }),
      {
        feriePct: 12.5,
        fritvalgPct: 2,
        shSoPct: 1.75,
        pensionPct: 10,
      }
    );

    expect(errors.fritvalg).toBe('Værdien er ovenfor angivet til 2 %');
  });

  it('springer felter over hvor sats på skadestidspunktet ikke er angivet', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({
        feriepenge: '',
        fritvalg: '',
        shSoSats: '',
        agPension: '',
      }),
      {
        feriePct: undefined,
        fritvalgPct: undefined,
        shSoPct: undefined,
        pensionPct: undefined,
      }
    );

    expect(errors).toEqual({});
  });

  it('behandler null som 0 i sats-sammenligning', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({
        feriepenge: '',
        fritvalg: '',
        shSoSats: '',
        agPension: '',
      }),
      {
        feriePct: null,
        fritvalgPct: null,
        shSoPct: null,
        pensionPct: null,
      }
    );

    expect(errors).toEqual({});
  });
});
