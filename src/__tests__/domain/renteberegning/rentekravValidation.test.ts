import { calculateInterestDate, validateInterestCalculation } from '../../../domain/renteberegning/rentekravValidation';
import type { DanishDateString } from '../../../types/branded';

const d = (s: string): DanishDateString => s as DanishDateString;

// ─── calculateInterestDate ────────────────────────────────────────────────────

describe('calculateInterestDate', () => {
  describe('FORRETNINGSREGEL: tillaegstid ≤ 0 → returner kravetDato uændret', () => {
    it('tillaegstid = 0 → success med kravetDato', () => {
      const result = calculateInterestDate({ kravetDato: d('01-01-2024'), tillaegstid: 0, enhed: 'dage' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('01-01-2024');
    });

    it('tillaegstid = -5 → success med kravetDato (negativ ignoreres)', () => {
      const result = calculateInterestDate({ kravetDato: d('15-06-2023'), tillaegstid: -5, enhed: 'uger' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('15-06-2023');
    });
  });

  describe('enhed = dage', () => {
    it('01-01-2024 + 30 dage = 31-01-2024', () => {
      const result = calculateInterestDate({ kravetDato: d('01-01-2024'), tillaegstid: 30, enhed: 'dage' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('31-01-2024');
    });

    it('01-01-2024 + 1 dag = 02-01-2024', () => {
      const result = calculateInterestDate({ kravetDato: d('01-01-2024'), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('02-01-2024');
    });
  });

  describe('enhed = uger', () => {
    it('01-01-2024 + 2 uger = 15-01-2024', () => {
      const result = calculateInterestDate({ kravetDato: d('01-01-2024'), tillaegstid: 2, enhed: 'uger' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('15-01-2024');
    });

    it('01-01-2024 + 1 uge = 08-01-2024', () => {
      const result = calculateInterestDate({ kravetDato: d('01-01-2024'), tillaegstid: 1, enhed: 'uger' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('08-01-2024');
    });
  });

  describe('enhed = maaneder', () => {
    it('01-01-2024 + 3 måneder = 01-04-2024', () => {
      const result = calculateInterestDate({ kravetDato: d('01-01-2024'), tillaegstid: 3, enhed: 'maaneder' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('01-04-2024');
    });

    it('01-01-2024 + 1 måned = 01-02-2024', () => {
      const result = calculateInterestDate({ kravetDato: d('01-01-2024'), tillaegstid: 1, enhed: 'maaneder' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('01-02-2024');
    });

    it('31-01-2024 + 1 måned følger dokumenteret UTC-month rollover = 02-03-2024', () => {
      const result = calculateInterestDate({ kravetDato: d('31-01-2024'), tillaegstid: 1, enhed: 'maaneder' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('02-03-2024');
    });
  });

  describe('fejlscenarier', () => {
    it('tom kravetDato → MISSING_INPUT', () => {
      const result = calculateInterestDate({ kravetDato: d(''), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_INPUT');
    });

    it('whitespace kravetDato → MISSING_INPUT', () => {
      const result = calculateInterestDate({ kravetDato: d('   '), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_INPUT');
    });

    it('ugyldig datoformat → INVALID_DATE_FORMAT', () => {
      const result = calculateInterestDate({ kravetDato: d('ikke-en-dato'), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_DATE_FORMAT');
    });
  });
});

// ─── validateInterestCalculation ─────────────────────────────────────────────

describe('validateInterestCalculation', () => {
  const validKravetDato = d('01-01-2024');
  const validRentedato = d('15-01-2024');
  const validBeregningsdato = d('01-06-2024');
  const validBeloeb = 10000;

  describe('succesfuld validering', () => {
    it('alle felter gyldige → success med valideret input', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, validRentedato, validBeregningsdato);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.beloeb).toBe(validBeloeb);
        expect(result.value.rentedato).toBe(validRentedato);
        expect(result.value.beregningsdato).toBe(validBeregningsdato);
      }
    });

    it('rentedato = beregningsdato → success (lig er ok)', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, validRentedato, validRentedato);
      expect(result.success).toBe(true);
    });
  });

  describe('MISSING_KRAVET_DATO', () => {
    it('undefined kravetDato → MISSING_KRAVET_DATO', () => {
      const result = validateInterestCalculation(undefined, validBeloeb, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_KRAVET_DATO');
    });

    it('tom kravetDato → MISSING_KRAVET_DATO', () => {
      const result = validateInterestCalculation(d(''), validBeloeb, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_KRAVET_DATO');
    });
  });

  describe('INVALID_KRAVET_DATO', () => {
    it('ugyldig kravetDato → INVALID_KRAVET_DATO', () => {
      const result = validateInterestCalculation(d('31-02-2024'), validBeloeb, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_KRAVET_DATO');
    });
  });

  describe('INVALID_AMOUNT', () => {
    it('undefined beloeb → INVALID_AMOUNT', () => {
      const result = validateInterestCalculation(validKravetDato, undefined, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_AMOUNT');
    });

    it('beloeb = 0 → INVALID_AMOUNT', () => {
      const result = validateInterestCalculation(validKravetDato, 0, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_AMOUNT');
    });

    it('beloeb < 0 → INVALID_AMOUNT', () => {
      const result = validateInterestCalculation(validKravetDato, -100, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_AMOUNT');
    });

    it('beloeb = Infinity → INVALID_AMOUNT', () => {
      const result = validateInterestCalculation(validKravetDato, Infinity, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_AMOUNT');
    });

    it('beloeb = NaN → INVALID_AMOUNT', () => {
      const result = validateInterestCalculation(validKravetDato, NaN, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_AMOUNT');
    });
  });

  describe('MISSING_RENTEDATO', () => {
    it('undefined rentedato → MISSING_RENTEDATO', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, undefined, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_RENTEDATO');
    });

    it('tom rentedato → MISSING_RENTEDATO', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, d(''), validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_RENTEDATO');
    });
  });

  describe('MISSING_BEREGNING_DATO', () => {
    it('undefined beregningsdato → MISSING_BEREGNING_DATO', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, validRentedato, undefined);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_BEREGNING_DATO');
    });

    it('tom beregningsdato → MISSING_BEREGNING_DATO', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, validRentedato, d(''));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_BEREGNING_DATO');
    });
  });

  describe('INVALID_DATE_ORDER', () => {
    it('rentedato > beregningsdato → INVALID_DATE_ORDER', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, d('01-12-2024'), d('01-01-2024'));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_DATE_ORDER');
    });
  });
});
