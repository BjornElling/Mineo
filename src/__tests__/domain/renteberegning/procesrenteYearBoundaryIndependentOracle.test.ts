import type { RateEntry } from '../../../data/interestRates';
import { calculateProcessInterestBreakdownWithRates } from '../../../domain/renteberegning/procesrenteCalculator';
import { toISODateString } from '../../../types/branded';

const rates = (entries: ReadonlyArray<{ date: string; pct: number }>): RateEntry[] =>
  entries.map(({ date, pct }) => ({
    effectiveDate: toISODateString(date),
    ratePct: pct,
  }));

describe('procesrente – uafhængigt årsskiftefacit', () => {
  it('skifter referencesats ved 1. januar og bruger 365/366 årsdage korrekt', () => {
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100_000,
      toISODateString('2023-12-30'),
      toISODateString('2024-01-02'),
      rates([
        { date: '2023-01-01', pct: 2 },
        { date: '2024-01-01', pct: 4 },
      ]),
      rates([{ date: '2020-01-01', pct: 8 }])
    );

    expect(breakdown).not.toBeNull();
    if (breakdown === null) throw new Error('Forventede et procesrente-breakdown');

    expect(breakdown.periods.map((period) => ({
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      referenceRatePct: period.referenceRatePct,
      surchargeRatePct: period.surchargeRatePct,
      totalRatePct: period.totalRatePct,
      days: period.days,
    }))).toEqual([
      {
        startDate: '2023-12-30T00:00:00.000Z',
        endDate: '2023-12-31T00:00:00.000Z',
        referenceRatePct: 2,
        surchargeRatePct: 8,
        totalRatePct: 10,
        days: 2,
      },
      {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-02T00:00:00.000Z',
        referenceRatePct: 4,
        surchargeRatePct: 8,
        totalRatePct: 12,
        days: 2,
      },
    ]);

    // 2023: 100.000 · 10 % · 2 / 365 = 54,7945205479452...
    // 2024: 100.000 · 12 % · 2 / 366 = 65,5737704918033...
    expect(breakdown.periods[0]?.interest).toBeCloseTo(54.7945205479452, 12);
    expect(breakdown.periods[1]?.interest).toBeCloseTo(65.5737704918033, 12);
    expect(breakdown.totalInterest).toBeCloseTo(120.3682910397485, 12);
  });
});
