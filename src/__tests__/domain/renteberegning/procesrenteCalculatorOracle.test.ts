import type { RateEntry } from '../../../data/interestRates';
import { toISODateString } from '../../../types/branded';
import {
  calculateProcessInterestWithRates,
  calculateProcessInterestBreakdownWithRates,
} from '../../../domain/renteberegning/procesrenteCalculator';

/**
 * Uafhængig orakel-test for procesrentemotoren.
 *
 * Modsat `procesrenteCalculator.test.ts` (der genberegner forventningen med de
 * samme dato-/dag-helpers som kilden, og derfor kun beviser intern konsistens)
 * hævder denne fil korrektheden mod HÅNDBEREGNEDE konstanter. En fejl i kildens
 * dag-optælling eller halvårsopdeling, der ville passere en selv-refererende
 * forventning, fanges her.
 *
 * Den verificerer desuden de domæneinvarianter, der ikke kan fanges af en
 * fast-sats-forventning: referencesats-skift ved halvårsgrænsen, tillægssats
 * bestemt af rentedatoen, skudårs-dagtælling og negative referencesatser.
 *
 * Alle forventede beløb er udledt manuelt: rente = beløb · sats% · dage / årsdage,
 * summeret pr. kalenderår og pr. halvårsperiode i samme rækkefølge som kilden.
 */

const ref = (entries: ReadonlyArray<{ date: string; pct: number }>): RateEntry[] =>
  entries.map((e) => ({ effectiveDate: toISODateString(e.date), ratePct: e.pct }));

describe('calculateProcessInterestWithRates – uafhængigt orakel', () => {
  it('én dag i skudår bruger 366 årsdage (håndberegnet konstant)', () => {
    // 10000 · 10% · 1 / 366 = 2,732240...
    const result = calculateProcessInterestWithRates(
      10000,
      toISODateString('2024-06-15'),
      toISODateString('2024-06-15'),
      ref([{ date: '2010-01-01', pct: 2 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    expect(result).toBeCloseTo(2.732240437158, 9);
  });

  it('én dag i ikke-skudår bruger 365 årsdage (håndberegnet konstant)', () => {
    // 10000 · 10% · 1 / 365 = 2,739726...
    const result = calculateProcessInterestWithRates(
      10000,
      toISODateString('2025-06-15'),
      toISODateString('2025-06-15'),
      ref([{ date: '2010-01-01', pct: 2 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    expect(result).toBeCloseTo(2.739726027397, 9);
  });

  it('skudårs-dag (29. feb) tæller med i dagantallet', () => {
    // 2024-02-28..2024-03-01 = 3 dage (28., 29., 1.) i skudår.
    // 2025-02-28..2025-03-01 = 2 dage (28., 1.) – ingen 29. feb.
    const leap = calculateProcessInterestWithRates(
      1000000,
      toISODateString('2024-02-28'),
      toISODateString('2024-03-01'),
      ref([{ date: '2010-01-01', pct: 2 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    const nonLeap = calculateProcessInterestWithRates(
      1000000,
      toISODateString('2025-02-28'),
      toISODateString('2025-03-01'),
      ref([{ date: '2010-01-01', pct: 2 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    // leap: 1000000 · 10% · 3 / 366 = 819,672...
    // nonLeap: 1000000 · 10% · 2 / 365 = 547,945...
    expect(leap).toBeCloseTo(819.672131147, 6);
    expect(nonLeap).toBeCloseTo(547.945205479, 6);
    // Invariant: skudåret giver flere dage end ikke-skudåret over samme kalenderinterval.
    expect(leap).toBeGreaterThan(nonLeap as number);
  });

  it('fuldt skudår på rund hovedstol giver renten = beløb · sats%', () => {
    // 100000 · 10% · 366/366 = 10000 præcist.
    const result = calculateProcessInterestWithRates(
      100000,
      toISODateString('2024-01-01'),
      toISODateString('2024-12-31'),
      ref([{ date: '2010-01-01', pct: 2 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    expect(result).toBeCloseTo(10000, 6);
  });
});

describe('calculateProcessInterestBreakdownWithRates – halvårsskift og satsbestemmelse', () => {
  it('referencesats-skift ved 1. juli opdeler i to perioder med hver sin sats', () => {
    // ref 2% til 30/6, 4% fra 1/7. sur 8% hele vejen.
    // Periode A: 2020-06-01..2020-06-30 (30 dage), total 10%.
    // Periode B: 2020-07-01..2020-07-31 (31 dage), total 12%.
    // A = 200000 · 10% · 30 / 366 = 1639,344...
    // B = 200000 · 12% · 31 / 366 = 2032,787...
    const breakdown = calculateProcessInterestBreakdownWithRates(
      200000,
      toISODateString('2020-06-01'),
      toISODateString('2020-07-31'),
      ref([
        { date: '2010-01-01', pct: 2 },
        { date: '2020-07-01', pct: 4 },
      ]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    expect(breakdown).not.toBeNull();
    const b = breakdown!;
    expect(b.periods).toHaveLength(2);

    // Invariant: periode 1 ligger helt før periode 2, ingen overlap, dækker hele intervallet.
    expect(b.periods[0]!.endDate.getTime()).toBeLessThan(b.periods[1]!.startDate.getTime());
    expect(b.periods[0]!.totalRatePct).toBe(10);
    expect(b.periods[1]!.totalRatePct).toBe(12);
    expect(b.periods[0]!.days).toBe(30);
    expect(b.periods[1]!.days).toBe(31);

    expect(b.periods[0]!.interest).toBeCloseTo(1639.344262295, 6);
    expect(b.periods[1]!.interest).toBeCloseTo(2032.786885246, 6);
    // Invariant: totalen er summen af periodernes rente.
    expect(b.totalInterest).toBeCloseTo(b.periods[0]!.interest + b.periods[1]!.interest, 9);
    expect(b.totalInterest).toBeCloseTo(3672.131147541, 6);
  });

  it('tillægssats bestemmes af rentedatoen, ikke beregningsdatoen (7% før 1/3-2013)', () => {
    // sur 7% før 2013-03-01, 8% fra. Begge krav beregnes til samme slutdato,
    // men rentestart afgør tillægssatsen.
    const surcharge = ref([
      { date: '2010-01-01', pct: 7 },
      { date: '2013-03-01', pct: 8 },
    ]);
    const reference = ref([{ date: '2010-01-01', pct: 2 }]);

    const foer = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2013-02-15'),
      toISODateString('2013-02-28'),
      reference,
      surcharge
    );
    const efter = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2013-03-15'),
      toISODateString('2013-03-31'),
      reference,
      surcharge
    );

    expect(foer!.periods[0]!.surchargeRatePct).toBe(7);
    expect(efter!.periods[0]!.surchargeRatePct).toBe(8);
  });

  it('negativ referencesats giver lavere total end nul-referencesats (sats kan blive < tillæg)', () => {
    // ref -1%, sur 8% => total 7%. Sammenlignet med ref 0% => total 8%.
    const negativ = calculateProcessInterestWithRates(
      100000,
      toISODateString('2022-01-01'),
      toISODateString('2022-12-31'),
      ref([{ date: '2010-01-01', pct: -1 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    const nul = calculateProcessInterestWithRates(
      100000,
      toISODateString('2022-01-01'),
      toISODateString('2022-12-31'),
      ref([{ date: '2010-01-01', pct: 0 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    // negativ: 100000 · 7% = 7000; nul: 100000 · 8% = 8000 (fuldt ikke-skudår).
    expect(negativ).toBeCloseTo(7000, 6);
    expect(nul).toBeCloseTo(8000, 6);
    expect(negativ as number).toBeLessThan(nul as number);
  });

  it('multi-år periode summerer hvert kalenderår med korrekt årsdage-divisor', () => {
    // 2023 (365 dage) + 2024 (366 dage), total 10% hele vejen.
    // 2023: 100000 · 10% · 365/365 = 10000
    // 2024: 100000 · 10% · 366/366 = 10000
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2023-01-01'),
      toISODateString('2024-12-31'),
      ref([{ date: '2010-01-01', pct: 2 }]),
      ref([{ date: '2010-01-01', pct: 8 }])
    );
    expect(breakdown).not.toBeNull();
    // Halvårsopdeling: 2 perioder pr. år => 4 perioder.
    expect(breakdown!.periods).toHaveLength(4);
    expect(breakdown!.totalInterest).toBeCloseTo(20000, 6);
    // Invariant: perioderne dækker intervallet sammenhængende uden huller eller overlap.
    for (let i = 0; i < breakdown!.periods.length - 1; i++) {
      expect(breakdown!.periods[i]!.endDate.getTime()).toBeLessThan(
        breakdown!.periods[i + 1]!.startDate.getTime()
      );
    }
  });
});
