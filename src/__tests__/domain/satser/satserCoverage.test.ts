/// <reference types="vitest/globals" />

import { getSatserForYear } from '../../../data/lovbestemteRates';
import { describeMissingSatserCoverage, hasAnyEalSats } from '../../../domain/satser/satserCoverage';

describe('describeMissingSatserCoverage (BB-392)', () => {
  it('nævner præcis de kategorier, et delvist dækket år mangler', () => {
    const satser = getSatserForYear(2027);
    expect(hasAnyEalSats(satser)).toBe(false);
    expect(describeMissingSatserCoverage(2027, satser)).toBe(
      'Mineo indeholder endnu ikke satser efter erstatningsansvarsloven eller beløbsgrænser for fri proces for 2027.',
    );
  });

  it('er tavs for fuldt dækkede år', () => {
    for (let year = 2005; year <= 2026; year += 1) {
      expect(describeMissingSatserCoverage(year, getSatserForYear(year)), String(year)).toBeNull();
    }
  });
});
