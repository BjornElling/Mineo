import { describe, expect, it } from 'vitest';
import { parseOptionalIntegerFromString } from '../../domain/tableModelUtils';

describe('parseOptionalIntegerFromString', () => {
  describe('gyldige heltal', () => {
    it('"0" → 0', () => expect(parseOptionalIntegerFromString('0')).toBe(0));
    it('"1" → 1', () => expect(parseOptionalIntegerFromString('1')).toBe(1));
    it('"42" → 42', () => expect(parseOptionalIntegerFromString('42')).toBe(42));
    it('"-5" → -5', () => expect(parseOptionalIntegerFromString('-5')).toBe(-5));
    it('"100" → 100', () => expect(parseOptionalIntegerFromString('100')).toBe(100));
  });

  describe('tom streng → undefined', () => {
    it('"" → undefined', () => expect(parseOptionalIntegerFromString('')).toBeUndefined());
    it('"   " (whitespace) → undefined', () => expect(parseOptionalIntegerFromString('   ')).toBeUndefined());
  });

  describe('whitespace trimmes', () => {
    it('"  42  " → 42', () => expect(parseOptionalIntegerFromString('  42  ')).toBe(42));
    it('"  0  " → 0', () => expect(parseOptionalIntegerFromString('  0  ')).toBe(0));
  });

  describe('ikke-numeriske strenge → undefined', () => {
    it('"abc" → undefined', () => expect(parseOptionalIntegerFromString('abc')).toBeUndefined());
    it('"12abc" → 12 (parseInt parser ledende tal)', () => {
      // parseInt('12abc') = 12
      expect(parseOptionalIntegerFromString('12abc')).toBe(12);
    });
    it('"abc12" → undefined (parseInt giver NaN)', () => {
      expect(parseOptionalIntegerFromString('abc12')).toBeUndefined();
    });
  });

  describe('decimaltal → afkortes', () => {
    it('"1.9" → 1 (parseInt afkorter)', () => expect(parseOptionalIntegerFromString('1.9')).toBe(1));
    it('"0.5" → 0', () => expect(parseOptionalIntegerFromString('0.5')).toBe(0));
  });
});
