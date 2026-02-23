import { describe, expect, it } from 'vitest';
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
  aarsloenMin,
} from '../../data/regulationRates';
import type { YearlyRate } from '../../data/regulationRates';

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

    it('asl.aarsloenMax er et positivt tal', () => {
      const satser = getSatserForYear(2024);
      expect(satser.asl.aarsloenMax).toBeGreaterThan(0);
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
      expect(satser.eal.erhvervsevnetabMax).toBeNull();
      expect(satser.eal.vejledendeUdtalelse).toBeNull();
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

describe('varigeMenPrGradYearBounds', () => {
  it('er et gyldigt YearBounds-objekt', () => {
    expect(varigeMenPrGradYearBounds).toHaveProperty('minYear');
    expect(varigeMenPrGradYearBounds).toHaveProperty('maxYear');
    expect(varigeMenPrGradYearBounds.minYear).toBeLessThanOrEqual(varigeMenPrGradYearBounds.maxYear);
  });
});

describe('aarsloenMin invariant', () => {
  it('aarsloenMin indeholder IKKE 2024 (bevidst erstattet af fra/foer-varianter)', () => {
    expect(aarsloenMin[2024]).toBeUndefined();
  });

  it('aarsloenMin indeholder gyldige satser for 2023', () => {
    expect(aarsloenMin[2023]).toBeGreaterThan(0);
  });
});
