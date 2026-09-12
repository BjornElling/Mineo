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

describe('utcDayMath – uafhængige århundredefacitter', () => {
  it.each([
    {
      navn: '1900 er ikke skudår',
      start: [1900, 2, 28] as const,
      slut: [1900, 3, 1] as const,
      eksklusiveDage: 1,
      inklusiveDage: 2,
    },
    {
      navn: '2000 er skudår',
      start: [2000, 2, 28] as const,
      slut: [2000, 3, 1] as const,
      eksklusiveDage: 2,
      inklusiveDage: 3,
    },
  ])(
    'beregner $navn korrekt fra 28. februar til 1. marts',
    ({ start, slut, eksklusiveDage, inklusiveDage }) => {
      const fra = utcDate(start);
      const til = utcDate(slut);

      // 1900 kan ikke deleligt med 400, så februar har 28 dage. 2000 kan deleligt med 400,
      // så februar har 29 dage. Facitterne er derfor henholdsvis 1/2 og 2/3 dage.
      expect(diffUtcDays(fra, til)).toBe(eksklusiveDage);
      expect(diffUtcDaysAbs(til, fra)).toBe(eksklusiveDage);
      expect(countExclusiveUtcDays(fra, til)).toBe(eksklusiveDage);
      expect(countInclusiveUtcDays(fra, til)).toBe(inklusiveDage);
    }
  );
});
