import type { RateEntry } from '../../../data/interestRates';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import { toISODateString } from '../../../types/branded';

const referenceRates: RateEntry[] = [
  { effectiveDate: toISODateString('2020-01-01'), ratePct: 3 },
];

const surchargeRates: RateEntry[] = [
  { effectiveDate: toISODateString('2020-01-01'), ratePct: 8 },
];

describe('renteberegningEngine – ugentlig tillægstid med selvstændigt facit', () => {
  it('beregner to ugers tillægstid og den efterfølgende seksdages renteperiode', () => {
    const result = computeRentekravRow(
      {
        id: 'row-weekly-unit',
        belob: { kind: 'number', value: 1_000 },
        renterFra: toISODateString('2024-01-01'),
        tillaegstid: 2,
        enhed: 'uger',
      },
      toISODateString('2024-01-20'),
      referenceRates,
      surchargeRates,
    );

    // 1.000 · 11 % · 6 / 366 = 1,8032786885..., afrundet til 1,80 kr.
    expect(result).toEqual({
      actualInterestDate: toISODateString('2024-01-15'),
      calculatedInterest: 1.8,
      pdfContext: {
        beloeb: 1_000,
        actualInterestDate: toISODateString('2024-01-15'),
        beregningsdato: toISODateString('2024-01-20'),
        periods: [
          {
            startDate: new Date('2024-01-15T00:00:00.000Z'),
            endDate: new Date('2024-01-20T00:00:00.000Z'),
            amount: 1_000,
            referenceRatePct: 3,
            surchargeRatePct: 8,
            totalRatePct: 11,
            days: 6,
            interest: 1.8032786885245902,
          },
        ],
        latestReferenceRatePeriodEnd: toISODateString('2020-06-30'),
        calculatedInterest: 1.8,
      },
    });
  });
});
