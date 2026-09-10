import type { RateEntry } from '../../../data/interestRates';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';
import {
  calculateProcessInterestBreakdownWithRates,
} from '../../../domain/renteberegning/procesrenteCalculator';
import { toISODateString } from '../../../types/branded';

/**
 * Lille rate-builder til testinput. Forventningerne nedenfor er ikke afledt
 * af produktionsdato- eller dagtællingskode, men er faste håndberegnede facit.
 */
const rates = (entries: ReadonlyArray<{ date: string; pct: number }>): RateEntry[] =>
  entries.map(({ date, pct }) => ({
    effectiveDate: toISODateString(date),
    ratePct: pct,
  }));

const periodFacit = (period: ProcessInterestPeriod) => ({
  startDate: period.startDate.toISOString(),
  endDate: period.endDate.toISOString(),
  amount: period.amount,
  referenceRatePct: period.referenceRatePct,
  surchargeRatePct: period.surchargeRatePct,
  totalRatePct: period.totalRatePct,
  days: period.days,
});

describe('procesrente – uafhængigt facit for kalendergrænser', () => {
  it('deler 30. juni og 1. juli i to inklusive perioder', () => {
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2020-06-30'),
      toISODateString('2020-07-01'),
      rates([
        { date: '2020-01-01', pct: 2 },
        { date: '2020-07-01', pct: 4 },
      ]),
      rates([{ date: '2010-01-01', pct: 8 }])
    );

    expect(breakdown).not.toBeNull();
    if (!breakdown) throw new Error('Forventede et procesrente-breakdown');

    expect(breakdown.periods.map(periodFacit)).toEqual([
      {
        startDate: '2020-06-30T00:00:00.000Z',
        endDate: '2020-06-30T00:00:00.000Z',
        amount: 100000,
        referenceRatePct: 2,
        surchargeRatePct: 8,
        totalRatePct: 10,
        days: 1,
      },
      {
        startDate: '2020-07-01T00:00:00.000Z',
        endDate: '2020-07-01T00:00:00.000Z',
        amount: 100000,
        referenceRatePct: 4,
        surchargeRatePct: 8,
        totalRatePct: 12,
        days: 1,
      },
    ]);

    // 2020 er skudår: 100000 · 10 % · 1 / 366 = 27,3224043715847...
    expect(breakdown.periods[0]?.interest).toBeCloseTo(27.3224043715847, 12);
    // 2020 er skudår: 100000 · 12 % · 1 / 366 = 32,7868852459016...
    expect(breakdown.periods[1]?.interest).toBeCloseTo(32.7868852459016, 12);
    expect(breakdown.totalInterest).toBeCloseTo(60.1092896174863, 12);
  });

  it('deler 31. december og 1. januar efter kalenderåret', () => {
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2020-12-31'),
      toISODateString('2021-01-01'),
      rates([
        { date: '2020-01-01', pct: 3 },
        { date: '2021-01-01', pct: 5 },
      ]),
      rates([{ date: '2010-01-01', pct: 8 }])
    );

    expect(breakdown).not.toBeNull();
    if (!breakdown) throw new Error('Forventede et procesrente-breakdown');

    expect(breakdown.periods.map(periodFacit)).toEqual([
      {
        startDate: '2020-12-31T00:00:00.000Z',
        endDate: '2020-12-31T00:00:00.000Z',
        amount: 100000,
        referenceRatePct: 3,
        surchargeRatePct: 8,
        totalRatePct: 11,
        days: 1,
      },
      {
        startDate: '2021-01-01T00:00:00.000Z',
        endDate: '2021-01-01T00:00:00.000Z',
        amount: 100000,
        referenceRatePct: 5,
        surchargeRatePct: 8,
        totalRatePct: 13,
        days: 1,
      },
    ]);

    // 2020 er skudår: 100000 · 11 % · 1 / 366 = 30,0546448087432...
    expect(breakdown.periods[0]?.interest).toBeCloseTo(30.0546448087432, 12);
    // 2021 har 365 dage: 100000 · 13 % · 1 / 365 = 35,6164383561644...
    expect(breakdown.periods[1]?.interest).toBeCloseTo(35.6164383561644, 12);
    expect(breakdown.totalInterest).toBeCloseTo(65.6710831649076, 12);
  });

  it('tæller 28. februar og 1. marts 2013 inklusivt og bruger 7 procent fra rentedatoen', () => {
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2013-02-28'),
      toISODateString('2013-03-01'),
      rates([{ date: '2013-01-01', pct: 2 }]),
      rates([
        { date: '2010-01-01', pct: 7 },
        { date: '2013-03-01', pct: 8 },
      ])
    );

    expect(breakdown).not.toBeNull();
    if (!breakdown) throw new Error('Forventede et procesrente-breakdown');

    expect(breakdown.periods.map(periodFacit)).toEqual([
      {
        startDate: '2013-02-28T00:00:00.000Z',
        endDate: '2013-03-01T00:00:00.000Z',
        amount: 100000,
        referenceRatePct: 2,
        surchargeRatePct: 7,
        totalRatePct: 9,
        days: 2,
      },
    ]);

    // 2013 er ikke skudår: 100000 · 9 % · 2 / 365 = 49,3150684931507...
    expect(breakdown.periods[0]?.interest).toBeCloseTo(49.3150684931507, 12);
    expect(breakdown.totalInterest).toBeCloseTo(49.3150684931507, 12);
  });
});
