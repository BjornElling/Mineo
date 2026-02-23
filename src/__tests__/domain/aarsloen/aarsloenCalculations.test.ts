import { describe, expect, it } from 'vitest';
import type { ISODateString } from '../../../types/branded';
import type { PeriodeResult } from '../../../utils/periodeBeregning';
import { beregnMetode, beregnOmregnetAarsloen } from '../../../domain/aarsloen/aarsloenCalculations';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

/**
 * Bygger et PeriodeResult med et datoSet der kun indeholder hverdage (mandag-fredag).
 * Vi angiver hverdage manuelt ved at tælle mandag-fredag i den angivne uge-mængde.
 */
const buildPeriodeResult = (
  loenperiode: 'maaned' | 'uge' | 'dag',
  unikkeEnheder: number,
  weekdayDates: string[] = []
): PeriodeResult => {
  const datoSet = new Set<ISODateString>(weekdayDates.map(iso));
  return {
    periodeTekst: 'test',
    totalEnheder: unikkeEnheder,
    unikkeEnheder,
    enhedNavn: loenperiode,
    datoSet,
    perioder: [],
  };
};

/**
 * Byg et datoSet med kendte hverdage.
 * Uge 1-10 i 2024: 2024-01-01 (mandag) til 2024-03-08 (fredag).
 * Vi bruger bare en liste af 10 ugers mandag-fredag (50 hverdage).
 */
const build10WeekdayDates = (): string[] => {
  // 2024-01-01 er mandag. Tilføj 50 hverdage (10 uger × 5 dage).
  const dates: string[] = [];
  let d = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01
  let count = 0;
  while (count < 50) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
      count++;
    }
    d = new Date(d.getTime() + 86400000);
  }
  return dates;
};

// ─── beregnMetode ──────────────────────────────────────────────────────────

describe('beregnMetode', () => {
  it('Ingen lønPaaHelligdage → Metode A', () => {
    expect(beregnMetode(false, 'Ingen')).toBe('A');
    expect(beregnMetode(true, 'Ingen')).toBe('A');
  });

  it('SH-udbetaling → Metode A', () => {
    expect(beregnMetode(false, 'SH-udbetaling')).toBe('A');
    expect(beregnMetode(true, 'SH-udbetaling')).toBe('A');
  });

  it('Ikke fuld løn under ferie + Almindelig løn → Metode B', () => {
    expect(beregnMetode(false, 'Almindelig løn')).toBe('B');
  });

  it('Fuld løn under ferie + Almindelig løn → Metode C', () => {
    expect(beregnMetode(true, 'Almindelig løn')).toBe('C');
  });
});

// ─── beregnOmregnetAarsloen — null periodeData ─────────────────────────────

describe('beregnOmregnetAarsloen — ingen periodeData', () => {
  it('returnerer metode=ingen og erEtAar=false når periodeData er null', () => {
    const result = beregnOmregnetAarsloen({
      periodeData: null,
      loenperiode: 'maaned',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    expect(result.metode).toBe('ingen');
    expect(result.erEtAar).toBe(false);
  });
});

// ─── beregnOmregnetAarsloen — Metode C (maaned) ───────────────────────────

describe('beregnOmregnetAarsloen — Metode C (maaned)', () => {
  it('12 måneder → erEtAar = true, omregnetAarsloen = beregnetAarsloen', () => {
    const periodeData = buildPeriodeResult('maaned', 12);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'maaned',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 360000,
    });
    expect(result.metode).toBe('C');
    expect(result.erEtAar).toBe(true);
    expect(result.omregnetAarsloen).toBe(360000); // 360000 / 12 * 12
  });

  it('6 måneder → omregnetAarsloen = beregnetAarsloen * 2', () => {
    const periodeData = buildPeriodeResult('maaned', 6);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'maaned',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 180000,
    });
    expect(result.metode).toBe('C');
    expect(result.omregnetAarsloen).toBe(360000);
  });

  it('0 måneder → omregnetAarsloen = 0 (undgår division med nul)', () => {
    const periodeData = buildPeriodeResult('maaned', 0);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'maaned',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    expect(result.omregnetAarsloen).toBe(0);
  });

  it('1 måned → omregnetAarsloen = beregnetAarsloen * 12', () => {
    const periodeData = buildPeriodeResult('maaned', 1);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'maaned',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 30000,
    });
    expect(result.omregnetAarsloen).toBe(360000);
  });

  it('erEtAar = false for < 12 måneder', () => {
    const periodeData = buildPeriodeResult('maaned', 11);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'maaned',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 330000,
    });
    expect(result.erEtAar).toBe(false);
  });
});

// ─── beregnOmregnetAarsloen — Metode C (uge) ──────────────────────────────

describe('beregnOmregnetAarsloen — Metode C (uge)', () => {
  it('STANDARD_UGER_PAA_AAR = 52.14 bruges som divisor', () => {
    const periodeData = buildPeriodeResult('uge', 26); // 26 uger = et halvt år
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'uge',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    expect(result.metode).toBe('C');
    // 100000 / 26 * 52.14
    const expected = (100000 / 26) * 52.14;
    expect(result.omregnetAarsloen).toBeCloseTo(expected, 2);
  });

  it('0 uger → omregnetAarsloen = 0', () => {
    const periodeData = buildPeriodeResult('uge', 0);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'uge',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    expect(result.omregnetAarsloen).toBe(0);
  });

  it('erEtAar = false for ugeløn (altid)', () => {
    const periodeData = buildPeriodeResult('uge', 52);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'uge',
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 500000,
    });
    expect(result.erEtAar).toBe(false);
  });
});

// ─── beregnOmregnetAarsloen — Metode A ────────────────────────────────────

describe('beregnOmregnetAarsloen — Metode A', () => {
  const weekdays = build10WeekdayDates(); // 50 hverdage

  it('Ingen lønPaaHelligdage → metode = A', () => {
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0,
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    expect(result.metode).toBe('A');
  });

  it('SH-udbetaling → metode = A', () => {
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'SH-udbetaling',
      beregnetAarsloen: 100000,
    });
    expect(result.metode).toBe('A');
  });

  it('Metode A: shDageAntal = null behandles som 0', () => {
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const resultNull = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    const resultZero = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    expect(resultNull.omregnetAarsloen).toBe(resultZero.omregnetAarsloen);
  });

  it('Metode A: fuld løn under ferie → feriedage trækkes IKKE fra arbejdsdageIPeriode', () => {
    // 50 hverdage, 0 SH-dage, 5 feriedage (men disse ignoreres ved fuldLoenUnderFerie)
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const resultMedFerie = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 5,
      shDageAntal: 0,
      fuldLoenUnderFerie: true, // ferie trækkes ikke fra
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    const resultUdenFerie = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    // Samme resultat fordi ferie ikke trækkes fra ved fuld løn
    expect(resultMedFerie.omregnetAarsloen).toBe(resultUdenFerie.omregnetAarsloen);
  });

  it('Metode A: ikke fuld løn → feriedage trækkes fra arbejdsdageIPeriode', () => {
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const resultUdenFerie = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0,
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    const resultMedFerie = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 5,
      shDageAntal: 0,
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    // Med 5 feriedage fratrukket har vi færre dage i perioden → højere omregnet årsløn
    expect(resultMedFerie.omregnetAarsloen).toBeGreaterThan(resultUdenFerie.omregnetAarsloen);
  });

  it('Metode A: 0 arbejdsdageIPeriode → omregnetAarsloen = 0', () => {
    // Alle dage er SH-dage, dvs. arbejdsdageIPeriode = hverdage - shDage = 0
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 50, // Alle 50 hverdage er SH-dage
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    expect(result.omregnetAarsloen).toBe(0);
  });

  it('Metode A: ret til 6. ferieuge → feriedagePaaAar = 30', () => {
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const resultMed6uge = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: true, // 30 feriedage
      antalFeriedage: 5,
      shDageAntal: 0,
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    const resultUden6uge = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false, // 25 feriedage
      antalFeriedage: 5,
      shDageAntal: 0,
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Ingen',
      beregnetAarsloen: 100000,
    });
    // Med 6. ferieuge er feriedagePaaAar = 30 (vs. 25) → arbejdsdagePaaAar er lavere
    expect(resultMed6uge.feriedagePaaAar).toBe(30);
    expect(resultUden6uge.feriedagePaaAar).toBe(25);
  });
});

// ─── beregnOmregnetAarsloen — Metode B ────────────────────────────────────

describe('beregnOmregnetAarsloen — Metode B', () => {
  const weekdays = build10WeekdayDates(); // 50 hverdage

  it('Ikke fuld løn + Almindelig løn → metode = B', () => {
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0,
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    expect(result.metode).toBe('B');
  });

  it('Metode B: hverdage bruges (ikke arbejdsdage)', () => {
    // Metode B bruger hverdage (incl. SH-dage i nævneren)
    // shDageAntal er irrelevant for Metode B
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const resultMedSH = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 10, // SH-dage ignoreres i Metode B
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    const resultUdenSH = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0, // SH-dage ignoreres i Metode B
      fuldLoenUnderFerie: false,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    expect(resultMedSH.omregnetAarsloen).toBe(resultUdenSH.omregnetAarsloen);
  });
});

// ─── beregnOmregnetAarsloen — Metode C (dag) ──────────────────────────────

describe('beregnOmregnetAarsloen — Metode C (dag)', () => {
  const weekdays = build10WeekdayDates();

  it('Fuld løn + Almindelig løn + dag → metode = C', () => {
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 0,
      shDageAntal: 0,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    expect(result.metode).toBe('C');
  });

  it('Metode C dag: bruger hverdagsomregning (som Metode B)', () => {
    // Metode C for dag genbruger beregnHverdagsOmregning identisk med Metode B
    // Men med fuldLoenUnderFerie = true → feriedage IKKE fratrukket
    const periodeData = buildPeriodeResult('dag', 50, weekdays);
    const result = beregnOmregnetAarsloen({
      periodeData,
      loenperiode: 'dag',
      retTilSjetteFerieuge: false,
      antalFeriedage: 5,
      shDageAntal: 0,
      fuldLoenUnderFerie: true, // Metode C
      loenPaaHelligdage: 'Almindelig løn',
      beregnetAarsloen: 100000,
    });
    // hverdageIPeriodeResultat = hverdageIPeriode (50) fordi fuldLoenUnderFerie
    // hverdagePaaAar = STANDARD_HVERDAGE_PAA_AAR = 261
    expect(result.omregnetAarsloen).toBeGreaterThan(0);
    const expected = (100000 / 50) * 261;
    expect(result.omregnetAarsloen).toBeCloseTo(expected, 1);
  });
});

// ─── Determinisme ─────────────────────────────────────────────────────────

describe('beregnOmregnetAarsloen — determinisme', () => {
  it('er deterministisk for identisk input', () => {
    const periodeData = buildPeriodeResult('maaned', 12);
    const params = {
      periodeData,
      loenperiode: 'maaned' as const,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      shDageAntal: null,
      fuldLoenUnderFerie: true,
      loenPaaHelligdage: 'Almindelig løn' as const,
      beregnetAarsloen: 360000,
    };
    const r1 = beregnOmregnetAarsloen(params);
    const r2 = beregnOmregnetAarsloen(params);
    expect(r1).toEqual(r2);
  });
});
