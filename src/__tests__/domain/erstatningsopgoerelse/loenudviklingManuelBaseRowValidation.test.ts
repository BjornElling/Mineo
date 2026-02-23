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

    expect(errors.fritvalg).toBe('Værdien er ovenfor angivet til 2,00 %');
    expect(errors.agPension).toBe('Værdien er ovenfor angivet til 10,00 %');
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

    expect(errors.fritvalg).toBe('Værdien er ovenfor angivet til 2,00 %');
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

  it('baseRow undefined + alle satser 0 → ingen fejl (actual=0, expected=0)', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(undefined, {
      feriePct: 0,
      fritvalgPct: 0,
      shSoPct: 0,
      pensionPct: 0,
    });
    expect(errors).toEqual({});
  });

  it('baseRow undefined + sats ≠ 0 → fejl for alle felter', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(undefined, {
      feriePct: 12.5,
      fritvalgPct: 2,
      shSoPct: 1.75,
      pensionPct: 10,
    });
    // actual=undefined → 0, expected=12.5 → delta > 0.01 → fejl
    expect(errors.feriepenge).toBeDefined();
    expect(errors.fritvalg).toBeDefined();
    expect(errors.shSoSats).toBeDefined();
    expect(errors.agPension).toBeDefined();
  });

  it('ugyldig streng → parseCommittedPercent returnerer undefined → normaliseres til 0', () => {
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({ feriepenge: 'abc', fritvalg: 'NaN', shSoSats: 'Infinity', agPension: 'ugyldig' }),
      { feriePct: 0, fritvalgPct: 0, shSoPct: 0, pensionPct: 0 }
    );
    // 'abc' → not finite → undefined → 0 vs 0 = ingen fejl
    expect(errors.feriepenge).toBeUndefined();
    expect(errors.fritvalg).toBeUndefined();
    expect(errors.shSoSats).toBeUndefined();
    expect(errors.agPension).toBeUndefined();
  });

  it('tolerance 0.01: delta ≤ 0.01 → ingen fejl', () => {
    // |12.505 - 12.5| = 0.005 ≤ 0.01
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({ feriepenge: '12,505' }),
      { feriePct: 12.5, fritvalgPct: undefined, shSoPct: undefined, pensionPct: undefined }
    );
    expect(errors.feriepenge).toBeUndefined();
  });

  it('tolerance 0.01: delta > 0.01 → fejl', () => {
    // |12.52 - 12.5| = 0.02 > 0.01
    const errors = validateLoenudviklingManualBaseRowSatser(
      makeBaseRow({ feriepenge: '12,52' }),
      { feriePct: 12.5, fritvalgPct: undefined, shSoPct: undefined, pensionPct: undefined }
    );
    expect(errors.feriepenge).toBeDefined();
  });
});
