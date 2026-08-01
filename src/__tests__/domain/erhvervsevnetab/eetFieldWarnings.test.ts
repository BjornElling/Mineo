import {
  EET_UNDER_15_WARNING,
  resolveEetUnder15Warning,
} from '../../../domain/erhvervsevnetab/eetFieldWarnings';

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
