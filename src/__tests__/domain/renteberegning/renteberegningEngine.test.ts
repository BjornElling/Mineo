import type { RateEntry } from '../../../data/interestRates';
import { toDanishDateString, toISODateString, isoToDanish } from '../../../types/branded';
import { getDaysInYear, parseDanishDate } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { computeRenteberegning, computeRentekravRow } from '../../../domain/renteberegning/renteberegningEngine';
import {
  calculateProcessInterestBreakdownWithRates,
  calculateProcessInterestWithRates,
} from '../../../domain/renteberegning/procesrenteCalculator';
import { roundByMethod } from '../../../utils/rounding';

const buildRates = (referenceRatePct = 1, surchargeRatePct = 2): { referenceRates: RateEntry[]; surchargeRates: RateEntry[] } => ({
  referenceRates: [{ effectiveDate: toDanishDateString('01-01-2020'), ratePct: referenceRatePct }],
  surchargeRates: [{ effectiveDate: toDanishDateString('01-01-2020'), ratePct: surchargeRatePct }],
});

const amountNumber = (value: number) => ({ kind: 'number' as const, value });

const buildExpectedInterest = (amount: number, start: string, end: string, ratePct: number): number => {
  const startDate = parseDanishDate(start);
  const endDate = parseDanishDate(end);
  if (!startDate || !endDate) {
    throw new Error('Invalid test dates');
  }
  const days = countInclusiveUtcDays(startDate, endDate);
  if (days === null) {
    throw new Error('Invalid date order');
  }
  const daysInYear = getDaysInYear(startDate.getUTCFullYear());
  const interest = (amount * ratePct / 100 * days) / daysInYear;
  return roundByMethod(interest, 2, 'halfAwayFromZero');
};

const normalizeOutput = (rows: ReadonlyArray<{ id: string; actualInterestDate: string | null; calculatedInterest: number | null }>) => {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
};

describe('renteberegningEngine', () => {
  it('computes interest with explicit reference data', () => {
    const { referenceRates, surchargeRates } = buildRates();
    const amount = 1000;
    const startIso = toISODateString('2024-01-01');
    const endIso = toISODateString('2024-01-31');
    const expected = buildExpectedInterest(amount, '01-01-2024', '31-01-2024', 3);

    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato: endIso,
        rentekravRows: [
          {
            id: 'row-1',
            belob: amountNumber(amount),
            renterFra: startIso,
            tillaegstid: 0,
            enhed: 'dage',
          },
        ],
      },
      referenceRates,
      surchargeRates,
    });

    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]).toEqual({
      id: 'row-1',
      actualInterestDate: startIso,
      calculatedInterest: expected,
      periods: [
        {
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-01-31T00:00:00.000Z'),
          amount,
          referenceRatePct: 1,
          surchargeRatePct: 2,
          totalRatePct: 3,
          days: 31,
          interest: 2.540983606557377,
        },
      ],
    });
  });

  it('returns null interest when beregningsdato is missing', () => {
    const { referenceRates, surchargeRates } = buildRates();
    const startIso = toISODateString('2024-01-01');
    const expectedInterestDate = toISODateString('2024-01-11');

    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato: undefined,
        rentekravRows: [
          {
            id: 'row-1',
            belob: amountNumber(1000),
            renterFra: startIso,
            tillaegstid: 10,
            enhed: 'dage',
          },
        ],
      },
      referenceRates,
      surchargeRates,
    });

    expect(output.rows[0]).toEqual({
      id: 'row-1',
      actualInterestDate: expectedInterestDate,
      calculatedInterest: null,
      periods: null,
    });
  });

  it('rounds edge case values deterministically', () => {
    const { referenceRates, surchargeRates } = buildRates(1.83, 0);
    const startIso = toISODateString('2024-01-01');
    const endIso = toISODateString('2024-01-01');

    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato: endIso,
        rentekravRows: [
          {
            id: 'row-1',
            belob: amountNumber(100),
            renterFra: startIso,
            tillaegstid: 0,
            enhed: 'dage',
          },
        ],
      },
      referenceRates,
      surchargeRates,
    });

    expect(output.rows[0].calculatedInterest).toBe(0.01);
  });

  it('is deterministic for identical input snapshots', () => {
    const { referenceRates, surchargeRates } = buildRates();
    const snapshot = {
      renteberegning: {
        beregningsdato: toISODateString('2024-02-01'),
        rentekravRows: [
          {
            id: 'row-1',
            belob: amountNumber(1000),
            renterFra: toISODateString('2024-01-01'),
            tillaegstid: 0,
            enhed: 'dage' as const,
          },
        ],
      },
      referenceRates,
      surchargeRates,
    };

    const cloned = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    const first = computeRenteberegning(snapshot);
    const second = computeRenteberegning(cloned);

    expect(first).toEqual(second);
  });

  it('is order-independent for rentekrav rows', () => {
    const { referenceRates, surchargeRates } = buildRates();
    const startIso = toISODateString('2024-01-01');
    const endIso = toISODateString('2024-02-01');

    const rows = [
      {
        id: 'row-1',
        belob: amountNumber(1000),
        renterFra: startIso,
        tillaegstid: 0,
        enhed: 'dage' as const,
      },
      {
        id: 'row-2',
        belob: amountNumber(500),
        renterFra: startIso,
        tillaegstid: 0,
        enhed: 'dage' as const,
      },
    ];

    const outputA = computeRenteberegning({
      renteberegning: { beregningsdato: endIso, rentekravRows: rows },
      referenceRates,
      surchargeRates,
    });

    const outputB = computeRenteberegning({
      renteberegning: { beregningsdato: endIso, rentekravRows: [...rows].reverse() },
      referenceRates,
      surchargeRates,
    });

    expect(normalizeOutput(outputA.rows)).toEqual(normalizeOutput(outputB.rows));
  });

  it('matches interestCalculator output for same validated dates and rates', () => {
    const { referenceRates, surchargeRates } = buildRates(2.15, 8);
    const renterFra = toISODateString('2024-01-15');
    const beregningsdato = toISODateString('2024-12-31');

    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato,
        rentekravRows: [
          {
            id: 'row-1',
            belob: amountNumber(125000),
            renterFra,
            tillaegstid: 0,
            enhed: 'dage',
          },
        ],
      },
      referenceRates,
      surchargeRates,
    });

    const actualInterestDate = output.rows[0]?.actualInterestDate;
    const actualCalculatedInterest = output.rows[0]?.calculatedInterest;
    expect(actualInterestDate).not.toBeNull();
    expect(actualCalculatedInterest).not.toBeNull();

    const expectedRaw = calculateProcessInterestWithRates(
      125000,
      isoToDanish(actualInterestDate ?? undefined)!,
      isoToDanish(beregningsdato)!,
      referenceRates,
      surchargeRates
    );

    expect(expectedRaw).not.toBeNull();
    expect(actualCalculatedInterest).toBe(roundByMethod(expectedRaw ?? 0, 2, 'halfAwayFromZero'));
  });

  it('returnerer tom rows-array for tom rentekravRows-liste', () => {
    const { referenceRates, surchargeRates } = buildRates();
    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato: toISODateString('2024-12-31'),
        rentekravRows: [],
      },
      referenceRates,
      surchargeRates,
    });
    expect(output.rows).toHaveLength(0);
    expect(output.rows).toEqual([]);
  });

  it('!renterFra med gyldig beregningsdato → actualInterestDate=null, calculatedInterest=null', () => {
    const { referenceRates, surchargeRates } = buildRates();
    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato: toISODateString('2024-12-31'),
        rentekravRows: [
          {
            id: 'row-missing-fra',
            belob: amountNumber(1000),
            renterFra: undefined,
            tillaegstid: 0,
            enhed: 'dage',
          },
        ],
      },
      referenceRates,
      surchargeRates,
    });
    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]).toEqual({
      id: 'row-missing-fra',
      actualInterestDate: null,
      calculatedInterest: null,
      periods: null,
    });
  });

  it('blandet valid/invalid rækker → mixed output (null og beregnet rente)', () => {
    const { referenceRates, surchargeRates } = buildRates();
    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato: toISODateString('2024-12-31'),
        rentekravRows: [
          {
            id: 'valid',
            belob: amountNumber(10000),
            renterFra: toISODateString('2024-01-01'),
            tillaegstid: 0,
            enhed: 'dage',
          },
          {
            id: 'missing-fra',
            belob: amountNumber(5000),
            renterFra: undefined,
            tillaegstid: 0,
            enhed: 'dage',
          },
          {
            id: 'future-fra',
            belob: amountNumber(2000),
            renterFra: toISODateString('2025-06-01'),
            tillaegstid: 0,
            enhed: 'dage',
          },
        ],
      },
      referenceRates,
      surchargeRates,
    });
    expect(output.rows).toHaveLength(3);
    // Gyldig række har beregnet rente
    const validRow = output.rows.find((r) => r.id === 'valid');
    expect(validRow?.calculatedInterest).not.toBeNull();
    expect(validRow?.actualInterestDate).not.toBeNull();
    // Manglende renterFra → null
    const missingFraRow = output.rows.find((r) => r.id === 'missing-fra');
    expect(missingFraRow?.actualInterestDate).toBeNull();
    expect(missingFraRow?.calculatedInterest).toBeNull();
    // Fremtidig renterFra (efter beregningsdato) → calculatedInterest=null (validering fejler)
    const futureRow = output.rows.find((r) => r.id === 'future-fra');
    expect(futureRow?.calculatedInterest).toBeNull();
  });

  describe('computeRentekravRow', () => {
    it('returnerer pdfContext ved gyldig række', () => {
      const { referenceRates, surchargeRates } = buildRates();
      const row = {
        id: 'row-1',
        belob: amountNumber(1250),
        renterFra: toISODateString('2024-01-01'),
        tillaegstid: 10,
        enhed: 'dage' as const,
      };
      const beregningsdato = toISODateString('2024-02-01');

      const result = computeRentekravRow(row, beregningsdato, referenceRates, surchargeRates);

      expect(result.actualInterestDate).toBe(toISODateString('2024-01-11'));
      expect(result.calculatedInterest).not.toBeNull();
      expect(result.pdfContext?.periods).toHaveLength(1);
      expect(result.pdfContext).toEqual({
        beloeb: 1250,
        actualInterestDate: toISODateString('2024-01-11'),
        beregningsdato,
        periods: result.pdfContext?.periods ?? [],
        latestReferenceRateDate: toISODateString('2020-06-30'),
      });
    });

    it('manglende beløb → null rente og ingen pdfContext', () => {
      const { referenceRates, surchargeRates } = buildRates();
      const row = {
        id: 'row-1',
        belob: undefined,
        renterFra: toISODateString('2024-01-01'),
        tillaegstid: 0,
        enhed: 'dage' as const,
      };

      const result = computeRentekravRow(row, toISODateString('2024-01-31'), referenceRates, surchargeRates);

      expect(result.actualInterestDate).toBe(toISODateString('2024-01-01'));
      expect(result.calculatedInterest).toBeNull();
      expect(result.pdfContext).toBeNull();
    });

    it('manglende beregningsdato → actualInterestDate uden beregnet rente', () => {
      const { referenceRates, surchargeRates } = buildRates();
      const row = {
        id: 'row-1',
        belob: amountNumber(1000),
        renterFra: toISODateString('2024-01-01'),
        tillaegstid: 2,
        enhed: 'uger' as const,
      };

      const result = computeRentekravRow(row, undefined, referenceRates, surchargeRates);

      expect(result.actualInterestDate).toBe(toISODateString('2024-01-15'));
      expect(result.calculatedInterest).toBeNull();
      expect(result.pdfContext).toBeNull();
    });

    it('dato før satsdækning → null rente og ingen throw', () => {
      const { referenceRates, surchargeRates } = buildRates();
      const row = {
        id: 'row-1',
        belob: amountNumber(1000),
        renterFra: toISODateString('2004-01-01'),
        tillaegstid: 0,
        enhed: 'dage' as const,
      };

      const result = computeRentekravRow(row, toISODateString('2024-01-31'), referenceRates, surchargeRates);

      expect(result.actualInterestDate).toBe(toISODateString('2004-01-01'));
      expect(result.calculatedInterest).toBeNull();
      expect(result.pdfContext).toBeNull();
    });

    it('manglende satsdata → null rente og ingen throw', () => {
      const row = {
        id: 'row-1',
        belob: amountNumber(1000),
        renterFra: toISODateString('2024-01-01'),
        tillaegstid: 0,
        enhed: 'dage' as const,
      };

      const result = computeRentekravRow(row, toISODateString('2024-01-31'), [], []);

      expect(result.actualInterestDate).toBe(toISODateString('2024-01-01'));
      expect(result.calculatedInterest).toBeNull();
      expect(result.pdfContext).toBeNull();
    });

    it('ugyldig rentedato-beregning → actualInterestDate=null og ingen pdfContext', () => {
      const { referenceRates, surchargeRates } = buildRates();
      const row = {
        id: 'row-1',
        belob: amountNumber(1000),
        renterFra: undefined,
        tillaegstid: 5,
        enhed: 'dage' as const,
      };

      const result = computeRentekravRow(row, toISODateString('2024-01-31'), referenceRates, surchargeRates);

      expect(result.actualInterestDate).toBeNull();
      expect(result.calculatedInterest).toBeNull();
      expect(result.pdfContext).toBeNull();
    });

    it('pdfContext-perioder matcher motor-breakdown og summerer til beregnet rente', () => {
      const referenceRates = [
        { effectiveDate: toDanishDateString('01-01-2013'), ratePct: 2 },
        { effectiveDate: toDanishDateString('01-07-2013'), ratePct: 3 },
        { effectiveDate: toDanishDateString('01-01-2014'), ratePct: 4 },
      ];
      const surchargeRates = [
        { effectiveDate: toDanishDateString('01-01-2010'), ratePct: 7 },
        { effectiveDate: toDanishDateString('01-03-2013'), ratePct: 8 },
      ];
      const row = {
        id: 'row-1',
        belob: amountNumber(100000),
        renterFra: toISODateString('2013-02-15'),
        tillaegstid: 0,
        enhed: 'dage' as const,
      };
      const beregningsdato = toISODateString('2014-01-31');

      const result = computeRentekravRow(row, beregningsdato, referenceRates, surchargeRates);
      expect(result.pdfContext).not.toBeNull();

      const expectedBreakdown = calculateProcessInterestBreakdownWithRates(
        100000,
        '15-02-2013',
        '31-01-2014',
        referenceRates,
        surchargeRates
      );
      expect(expectedBreakdown).not.toBeNull();
      expect(result.pdfContext?.periods).toEqual(expectedBreakdown?.periods);

      const summedPeriods = result.pdfContext?.periods.reduce((sum, period) => sum + period.interest, 0) ?? 0;
      expect(result.calculatedInterest).toBe(roundByMethod(summedPeriods, 2, 'halfAwayFromZero'));
    });
  });

});
