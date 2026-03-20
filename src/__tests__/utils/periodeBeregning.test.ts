import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { createDate } from '../../utils/dateUtils';
import {
  beregnDagPeriode,
  beregnPeriodiseringsDage,
  beregnUgePeriode,
  erNoejagtEtAar,
  beregnAntalHverdage,
  beregnFeriedagePaaEtAar,
  beregnMaanedPeriode,
} from '../../utils/periodeBeregning';
import type { ISODateString } from '../../types/branded';

const formatIso = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildIsoSet = (start: Date, end: Date): Set<string> => {
  const set = new Set<string>();
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
      { id: 'row-1', col0_dag: '26-01-2024', col1_dag: '20-10-2024' },
    ];
    const result = beregnDagPeriode(rows);
    expect(result?.totalEnheder).toBe(269);
    expect(result?.unikkeEnheder).toBe(269);
  });

  it('erNoejagtEtAar accepts a full leap year in day periods', () => {
    const datoSet = buildIsoSet(createDate(2024, 0, 1), createDate(2024, 11, 31));
    expect(erNoejagtEtAar('dag', datoSet.size, datoSet)).toBe(true);
  });

  it('beregnPeriodiseringsDage counts kalenderdage inclusively across DST', () => {
    const days = beregnPeriodiseringsDage('30-03-2024', '02-04-2024', 'kalenderdage');
    expect(days).toBe(4);
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

// ─── erNoejagtEtAar ───────────────────────────────────────────────────────────

describe('erNoejagtEtAar', () => {
  describe('maaned', () => {
    it('12 unikke måneder → true', () => {
      expect(erNoejagtEtAar('maaned', 12)).toBe(true);
    });

    it('11 unikke måneder → false', () => {
      expect(erNoejagtEtAar('maaned', 11)).toBe(false);
    });

    it('13 unikke måneder → false', () => {
      expect(erNoejagtEtAar('maaned', 13)).toBe(false);
    });
  });

  describe('uge', () => {
    it('uge-lønperiode → altid false', () => {
      expect(erNoejagtEtAar('uge', 52)).toBe(false);
      expect(erNoejagtEtAar('uge', 53)).toBe(false);
    });
  });

  describe('ukendt lønperiode', () => {
    it('ukendt → false', () => {
      expect(erNoejagtEtAar('timer', 365)).toBe(false);
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
    expect(result!.datoSet.has('2024-01-01' as ISODateString)).toBe(true);
    expect(result!.datoSet.has('2024-01-31' as ISODateString)).toBe(true);
  });

  it('periodeTekst er formateret korrekt', () => {
    const result = beregnMaanedPeriode([makeRow('1', '2024')]);
    expect(result!.periodeTekst).toContain('2024');
  });
});

// ─── beregnPeriodiseringsDage – arbejdsdage ────────────────────────────────────

describe('beregnPeriodiseringsDage – arbejdsdage', () => {
  it('manglende fra → null', () => {
    expect(beregnPeriodiseringsDage(undefined, '31-01-2024', 'arbejdsdage')).toBeNull();
  });

  it('manglende til → null', () => {
    expect(beregnPeriodiseringsDage('01-01-2024', undefined, 'arbejdsdage')).toBeNull();
  });

  it('fra > til → null', () => {
    expect(beregnPeriodiseringsDage('31-01-2024', '01-01-2024', 'arbejdsdage')).toBeNull();
  });

  it('én hverdag (mandag) → 1 (ingen SH-dage)', () => {
    // 2024-01-08 = mandag (ikke helligdag)
    const days = beregnPeriodiseringsDage('08-01-2024', '08-01-2024', 'arbejdsdage');
    expect(days).toBe(1);
  });

  it('en lørdag → 0 (ikke hverdag)', () => {
    // 2024-01-06 = lørdag
    const days = beregnPeriodiseringsDage('06-01-2024', '06-01-2024', 'arbejdsdage');
    expect(days).toBe(0);
  });

  it('Sygedagpenge FØR 2. juli 2012 → ingen SH-fradrag', () => {
    // Juledag 25-12-2011 er søndag → ingen forskel i dette tilfælde.
    // Tester i stedet med en periode der INDEHOLDER en helligdag før 2. juli 2012.
    // Skærtorsdag 5. april 2012 (torsdag) er en helligdag.
    // For sygedagpenge før 02-07-2012 fratrækkes SH-dage IKKE.
    const daysMedSygedagpenge = beregnPeriodiseringsDage('01-04-2012', '30-06-2012', 'arbejdsdage', 'sygedagpenge');
    const daysUdenSygedagpenge = beregnPeriodiseringsDage('01-04-2012', '30-06-2012', 'arbejdsdage');
    // Med sygedagpenge (< 02-07-2012): ingen SH-fradrag → flere dage
    expect(daysMedSygedagpenge).toBeGreaterThan(daysUdenSygedagpenge!);
  });

  it('Sygedagpenge EFTER 2. juli 2012 → SH-dage fratrækkes', () => {
    // En periode med pinse 2013: Hvidemandag 20. maj 2013 (mandag = helligdag)
    const daysMedSygedagpenge = beregnPeriodiseringsDage('13-05-2013', '31-05-2013', 'arbejdsdage', 'sygedagpenge');
    const daysUdenSygedagpenge = beregnPeriodiseringsDage('13-05-2013', '31-05-2013', 'arbejdsdage');
    // Samme resultat — SH-dage fratrækkes for begge
    expect(daysMedSygedagpenge).toBe(daysUdenSygedagpenge);
  });

  it('ukendt periodisering → null', () => {
    expect(beregnPeriodiseringsDage('01-01-2024', '31-01-2024', 'ukendt' as any)).toBeNull();
  });
});
