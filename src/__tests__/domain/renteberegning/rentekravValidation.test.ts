import { calculateInterestDate, validateInterestCalculation } from '../../../domain/renteberegning/rentekravValidation';
import type { ISODateString } from '../../../types/branded';

const iso = (s: string): ISODateString => s as ISODateString;

// ─── calculateInterestDate ────────────────────────────────────────────────────

describe('calculateInterestDate', () => {
  describe('FORRETNINGSREGEL: tillaegstid ≤ 0 → returner kravetDato uændret', () => {
    it('tillaegstid = 0 → success med kravetDato', () => {
      const result = calculateInterestDate({ kravetDato: iso('2024-01-01'), tillaegstid: 0, enhed: 'dage' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-01-01');
    });

    it('tillaegstid = -5 → success med kravetDato (negativ ignoreres)', () => {
      const result = calculateInterestDate({ kravetDato: iso('2023-06-15'), tillaegstid: -5, enhed: 'uger' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2023-06-15');
    });
  });

  describe('enhed = dage', () => {
    it('2024-01-01 + 30 dage = 2024-01-31', () => {
      const result = calculateInterestDate({ kravetDato: iso('2024-01-01'), tillaegstid: 30, enhed: 'dage' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-01-31');
    });

    it('2024-01-01 + 1 dag = 2024-01-02', () => {
      const result = calculateInterestDate({ kravetDato: iso('2024-01-01'), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-01-02');
    });
  });

  describe('enhed = uger', () => {
    it('2024-01-01 + 2 uger = 2024-01-15', () => {
      const result = calculateInterestDate({ kravetDato: iso('2024-01-01'), tillaegstid: 2, enhed: 'uger' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-01-15');
    });

    it('2024-01-01 + 1 uge = 2024-01-08', () => {
      const result = calculateInterestDate({ kravetDato: iso('2024-01-01'), tillaegstid: 1, enhed: 'uger' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-01-08');
    });
  });

  describe('enhed = maaneder', () => {
    it('2024-01-01 + 3 måneder = 2024-04-01', () => {
      const result = calculateInterestDate({ kravetDato: iso('2024-01-01'), tillaegstid: 3, enhed: 'maaneder' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-04-01');
    });

    it('2024-01-01 + 1 måned = 2024-02-01', () => {
      const result = calculateInterestDate({ kravetDato: iso('2024-01-01'), tillaegstid: 1, enhed: 'maaneder' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-02-01');
    });

    it('2024-01-31 + 1 måned clamper til månedsslut (skudår) = 2024-02-29', () => {
      // Kanonisk addMonths-semantik: "1 måned efter 31. januar" = udgangen af februar,
      // ikke begyndelsen af marts (ingen rå setUTCMonth-rollover).
      const result = calculateInterestDate({ kravetDato: iso('2024-01-31'), tillaegstid: 1, enhed: 'maaneder' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2024-02-29');
    });

    it('2025-01-31 + 1 måned clamper til månedsslut (ikke-skudår) = 2025-02-28', () => {
      const result = calculateInterestDate({ kravetDato: iso('2025-01-31'), tillaegstid: 1, enhed: 'maaneder' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.value).toBe('2025-02-28');
    });
  });

  describe('fejlscenarier', () => {
    it('tom kravetDato → MISSING_INPUT', () => {
      const result = calculateInterestDate({ kravetDato: iso(''), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_INPUT');
    });

    it('whitespace kravetDato → MISSING_INPUT', () => {
      const result = calculateInterestDate({ kravetDato: iso('   '), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_INPUT');
    });

    it('ugyldig ISO-dato → DATE_PARSE_ERROR', () => {
      const result = calculateInterestDate({ kravetDato: iso('ikke-en-dato'), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('DATE_PARSE_ERROR');
    });

    it('dansk format afvises (forventer ISO) → DATE_PARSE_ERROR', () => {
      const result = calculateInterestDate({ kravetDato: iso('01-01-2024'), tillaegstid: 1, enhed: 'dage' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('DATE_PARSE_ERROR');
    });
  });
});

// ─── validateInterestCalculation ─────────────────────────────────────────────

describe('validateInterestCalculation', () => {
  const validKravetDato = iso('2024-01-01');
  const validRentedato = iso('2024-01-15');
  const validBeregningsdato = iso('2024-06-01');
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
      const result = validateInterestCalculation(iso(''), validBeloeb, validRentedato, validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_KRAVET_DATO');
    });
  });

  describe('INVALID_KRAVET_DATO', () => {
    it('ugyldig kravetDato (31-02 i ISO) → INVALID_KRAVET_DATO', () => {
      const result = validateInterestCalculation(iso('2024-02-31'), validBeloeb, validRentedato, validBeregningsdato);
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
      const result = validateInterestCalculation(validKravetDato, validBeloeb, iso(''), validBeregningsdato);
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
      const result = validateInterestCalculation(validKravetDato, validBeloeb, validRentedato, iso(''));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('MISSING_BEREGNING_DATO');
    });
  });

  describe('INVALID_DATE_ORDER', () => {
    it('rentedato > beregningsdato → INVALID_DATE_ORDER', () => {
      const result = validateInterestCalculation(validKravetDato, validBeloeb, iso('2024-12-01'), iso('2024-01-01'));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('INVALID_DATE_ORDER');
    });
  });

  describe('DATE_BEFORE_RATE_COVERAGE', () => {
    it('rentedato før tidligste referencesats → DATE_BEFORE_RATE_COVERAGE', () => {
      const result = validateInterestCalculation(iso('2004-01-01'), validBeloeb, iso('2004-01-01'), validBeregningsdato);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('DATE_BEFORE_RATE_COVERAGE');
    });
  });
});
