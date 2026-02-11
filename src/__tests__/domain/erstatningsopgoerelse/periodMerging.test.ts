import { toISODateString } from '../../../types/branded';
import { mergeIsoDateRanges } from '../../../domain/erstatningsopgoerelse/periodMerging';

const iso = (value: string) => toISODateString(value);

describe('mergeIsoDateRanges', () => {
  it('merger overlappende ranges', () => {
    const ranges = [
      { fra: iso('2024-01-10'), til: iso('2024-01-20') },
      { fra: iso('2024-01-01'), til: iso('2024-01-12') },
    ];
    const merged = mergeIsoDateRanges(ranges);
    expect(merged).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-20') }]);
  });

  it('merger adjacent ranges når mergeAdjacent=true', () => {
    const ranges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-10') },
      { fra: iso('2024-01-11'), til: iso('2024-01-20') },
    ];
    const merged = mergeIsoDateRanges(ranges, { mergeAdjacent: true });
    expect(merged).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-20') }]);
  });

  it('bevarer separate ranges når mergeAdjacent=false', () => {
    const ranges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-10') },
      { fra: iso('2024-01-11'), til: iso('2024-01-20') },
    ];
    const merged = mergeIsoDateRanges(ranges, { mergeAdjacent: false });
    expect(merged).toEqual(ranges);
  });
});
