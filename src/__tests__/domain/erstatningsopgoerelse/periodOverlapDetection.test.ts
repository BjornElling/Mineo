import { toISODateString } from '../../../types/branded';
import { detectConflictingSvieSmerteOverlaps, detectOverlappingPeriods } from '../../../domain/erstatningsopgoerelse/periodOverlapDetection';

const iso = (value: string) => toISODateString(value);

describe('detectOverlappingPeriods', () => {
  it('finder overlap inklusiv grænsedage', () => {
    const rows = [
      { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-10') },
      { id: 'b', fra: iso('2024-01-10'), til: iso('2024-01-20') },
      { id: 'c', fra: iso('2024-02-01'), til: iso('2024-02-05') },
    ];
    const overlap = detectOverlappingPeriods(rows);
    expect(overlap.has('a')).toBe(true);
    expect(overlap.has('b')).toBe(true);
    expect(overlap.has('c')).toBe(false);
  });

  it('ignorerer ugyldige eller tomme rækker', () => {
    const rows = [
      { id: 'a', fra: iso('2024-01-05'), til: iso('2024-01-03') },
      { id: 'b', fra: iso('2024-02-01'), til: undefined },
    ];
    const overlap = detectOverlappingPeriods(rows);
    expect(overlap.size).toBe(0);
  });
});

describe('detectConflictingSvieSmerteOverlaps', () => {
  it('markerer kun overlap med forskellig tilstand', () => {
    const rows = [
      { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'Sygemeldt' },
      { id: 'b', fra: iso('2024-01-05'), til: iso('2024-01-12'), tilstand: 'Delvist Sygemeldt' },
      { id: 'c', fra: iso('2024-02-01'), til: iso('2024-02-05'), tilstand: 'Sygemeldt' },
    ];
    const overlap = detectConflictingSvieSmerteOverlaps(rows);
    expect(overlap.has('a')).toBe(true);
    expect(overlap.has('b')).toBe(true);
    expect(overlap.has('c')).toBe(false);
  });
});
