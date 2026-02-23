import { toISODateString } from '../../../types/branded';
import { mergeIsoDateRanges, mergeDateRanges } from '../../../domain/erstatningsopgoerelse/periodMerging';

const iso = (value: string) => toISODateString(value);
const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('mergeIsoDateRanges', () => {
  it('tom liste → tom liste', () => {
    expect(mergeIsoDateRanges([])).toEqual([]);
  });

  it('enkelt range → returneres uændret', () => {
    const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-10') }];
    const merged = mergeIsoDateRanges(ranges);
    expect(merged).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-10') }]);
  });

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

  it('to ranges med samme fra-dato sorteres korrekt (korteste til-dato først)', () => {
    const ranges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-20') },
      { fra: iso('2024-01-01'), til: iso('2024-01-10') },
    ];
    const merged = mergeIsoDateRanges(ranges);
    // Begge starter samme dag — slår sammen til det største interval
    expect(merged).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-20') }]);
  });

  it('nested range (next.til <= current.til) udvider ikke grænsen', () => {
    // [Jan 1–20] indeholder [Jan 5–15] — resultatet er stadig [Jan 1–20]
    const ranges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-20') },
      { fra: iso('2024-01-05'), til: iso('2024-01-15') },
    ];
    const merged = mergeIsoDateRanges(ranges);
    expect(merged).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-20') }]);
  });

  it('tre uafhængige ranges → tre separate resultater', () => {
    const ranges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-05') },
      { fra: iso('2024-02-01'), til: iso('2024-02-05') },
      { fra: iso('2024-03-01'), til: iso('2024-03-05') },
    ];
    const merged = mergeIsoDateRanges(ranges);
    expect(merged).toHaveLength(3);
  });

  it('to overlappende og et separat → to grupper', () => {
    const ranges = [
      { fra: iso('2024-01-01'), til: iso('2024-01-15') },
      { fra: iso('2024-01-10'), til: iso('2024-01-20') },
      { fra: iso('2024-03-01'), til: iso('2024-03-10') },
    ];
    const merged = mergeIsoDateRanges(ranges);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({ fra: iso('2024-01-01'), til: iso('2024-01-20') });
    expect(merged[1]).toEqual({ fra: iso('2024-03-01'), til: iso('2024-03-10') });
  });
});

describe('mergeDateRanges', () => {
  it('tom liste → tom liste', () => {
    expect(mergeDateRanges([])).toEqual([]);
  });

  it('merger overlappende Date-ranges korrekt', () => {
    const ranges = [
      { fra: d('2024-01-10'), til: d('2024-01-20') },
      { fra: d('2024-01-01'), til: d('2024-01-12') },
    ];
    const merged = mergeDateRanges(ranges);
    expect(merged).toHaveLength(1);
    // Verificer at resultat er Date-objekter
    expect(merged[0].fra).toBeInstanceOf(Date);
    expect(merged[0].til).toBeInstanceOf(Date);
    // Verificer tidspunkter
    expect(merged[0].fra.toISOString().startsWith('2024-01-01')).toBe(true);
    expect(merged[0].til.toISOString().startsWith('2024-01-20')).toBe(true);
  });

  it('enkelt range returneres som Date-objekt', () => {
    const ranges = [{ fra: d('2024-06-01'), til: d('2024-06-30') }];
    const merged = mergeDateRanges(ranges);
    expect(merged).toHaveLength(1);
    expect(merged[0].fra).toBeInstanceOf(Date);
  });
});
