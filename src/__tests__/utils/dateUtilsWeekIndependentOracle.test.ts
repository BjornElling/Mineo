import { parseWeekString } from '../../utils/dateUtils';

type DateParts = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

const getUtcDateParts = (date: Date): DateParts => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

describe('parseWeekString – uafhængigt ISO-ugefacit', () => {
  it('fastholder statiske mandag/søndag-datoer ved ISO-årsskifte og uge 53', () => {
    const cases = [
      {
        input: '01/2025',
        start: { year: 2024, month: 12, day: 30 },
        end: { year: 2025, month: 1, day: 5 },
      },
      {
        input: '53/2020',
        start: { year: 2020, month: 12, day: 28 },
        end: { year: 2021, month: 1, day: 3 },
      },
    ] as const;

    for (const expected of cases) {
      const result = parseWeekString(expected.input);

      expect(result).not.toBeNull();
      expect(getUtcDateParts(result!.start)).toEqual(expected.start);
      expect(getUtcDateParts(result!.end)).toEqual(expected.end);
    }
  });
});
