import {
  getYearBoundsForYearlyRate,
  getYearBoundsForCompleteCoverage,
  getYearBoundsForAnyCoverage,
  svieSmertePrDag,
  getSatserForYear,
  getSatserCompleteYearBounds,
  satserCompleteYearBounds,
  satserAngivAarYearBounds,
  varigeMenPrGradYearBounds,
  eetYearBounds,
  aarsloenAslMin,
  aarsloenAslMinFoer20240701,
  aarsloenAslMinFra20240701,
  reguleringsprocentErhvervsevnetabFoer2024,
  reguleringsprocentErhvervsevnetabFra2024,
  ASL_MAX_AARSLOEN_2024,
  aarsloenAslMax,
  assertAarsloenAslMaxKontinuitet,
} from '../../data/lovbestemteRates';
import { eetKapitaliseringsDatoMaxFraBekendtgoerelser } from '../../data/kapitalisering/kapitaliseringsbekendtgoerelser';
import type { YearlyRate } from '../../data/lovbestemteRates';

// ─── getYearBoundsForYearlyRate ──────────────────────────────────────────────

describe('getYearBoundsForYearlyRate', () => {
  it('tom dict → null', () => {
    expect(getYearBoundsForYearlyRate({})).toBeNull();
  });

  it('single entry → minYear = maxYear', () => {
    const bounds = getYearBoundsForYearlyRate({ 2024: 100 });
    expect(bounds).toEqual({ minYear: 2024, maxYear: 2024 });
  });

  it('multiple entries → korrekte min/max', () => {
    const dict: YearlyRate = { 2020: 100, 2022: 200, 2021: 150 };
    const bounds = getYearBoundsForYearlyRate(dict);
    expect(bounds).toEqual({ minYear: 2020, maxYear: 2022 });
  });

  it('svieSmertePrDag har bounds fra ≤ 2009', () => {
    const bounds = getYearBoundsForYearlyRate(svieSmertePrDag);
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.minYear).toBeLessThanOrEqual(2009);
      expect(bounds.maxYear).toBeGreaterThanOrEqual(2024);
    }
  });
});

// ─── getYearBoundsForCompleteCoverage ────────────────────────────────────────

describe('getYearBoundsForCompleteCoverage', () => {
  it('tom liste → null', () => {
    expect(getYearBoundsForCompleteCoverage([])).toBeNull();
  });

  it('ingen fælles år → null', () => {
    const result = getYearBoundsForCompleteCoverage([
      { 2020: 1 },
      { 2021: 2 },
    ]);
    expect(result).toBeNull();
  });

  it('ét fælles år → bounds med det år', () => {
    const result = getYearBoundsForCompleteCoverage([
      { 2020: 1, 2021: 2 },
      { 2021: 3, 2022: 4 },
    ]);
    expect(result).toEqual({ minYear: 2021, maxYear: 2021 });
  });

  it('overlappende range → intersection', () => {
    const result = getYearBoundsForCompleteCoverage([
      { 2020: 1, 2021: 2, 2022: 3 },
      { 2021: 4, 2022: 5, 2023: 6 },
    ]);
    expect(result).toEqual({ minYear: 2021, maxYear: 2022 });
  });

  it('ét enkelt tomt dict → null (ikke {Infinity, -Infinity})', () => {
    // Loopet løber ikke for et enkelt element; uden fail-closed-værnet ville
    // Math.min/max(...[]) give uendelige bounds i stedet for null.
    expect(getYearBoundsForCompleteCoverage([{}])).toBeNull();
  });
});

// ─── getYearBoundsForAnyCoverage ─────────────────────────────────────────────

describe('getYearBoundsForAnyCoverage', () => {
  it('tom liste → null', () => {
    expect(getYearBoundsForAnyCoverage([])).toBeNull();
  });

  it('alle dicts tomme → null', () => {
    expect(getYearBoundsForAnyCoverage([{}, {}])).toBeNull();
  });

  it('union af år → korrekte min/max', () => {
    const result = getYearBoundsForAnyCoverage([
      { 2020: 1, 2021: 2 },
      { 2023: 3, 2024: 4 },
    ]);
    expect(result).toEqual({ minYear: 2020, maxYear: 2024 });
  });

  it('enkelt dict → bounds fra det dict', () => {
    const result = getYearBoundsForAnyCoverage([{ 2015: 1, 2025: 2 }]);
    expect(result).toEqual({ minYear: 2015, maxYear: 2025 });
  });
});

// ─── svieSmertePrDag integritetcheck ─────────────────────────────────────────

describe('svieSmertePrDag', () => {
  it('alle værdier er positive', () => {
    for (const [, sats] of Object.entries(svieSmertePrDag)) {
      expect(sats).toBeGreaterThan(0);
    }
  });

  it('alle værdier er finite numbers', () => {
    for (const [, sats] of Object.entries(svieSmertePrDag)) {
      expect(Number.isFinite(sats)).toBe(true);
    }
  });

  it('ingen spring i årstallene (konsekutive år)', () => {
    const years = Object.keys(svieSmertePrDag).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < years.length; i++) {
      expect(years[i] - years[i - 1]).toBe(1);
    }
  });

  it('indeholder kendte 2024 sats: 230', () => {
    expect(svieSmertePrDag[2024]).toBe(230);
  });
});

// ─── getSatserForYear ──────────────────────────────────────────────────────────

describe('getSatserForYear', () => {
  describe('kendte satser for 2024', () => {
    it('eal.svieSmertePrDag = 230', () => {
      const satser = getSatserForYear(2024);
      expect(satser.eal.svieSmertePrDag).toBe(230);
    });

    it('eal.svieSmerteMax er et positivt tal', () => {
      const satser = getSatserForYear(2024);
      expect(satser.eal.svieSmerteMax).toBeGreaterThan(0);
    });

    it('asl.varigeMenPrGrad er et positivt tal', () => {
      const satser = getSatserForYear(2024);
      expect(satser.asl.varigeMenPrGrad).toBeGreaterThan(0);
    });

    it('asl.aarsloenAslMax er et positivt tal', () => {
      const satser = getSatserForYear(2024);
      expect(satser.asl.aarsloenAslMax).toBeGreaterThan(0);
    });

    it('referencer.ealReference er en ikke-tom streng', () => {
      const satser = getSatserForYear(2024);
      expect(satser.referencer.ealReference.length).toBeGreaterThan(0);
    });

    it('referencer.aslReference er en ikke-tom streng', () => {
      const satser = getSatserForYear(2024);
      expect(satser.referencer.aslReference.length).toBeGreaterThan(0);
    });
  });

  describe('retsinformation-links', () => {
    it('afleder vist reference-tekst fra samme datasæt som links', () => {
      const satser = getSatserForYear(2024);

      expect(satser.referencer.kapitaliseringSkadeFra2011).toBe('Vejl. 9820/2023 og Vejl. 9376/2024');
    });

    it('returnerer links for 2026-referencer', () => {
      const satser = getSatserForYear(2026);

      expect(satser.referencer.ealReferenceLinks).toEqual([
        { label: 'Bkg. 1428/2025', url: 'https://www.retsinformation.dk/eli/lta/2025/1428' },
      ]);
      expect(satser.referencer.aslReferenceLinks).toEqual([
        { label: 'Vejl. 10058/2025', url: 'https://www.retsinformation.dk/eli/retsinfo/2025/10058' },
      ]);
      expect(satser.referencer.kapitaliseringLinks).toEqual([
        { label: 'Vejl. 10056/2025', url: 'https://www.retsinformation.dk/eli/retsinfo/2025/10056' },
      ]);
      expect(satser.referencer.friProcesReferenceLinks).toEqual([
        { label: 'Bkg. 1360/2025', url: 'https://www.retsinformation.dk/eli/lta/2025/1360' },
      ]);
      expect(satser.referencer.reguleringssatsReferenceLinks).toEqual([
        { label: 'Bkg. 1056/2025', url: 'https://www.retsinformation.dk/eli/lta/2025/1056' },
      ]);
    });

    it('returnerer flere links for kombinerede referencer', () => {
      const satser = getSatserForYear(2024);

      expect(satser.referencer.kapitaliseringSkadeFra2011Links).toEqual([
        { label: 'Vejl. 9820/2023', url: 'https://www.retsinformation.dk/eli/retsinfo/2023/9820' },
        { label: 'Vejl. 9376/2024', url: 'https://www.retsinformation.dk/eli/retsinfo/2024/9376' },
      ]);
    });

    it('returnerer korrekt 2025-url for arbejdsskadesikringsloven', () => {
      const satser = getSatserForYear(2025);

      expect(satser.referencer.aslReferenceLinks).toEqual([
        { label: 'Vejl. 9915/2024', url: 'https://www.retsinformation.dk/eli/retsinfo/2024/9915' },
      ]);
    });
  });

  describe('manglende år → null (for tal) og tom streng (for tekst)', () => {
    it('asl.aarsloenMin er null for 2024 (bevidst udeladt)', () => {
      // aarsloenMin er bevidst ikke sat for 2024 — erstattet af aarsloenMinFoer2024/Fra2024
      const satser = getSatserForYear(2024);
      expect(satser.asl.aarsloenMin).toBeNull();
    });

    it('ukendt år (fx 1800) → alle eal-felter er null', () => {
      const satser = getSatserForYear(1800);
      expect(satser.eal.svieSmertePrDag).toBeNull();
      expect(satser.eal.svieSmerteMax).toBeNull();
      expect(satser.eal.erhvervsevnetabEalMax).toBeNull();
      expect(satser.eal.vejledendeUdtalelseEet).toBeNull();
    });

    it('ukendt år (fx 1800) → referencer er tomme strenge', () => {
      const satser = getSatserForYear(1800);
      expect(satser.referencer.ealReference).toBe('');
      expect(satser.referencer.aslReference).toBe('');
    });

    it('ukendt år → diverse-felter er null', () => {
      const satser = getSatserForYear(1800);
      expect(satser.diverse.friProcesEnlig).toBeNull();
      expect(satser.diverse.reguleringssats).toBeNull();
    });
  });

  describe('returstruktur', () => {
    it('returnerer objekt med eal, asl, diverse, referencer', () => {
      const satser = getSatserForYear(2024);
      expect(satser).toHaveProperty('eal');
      expect(satser).toHaveProperty('asl');
      expect(satser).toHaveProperty('diverse');
      expect(satser).toHaveProperty('referencer');
    });

    it('2024 diverse.reguleringssats er et positivt tal', () => {
      const satser = getSatserForYear(2024);
      expect(satser.diverse.reguleringssats).toBeGreaterThan(0);
    });
  });
});

// ─── getSatserCompleteYearBounds ──────────────────────────────────────────────

describe('getSatserCompleteYearBounds', () => {
  it('returnerer bounds med positivt interval', () => {
    const bounds = getSatserCompleteYearBounds();
    expect(bounds.minYear).toBeLessThan(bounds.maxYear);
  });

  it('minYear er ≥ 2005 (lovens ikrafttrædelse)', () => {
    const bounds = getSatserCompleteYearBounds();
    expect(bounds.minYear).toBeGreaterThanOrEqual(2005);
  });
});

// ─── Eksporterede konstanter ──────────────────────────────────────────────────

describe('satserCompleteYearBounds', () => {
  it('er et gyldigt YearBounds-objekt', () => {
    expect(satserCompleteYearBounds).toHaveProperty('minYear');
    expect(satserCompleteYearBounds).toHaveProperty('maxYear');
    expect(satserCompleteYearBounds.minYear).toBeLessThanOrEqual(satserCompleteYearBounds.maxYear);
  });
});

describe('satserAngivAarYearBounds', () => {
  it('er et gyldigt YearBounds-objekt', () => {
    expect(satserAngivAarYearBounds).toHaveProperty('minYear');
    expect(satserAngivAarYearBounds).toHaveProperty('maxYear');
    expect(satserAngivAarYearBounds.minYear).toBeLessThanOrEqual(satserAngivAarYearBounds.maxYear);
  });

  it('spænder bredere end satserCompleteYearBounds (angivAar er union)', () => {
    // angivAar bruger "any coverage" (union af alle årstal i alle dicts)
    expect(satserAngivAarYearBounds.minYear).toBeLessThanOrEqual(satserCompleteYearBounds.minYear);
    expect(satserAngivAarYearBounds.maxYear).toBeGreaterThanOrEqual(satserCompleteYearBounds.maxYear);
  });
});

describe('eetYearBounds', () => {
  it('maxYear er capped af kapitaliseringsbekendtgørelsernes fælles max-år', () => {
    const expectedMaxYear = Number.parseInt(eetKapitaliseringsDatoMaxFraBekendtgoerelser.slice(0, 4), 10);
    expect(eetYearBounds.maxYear).toBe(expectedMaxYear);
  });
});

describe('varigeMenPrGradYearBounds', () => {
  it('er et gyldigt YearBounds-objekt', () => {
    expect(varigeMenPrGradYearBounds).toHaveProperty('minYear');
    expect(varigeMenPrGradYearBounds).toHaveProperty('maxYear');
    expect(varigeMenPrGradYearBounds.minYear).toBeLessThanOrEqual(varigeMenPrGradYearBounds.maxYear);
  });
});

describe('ASL_MAX_AARSLOEN_2024 invariant', () => {
  it('er udledt af aarsloenAslMax[2024] (én sandhedskilde, ingen drift)', () => {
    expect(ASL_MAX_AARSLOEN_2024).toBe(aarsloenAslMax[2024]);
  });
});

describe('assertAarsloenAslMaxKontinuitet (S6-hul-guard for ASL-regulering)', () => {
  it('den faktiske tabel er sammenhængende (guarden passerer for produktionsdata)', () => {
    expect(() => assertAarsloenAslMaxKontinuitet()).not.toThrow();
  });

  it('accepterer en sammenhængende syntetisk serie', () => {
    expect(() => assertAarsloenAslMaxKontinuitet({ 2020: 1, 2021: 2, 2022: 3 })).not.toThrow();
  });

  it('accepterer et enkelt år og en tom tabel (intet hul muligt)', () => {
    expect(() => assertAarsloenAslMaxKontinuitet({ 2024: 100 })).not.toThrow();
    expect(() => assertAarsloenAslMaxKontinuitet({})).not.toThrow();
  });

  it('fail-closer ved et enkelt manglende år midt i serien', () => {
    // 2021 mangler mellem 2020 og 2022 — ville passere den endepunkts-baserede
    // dækningsvalidering, men få compute-motoren til at kaste for 2021-segmentet.
    expect(() => assertAarsloenAslMaxKontinuitet({ 2020: 1, 2022: 3 })).toThrow(/mangler år 2021/);
  });

  it('fail-closer ved flere manglende år (rapporterer det første hul)', () => {
    expect(() => assertAarsloenAslMaxKontinuitet({ 2018: 1, 2021: 2 })).toThrow(/mangler år 2019/);
  });

  it('behandler et ikke-finit år som et hul (NaN-værdi)', () => {
    expect(() => assertAarsloenAslMaxKontinuitet({ 2020: 1, 2021: Number.NaN, 2022: 3 })).toThrow(/mangler år 2021/);
  });

  it('behandler en 0-værdi som TILSTEDE (et hul er en manglende år-nøgle, ikke en dårlig værdi)', () => {
    // 0 er en dårlig sats (fanges af resolveAslAarsloensmaksimumForAar → undefined),
    // men er IKKE et hul i serien. Kontinuitets-guarden må kun fange manglende år.
    expect(() => assertAarsloenAslMaxKontinuitet({ 2020: 1, 2021: 0, 2022: 3 })).not.toThrow();
  });
});

describe('aarsloenAslMin invariant', () => {
  it('aarsloenAslMin indeholder IKKE 2024 (bevidst erstattet af fra/foer-varianter)', () => {
    expect(aarsloenAslMin[2024]).toBeUndefined();
  });

  it('aarsloenAslMin indeholder gyldige satser for 2023', () => {
    expect(aarsloenAslMin[2023]).toBeGreaterThan(0);
  });
});

// ─── 2024 split-værdier ───────────────────────────────────────────────────────

describe('aarsloenAslMinFoer20240701', () => {
  it('[2024] = 227000', () => {
    expect(aarsloenAslMinFoer20240701[2024]).toBe(227000);
  });

  it('indeholder positive satser', () => {
    for (const [, sats] of Object.entries(aarsloenAslMinFoer20240701)) {
      expect(sats).toBeGreaterThan(0);
    }
  });
});

describe('aarsloenAslMinFra20240701', () => {
  it('[2024] = 257000', () => {
    expect(aarsloenAslMinFra20240701[2024]).toBe(257000);
  });

  it('fra20240701 er større end foer20240701 for 2024', () => {
    expect(aarsloenAslMinFra20240701[2024]).toBeGreaterThan(aarsloenAslMinFoer20240701[2024]!);
  });
});

describe('reguleringsprocentErhvervsevnetabFoer2024', () => {
  it('[2024] = 65.7', () => {
    expect(reguleringsprocentErhvervsevnetabFoer2024[2024]).toBe(65.7);
  });
});

describe('reguleringsprocentErhvervsevnetabFra2024', () => {
  it('[2024] er et finite number', () => {
    expect(Number.isFinite(reguleringsprocentErhvervsevnetabFra2024[2024])).toBe(true);
  });
});

describe('getSatserForYear – 2024 split-felter i asl', () => {
  it('asl.aarsloenMinFoer2024 = 227000', () => {
    const satser = getSatserForYear(2024);
    expect(satser.asl.aarsloenMinFoer2024).toBe(227000);
  });

  it('asl.aarsloenMinFra2024 = 257000', () => {
    const satser = getSatserForYear(2024);
    expect(satser.asl.aarsloenMinFra2024).toBe(257000);
  });

  it('asl.aarsloenMinFra2024 > asl.aarsloenMinFoer2024', () => {
    const satser = getSatserForYear(2024);
    expect(satser.asl.aarsloenMinFra2024!).toBeGreaterThan(satser.asl.aarsloenMinFoer2024!);
  });
});
