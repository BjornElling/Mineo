import { countExclusiveUtcDays, countInclusiveUtcDays, diffUtcDays } from '../utcDayMath';

describe('utcDayMath', () => {
  it('counts inclusive days across DST start', () => {
    const start = new Date(2024, 2, 30);
    const end = new Date(2024, 3, 2);
    expect(countInclusiveUtcDays(start, end)).toBe(4);
  });

  it('counts inclusive days across DST end', () => {
    const start = new Date(2024, 9, 26);
    const end = new Date(2024, 9, 28);
    expect(countInclusiveUtcDays(start, end)).toBe(3);
  });

  it('counts inclusive days without DST crossing', () => {
    const start = new Date(2024, 1, 10);
    const end = new Date(2024, 1, 12);
    expect(countInclusiveUtcDays(start, end)).toBe(3);
  });

  it('calculates exclusive day difference', () => {
    const start = new Date(2024, 1, 10);
    const end = new Date(2024, 1, 12);
    expect(countExclusiveUtcDays(start, end)).toBe(2);
    expect(diffUtcDays(end, start)).toBe(-2);
  });
});
