import type { ISODateString } from '../../../types/branded';
import { calculateKalenderdageInclusive, calculateTafAntalMaaneder, calculateTafAntalMaanederPraecis } from '../../../domain/erstatningsopgoerelse/engines/tafCalculations';

const iso = (value: string): ISODateString => value as ISODateString;

describe('calculateKalenderdageInclusive', () => {
  it('counts inclusive days across DST', () => {
    expect(calculateKalenderdageInclusive(iso('2024-01-26'), iso('2024-10-20'))).toBe(269);
  });

  it('counts inclusive days across DST start', () => {
    expect(calculateKalenderdageInclusive(iso('2024-03-30'), iso('2024-04-02'))).toBe(4);
  });

  it('counts inclusive days across DST end', () => {
    expect(calculateKalenderdageInclusive(iso('2024-10-26'), iso('2024-10-28'))).toBe(3);
  });

  it('counts inclusive days without DST crossing', () => {
    expect(calculateKalenderdageInclusive(iso('2024-02-10'), iso('2024-02-12'))).toBe(3);
  });

  it('counts a single day as 1', () => {
    expect(calculateKalenderdageInclusive(iso('2024-02-01'), iso('2024-02-01'))).toBe(1);
  });

  it('returns null for reversed ranges', () => {
    expect(calculateKalenderdageInclusive(iso('2024-02-02'), iso('2024-02-01'))).toBeNull();
  });
});

describe('calculateTafAntalMaaneder', () => {
  it('is DST-neutral and inclusive across month boundaries', () => {
    const months = calculateTafAntalMaaneder(iso('2024-03-30'), iso('2024-04-02'), 0);
    expect(months).toBe(0.13);
  });

  it('returns full month when there are no øvrige fraværsdage', () => {
    const months = calculateTafAntalMaaneder(iso('2024-01-01'), iso('2024-01-31'), 0);
    expect(months).toBe(1);
  });

  it('subtracts only øvrigt fravær uden løn (4.8% per day) for month-based beregningsgrundlag', () => {
    const months = calculateTafAntalMaaneder(iso('2024-01-01'), iso('2024-01-31'), 1);
    expect(months).toBe(0.95);
  });

  it('returnerer null ved undefined fra-dato', () => {
    expect(calculateTafAntalMaaneder(undefined, iso('2024-01-31'), 0)).toBeNull();
  });

  it('returnerer null ved undefined til-dato', () => {
    expect(calculateTafAntalMaaneder(iso('2024-01-01'), undefined, 0)).toBeNull();
  });
});

// ─── calculateTafAntalMaanederPraecis ─────────────────────────────────────────

describe('calculateTafAntalMaanederPraecis', () => {
  it('returnerer ikke-afrundet brøkdel (modsat calculateTafAntalMaaneder)', () => {
    // 4 dage i jan (31 dage i måneden) = 4/31 ≈ 0.12903...
    // calculateTafAntalMaaneder afrunder til 2 decimaler → 0.13
    // calculateTafAntalMaanederPraecis returnerer rå fraktion
    const praecis = calculateTafAntalMaanederPraecis(iso('2024-01-01'), iso('2024-01-04'), 0);
    expect(praecis).not.toBeNull();
    if (praecis === null) return;
    // Rå fraktion er IKKE afrundet
    expect(praecis).toBeCloseTo(4 / 31, 5);
    // Og afviger fra det afrundede resultat
    const afrundet = calculateTafAntalMaaneder(iso('2024-01-01'), iso('2024-01-04'), 0);
    expect(praecis).not.toBe(afrundet);
  });

  it('returnerer null ved undefined fra-dato', () => {
    expect(calculateTafAntalMaanederPraecis(undefined, iso('2024-01-31'), 0)).toBeNull();
  });

  it('returnerer null ved undefined til-dato', () => {
    expect(calculateTafAntalMaanederPraecis(iso('2024-01-01'), undefined, 0)).toBeNull();
  });

  it('fuld måned januar → 1.0 præcist', () => {
    const result = calculateTafAntalMaanederPraecis(iso('2024-01-01'), iso('2024-01-31'), 0);
    expect(result).toBe(1);
  });
});
