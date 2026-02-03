import type { ISODateString } from '../../../types/branded';
import { calculateKalenderdageInclusive, calculateTafAntalMaaneder } from '../tafCalculations';

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
    const months = calculateTafAntalMaaneder(iso('2024-03-30'), iso('2024-04-02'), [], 0, 0);
    expect(months).toBe(0.13);
  });

  it('ignores ferieperioder and loose ferie days for month-based calculations', () => {
    const ferieperioder = [
      { id: 'fp-1', fra: iso('2024-01-10'), til: iso('2024-01-12') },
    ];
    const months = calculateTafAntalMaaneder(iso('2024-01-01'), iso('2024-01-31'), ferieperioder, 5, 0);
    expect(months).toBe(1);
  });

  it('subtracts only øvrigt fravær uden løn (4.8% per day) for month-based beregningsgrundlag', () => {
    const months = calculateTafAntalMaaneder(iso('2024-01-01'), iso('2024-01-31'), [], 0, 1);
    expect(months).toBe(0.95);
  });
});
