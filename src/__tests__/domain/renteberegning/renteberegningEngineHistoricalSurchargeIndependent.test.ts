import type { RateEntry } from '../../../data/interestRates';
import { computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const referenceRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2010-01-01'), ratePct: 2 },
];

const surchargeRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2010-01-01'), ratePct: 7 },
  { effectiveDate: iso('2013-03-01'), ratePct: 8 },
];

describe('CALC-003 – enginefacit for tillægssatsens historiske skæringsdato', () => {
  it('bruger 8 procent fra 1. marts efter dagtillæg og beregner to rentedage', () => {
    const result = computeRentekravRow(
      {
        id: 'historical-surcharge-boundary',
        belob: { kind: 'number', value: 100_000 },
        renterFra: iso('2013-02-20'),
        tillaegstid: 9,
        enhed: 'dage',
      },
      iso('2013-03-02'),
      referenceRates,
      surchargeRates,
    );

    // 20. februar + 9 dage = 1. marts. 100.000 · 10 % · 2 / 365 = 54,7945205479452...
    expect(result).toEqual({
      actualInterestDate: iso('2013-03-01'),
      calculatedInterest: 54.79,
      pdfContext: {
        beloeb: 100_000,
        actualInterestDate: iso('2013-03-01'),
        beregningsdato: iso('2013-03-02'),
        periods: [
          {
            startDate: new Date('2013-03-01T00:00:00.000Z'),
            endDate: new Date('2013-03-02T00:00:00.000Z'),
            amount: 100_000,
            referenceRatePct: 2,
            surchargeRatePct: 8,
            totalRatePct: 10,
            days: 2,
            interest: 54.794520547945204,
          },
        ],
        latestReferenceRatePeriodEnd: iso('2010-06-30'),
        calculatedInterest: 54.79,
      },
    });
  });
});
