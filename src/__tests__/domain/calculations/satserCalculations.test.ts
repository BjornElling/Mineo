import { satserAngivAarYearBounds } from '../../../data/lovbestemteRates';
import { resolveSatserDefaultAargang } from '../../../domain/policies/satserCalculations';

const MIN = satserAngivAarYearBounds.minYear;
const MAX = satserAngivAarYearBounds.maxYear;

describe('resolveSatserDefaultAargang', () => {
  it('aktuelt år inden for interval → returnerer det aktuelle år', () => {
    expect(resolveSatserDefaultAargang(2020, 2005, 2025)).toBe(2020);
  });

  it('aktuelt år = minYear → returnerer minYear (grænseværdi)', () => {
    expect(resolveSatserDefaultAargang(2005, 2005, 2025)).toBe(2005);
  });

  it('aktuelt år = maxYear → returnerer maxYear (grænseværdi)', () => {
    expect(resolveSatserDefaultAargang(2025, 2005, 2025)).toBe(2025);
  });

  it('aktuelt år over interval → falder tilbage til maxYear (højeste år ≤ aktuelt)', () => {
    expect(resolveSatserDefaultAargang(2030, 2005, 2025)).toBe(2025);
  });

  it('aktuelt år under interval → undefined (intet gyldigt år ≤ aktuelt)', () => {
    expect(resolveSatserDefaultAargang(2000, 2005, 2025)).toBeUndefined();
  });

  it('defaulten ligger altid inden for det aktuelle satsinterval', () => {
    for (const currentYear of [MIN - 1, MIN, MAX, MAX + 5, 2024]) {
      const value = resolveSatserDefaultAargang(currentYear, MIN, MAX);
      if (value === undefined) continue;
      expect(value).toBeGreaterThanOrEqual(MIN);
      expect(value).toBeLessThanOrEqual(MAX);
    }
  });
});
