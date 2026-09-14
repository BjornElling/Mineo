import type { RateEntry } from '../../../data/interestRates';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const referenceRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2024-01-01'), ratePct: 3.75 },
  { effectiveDate: iso('2024-07-01'), ratePct: 3.5 },
];

const surchargeRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2010-01-01'), ratePct: 8 },
];

describe('CALC-003 – uafhængigt facit for dagtillæg ved satsskift', () => {
  it('lander på 30. juni og deler renten korrekt ved 1. juli', () => {
    const result = computeRentekravRow(
      {
        id: 'day-rate-boundary',
        belob: { kind: 'number', value: 100_000 },
        renterFra: iso('2024-06-25'),
        tillaegstid: 5,
        enhed: 'dage',
      },
      iso('2024-07-02'),
      referenceRates,
      surchargeRates,
    );

    expect(result.actualInterestDate).toBe(iso('2024-06-30'));
    expect(result.calculatedInterest).toBe(94.94);
    expect(result.pdfContext?.periods.map((period) => ({
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      referenceRatePct: period.referenceRatePct,
      surchargeRatePct: period.surchargeRatePct,
      totalRatePct: period.totalRatePct,
      days: period.days,
    }))).toEqual([
      {
        startDate: '2024-06-30T00:00:00.000Z',
        endDate: '2024-06-30T00:00:00.000Z',
        referenceRatePct: 3.75,
        surchargeRatePct: 8,
        totalRatePct: 11.75,
        days: 1,
      },
      {
        startDate: '2024-07-01T00:00:00.000Z',
        endDate: '2024-07-02T00:00:00.000Z',
        referenceRatePct: 3.5,
        surchargeRatePct: 8,
        totalRatePct: 11.5,
        days: 2,
      },
    ]);

    // 100.000 · 11,75 % · 1 / 366 = 32,10382513661202...
    // 100.000 · 11,50 % · 2 / 366 = 62,84153005464481...
    expect(result.pdfContext?.periods[0]?.interest).toBeCloseTo(32.10382513661202, 12);
    expect(result.pdfContext?.periods[1]?.interest).toBeCloseTo(62.84153005464481, 12);
  });
});
