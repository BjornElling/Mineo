import { describe, expect, it } from 'vitest';
import { toNonNegativeInt } from '../../utils/numberUtils';

describe('toNonNegativeInt', () => {
  describe('normale heltal', () => {
    it('0 → 0', () => expect(toNonNegativeInt(0)).toBe(0));
    it('1 → 1', () => expect(toNonNegativeInt(1)).toBe(1));
    it('100 → 100', () => expect(toNonNegativeInt(100)).toBe(100));
    it('Number.MAX_SAFE_INTEGER → Number.MAX_SAFE_INTEGER', () => {
      expect(toNonNegativeInt(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('negative tal → 0', () => {
    it('-1 → 0', () => expect(toNonNegativeInt(-1)).toBe(0));
    it('-100 → 0', () => expect(toNonNegativeInt(-100)).toBe(0));
    it('-0.5 → 0 (afkortet til 0, clampet til 0)', () => expect(toNonNegativeInt(-0.5)).toBe(0));
  });

  describe('decimaltal → afkortes nedad (Math.trunc)', () => {
    it('1.9 → 1', () => expect(toNonNegativeInt(1.9)).toBe(1));
    it('1.1 → 1', () => expect(toNonNegativeInt(1.1)).toBe(1));
    it('0.9 → 0', () => expect(toNonNegativeInt(0.9)).toBe(0));
    it('5.5 → 5', () => expect(toNonNegativeInt(5.5)).toBe(5));
    it('-1.9 → 0 (truncer til -1, clamp til 0)', () => expect(toNonNegativeInt(-1.9)).toBe(0));
  });

  describe('ikke-finite værdier → 0', () => {
    it('NaN → 0', () => expect(toNonNegativeInt(NaN)).toBe(0));
    it('Infinity → 0', () => expect(toNonNegativeInt(Infinity)).toBe(0));
    it('-Infinity → 0', () => expect(toNonNegativeInt(-Infinity)).toBe(0));
  });
});
