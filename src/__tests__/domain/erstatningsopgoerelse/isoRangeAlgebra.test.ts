import { toISODateString, type ISODateString } from '../../../types/branded';
import {
  buildDateSetFromRanges,
  buildRangesFromSortedDates,
  buildSingleDateRange,
  clipRangesToInclusiveUpperBound,
  mergeDateRanges,
  mergeIsoDateRanges,
  splitRangesAtBoundaryStarts,
  subtractIsoDateRanges,
} from '../../../domain/erstatningsopgoerelse/engines/isoRangeAlgebra';
import type { IsoRange } from '../../../utils/isoDateHelpers';

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
      { fra: d(toISODateString('2024-01-10')), til: d(toISODateString('2024-01-20')) },
      { fra: d(toISODateString('2024-01-01')), til: d(toISODateString('2024-01-12')) },
    ];
    const merged = mergeDateRanges(ranges);
    expect(merged).toHaveLength(1);
    // Verificer at resultat er Date-objekter
    expect(merged[0].fra).toBeInstanceOf(Date);
    expect(merged[0].til).toBeInstanceOf(Date);
    // Verificer tidspunkter
    expect(merged[0].fra.toISOString().startsWith(toISODateString('2024-01-01'))).toBe(true);
    expect(merged[0].til.toISOString().startsWith(toISODateString('2024-01-20'))).toBe(true);
  });

  it('enkelt range returneres som Date-objekt', () => {
    const ranges = [{ fra: d(toISODateString('2024-06-01')), til: d(toISODateString('2024-06-30')) }];
    const merged = mergeDateRanges(ranges);
    expect(merged).toHaveLength(1);
    expect(merged[0].fra).toBeInstanceOf(Date);
  });
});

// Ækvivalens-lås for SFGG-refaktoreringen (buildIncomeExcludedRanges): den nye form bruger
// mergeIsoDateRanges({mergeAdjacent:true}) i stedet for at materialisere alle dage, sortere og
// re-segmentere til sammenhængende ranges. Disse SKAL give præcis samme dag-dækning, ellers
// ændres hvilke perioder der udelukkes. Property-test over mange tilfældige interval-sæt.
describe('mergeIsoDateRanges ≡ materialisér-sortér-resegmentér (mergeAdjacent)', () => {
  const oneDayMs = 86_400_000;
  const isoOf = (ms: number): ISODateString =>
    toISODateString(new Date(ms).toISOString().slice(0, 10));

  // Reference: materialisér alle dage → dedup → sortér → segmentér i maksimalt sammenhængende ranges.
  const referenceResegment = (ranges: readonly IsoRange[]): IsoRange[] => {
    const days = new Set<ISODateString>();
    for (const r of ranges) {
      const start = Date.parse(`${r.fra}T00:00:00.000Z`);
      const end = Date.parse(`${r.til}T00:00:00.000Z`);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end) continue;
      for (let ms = start; ms <= end; ms += oneDayMs) days.add(isoOf(ms));
    }
    const sorted = [...days].sort();
    const out: IsoRange[] = [];
    let fra: ISODateString | null = null;
    let prev: ISODateString | null = null;
    for (const day of sorted) {
      if (fra === null || prev === null) {
        fra = day;
        prev = day;
        continue;
      }
      const expectedNext = isoOf(Date.parse(`${prev}T00:00:00.000Z`) + oneDayMs);
      if (day !== expectedNext) {
        out.push({ fra, til: prev });
        fra = day;
      }
      prev = day;
    }
    if (fra !== null && prev !== null) out.push({ fra, til: prev });
    return out;
  };

  it('matcher referencen for mange tilfældige (overlappende/adjacent/adskilte) interval-sæt', () => {
    const base = Date.parse('2020-01-01T00:00:00.000Z');
    // Deterministisk LCG, så testen ikke er flaky (ingen Math.random).
    let seed = 123456789;
    const nextInt = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let iteration = 0; iteration < 300; iteration += 1) {
      const count = 1 + nextInt(5);
      const ranges: IsoRange[] = [];
      for (let r = 0; r < count; r += 1) {
        const startMs = base + nextInt(120) * oneDayMs;
        const lenDays = nextInt(40);
        ranges.push({ fra: isoOf(startMs), til: isoOf(startMs + lenDays * oneDayMs) });
      }
      const merged = mergeIsoDateRanges(ranges, { mergeAdjacent: true });
      const reference = referenceResegment(ranges);
      expect(merged).toEqual(reference);
    }
  });
});

describe('subtractIsoDateRanges', () => {
  it('tom base → tom liste', () => {
    expect(subtractIsoDateRanges([], [{ fra: iso('2024-01-01'), til: iso('2024-01-05') }])).toEqual([]);
  });

  it('ingen udelukkelser → base uændret (kopi)', () => {
    const base = [{ fra: iso('2024-01-01'), til: iso('2024-01-10') }];
    expect(subtractIsoDateRanges(base, [])).toEqual(base);
  });

  it('udskærer et midtstillet interval og efterlader hullerne', () => {
    const result = subtractIsoDateRanges(
      [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
      [{ fra: iso('2024-01-10'), til: iso('2024-01-12') }]
    );
    expect(result).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-09') },
      { fra: iso('2024-01-13'), til: iso('2024-01-31') },
    ]);
  });

  it('fjerner hele basen når udelukkelsen dækker den', () => {
    const result = subtractIsoDateRanges(
      [{ fra: iso('2024-01-10'), til: iso('2024-01-20') }],
      [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]
    );
    expect(result).toEqual([]);
  });
});

describe('clipRangesToInclusiveUpperBound', () => {
  it('null grænse → uændret kopi', () => {
    const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-10') }];
    expect(clipRangesToInclusiveUpperBound(ranges, null)).toEqual(ranges);
  });

  it('afkorter ranges der overskrider grænsen og dropper dem der starter efter', () => {
    const result = clipRangesToInclusiveUpperBound(
      [
        { fra: iso('2024-01-01'), til: iso('2024-01-20') },
        { fra: iso('2024-02-01'), til: iso('2024-02-05') },
      ],
      iso('2024-01-15')
    );
    expect(result).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });
});

describe('splitRangesAtBoundaryStarts', () => {
  it('ingen grænser → uændret kopi', () => {
    const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-10') }];
    expect(splitRangesAtBoundaryStarts(ranges, [])).toEqual(ranges);
  });

  it('splitter ved grænsestart uden at fjerne dage', () => {
    const result = splitRangesAtBoundaryStarts(
      [{ fra: iso('2024-01-01'), til: iso('2024-01-10') }],
      [iso('2024-01-05')]
    );
    expect(result).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-04') },
      { fra: iso('2024-01-05'), til: iso('2024-01-10') },
    ]);
  });
});

describe('buildRangesFromSortedDates', () => {
  it('tom liste → tom liste', () => {
    expect(buildRangesFromSortedDates([])).toEqual([]);
  });

  it('samler sammenhængende datoer og bryder ved huller', () => {
    const result = buildRangesFromSortedDates([
      iso('2024-01-01'), iso('2024-01-02'), iso('2024-01-03'),
      iso('2024-01-06'), iso('2024-01-07'),
    ]);
    expect(result).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-03') },
      { fra: iso('2024-01-06'), til: iso('2024-01-07') },
    ]);
  });
});

describe('buildDateSetFromRanges', () => {
  it('samler alle inkluderede datoer på tværs af ranges', () => {
    const set = buildDateSetFromRanges([
      { fra: iso('2024-01-01'), til: iso('2024-01-03') },
      { fra: iso('2024-01-06'), til: iso('2024-01-06') },
    ]);
    expect([...set].sort()).toEqual([
      iso('2024-01-01'), iso('2024-01-02'), iso('2024-01-03'), iso('2024-01-06'),
    ]);
  });
});

describe('buildSingleDateRange', () => {
  it('bygger en én-dags range', () => {
    expect(buildSingleDateRange(iso('2024-01-07'))).toEqual({ fra: iso('2024-01-07'), til: iso('2024-01-07') });
  });
});
