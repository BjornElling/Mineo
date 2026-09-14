import type { RateEntry } from '../../../data/interestRates';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const referenceRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2024-07-01'), ratePct: 3.5 },
];

const surchargeRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2010-01-01'), ratePct: 8 },
];

describe('CALC-003 – uafhængigt enginefacit for juli-december-dækning', () => {
  it('giver 31. december som seneste referencesatsperiodes slutdato', () => {
    const result = computeRentekravRow(
      {
        id: 'latest-rate-july-period',
        belob: { kind: 'number', value: 100_000 },
        renterFra: iso('2024-07-01'),
        tillaegstid: 0,
        enhed: 'dage',
      },
      iso('2024-07-02'),
      referenceRates,
      surchargeRates,
    );

    // 100.000 · 11,5 % · 2 / 366 = 62,84153005464481..., afrundet til 62,84 kr.
    expect(result).toEqual({
      actualInterestDate: iso('2024-07-01'),
      calculatedInterest: 62.84,
      pdfContext: {
        beloeb: 100_000,
        actualInterestDate: iso('2024-07-01'),
        beregningsdato: iso('2024-07-02'),
        periods: [
          {
            startDate: new Date('2024-07-01T00:00:00.000Z'),
            endDate: new Date('2024-07-02T00:00:00.000Z'),
            amount: 100_000,
            referenceRatePct: 3.5,
            surchargeRatePct: 8,
            totalRatePct: 11.5,
            days: 2,
            interest: 62.84153005464481,
          },
        ],
        latestReferenceRatePeriodEnd: iso('2024-12-31'),
        calculatedInterest: 62.84,
      },
    });
  });
});
