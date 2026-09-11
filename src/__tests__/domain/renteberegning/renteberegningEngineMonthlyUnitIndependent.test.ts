import type { RateEntry } from '../../../data/interestRates';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import { toISODateString } from '../../../types/branded';

const referenceRates: RateEntry[] = [
  { effectiveDate: toISODateString('2020-01-01'), ratePct: 3 },
];

const surchargeRates: RateEntry[] = [
  { effectiveDate: toISODateString('2020-01-01'), ratePct: 8 },
];

describe('renteberegningEngine – månedlig tillægstid med selvstændigt facit', () => {
  it('clamper 31. januar 2024 til 29. februar og beregner engine-outputtet', () => {
    const result = computeRentekravRow(
      {
        id: 'row-month-clamp',
        belob: { kind: 'number', value: 1_000 },
        renterFra: toISODateString('2024-01-31'),
        tillaegstid: 1,
        enhed: 'maaneder',
      },
      toISODateString('2024-03-01'),
      referenceRates,
      surchargeRates,
    );

    // 1.000 · 11 % · 2 / 366 = 0,601092896..., afrundet til 0,60 kr.
    expect(result).toEqual({
      actualInterestDate: toISODateString('2024-02-29'),
      calculatedInterest: 0.6,
      pdfContext: {
        beloeb: 1_000,
        actualInterestDate: toISODateString('2024-02-29'),
        beregningsdato: toISODateString('2024-03-01'),
        periods: [
          {
            startDate: new Date('2024-02-29T00:00:00.000Z'),
            endDate: new Date('2024-03-01T00:00:00.000Z'),
            amount: 1_000,
            referenceRatePct: 3,
            surchargeRatePct: 8,
            totalRatePct: 11,
            days: 2,
            interest: 0.6010928961748634,
          },
        ],
        latestReferenceRatePeriodEnd: toISODateString('2020-06-30'),
        calculatedInterest: 0.6,
      },
    });
  });
});
