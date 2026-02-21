import { describe, expect, it } from 'vitest';
import { computeFormulaValue, type FormulaComponents } from '../../../domain/erstatningsopgoerelse/reguleringFormulaUtils';

describe('reguleringFormulaUtils.computeFormulaValue', () => {
  it('fortolker pct-felter som procentpoint (12 = 12%)', () => {
    const components: FormulaComponents = {
      baseValue: 100,
      feriePct: 12,
      fritvalgPct: 0,
      shSoPct: 0,
      pensionPct: 10,
      storeBededagPct: 0,
    };

    expect(computeFormulaValue(components)).toBeCloseTo(123.2, 6);
  });

  it('behandler ugyldige tal fail-closed som 0', () => {
    const components: FormulaComponents = {
      baseValue: Number.NaN,
      feriePct: Number.NaN,
      fritvalgPct: Number.NaN,
      shSoPct: Number.NaN,
      pensionPct: Number.NaN,
      storeBededagPct: Number.NaN,
    };

    expect(computeFormulaValue(components)).toBe(0);
  });
});

