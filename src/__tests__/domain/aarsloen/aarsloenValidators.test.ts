import {
  validateAslAarsloenDivisibleBy1000,
  validateAslAarsloenBySkadesaarMax,
} from '../../../domain/aslEalAarsloen/aarsloenValidators';
import { toISODateString } from '../../../types/branded';

/**
 * Unit-test for ASL/EAL-årsløn-validatorerne.
 *
 * Begge validatorer er fail-open på malformet/ufuldstændigt input (returnerer
 * undefined = "ingen fejl at vise"), men fail-closed på faktiske regelbrud. Den
 * sondring testes eksplicit, da den tidligere kun var indirekte dækket.
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
    expect(validateAslAarsloenDivisibleBy1000(1500)).toBe('Årsløn skal være deleligt med 1.000.');
  });
});

describe('validateAslAarsloenBySkadesaarMax', () => {
  it('undefined årsløn → ingen fejl', () => {
    expect(validateAslAarsloenBySkadesaarMax(undefined, toISODateString('2024-01-01'))).toBeUndefined();
  });

  it('manglende skadedato → ingen fejl (kan ikke fastlægge maks)', () => {
    expect(validateAslAarsloenBySkadesaarMax(360000, undefined)).toBeUndefined();
  });

  it('skadesår uden registreret maks → ingen fejl (fail-open)', () => {
    // 2099 findes ikke i aarsloenAslMax.
    expect(validateAslAarsloenBySkadesaarMax(360000, toISODateString('2099-01-01'))).toBeUndefined();
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
