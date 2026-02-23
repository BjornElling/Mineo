import { describe, expect, it } from 'vitest';
import { erDetteFoersteErstatningsopgoerelse } from '../../../domain/erstatningsopgoerelse/eoNummerValidering';

describe('erDetteFoersteErstatningsopgoerelse', () => {
  describe('tomt input → første', () => {
    it('undefined → true', () => {
      expect(erDetteFoersteErstatningsopgoerelse(undefined)).toBe(true);
    });

    it('tom streng → true', () => {
      expect(erDetteFoersteErstatningsopgoerelse('')).toBe(true);
    });

    it('kun whitespace → true (ingen alfanumeriske tegn)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('   ')).toBe(true);
    });
  });

  describe('tal som første alfanumeriske tegn', () => {
    it('"1" → true (første)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('1')).toBe(true);
    });

    it('"2" → false (ikke første)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('2')).toBe(false);
    });

    it('"3" → false', () => {
      expect(erDetteFoersteErstatningsopgoerelse('3')).toBe(false);
    });

    it('"9" → false', () => {
      expect(erDetteFoersteErstatningsopgoerelse('9')).toBe(false);
    });

    it('"12" → false (1 efterfulgt af 2)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('12')).toBe(false);
    });

    it('"10" → false (1 efterfulgt af 0)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('10')).toBe(false);
    });

    it('"1A" → true (1 efterfulgt af bogstav)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('1A')).toBe(true);
    });

    it('"1a" → true (1 efterfulgt af lille bogstav)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('1a')).toBe(true);
    });

    it('"2A" → false (2 som første tal)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('2A')).toBe(false);
    });

    it('"3B" → false', () => {
      expect(erDetteFoersteErstatningsopgoerelse('3B')).toBe(false);
    });
  });

  describe('bogstav som første alfanumeriske tegn', () => {
    it('"A" → true (bogstav første)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('A')).toBe(true);
    });

    it('"B" → true', () => {
      expect(erDetteFoersteErstatningsopgoerelse('B')).toBe(true);
    });

    it('"A1" → true (bogstav efterfulgt af tal)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('A1')).toBe(true);
    });

    it('"A2" → true', () => {
      expect(erDetteFoersteErstatningsopgoerelse('A2')).toBe(true);
    });
  });

  describe('præfix med specialtegn', () => {
    it('"  1" (whitespace foran 1) → true', () => {
      expect(erDetteFoersteErstatningsopgoerelse('  1')).toBe(true);
    });

    it('"  2" (whitespace foran 2) → false', () => {
      expect(erDetteFoersteErstatningsopgoerelse('  2')).toBe(false);
    });

    it('"EO-1" → true (1 som første alfanumeriske efter E og O)', () => {
      // E er første alfanumeriske → true (bogstav)
      expect(erDetteFoersteErstatningsopgoerelse('EO-1')).toBe(true);
    });

    it('"-2" → false (2 er første alfanumeriske)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('-2')).toBe(false);
    });

    it('"-1A" → true (1 efterfulgt af bogstav)', () => {
      expect(erDetteFoersteErstatningsopgoerelse('-1A')).toBe(true);
    });
  });
});
