import type { RateEntry } from '../../../data/interestRates';
import { toDanishDateString, toISODateString } from '../../../types/branded';
import { parseDanishDate } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { computeRenteberegning } from '../../../domain/renteberegning/renteberegningEngine';
import { calculateProcessInterestWithRates } from '../../../utils/interestCalculator';
import { roundByMethod } from '../../../utils/rounding';
import { isoToDanish } from '../../../types/branded';
import { computeRentekravCalculation } from '../../../domain/renteberegning/renteEngine';
import { getInterestRates } from '../../../data/interestRates';

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
  const daysInYear = startDate.getUTCFullYear() % 4 === 0 ? 366 : 365;
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

  it('keeps parity between legacy row-engine and injected-rates engine for same rates', () => {
    const { referenceRates, surchargeRates } = getInterestRates();
    const row = {
      id: 'row-parity',
      belob: amountNumber(87500),
      renterFra: toISODateString('2024-02-10'),
      tillaegstid: 14,
      enhed: 'dage' as const,
    };
    const beregningsdato = toISODateString('2025-01-31');

    const legacy = computeRentekravCalculation(row, beregningsdato);
    const modern = computeRenteberegning({
      renteberegning: { beregningsdato, rentekravRows: [row] },
      referenceRates,
      surchargeRates,
    });

    expect(legacy.context).not.toBeNull();
    expect(modern.rows).toHaveLength(1);

    const legacyContext = legacy.context;
    const modernRow = modern.rows[0];

    if (!legacyContext || !modernRow) {
      throw new Error('Parity-test for rente-engines kræver gyldige beregningsresultater');
    }

    expect(legacyContext.calculatedInterest).not.toBeNull();
    expect(modernRow.calculatedInterest).not.toBeNull();
    expect(modernRow.id).toBe(row.id);
    expect(legacyContext.actualInterestDate).toBe(isoToDanish(modernRow.actualInterestDate ?? undefined));
    expect(legacyContext.calculatedInterest).toBe(modernRow.calculatedInterest);
  });
});
