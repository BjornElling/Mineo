import {
  countExclusiveUtcDays,
  countInclusiveUtcDays,
  diffUtcDays,
  diffUtcDaysAbs,
} from '../../utils/utcDayMath';

// Native UTC-datoer holder håndfacittet adskilt fra Mineos egne dato-helpers.
const utcDate = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day));

describe('utcDayMath – uafhængigt facit ved månedsskifte', () => {
  it('tæller 30. januar til 1. marts 2025 inklusivt uden skudår', () => {
    const fra = utcDate(2025, 1, 30);
    const til = utcDate(2025, 3, 1);

    // 30.–31. januar = 2 dage, februar = 28 dage, og 1. marts = 1 dag.
    // Det håndberegnede facit er derfor 31 inklusive og 30 eksklusive.
    expect(diffUtcDays(fra, til)).toBe(30);
    expect(diffUtcDays(til, fra)).toBe(-30);
    expect(diffUtcDaysAbs(til, fra)).toBe(30);
    expect(countExclusiveUtcDays(fra, til)).toBe(30);
    expect(countInclusiveUtcDays(fra, til)).toBe(31);
  });
});
