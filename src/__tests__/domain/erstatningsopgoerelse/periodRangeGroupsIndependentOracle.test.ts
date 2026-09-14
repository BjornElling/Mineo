import {
  splitIsoRangeByCalendarMonthsInclusive,
  type CalendarMonthIsoRange,
} from '../../../domain/erstatningsopgoerelse/engines/periodRangeGroups';
import type { ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => value as ISODateString;

const facit: readonly CalendarMonthIsoRange[] = [
  { fra: iso('2023-12-30'), til: iso('2023-12-31'), year: 2023, month: 12 },
  { fra: iso('2024-01-01'), til: iso('2024-01-31'), year: 2024, month: 1 },
  { fra: iso('2024-02-01'), til: iso('2024-02-29'), year: 2024, month: 2 },
  { fra: iso('2024-03-01'), til: iso('2024-03-02'), year: 2024, month: 3 },
];

describe('splitIsoRangeByCalendarMonthsInclusive – uafhængigt periodiseringsfacit', () => {
  it('bevarer delvise yderpunkter, årsskifte og skuddagen', () => {
    // Håndfacit: 30.–31. december, hele januar, hele skudårsfebruar og 1.–2. marts.
    expect(
      splitIsoRangeByCalendarMonthsInclusive(iso('2023-12-30'), iso('2024-03-02'))
    ).toEqual(facit);
  });
});
