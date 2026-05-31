import { toISODateString } from '../../../types/branded';
import { detectOverlappingPeriods } from '../../../domain/erstatningsopgoerelse/engines/periodOverlapDetection';

const iso = (value: string) => toISODateString(value);

describe('detectOverlappingPeriods', () => {
  it('tom liste → tomt set', () => {
    expect(detectOverlappingPeriods([])).toEqual(new Set());
  });

  it('enkelt række → ingen overlap muligt', () => {
    const rows = [{ id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-10') }];
    const overlap = detectOverlappingPeriods(rows);
    expect(overlap.size).toBe(0);
  });

  it('to fuldt separate perioder → ingen overlap', () => {
    const rows = [
      { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-10') },
      { id: 'b', fra: iso('2024-02-01'), til: iso('2024-02-10') },
    ];
    const overlap = detectOverlappingPeriods(rows);
    expect(overlap.size).toBe(0);
  });

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
      { id: 'a', fra: iso('2024-01-05'), til: iso('2024-01-03') }, // fra > til
      { id: 'b', fra: iso('2024-02-01'), til: undefined },          // mangler til
    ];
    const overlap = detectOverlappingPeriods(rows);
    expect(overlap.size).toBe(0);
  });

  it('tre rækker der alle overlapper → alle tre markeres', () => {
    const rows = [
      { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-15') },
      { id: 'b', fra: iso('2024-01-10'), til: iso('2024-01-20') },
      { id: 'c', fra: iso('2024-01-12'), til: iso('2024-01-25') },
    ];
    const overlap = detectOverlappingPeriods(rows);
    expect(overlap.has('a')).toBe(true);
    expect(overlap.has('b')).toBe(true);
    expect(overlap.has('c')).toBe(true);
  });

  it('svie/smerte: ethvert overlap markeres — også når perioderne har samme tilstand', () => {
    // Tilstand er irrelevant for overlap-afvisning: validator og svieSmerteEngine afviser
    // ethvert overlap. detectOverlappingPeriods ser kun på fra/til, og det er den korrekte regel.
    const rows = [
      { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-15') },
      { id: 'b', fra: iso('2024-01-10'), til: iso('2024-01-20') },
    ];
    const overlap = detectOverlappingPeriods(rows);
    expect(overlap.has('a')).toBe(true);
    expect(overlap.has('b')).toBe(true);
  });
});
