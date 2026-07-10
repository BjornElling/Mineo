import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { createDate } from '../../utils/dateUtils';
import {
  beregnDagPeriode,
  beregnUgePeriode,
  erPraecisEtAar,
  beregnAntalHverdage,
  beregnFeriedagePaaEtAar,
  beregnMaanedPeriode,
} from '../../utils/periodeBeregning';
import type { ISODateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';

const formatIso = (date: Date): ISODateString => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return toISODateString(`${year}-${month}-${day}`);
};

const buildIsoSet = (start: Date, end: Date): Set<ISODateString> => {
  const set = new Set<ISODateString>();
  const current = new Date(start.getTime());
  while (current <= end) {
    set.add(formatIso(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return set;
};

describe('periodeBeregning', () => {
  it('beregnDagPeriode counts inclusive days across DST', () => {
    const rows: StandardLoenTableRow[] = [
      { id: 'row-1', col0_dag: toISODateString('2024-01-26'), col1_dag: toISODateString('2024-10-20') },
    ];
    const result = beregnDagPeriode(rows);
    expect(result?.totalEnheder).toBe(269);
    expect(result?.unikkeEnheder).toBe(269);
  });

  it('erPraecisEtAar accepts a full leap year in day periods', () => {
    const datoSet = buildIsoSet(createDate(2024, 0, 1), createDate(2024, 11, 31));
    expect(erPraecisEtAar('dag', datoSet.size, datoSet)).toBe(true);
  });

  it('beregnUgePeriode counts week 53 when crossing year boundary', () => {
    const rows: StandardLoenTableRow[] = [{ id: 'row-1', col0_uge: '52/2020', col1_uge: '01/2021' }];
    const result = beregnUgePeriode(rows);
    expect(result?.totalEnheder).toBe(3);
    expect(result?.unikkeEnheder).toBe(3);
  });

  it('beregnUgePeriode handles start week 53 at year boundary', () => {
    const rows: StandardLoenTableRow[] = [{ id: 'row-1', col0_uge: '53/2020', col1_uge: '01/2021' }];
    const result = beregnUgePeriode(rows);
    expect(result?.totalEnheder).toBe(2);
    expect(result?.unikkeEnheder).toBe(2);
  });

  it('beregnDagPeriode tæller kun unikke kalenderdage ved overlappende perioder', () => {
    const rows: StandardLoenTableRow[] = [
      { id: 'row-1', col0_dag: toISODateString('2024-01-01'), col1_dag: toISODateString('2024-01-10') },
      { id: 'row-2', col0_dag: toISODateString('2024-01-05'), col1_dag: toISODateString('2024-01-15') },
    ];
    const result = beregnDagPeriode(rows);
    expect(result?.unikkeEnheder).toBe(15);
    expect(result?.totalEnheder).toBe(15);
  });

  it('beregnUgePeriode tæller kun unikke uger ved overlappende perioder', () => {
    const rows: StandardLoenTableRow[] = [
      { id: 'row-1', col0_uge: '01/2024', col1_uge: '03/2024' },
      { id: 'row-2', col0_uge: '03/2024', col1_uge: '05/2024' },
    ];
    const result = beregnUgePeriode(rows);
    expect(result?.unikkeEnheder).toBe(5);
    expect(result?.totalEnheder).toBe(5);
  });
});

// ─── beregnAntalHverdage ──────────────────────────────────────────────────────

describe('beregnAntalHverdage', () => {
  const iso = (s: string) => s as ISODateString;

  it('tom set → 0', () => {
    expect(beregnAntalHverdage(new Set())).toBe(0);
  });

  it('kun mandag → 1 hverdag', () => {
    // 2024-01-01 = mandag
    expect(beregnAntalHverdage(new Set([iso('2024-01-01')]))).toBe(1);
  });

  it('kun lørdag → 0 hverdage', () => {
    // 2024-01-06 = lørdag
    expect(beregnAntalHverdage(new Set([iso('2024-01-06')]))).toBe(0);
  });

  it('kun søndag → 0 hverdage', () => {
    // 2024-01-07 = søndag
    expect(beregnAntalHverdage(new Set([iso('2024-01-07')]))).toBe(0);
  });

  it('en hel uge (man-søn) → 5 hverdage', () => {
    // 2024-01-01 (man) til 2024-01-07 (søn) = 5 hverdage
    const set = new Set([
      iso('2024-01-01'), // man
      iso('2024-01-02'), // tir
      iso('2024-01-03'), // ons
      iso('2024-01-04'), // tor
      iso('2024-01-05'), // fre
      iso('2024-01-06'), // lør
      iso('2024-01-07'), // søn
    ]);
    expect(beregnAntalHverdage(set)).toBe(5);
  });

  it('januar 2024 (31 dage) har korrekte hverdage', () => {
    // Jan 2024: mandag 1 → søndag 31 (4 hele uger + 3 dage: man, tir, ons)
    // Hverdage: 23
    const set = new Set<ISODateString>();
    for (let d = 1; d <= 31; d++) {
      set.add(iso(`2024-01-${String(d).padStart(2, '0')}`));
    }
    expect(beregnAntalHverdage(set)).toBe(23);
  });
});

// ─── beregnFeriedagePaaEtAar ──────────────────────────────────────────────────

describe('beregnFeriedagePaaEtAar', () => {
  it('ingen 6. ferieuge → 25 dage', () => {
    expect(beregnFeriedagePaaEtAar(false)).toBe(25);
  });

  it('med 6. ferieuge → 30 dage', () => {
    expect(beregnFeriedagePaaEtAar(true)).toBe(30);
  });
});

// ─── erPraecisEtAar ───────────────────────────────────────────────────────────

describe('erPraecisEtAar', () => {
  describe('maaned', () => {
    it('12 unikke måneder → true', () => {
      expect(erPraecisEtAar('maaned', 12)).toBe(true);
    });

    it('11 unikke måneder → false', () => {
      expect(erPraecisEtAar('maaned', 11)).toBe(false);
    });

    it('13 unikke måneder → false', () => {
      expect(erPraecisEtAar('maaned', 13)).toBe(false);
    });
  });

  describe('uge', () => {
    it('uge-lønperiode → altid false', () => {
      expect(erPraecisEtAar('uge', 52)).toBe(false);
      expect(erPraecisEtAar('uge', 53)).toBe(false);
    });
  });

  describe('ukendt lønperiode', () => {
    it('ukendt → false', () => {
      expect(erPraecisEtAar('timer', 365)).toBe(false);
    });
  });

  describe('dag', () => {
    it('1. jan – 31. dec ikke-skudår (2023) → true', () => {
      const set = buildIsoSet(createDate(2023, 0, 1), createDate(2023, 11, 31));
      expect(erPraecisEtAar('dag', set.size, set)).toBe(true);
    });

    it('1. jan – 31. dec skudår (2024) → true', () => {
      const set = buildIsoSet(createDate(2024, 0, 1), createDate(2024, 11, 31));
      expect(erPraecisEtAar('dag', set.size, set)).toBe(true);
    });

    it('periode midt i år: 1. jul 2023 – 30. jun 2024 (365 dage) → false', () => {
      const set = buildIsoSet(createDate(2023, 6, 1), createDate(2024, 5, 30));
      expect(erPraecisEtAar('dag', set.size, set)).toBe(false);
    });

    it('11 måneder (1. jan – 30. nov 2023) → false', () => {
      const set = buildIsoSet(createDate(2023, 0, 1), createDate(2023, 10, 30));
      expect(erPraecisEtAar('dag', set.size, set)).toBe(false);
    });

    it('tomt datoSet → false', () => {
      expect(erPraecisEtAar('dag', 0, new Set())).toBe(false);
    });

    it('intet datoSet → false', () => {
      expect(erPraecisEtAar('dag', 365)).toBe(false);
    });
  });
});

// ─── beregnMaanedPeriode ──────────────────────────────────────────────────────

const makeRow = (maaned: string, aar: string): StandardLoenTableRow => ({
  id: `r-${maaned}-${aar}`,
  col0_maaned: maaned,
  col1_maaned: aar,
});

describe('beregnMaanedPeriode', () => {
  it('tomme rækker → null', () => {
    expect(beregnMaanedPeriode([])).toBeNull();
  });

  it('én gyldig måned → result med 1 unik måned', () => {
    const result = beregnMaanedPeriode([makeRow('1', '2024')]);
    expect(result).not.toBeNull();
    expect(result!.unikkeEnheder).toBe(1);
    expect(result!.enhedNavn).toBe('måned');
  });

  it('to måneder → result med 2 unikke måneder', () => {
    const result = beregnMaanedPeriode([
      makeRow('1', '2024'),
      makeRow('2', '2024'),
    ]);
    expect(result).not.toBeNull();
    expect(result!.unikkeEnheder).toBe(2);
    expect(result!.enhedNavn).toBe('måneder');
  });

  it('totalEnheder = antal måneder i intervallet (jan-dec 2024 = 12)', () => {
    const rows = Array.from({ length: 12 }, (_, i) => makeRow(String(i + 1), '2024'));
    const result = beregnMaanedPeriode(rows);
    expect(result).not.toBeNull();
    expect(result!.totalEnheder).toBe(12);
    expect(result!.unikkeEnheder).toBe(12);
  });

  it('duplikerede måneder tæller ikke dobbelt i unikkeEnheder', () => {
    const result = beregnMaanedPeriode([
      makeRow('6', '2024'),
      makeRow('6', '2024'), // duplikat
    ]);
    expect(result!.unikkeEnheder).toBe(1);
  });

  it('totalEnheder tæller inklusivt (jan 2024 - jan 2025 = 13 måneder)', () => {
    const result = beregnMaanedPeriode([
      makeRow('1', '2024'),
      makeRow('1', '2025'),
    ]);
    expect(result!.totalEnheder).toBe(13);
    expect(result!.unikkeEnheder).toBe(2);
  });

  it('ugyldig måned (13) ignoreres', () => {
    const result = beregnMaanedPeriode([makeRow('13', '2024')]);
    expect(result).toBeNull();
  });

  it('ugyldig år (1800) ignoreres', () => {
    const result = beregnMaanedPeriode([makeRow('6', '1800')]);
    expect(result).toBeNull();
  });

  it('datoSet indeholder alle dage i januar 2024 (31 dage)', () => {
    const result = beregnMaanedPeriode([makeRow('1', '2024')]);
    expect(result!.datoSet.size).toBe(31);
    expect(result!.datoSet.has(toISODateString('2024-01-01') as ISODateString)).toBe(true);
    expect(result!.datoSet.has(toISODateString('2024-01-31') as ISODateString)).toBe(true);
  });

  it('periodeTekst er formateret korrekt', () => {
    const result = beregnMaanedPeriode([makeRow('1', '2024')]);
    expect(result!.periodeTekst).toContain('2024');
  });
});
