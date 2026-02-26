import { describe, expect, it } from 'vitest';
import { clampMoneyOreToZero, ensureMoneyOre, fromOre, roundKroner, toOre } from '../../../domain/erstatningsopgoerelse/eoPdfMoneyUtils';

describe('eoPdfMoneyUtils', () => {
  describe('toOre', () => {
    it('konverterer kroner med 2 decimaler til øre', () => {
      expect(toOre(123.45)).toBe(12345);
      expect(toOre(-123.45)).toBe(-12345);
    });

    it('afviser ikke-endelige tal', () => {
      expect(() => toOre(Number.NaN)).toThrow('ikke et endeligt tal');
      expect(() => toOre(Number.POSITIVE_INFINITY)).toThrow('ikke et endeligt tal');
    });

    it('afviser beløb med mere end 2 decimaler', () => {
      expect(() => toOre(1.005)).toThrow('flere end 2 decimaler');
      expect(() => toOre(-1.005)).toThrow('flere end 2 decimaler');
    });
  });

  describe('clampMoneyOreToZero', () => {
    it('clamp’er negative totaler til 0', () => {
      expect(clampMoneyOreToZero(ensureMoneyOre(-100))).toBe(0);
      expect(clampMoneyOreToZero(ensureMoneyOre(0))).toBe(0);
      expect(clampMoneyOreToZero(ensureMoneyOre(50))).toBe(50);
    });
  });

  describe('roundtrip', () => {
    it('bevarer øre ved fromOre/toOre roundtrip', () => {
      expect(toOre(fromOre(ensureMoneyOre(12345)))).toBe(12345);
    });

    it('roundKroner bruger half-away-from-zero', () => {
      // Midpoint-case med 3 decimaler: verificerer at half-away-from-zero anvendes
      // i commit-afrunding til 2 decimaler (og ikke banker's rounding/truncation).
      expect(roundKroner(1.125)).toBe(1.13);
      expect(roundKroner(-1.125)).toBe(-1.13);
    });
  });
});
