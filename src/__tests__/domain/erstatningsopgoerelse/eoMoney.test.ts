import { clampMoneyOreToZero, ensureMoneyOre, fromOre, roundKroner, scaleMoneyOre, toOre } from '../../../domain/erstatningsopgoerelse/shared/eoMoney';

describe('eoMoney', () => {
  describe('toOre', () => {
    it('konverterer kroner med 2 decimaler til øre', () => {
      expect(toOre(0)).toBe(0);
      expect(toOre(123.45)).toBe(12345);
      expect(toOre(-123.45)).toBe(-12345);
      expect(toOre(999999.99)).toBe(99999999);
    });

    it('afviser ikke-endelige tal', () => {
      expect(() => toOre(Number.NaN)).toThrow('ikke et endeligt tal');
      expect(() => toOre(Number.POSITIVE_INFINITY)).toThrow('ikke et endeligt tal');
    });

    it('afviser beløb med mere end 2 decimaler', () => {
      expect(() => toOre(1.005)).toThrow('flere end 2 decimaler');
      expect(() => toOre(-1.005)).toThrow('flere end 2 decimaler');
    });

    it('behandler halv-øre-input som ugyldigt input (ikke afrundings-case i toOre)', () => {
      expect(() => toOre(0.005)).toThrow('flere end 2 decimaler');
      expect(() => toOre(-0.005)).toThrow('flere end 2 decimaler');
    });
  });

  describe('clampMoneyOreToZero', () => {
    it('clamp’er negative totaler til 0 og bevarer positive', () => {
      expect(clampMoneyOreToZero(ensureMoneyOre(-1))).toBe(0);
      expect(clampMoneyOreToZero(ensureMoneyOre(0))).toBe(0);
      expect(clampMoneyOreToZero(ensureMoneyOre(1))).toBe(1);
    });
  });

  describe('scaleMoneyOre', () => {
    it('skalerer med en faktor i (0,1] og afrunder half-away-from-zero', () => {
      expect(scaleMoneyOre(ensureMoneyOre(10000), 0.5)).toBe(5000);
      // 12345 · 0,5 = 6172,5 → 6173 (half-away-from-zero, ikke banker's).
      expect(scaleMoneyOre(ensureMoneyOre(12345), 0.5)).toBe(6173);
      // Faktor præcis 1 er tilladt (øvre inklusiv grænse) og er identitet.
      expect(scaleMoneyOre(ensureMoneyOre(777), 1)).toBe(777);
    });

    it('afviser faktor uden for (0,1] og ikke-endelige faktorer (fail-closed)', () => {
      expect(() => scaleMoneyOre(ensureMoneyOre(1000), 0)).toThrow('Ugyldig faktor');
      expect(() => scaleMoneyOre(ensureMoneyOre(1000), -0.5)).toThrow('Ugyldig faktor');
      expect(() => scaleMoneyOre(ensureMoneyOre(1000), 1.0001)).toThrow('Ugyldig faktor');
      expect(() => scaleMoneyOre(ensureMoneyOre(1000), Number.NaN)).toThrow('Ugyldig faktor');
      expect(() => scaleMoneyOre(ensureMoneyOre(1000), Number.POSITIVE_INFINITY)).toThrow('Ugyldig faktor');
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
