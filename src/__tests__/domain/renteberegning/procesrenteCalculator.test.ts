import type { RateEntry } from '../../../data/interestRates';
import { toISODateString, parseISODate } from '../../../types/branded';
import {
  calculateProcessInterestBreakdownWithRates,
  calculateProcessInterestWithRates,
  findLatestReferenceRatePeriodEnd,
} from '../../../domain/renteberegning/procesrenteCalculator';
import { getDaysInYear } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';

// ─── calculateProcessInterestWithRates – null-paths og edge cases ────────────

const buildMinimalRates = (): { ref: RateEntry[]; sur: RateEntry[] } => ({
  ref: [{ effectiveDate: toISODateString('2010-01-01'), ratePct: 2 }],
  sur: [{ effectiveDate: toISODateString('2010-01-01'), ratePct: 8 }],
});

const buildExpectedInterest = (amount: number, start: string, end: string, ratePct: number): number => {
  const startDate = parseISODate(toISODateString(start));
  const endDate = parseISODate(toISODateString(end));
  if (!startDate || !endDate) {
    throw new Error('Invalid test dates');
  }
  const days = countInclusiveUtcDays(startDate, endDate);
  if (days === null) {
    throw new Error('Invalid date order');
  }

  return (amount * ratePct / 100 * days) / getDaysInYear(startDate.getUTCFullYear());
};

// Omgå branded-type-validering for null-path tests – calculateProcessInterestWithRates
// tager ISODateString; vi caster en ugyldig streng for at teste null-paths.
const badDate = 'not-a-date' as unknown as Parameters<typeof calculateProcessInterestWithRates>[1];

describe('calculateProcessInterestWithRates – null-paths', () => {
  it.each([
    ['2024-01-01', '2024-06-30'],
    ['2024-07-01', '2024-12-31'],
  ])('udleder halvårets dækningsslutning for en sats der træder i kraft %s', (effectiveDate, expectedEnd) => {
    expect(findLatestReferenceRatePeriodEnd([
      { effectiveDate: toISODateString(effectiveDate), ratePct: 2 },
    ])).toEqual(parseISODate(toISODateString(expectedEnd)));
  });

  it('ugyldig startdato (ikke-parseable) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      badDate,
      toISODateString('2024-12-31'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('ugyldig slutdato (ikke-parseable) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      toISODateString('2024-01-01'),
      badDate,
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('startDate > endDate → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      toISODateString('2024-12-31'),
      toISODateString('2024-01-01'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('non-finite beløb (Infinity) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      Number.POSITIVE_INFINITY,
      toISODateString('2024-01-01'),
      toISODateString('2024-12-31'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('non-finite beløb (NaN) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      Number.NaN,
      toISODateString('2024-01-01'),
      toISODateString('2024-12-31'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('tomt satsgrundlag → null', () => {
    const result = calculateProcessInterestWithRates(
      1000,
      toISODateString('2024-01-01'),
      toISODateString('2024-01-31'),
      [],
      []
    );
    expect(result).toBeNull();
  });

  it('startdato før første referencesats → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      toISODateString('2009-01-01'),
      toISODateString('2009-01-31'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('startDate === endDate → ikke null (én dags rente)', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      10000,
      toISODateString('2024-06-15'),
      toISODateString('2024-06-15'),
      ref,
      sur
    );
    expect(result).toBe(buildExpectedInterest(10000, '2024-06-15', '2024-06-15', 10));
  });

  it('multi-år periode krydser halvårsskift og årsgrænse', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      100000,
      toISODateString('2023-01-01'),
      toISODateString('2024-12-31'),
      ref,
      sur
    );
    const expected2023 = buildExpectedInterest(100000, '2023-01-01', '2023-12-31', 10);
    const expected2024 = buildExpectedInterest(100000, '2024-01-01', '2024-12-31', 10);
    expect(result).toBe(expected2023 + expected2024);
  });

  it('dato før tilgængelige satser → null uden exception', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      toISODateString('2009-01-01'),
      toISODateString('2009-01-31'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('tomme satstabeller → null uden exception', () => {
    const result = calculateProcessInterestWithRates(
      1000,
      toISODateString('2024-01-01'),
      toISODateString('2024-01-31'),
      [],
      []
    );
    expect(result).toBeNull();
  });
});

// ─── Satsvalg: to satser, to regler (renteberegning-contract.md §2.10) ───────
//
// Referencesatsen er periodisk (slås op pr. halvårsstart), mens tillægssatsen fastlægges ÉN gang
// ud fra kravets rentedato og gælder hele beregningen. De to regler er bevidst forskellige og har
// givet forkerte brugervendte tekster før (BB-092/BB-093), så de er hævdet her.

describe('calculateProcessInterestBreakdownWithRates – satsvalg pr. krav', () => {
  const rates = {
    ref: [
      { effectiveDate: toISODateString('2013-01-01'), ratePct: 0.2 },
      { effectiveDate: toISODateString('2013-07-01'), ratePct: 0.3 },
    ],
    sur: [
      { effectiveDate: toISODateString('2002-08-01'), ratePct: 7 },
      { effectiveDate: toISODateString('2013-03-01'), ratePct: 8 },
    ],
  };

  it('låser tillægssatsen til rentedatoen for hele beregningen, også for perioder efter satsskiftet', () => {
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2013-02-01'),
      toISODateString('2013-12-31'),
      rates.ref,
      rates.sur
    );

    expect(breakdown).not.toBeNull();
    // Begge halvår – også 01-07-2013–31-12-2013, som ligger efter tillægssatsens 01-03-2013.
    expect(breakdown?.periods.map((period) => period.surchargeRatePct)).toEqual([7, 7]);
  });

  it('lader referencesatsen skifte ved halvårsskiftet inde i samme beregning', () => {
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2013-02-01'),
      toISODateString('2013-12-31'),
      rates.ref,
      rates.sur
    );

    expect(breakdown?.periods.map((period) => period.referenceRatePct)).toEqual([0.2, 0.3]);
    expect(breakdown?.periods.map((period) => period.totalRatePct)).toEqual([7.2, 7.3]);
  });

  it('vælger den nye tillægssats, når rentedatoen selv ligger efter satsskiftet', () => {
    const breakdown = calculateProcessInterestBreakdownWithRates(
      100000,
      toISODateString('2013-03-22'),
      toISODateString('2013-12-31'),
      rates.ref,
      rates.sur
    );

    expect(breakdown?.periods.map((period) => period.surchargeRatePct)).toEqual([8, 8]);
  });
});
