import { describe, expect, it } from 'vitest';
import { shouldClearField, trimValue } from '../../utils/inputValidation';

describe('shouldClearField', () => {
  describe('skal tømmes (return true)', () => {
    it('tom streng → true', () => {
      expect(shouldClearField('')).toBe(true);
    });

    it('whitespace → true', () => {
      expect(shouldClearField('   ')).toBe(true);
    });

    it('"0" → true (kun nul)', () => {
      expect(shouldClearField('0')).toBe(true);
    });

    it('"00" → true (kun nuller)', () => {
      expect(shouldClearField('00')).toBe(true);
    });

    it('"0.0" → true (nuller + specialtegn)', () => {
      expect(shouldClearField('0.0')).toBe(true);
    });

    it('"0,0" → true (nuller + komma)', () => {
      expect(shouldClearField('0,0')).toBe(true);
    });

    it('"-" → true (kun specialtegn)', () => {
      expect(shouldClearField('-')).toBe(true);
    });

    it('"." → true (kun punktum)', () => {
      expect(shouldClearField('.')).toBe(true);
    });

    it('nummer 0 → true', () => {
      expect(shouldClearField(0)).toBe(true);
    });
  });

  describe('skal bevares (return false)', () => {
    it('"10" → false (indeholder "1")', () => {
      expect(shouldClearField('10')).toBe(false);
    });

    it('"abc" → false (bogstaver)', () => {
      expect(shouldClearField('abc')).toBe(false);
    });

    it('"1" → false', () => {
      expect(shouldClearField('1')).toBe(false);
    });

    it('"5" → false', () => {
      expect(shouldClearField('5')).toBe(false);
    });

    it('"9" → false (grænseværdi)', () => {
      expect(shouldClearField('9')).toBe(false);
    });

    it('"100" → false', () => {
      expect(shouldClearField('100')).toBe(false);
    });

    it('"A" → false (stort bogstav)', () => {
      expect(shouldClearField('A')).toBe(false);
    });

    it('danske bogstaver Æ/Ø/Å → false', () => {
      expect(shouldClearField('Æ')).toBe(false);
      expect(shouldClearField('Ø')).toBe(false);
      expect(shouldClearField('Å')).toBe(false);
    });

    it('"0,5" → false (indeholder gyldigt ciffer: 5)', () => {
      expect(shouldClearField('0,5')).toBe(false);
    });

    it('nummer 10 → false', () => {
      expect(shouldClearField(10)).toBe(false);
    });
  });
});

describe('trimValue', () => {
  it('trimmer mellemrum i start og slut', () => {
    expect(trimValue('  hello  ')).toBe('hello');
  });

  it('returnerer tom streng uændret', () => {
    expect(trimValue('')).toBe('');
  });

  it('konverterer tal til streng', () => {
    expect(trimValue(42)).toBe('42');
  });

  it('konverterer 0 til "0"', () => {
    expect(trimValue(0)).toBe('0');
  });

  it('trimmer intern whitespace ikke (kun start/slut)', () => {
    expect(trimValue('  hej verden  ')).toBe('hej verden');
  });
});
