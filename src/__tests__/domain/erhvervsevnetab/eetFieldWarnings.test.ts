import {
  EET_ASL_AARSLOEN_MAX_WARNING,
  EET_UNDER_15_WARNING,
  hasEetAslAarsloenMaxWarning,
  resolveEetAslAarsloenMaxWarning,
  resolveEetUnder15Warning,
} from '../../../domain/erhvervsevnetab/eetFieldWarnings';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';

const amount = (value: number) => ({ kind: 'number' as const, value });

describe('resolveEetUnder15Warning', () => {
  it.each([5, 10])('viser den aftalte advarsel ved %s procent', (value) => {
    expect(resolveEetUnder15Warning(value)).toEqual({
      severity: 'warning',
      message: EET_UNDER_15_WARNING,
    });
  });

  it.each([undefined, 0, 15, 20])('viser ingen advarsel ved %s', (value) => {
    expect(resolveEetUnder15Warning(value)).toBeUndefined();
  });
});

describe('resolveEetAslAarsloenMaxWarning', () => {
  it('viser en gul feltadvarsel når EAL-årslønnen er tom og ASL-årslønnen er skadesårets maksimum', () => {
    const skadedato = toISODateString('2024-07-01');
    const aslAarsloen = amount(aarsloenAslMax[2024]!);

    expect(hasEetAslAarsloenMaxWarning(aslAarsloen, undefined, skadedato)).toBe(true);
    expect(resolveEetAslAarsloenMaxWarning(aslAarsloen, undefined, skadedato)).toEqual({
      severity: 'warning',
      message: EET_ASL_AARSLOEN_MAX_WARNING,
    });
  });

  it.each([
    ['EAL-årslønnen er udfyldt', amount(aarsloenAslMax[2024]!), amount(500000)],
    ['ASL-årslønnen ikke er maksimum', amount(aarsloenAslMax[2024]! - 1000), undefined],
    ['skadedatoen mangler', amount(aarsloenAslMax[2024]!), undefined],
  ])('viser ingen advarsel når %s', (_reason, aslAarsloen, ealAarsloen) => {
    const skadedato = _reason === 'skadedatoen mangler' ? undefined : toISODateString('2024-07-01');
    expect(resolveEetAslAarsloenMaxWarning(aslAarsloen, ealAarsloen, skadedato)).toBeUndefined();
  });
});
