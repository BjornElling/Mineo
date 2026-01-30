import type { RateEntry } from '../../../data/interestRates';
import { toDanishDateString, toISODateString } from '../../../types/branded';
import { parseDanishDate } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { computeRenteberegning } from '../../../domain/renteberegning/renteberegningEngine';

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
  const daysInYear = startDate.getFullYear() % 4 === 0 ? 366 : 365;
  const interest = (amount * ratePct / 100 * days) / daysInYear;
  return Math.round(interest * 100) / 100;
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
});
