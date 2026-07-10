import {
  addMoneyOre,
  clampMoneyOreToZero,
  fromKroner,
  moneyOre,
  moneyOreSchema,
  roundKroner,
  scaleMoneyOre,
  subtractMoneyOre,
  sumMoneyOre,
  toKroner,
  zeroMoneyOre,
} from '../../../domain/money/money';

describe('money', () => {
  describe('moneyOre og moneyOreSchema', () => {
    it('accepterer kun endelige, sikre heltalsbeløb i øre', () => {
      expect(moneyOre(-1)).toBe(-1);
      expect(moneyOre(0)).toBe(0);
      expect(moneyOre(1)).toBe(1);
      expect(moneyOreSchema.safeParse(123).success).toBe(true);

      for (const invalid of [0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(() => moneyOre(invalid)).toThrow();
        expect(moneyOreSchema.safeParse(invalid).success).toBe(false);
      }
    });
  });

  describe('lukket øre-algebra', () => {
    it('opretter nul og udfører addition og subtraktion uden at miste enheden', () => {
      expect(zeroMoneyOre()).toBe(0);
      expect(addMoneyOre(moneyOre(125), moneyOre(-25))).toBe(100);
      expect(subtractMoneyOre(moneyOre(125), moneyOre(-25))).toBe(150);
    });

    it('summerer tomme, negative og generator-baserede serier deterministisk', () => {
      expect(sumMoneyOre([])).toBe(0);
      expect(sumMoneyOre([moneyOre(100), moneyOre(-40), moneyOre(2)])).toBe(62);
      function* values() {
        yield moneyOre(4);
        yield moneyOre(5);
      }
      expect(sumMoneyOre(values())).toBe(9);
    });

    it('afviser overflow i stedet for at skabe et usikkert ørebeløb', () => {
      expect(() => addMoneyOre(moneyOre(Number.MAX_SAFE_INTEGER), moneyOre(1))).toThrow();
    });
  });

  describe('fromKroner', () => {
    it('konverterer kroner med 2 decimaler til øre', () => {
      expect(fromKroner(0)).toBe(0);
      expect(fromKroner(123.45)).toBe(12345);
      expect(fromKroner(-123.45)).toBe(-12345);
      expect(fromKroner(999999.99)).toBe(99999999);
    });

    it('afviser ikke-endelige tal', () => {
      expect(() => fromKroner(Number.NaN)).toThrow('ikke et endeligt tal');
      expect(() => fromKroner(Number.POSITIVE_INFINITY)).toThrow('ikke et endeligt tal');
    });

    it('afviser beløb med mere end 2 decimaler og halve øre', () => {
      for (const invalid of [1.005, -1.005, 0.005, -0.005]) {
        expect(() => fromKroner(invalid)).toThrow('flere end 2 decimaler');
      }
    });
  });

  describe('clampMoneyOreToZero', () => {
    it('clamper negative totaler til 0 og bevarer positive', () => {
      expect(clampMoneyOreToZero(moneyOre(-1))).toBe(0);
      expect(clampMoneyOreToZero(moneyOre(0))).toBe(0);
      expect(clampMoneyOreToZero(moneyOre(1))).toBe(1);
    });
  });

  describe('scaleMoneyOre', () => {
    it('skalerer med en faktor i (0,1] og afrunder half-away-from-zero', () => {
      expect(scaleMoneyOre(moneyOre(10000), 0.5)).toBe(5000);
      expect(scaleMoneyOre(moneyOre(12345), 0.5)).toBe(6173);
      expect(scaleMoneyOre(moneyOre(-12345), 0.5)).toBe(-6173);
      expect(scaleMoneyOre(moneyOre(777), 1)).toBe(777);
    });

    it('afviser faktor uden for (0,1] og ikke-endelige faktorer', () => {
      for (const invalid of [0, -0.5, 1.0001, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => scaleMoneyOre(moneyOre(1000), invalid)).toThrow('Ugyldig faktor');
      }
    });
  });

  describe('krone-roundtrip', () => {
    it('bevarer øre ved toKroner/fromKroner roundtrip', () => {
      expect(fromKroner(toKroner(moneyOre(12345)))).toBe(12345);
    });

    it('roundKroner bruger half-away-from-zero', () => {
      expect(roundKroner(1.125)).toBe(1.13);
      expect(roundKroner(-1.125)).toBe(-1.13);
    });
  });
});
