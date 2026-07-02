import {
  statistiskLoenudvikling,
  getStatistiskLoenudvikling,
  getReguleringsDatoIntervalForStatistikModel,
  assertStatistikAarKontinuitet,
  type Kvartal,
  type StatistiskLoenudvikling,
  type StatistiskLoenudviklingId,
} from '../../data/statistiskeRates';

// Byg en syntetisk model uden at gå gennem de (ikke-eksporterede) brand-helpers.
const makeModel = (id: string, rows: ReadonlyArray<readonly [string, number]>): StatistiskLoenudvikling => ({
  meta: { id: id as StatistiskLoenudviklingId, navn: id, hjaelpetekst: '' },
  indeksvaerdier: rows.map(([kvartal, indeksvaerdi]) => ({ kvartal: kvartal as Kvartal, indeksvaerdi })),
});

// ─── Dataintegritet ───────────────────────────────────────────────────────────

describe('statistiskLoenudvikling – dataintegritet', () => {
  it('har præcis 2 modeller (ILON12 + SBLON2)', () => {
    expect(statistiskLoenudvikling).toHaveLength(2);
  });

  it('ILON12 og SBLON2 er begge repræsenteret', () => {
    const ids = statistiskLoenudvikling.map((m) => m.meta.id);
    expect(ids).toContain('ILON12');
    expect(ids).toContain('SBLON2');
  });

  it('alle modeller har mindst ét indeksværdi-sæt', () => {
    for (const model of statistiskLoenudvikling) {
      expect(model.indeksvaerdier.length).toBeGreaterThan(0);
    }
  });

  it('alle indeksværdier er finite positive tal', () => {
    for (const model of statistiskLoenudvikling) {
      for (const vaerdi of model.indeksvaerdier) {
        expect(Number.isFinite(vaerdi.indeksvaerdi)).toBe(true);
        expect(vaerdi.indeksvaerdi).toBeGreaterThan(0);
      }
    }
  });

  it('alle kvartal-værdier matcher ÅÅÅÅKn format', () => {
    const KVARTAL_PATTERN = /^\d{4}K[1-4]$/;
    for (const model of statistiskLoenudvikling) {
      for (const vaerdi of model.indeksvaerdier) {
        expect(vaerdi.kvartal).toMatch(KVARTAL_PATTERN);
      }
    }
  });

  it('ILON12 indeholder 2005K1 med indeks 100', () => {
    const ilon12 = statistiskLoenudvikling.find((m) => m.meta.id === 'ILON12');
    expect(ilon12).toBeDefined();
    const basisvaerdi = ilon12?.indeksvaerdier.find((v) => v.kvartal === '2005K1');
    expect(basisvaerdi).toBeDefined();
    expect(basisvaerdi?.indeksvaerdi).toBe(100.0);
  });

  it('alle modeller har unikke kvartal-nøgler inden for modellen', () => {
    for (const model of statistiskLoenudvikling) {
      const kvartaler = model.indeksvaerdier.map((v) => v.kvartal);
      const unique = new Set(kvartaler);
      expect(unique.size).toBe(kvartaler.length);
    }
  });

  it('ILON12 basis er 2005K1 = 100, alle øvrige > 100', () => {
    const ilon12 = statistiskLoenudvikling.find((m) => m.meta.id === 'ILON12');
    if (!ilon12) return;
    for (const vaerdi of ilon12.indeksvaerdier) {
      if (vaerdi.kvartal === '2005K1') {
        expect(vaerdi.indeksvaerdi).toBe(100.0);
      } else {
        // Lønindeks stiger generelt over tid — alle andre år er > 100
        expect(vaerdi.indeksvaerdi).toBeGreaterThan(100);
      }
    }
  });
});

// ─── getStatistiskLoenudvikling ───────────────────────────────────────────────

describe('getStatistiskLoenudvikling', () => {
  it('ILON12 → returnerer model', () => {
    const model = getStatistiskLoenudvikling('ILON12' as Parameters<typeof getStatistiskLoenudvikling>[0]);
    expect(model).toBeDefined();
    expect(model?.meta.id).toBe('ILON12');
  });

  it('SBLON2 → returnerer model', () => {
    const model = getStatistiskLoenudvikling('SBLON2' as Parameters<typeof getStatistiskLoenudvikling>[0]);
    expect(model).toBeDefined();
    expect(model?.meta.id).toBe('SBLON2');
  });
});

// ─── getReguleringsDatoIntervalForStatistikModel ──────────────────────────────

describe('getReguleringsDatoIntervalForStatistikModel', () => {
  it('tom streng → undefined', () => {
    expect(getReguleringsDatoIntervalForStatistikModel('')).toBeUndefined();
  });

  it('whitespace → undefined', () => {
    expect(getReguleringsDatoIntervalForStatistikModel('   ')).toBeUndefined();
  });

  it('ukendt model → undefined', () => {
    expect(getReguleringsDatoIntervalForStatistikModel('UKENDT')).toBeUndefined();
  });

  it('ILON12 → returnerer interval med fraDato og tilDato', () => {
    const interval = getReguleringsDatoIntervalForStatistikModel('ILON12');
    expect(interval).toBeDefined();
    if (interval) {
      expect(interval.fraDato).toBeTruthy();
      expect(interval.tilDato).toBeTruthy();
    }
  });

  it('SBLON2 → returnerer interval', () => {
    const interval = getReguleringsDatoIntervalForStatistikModel('SBLON2');
    expect(interval).toBeDefined();
  });

  it('ILON12 interval fraDato matcher 01-01-2005', () => {
    const interval = getReguleringsDatoIntervalForStatistikModel('ILON12');
    // Ældste kvartal er 2005K1 → fraDato = 01-01-2005
    expect(interval?.fraDato).toBe('01-01-2005');
  });

  it('interval datoer er på dansk datoformat (dd-mm-åååå)', () => {
    const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;
    const interval = getReguleringsDatoIntervalForStatistikModel('ILON12');
    if (interval) {
      expect(interval.fraDato).toMatch(DANISH_DATE);
      expect(interval.tilDato).toMatch(DANISH_DATE);
    }
  });

  it('ASL-årslønsmaksimum → returnerer interval eller undefined (afhænger af data)', () => {
    // Denne model bruger aarsloenAslMax fra lovbestemteRates
    const interval = getReguleringsDatoIntervalForStatistikModel('ASL-årslønsmaksimum');
    // Enten defineret eller undefined – vi kontrollerer bare at det ikke kaster
    expect(interval === undefined || typeof interval === 'object').toBe(true);
  });
});

// ─── assertStatistikAarKontinuitet (kontinuitets-guard, silent-path S6) ─────────
//
// Guarden er fail-closed-værnet mod et interiort hul i kvartalsserien: mangler et
// helt kalenderår midt i serien, ville motorens "seneste indeks ≤ dato"-opslag
// stiltiende videreføre det forrige års indeks i det manglende års segment (tavs
// under-regulering). Guarden gør et sådant hul umuligt ved modul-load.

describe('assertStatistikAarKontinuitet', () => {
  it('de faktiske modeller (ILON12, SBLON2) har sammenhængende års-dækning og kaster ikke', () => {
    for (const model of statistiskLoenudvikling) {
      expect(() => assertStatistikAarKontinuitet(model)).not.toThrow();
    }
  });

  it('en sammenhængende serie (år uden huller) kaster ikke', () => {
    const model = makeModel('X', [
      ['2020K1', 100],
      ['2021K1', 105],
      ['2022K1', 110],
    ]);
    expect(() => assertStatistikAarKontinuitet(model)).not.toThrow();
  });

  it('flere kvartaler i samme år (fx K1 + K4) er tilladt — året er repræsenteret', () => {
    // Spejler ILON12's faktiske form: 2025 optræder som både K1 og K4.
    const model = makeModel('X', [
      ['2024K1', 156.1],
      ['2025K1', 161.5],
      ['2025K4', 165.2],
    ]);
    expect(() => assertStatistikAarKontinuitet(model)).not.toThrow();
  });

  it('FAIL-CLOSED: et helt manglende år midt i serien kaster (hul-midt-i-serien)', () => {
    // 2021 mangler helt mellem 2020 og 2022. Uden guarden ville et TAF-segment i
    // 2021 stiltiende bruge 2020-indekset (100) → tavs under-regulering.
    const model = makeModel('X', [
      ['2020K1', 100],
      ['2022K1', 110],
    ]);
    expect(() => assertStatistikAarKontinuitet(model)).toThrow(/mangler år 2021/);
  });

  it('FAIL-CLOSED: et flerårigt hul rapporterer det første manglende år', () => {
    const model = makeModel('X', [
      ['2018K1', 100],
      ['2022K1', 120],
    ]);
    expect(() => assertStatistikAarKontinuitet(model)).toThrow(/mangler år 2019/);
  });

  it('tom serie kaster ikke (ingen års-span at kontrollere)', () => {
    const model = makeModel('X', []);
    expect(() => assertStatistikAarKontinuitet(model)).not.toThrow();
  });
});
