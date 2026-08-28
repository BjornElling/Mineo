import {
  validateAslAarsloenDivisibleBy1000,
  validateAslAarsloenBySkadesaarMax,
} from '../../../domain/aslEalAarsloen/aarsloenValidators';
import { toISODateString } from '../../../types/branded';

/**
 * Unit-test for ASL/EAL-årsløn-validatorerne.
 *
 * Validatorerne er fail-open på endnu-ikke-udfyldt input (manglende årsløn/skadedato →
 * undefined = "ingen fejl at vise"), men fail-closed på faktiske regelbrud OG på en manglende
 * maks-sats for skadesåret: et skadesår uden offentliggjort sats kan ikke valideres, og
 * årslønnen må derfor ikke stiltiende slippe igennem (jf. fail-closed-princippet).
 */

describe('validateAslAarsloenDivisibleBy1000', () => {
  it('undefined → ingen fejl (intet at validere endnu)', () => {
    expect(validateAslAarsloenDivisibleBy1000(undefined)).toBeUndefined();
  });

  it('ikke-endeligt tal (NaN/Infinity) → ingen fejl', () => {
    expect(validateAslAarsloenDivisibleBy1000(Number.NaN)).toBeUndefined();
    expect(validateAslAarsloenDivisibleBy1000(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('0 er deleligt med 1.000 → ingen fejl', () => {
    expect(validateAslAarsloenDivisibleBy1000(0)).toBeUndefined();
  });

  it('negativt multiplum af 1.000 → ingen fejl (delelighed afhænger ikke af fortegn)', () => {
    expect(validateAslAarsloenDivisibleBy1000(-5000)).toBeUndefined();
  });

  it('rundt multiplum af 1.000 → ingen fejl', () => {
    expect(validateAslAarsloenDivisibleBy1000(450000)).toBeUndefined();
  });

  it('ikke-multiplum → fejlbesked', () => {
    expect(validateAslAarsloenDivisibleBy1000(1500)).toBe('Skadelidtes årsløn (efter ASL) skal være deleligt med 1.000.');
  });
});

describe('validateAslAarsloenBySkadesaarMax', () => {
  it('undefined årsløn → ingen fejl', () => {
    expect(validateAslAarsloenBySkadesaarMax(undefined, toISODateString('2024-01-01'))).toBeUndefined();
  });

  it('manglende skadedato → ingen fejl (kan ikke fastlægge maks)', () => {
    expect(validateAslAarsloenBySkadesaarMax(360000, undefined)).toBeUndefined();
  });

  it('skadesår uden registreret maks → fail-closed fejl med dækningsgrænserne', () => {
    // 2099 findes ikke i aarsloenAslMax → satsen kan ikke slås op, og årslønnen må ikke
    // stiltiende accepteres.
    const msg = validateAslAarsloenBySkadesaarMax(360000, toISODateString('2099-01-01'));
    expect(msg).toBeDefined();
    expect(msg).toContain('2099');
    // Beskeden oplyser de konkrete dækkede år (kanonisk min–max fra satstabellen).
    expect(msg).toContain('2005');
    expect(msg).toContain('2026');
  });

  it('årsløn på præcis maks → ingen fejl (grænsen er inklusiv)', () => {
    // aarsloenAslMax[2024] = 608000.
    expect(validateAslAarsloenBySkadesaarMax(608000, toISODateString('2024-06-01'))).toBeUndefined();
  });

  it('årsløn under maks → ingen fejl', () => {
    expect(validateAslAarsloenBySkadesaarMax(500000, toISODateString('2024-06-01'))).toBeUndefined();
  });

  it('årsløn over maks → fejlbesked med den konkrete grænse', () => {
    const msg = validateAslAarsloenBySkadesaarMax(700000, toISODateString('2024-06-01'));
    expect(msg).toBeDefined();
    expect(msg).toContain('608.000');
  });
});
