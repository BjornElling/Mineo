import {
  countExclusiveUtcDays,
  countInclusiveUtcDays,
  diffUtcDays,
  diffUtcDaysAbs,
} from '../../utils/utcDayMath';

type CalendarDate = readonly [year: number, month: number, day: number];

// Native UTC-datoer holder dette facit adskilt fra Mineos egne dato-helpers.
const utcDate = ([year, month, day]: CalendarDate): Date =>
  new Date(Date.UTC(year, month - 1, day));

describe('utcDayMath – uafhængigt 2100-facit', () => {
  it('tæller korrekt over årsskiftet ind i 2100, som ikke er skudår', () => {
    const fra = utcDate([2099, 12, 31]);
    const til = utcDate([2100, 3, 1]);

    // Fra 31. december til 1. marts er der 31 januardage og 28 februardage i 2100.
    expect(diffUtcDays(fra, til)).toBe(60);
    expect(diffUtcDays(til, fra)).toBe(-60);
    expect(diffUtcDaysAbs(til, fra)).toBe(60);
    expect(countExclusiveUtcDays(fra, til)).toBe(60);
    expect(countInclusiveUtcDays(fra, til)).toBe(61);
  });
});
