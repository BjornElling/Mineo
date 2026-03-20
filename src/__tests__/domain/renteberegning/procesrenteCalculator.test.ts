import type { RateEntry } from '../../../data/interestRates';
import { toDanishDateString } from '../../../types/branded';
import { calculateProcessInterestWithRates } from '../../../domain/renteberegning/procesrenteCalculator';

// ─── calculateProcessInterestWithRates — null-paths og edge cases ────────────

const buildMinimalRates = (): { ref: RateEntry[]; sur: RateEntry[] } => ({
  ref: [{ effectiveDate: toDanishDateString('01-01-2010'), ratePct: 2 }],
  sur: [{ effectiveDate: toDanishDateString('01-01-2010'), ratePct: 8 }],
});

// Omgå branded-type-validering for null-path tests — parseDanishDate tager 'DanishDateString | string'
// men calculateProcessInterestWithRates tager DanishDateString; vi caster til at teste null-paths.
const badDate = 'not-a-date' as unknown as Parameters<typeof calculateProcessInterestWithRates>[0];

describe('calculateProcessInterestWithRates — null-paths', () => {
  it('ugyldig startdato (ikke-parseable) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      badDate,
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('ugyldig slutdato (ikke-parseable) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      toDanishDateString('01-01-2024'),
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
      toDanishDateString('31-12-2024'),
      toDanishDateString('01-01-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('non-finite beløb (Infinity) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      Number.POSITIVE_INFINITY,
      toDanishDateString('01-01-2024'),
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('non-finite beløb (NaN) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      Number.NaN,
      toDanishDateString('01-01-2024'),
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('startDate === endDate → ikke null (én dags rente)', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      10000,
      toDanishDateString('15-06-2024'),
      toDanishDateString('15-06-2024'),
      ref,
      sur
    );
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it('multi-år periode krydser halvårsskift og årsgrænse', () => {
    const { ref, sur } = buildMinimalRates();
    // Jan 2023 → Dec 2024: krydser 1 juli, 1 jan og 1 juli
    const result = calculateProcessInterestWithRates(
      100000,
      toDanishDateString('01-01-2023'),
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });
});
