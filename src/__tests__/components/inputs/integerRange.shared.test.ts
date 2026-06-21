import { getIntegerRangeErrorMessage } from '../../../utils/integerRange';

describe('integerRange shared helper', () => {
  it('returns empty when value is in range', () => {
    expect(getIntegerRangeErrorMessage(5, 0, 10)).toBe('');
  });

  it('returns lower-bound message when below min', () => {
    expect(getIntegerRangeErrorMessage(1, 2, undefined)).toBe('Værdi skal være 2 eller højere');
  });

  it('returns upper-bound message when above max', () => {
    expect(getIntegerRangeErrorMessage(11, undefined, 10)).toBe('Værdi skal være 10 eller lavere');
  });

  it('shows the single allowed value when bounds are equal (below)', () => {
    expect(getIntegerRangeErrorMessage(4, 5, 5)).toBe('Værdi skal være 5');
  });

  it('shows the single allowed value when bounds are equal (above)', () => {
    expect(getIntegerRangeErrorMessage(6, 5, 5)).toBe('Værdi skal være 5');
  });

  it('shows the between message when bounds differ', () => {
    expect(getIntegerRangeErrorMessage(1, 2, 9)).toBe('Værdi skal være mellem 2 og 9');
  });
});
