import {
  round0,
  round2,
  round3,
  round4,
  roundNearest1000,
  ceil0,
  ceilNearest12,
} from '../../utils/roundingShortcuts';

describe('roundingShortcuts', () => {
  describe('round0/2/3/4 (halfAwayFromZero)', () => {
    it('runder til det forventede antal decimaler', () => {
      expect(round0(1.5)).toBe(2);
      expect(round0(-1.5)).toBe(-2);
      expect(round2(2.005)).toBe(2.01);
      expect(round3(1.23449)).toBe(1.234);
      expect(round4(1.234549)).toBe(1.2345);
    });

    it('normaliserer -0', () => {
      expect(Object.is(round2(-0), -0)).toBe(false);
      expect(Object.is(round0(-0.0001), -0)).toBe(false);
    });

    it('fail-closed på NaN/Infinity', () => {
      expect(round2(Number.NaN)).toBe(0);
      expect(round0(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe('roundNearest1000', () => {
    it('runder til nærmeste tusinde (halfAwayFromZero)', () => {
      expect(roundNearest1000(1499)).toBe(1000);
      expect(roundNearest1000(1500)).toBe(2000);
      expect(roundNearest1000(-1500)).toBe(-2000);
    });
  });

  describe('ceil0', () => {
    it('runder altid op til heltal', () => {
      expect(ceil0(1.01)).toBe(2);
      expect(ceil0(1.0)).toBe(1);
      expect(ceil0(-1.9)).toBe(-1);
    });
  });

  describe('ceilNearest12', () => {
    it('runder op til nærmeste multiplum af 12', () => {
      expect(ceilNearest12(0)).toBe(0);
      expect(ceilNearest12(1)).toBe(12);
      expect(ceilNearest12(12)).toBe(12);
      expect(ceilNearest12(13)).toBe(24);
      expect(ceilNearest12(120000)).toBe(120000);
    });

    it('resultatet er altid deleligt med 12', () => {
      for (const v of [1, 7, 100, 1234, 99999]) {
        expect(ceilNearest12(v) % 12).toBe(0);
      }
    });

    it('normaliserer -0 ved v = 0', () => {
      expect(Object.is(ceilNearest12(0), -0)).toBe(false);
    });
  });
});
