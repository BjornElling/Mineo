import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  foersoergertabEalMin,
  overgangsbeloeb,
  reguleringsprocentErhvervsevnetab,
  reguleringssats,
  svieSmerteMax,
  svieSmertePrDag,
  varigeMenPrGrad,
} from '../../data/lovbestemteRates';
import { referenceRates } from '../../data/interestRates';
import {
  statistiskLoenudvikling,
  type StatistiskLoenudvikling,
} from '../../data/statistiskeRates';

/**
 * DATA-001/CALC-001: Uafhængige literal-facit for udvalgte autoritative registre.
 *
 * Forventningerne nedenfor er skrevet direkte efter kilderne og er ikke afledt af
 * produktionsregistre, produktionshelpers eller andre forventningsværdier i Mineo.
 * 2005 og 2015 er historiske mellem- og startpunkter; 2026 er det seneste punkt i
 * den aktuelle EAL/ASL-matrix.
 *
 * EAL-kilder:
 * - https://www.retsinformation.dk/eli/lta/2004/1158
 * - https://www.retsinformation.dk/eli/lta/2014/1185
 * - https://www.retsinformation.dk/eli/lta/2025/1428
 *
 * ASL-kilder:
 * - https://www.retsinformation.dk/eli/lta/2004/1033
 * - https://www.retsinformation.dk/eli/lta/2014/1114
 * - https://www.retsinformation.dk/eli/retsinfo/2025/10058/pdf
 *
 * Varigt mén er angivet pr. procentpoint som den bogførte 100 %-godtgørelse
 * divideret med 100, sådan som proportionalitetsreglen fastsætter.
 */
const lovbestemteFacit = [
  {
    aar: 2005,
    svieSmertePrDag: 145,
    svieSmerteMax: 56000,
    erhvervsevnetabEalMax: 6678500,
    foersoergertabEalMin: 724000,
    varigeMenPrGrad: 6450,
    aarsloenAslMax: 387000,
    overgangsbeloeb: 121500,
    reguleringssats: 2.2,
  },
  {
    aar: 2015,
    svieSmertePrDag: 190,
    svieSmerteMax: 72500,
    erhvervsevnetabEalMax: 8712500,
    foersoergertabEalMin: 932000,
    varigeMenPrGrad: 8300,
    aarsloenAslMax: 498000,
    overgangsbeloeb: 156500,
    reguleringssats: 1.5,
  },
  {
    aar: 2026,
    svieSmertePrDag: 250,
    svieSmerteMax: 96000,
    erhvervsevnetabEalMax: 11582500,
    foersoergertabEalMin: 1239000,
    varigeMenPrGrad: 11035,
    aarsloenAslMax: 662000,
    overgangsbeloeb: 208000,
    reguleringssats: 4.8,
  },
] as const;

const assertYearlyFacit = (
  actual: Readonly<Record<number, number>>,
  year: number,
  expected: number,
): void => {
  expect(actual[year]).toBe(expected);
};

const assertDateFacit = (
  actual: ReadonlyArray<Readonly<{ effectiveDate: string; ratePct: number }>>,
  expected: ReadonlyArray<readonly [date: string, ratePct: number]>,
): void => {
  for (const [date, ratePct] of expected) {
    const entry = actual.find(({ effectiveDate }) => effectiveDate === date);
    expect(entry).toEqual({ effectiveDate: date, ratePct });
  }
};

const assertQuarterFacit = (
  actual: StatistiskLoenudvikling,
  expected: ReadonlyArray<readonly [quarter: string, value: number]>,
): void => {
  for (const [quarter, value] of expected) {
    const entry = actual.indeksvaerdier.find(({ kvartal }) => kvartal === quarter);
    expect(entry?.indeksvaerdi).toBe(value);
  }
};

describe('uafhængig facitmatrix for rate- og satsregistre', () => {
  it('matcher EAL- og ASL-satser ved første, historisk mellemste og seneste endpoint', () => {
    for (const facit of lovbestemteFacit) {
      assertYearlyFacit(svieSmertePrDag, facit.aar, facit.svieSmertePrDag);
      assertYearlyFacit(svieSmerteMax, facit.aar, facit.svieSmerteMax);
      assertYearlyFacit(erhvervsevnetabEalMax, facit.aar, facit.erhvervsevnetabEalMax);
      assertYearlyFacit(foersoergertabEalMin, facit.aar, facit.foersoergertabEalMin);
      assertYearlyFacit(varigeMenPrGrad, facit.aar, facit.varigeMenPrGrad);
      assertYearlyFacit(aarsloenAslMax, facit.aar, facit.aarsloenAslMax);
      assertYearlyFacit(overgangsbeloeb, facit.aar, facit.overgangsbeloeb);
      assertYearlyFacit(reguleringssats, facit.aar, facit.reguleringssats);
    }
  });

  it('matcher EET-reguleringsprocentens første, historiske mellemste og sidste endpoint', () => {
    const facit: ReadonlyArray<readonly [year: number, value: number]> = [
      [2005, 5.5],
      [2015, 35.7],
      [2023, 60.1],
    ];

    for (const [year, value] of facit) {
      assertYearlyFacit(reguleringsprocentErhvervsevnetab, year, value);
    }
  });

  it('matcher Nationalbankens referencesats ved første, historisk mellemste og seneste endpoint', () => {
    // Nationalbankens XML offentliggør skiftedatoer. Mineo gemmer den sats, der
    // gælder på den faste halvårsgrænse, så 2015-01-01 er fortsat 0,20 pct.
    assertDateFacit(referenceRates, [
      ['2026-07-01', 2.0],
      ['2015-01-01', 0.2],
      ['2005-01-01', 2.15],
    ]);
  });

  it('matcher Danmarks Statistiks ILON12- og SBLON2-endepunkter med historiske mellemår', () => {
    const ilon12 = statistiskLoenudvikling.find(({ meta }) => meta.id === 'ILON12');
    const sblon2 = statistiskLoenudvikling.find(({ meta }) => meta.id === 'SBLON2');

    if (!ilon12 || !sblon2) {
      throw new Error('Forventede statistiske lønindeksmodeller mangler');
    }

    // Kilder:
    // - https://api.statbank.dk/v1/data/ILON12/HTML?ERHVERV=TOT&S%C3%86SON=EJS%C3%86SON&Tid=2005K1%2C2015K1%2C2025K4
    // - https://api.statbank.dk/v1/data/SBLON2/HTML?ARBFUNK=TOT&SEKTOR=1000&VARIA1=100&Tid=2016K1%2C2020K1%2C2026K1
    assertQuarterFacit(ilon12, [
      ['2005K1', 100.0],
      ['2015K1', 127.6],
      ['2025K4', 165.2],
    ]);
    assertQuarterFacit(sblon2, [
      ['2016K1', 98.9],
      ['2020K1', 107.4],
      ['2026K1', 129.3],
    ]);
  });
});
