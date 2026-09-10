import { createDate } from '../../utils/dateUtils';
import { countExclusiveUtcDays, countInclusiveUtcDays, diffUtcDays, diffUtcDaysAbs } from '../../utils/utcDayMath';

describe('utcDayMath', () => {
  it('tæller inklusive dage over sommertidens start', () => {
    const start = createDate(2024, 2, 30);
    const end = createDate(2024, 3, 2);
    expect(countInclusiveUtcDays(start, end)).toBe(4);
  });

  it('tæller inklusive dage over sommertidens slutning', () => {
    const start = createDate(2024, 9, 26);
    const end = createDate(2024, 9, 28);
    expect(countInclusiveUtcDays(start, end)).toBe(3);
  });

  it('håndberegnet skudårsinterval tæller 28. februar til 1. marts som tre dage', () => {
    const start = createDate(2024, 1, 28);
    const end = createDate(2024, 2, 1);

    expect(diffUtcDays(start, end)).toBe(2);
    expect(diffUtcDays(end, start)).toBe(-2);
    expect(diffUtcDaysAbs(start, end)).toBe(2);
    expect(countExclusiveUtcDays(start, end)).toBe(2);
    expect(countInclusiveUtcDays(start, end)).toBe(3);
  });

  it('tæller inklusive dage uden sommertidsskift', () => {
    const start = createDate(2024, 1, 10);
    const end = createDate(2024, 1, 12);
    expect(countInclusiveUtcDays(start, end)).toBe(3);
  });

  it('beregner eksklusiv dagforskel', () => {
    const start = createDate(2024, 1, 10);
    const end = createDate(2024, 1, 12);
    expect(countExclusiveUtcDays(start, end)).toBe(2);
    expect(diffUtcDays(end, start)).toBe(-2);
  });

  it('countInclusiveUtcDays: samme dato = 1 dag', () => {
    const d = createDate(2024, 5, 15);
    expect(countInclusiveUtcDays(d, d)).toBe(1);
  });

  it('countInclusiveUtcDays: start > end = null', () => {
    const start = createDate(2024, 5, 15);
    const end = createDate(2024, 5, 10);
    expect(countInclusiveUtcDays(start, end)).toBeNull();
  });

  it('countExclusiveUtcDays: samme dato = 0', () => {
    const d = createDate(2024, 5, 15);
    expect(countExclusiveUtcDays(d, d)).toBe(0);
  });

  it('countExclusiveUtcDays: start > end = null', () => {
    const start = createDate(2024, 5, 15);
    const end = createDate(2024, 5, 10);
    expect(countExclusiveUtcDays(start, end)).toBeNull();
  });

  it('diffUtcDaysAbs: positiv forskel er absolut', () => {
    const start = createDate(2024, 0, 1);
    const end = createDate(2024, 0, 11);
    expect(diffUtcDaysAbs(start, end)).toBe(10);
    expect(diffUtcDaysAbs(end, start)).toBe(10); // omvendt rækkefølge → samme resultat
  });

  it('diffUtcDaysAbs: samme dato = 0', () => {
    const d = createDate(2024, 5, 15);
    expect(diffUtcDaysAbs(d, d)).toBe(0);
  });

});
