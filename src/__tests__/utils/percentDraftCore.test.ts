import {
  formatPercentDisplay,
  parsePercentDraftForCommit,
} from '../../utils/percentDraftCore';
import { MAX_PERCENT_RAW_LENGTH } from '../../utils/percentInputUtils';

const baseConfig = {
  allowNegative: false,
  allowDecimals: true,
  minValue: 0,
  maxValue: 100,
} as const;

describe('percentDraftCore', () => {
  it('parser tomt input som undefined', () => {
    expect(parsePercentDraftForCommit('', baseConfig)).toEqual({ ok: true, value: undefined });
    expect(parsePercentDraftForCommit('   ', baseConfig)).toEqual({ ok: true, value: undefined });
  });

  it('afviser ikke-kommitterbare og for lange procentdrafts', () => {
    expect(parsePercentDraftForCommit('-', baseConfig).ok).toBe(false);
    expect(parsePercentDraftForCommit('50,', baseConfig).ok).toBe(false);
    expect(parsePercentDraftForCommit('1'.repeat(MAX_PERCENT_RAW_LENGTH + 1), baseConfig).ok).toBe(false);
  });

  it('parser hele tal, decimaler og tusindtalsseparatorer', () => {
    expect(parsePercentDraftForCommit('50', baseConfig)).toEqual({ ok: true, value: 50 });
    expect(parsePercentDraftForCommit('50,25', baseConfig)).toEqual({ ok: true, value: 50.25 });
    expect(parsePercentDraftForCommit('1.000', { ...baseConfig, maxValue: 2000 })).toEqual({ ok: true, value: 1000 });
    expect(parsePercentDraftForCommit('1.000,50', { ...baseConfig, maxValue: 2000 })).toEqual({
      ok: true,
      value: 1000.5,
    });
  });

  it('respekterer decimal- og negativ-konfiguration', () => {
    expect(parsePercentDraftForCommit('50,25', { ...baseConfig, allowDecimals: false }).ok).toBe(false);
    expect(parsePercentDraftForCommit('5,0', { ...baseConfig, allowDecimals: false }).ok).toBe(false);
    expect(parsePercentDraftForCommit('-5', baseConfig)).toEqual({
      ok: false,
      errorMessage: 'Procent kan ikke være negativ',
    });
    expect(parsePercentDraftForCommit('-10', baseConfig)).toEqual({
      ok: false,
      errorMessage: 'Procent kan ikke være negativ',
    });
    expect(parsePercentDraftForCommit('-10', { ...baseConfig, allowNegative: true, minValue: -100 })).toEqual({
      ok: true,
      value: -10,
    });
  });

  it('producerer danske range-fejl med konkrete bounds', () => {
    expect(parsePercentDraftForCommit('101', baseConfig)).toEqual({
      ok: false,
      errorMessage: 'Procent skal være mellem 0,00 og 100,00',
    });
    expect(parsePercentDraftForCommit('-1', { ...baseConfig, allowNegative: true })).toEqual({
      ok: false,
      errorMessage: 'Procent skal være mellem 0,00 og 100,00',
    });
    expect(parsePercentDraftForCommit('101', { allowNegative: false, allowDecimals: false, maxValue: 100 })).toEqual({
      ok: false,
      errorMessage: 'Procent skal være 100 eller lavere',
    });
    expect(parsePercentDraftForCommit('4', { allowNegative: false, allowDecimals: false, minValue: 5 })).toEqual({
      ok: false,
      errorMessage: 'Procent skal være 5 eller højere',
    });
  });

  it('accepterer nul og eksakt maxValue', () => {
    expect(parsePercentDraftForCommit('0', baseConfig)).toEqual({ ok: true, value: 0 });
    expect(parsePercentDraftForCommit('100', baseConfig)).toEqual({ ok: true, value: 100 });
  });

  it('afviser procentværdier hvor naboværdier med to decimaler kan kollidere', () => {
    const unbounded = { allowNegative: false, allowDecimals: true } as const;

    expect(parsePercentDraftForCommit('70368744177663,99', unbounded))
      .toEqual({ ok: true, value: 70_368_744_177_663.99 });
    expect(parsePercentDraftForCommit('70368744177664,00', unbounded).ok).toBe(false);
  });

  it('roundtripper canonical display gennem parseren', () => {
    for (const value of [0, 1, 50, 99.99, 100, -10]) {
      const formatted = formatPercentDisplay(value, true);
      const parsed = parsePercentDraftForCommit(formatted, {
        allowNegative: true,
        allowDecimals: true,
        minValue: -100,
      });

      expect(parsed).toEqual({ ok: true, value });
    }
  });
});
