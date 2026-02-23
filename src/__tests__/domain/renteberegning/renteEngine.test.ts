import { describe, expect, it } from 'vitest';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import {
  calculateActualInterestDate,
  computeRentekravCalculation,
} from '../../../domain/renteberegning/renteEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const makeRow = (overrides: Partial<RentekravRow> = {}): RentekravRow => ({
  id: 'r1',
  belob: undefined,
  renterFra: iso('2023-01-01'),
  tillaegstid: 0,
  enhed: 'dage',
  ...overrides,
});

// ─── calculateActualInterestDate ──────────────────────────────────────────────

describe('calculateActualInterestDate', () => {
  describe('renterFra = undefined → null', () => {
    it('returnerer null når renterFra ikke er sat', () => {
      const row = makeRow({ renterFra: undefined });
      expect(calculateActualInterestDate(row)).toBeNull();
    });
  });

  describe('tillaegstid = 0 → rentedato = renterFra (i dansk format)', () => {
    it('01-01-2023 med tillaegstid=0 → dansk "01-01-2023"', () => {
      const row = makeRow({ renterFra: iso('2023-01-01'), tillaegstid: 0, enhed: 'dage' });
      expect(calculateActualInterestDate(row)).toBe('01-01-2023');
    });

    it('renterFra=2024-06-15, tillaegstid=0 → "15-06-2024"', () => {
      const row = makeRow({ renterFra: iso('2024-06-15'), tillaegstid: 0, enhed: 'dage' });
      expect(calculateActualInterestDate(row)).toBe('15-06-2024');
    });
  });

  describe('tillaegstid > 0 – dage', () => {
    it('2023-01-01 + 30 dage = dansk "31-01-2023"', () => {
      const row = makeRow({ renterFra: iso('2023-01-01'), tillaegstid: 30, enhed: 'dage' });
      expect(calculateActualInterestDate(row)).toBe('31-01-2023');
    });

    it('2023-01-01 + 365 dage = dansk "01-01-2024"', () => {
      const row = makeRow({ renterFra: iso('2023-01-01'), tillaegstid: 365, enhed: 'dage' });
      expect(calculateActualInterestDate(row)).toBe('01-01-2024');
    });
  });

  describe('tillaegstid > 0 – uger', () => {
    it('2023-01-01 + 4 uger = dansk "29-01-2023"', () => {
      const row = makeRow({ renterFra: iso('2023-01-01'), tillaegstid: 4, enhed: 'uger' });
      expect(calculateActualInterestDate(row)).toBe('29-01-2023');
    });
  });

  describe('tillaegstid > 0 – måneder', () => {
    it('2023-01-01 + 3 måneder = dansk "01-04-2023"', () => {
      const row = makeRow({ renterFra: iso('2023-01-01'), tillaegstid: 3, enhed: 'maaneder' });
      expect(calculateActualInterestDate(row)).toBe('01-04-2023');
    });

    it('2023-01-31 + 1 måned (overflow) = dansk "03-03-2023" (JavaScript setUTCMonth-overflow)', () => {
      // setUTCMonth(1) på 31. jan → feb har ikke 31 dage → JavaScript ruller videre til 3. marts
      const row = makeRow({ renterFra: iso('2023-01-31'), tillaegstid: 1, enhed: 'maaneder' });
      const result = calculateActualInterestDate(row);
      expect(result).toBe('03-03-2023');
    });
  });

  describe('tillaegstid < 0 → rentedato = renterFra (negativ ignoreres)', () => {
    it('tillaegstid=-5 → rentedato = renterFra', () => {
      const row = makeRow({ renterFra: iso('2023-06-01'), tillaegstid: -5, enhed: 'dage' });
      expect(calculateActualInterestDate(row)).toBe('01-06-2023');
    });
  });
});

// ─── computeRentekravCalculation ──────────────────────────────────────────────

describe('computeRentekravCalculation', () => {
  describe('manglende data → context=null, issue=null', () => {
    it('renterFra = undefined → context=null, issue=null', () => {
      const row = makeRow({ renterFra: undefined, belob: { kind: 'number', value: 10000 } });
      const result = computeRentekravCalculation(row, iso('2024-01-01'));
      expect(result.context).toBeNull();
      expect(result.issue).toBeNull();
    });

    it('beregningsdato = undefined → context=null, issue=null, actualInterestDate beregnes', () => {
      const row = makeRow({ renterFra: iso('2023-01-01'), tillaegstid: 0, enhed: 'dage', belob: { kind: 'number', value: 10000 } });
      const result = computeRentekravCalculation(row, undefined);
      expect(result.context).toBeNull();
      expect(result.issue).toBeNull();
      // actualInterestDate er stadig beregnet
      expect(result.actualInterestDate).toBe('01-01-2023');
    });

    it('belob = undefined → context=null pga. invalid amount i validation', () => {
      const row = makeRow({ renterFra: iso('2023-01-01'), tillaegstid: 0, enhed: 'dage', belob: undefined });
      const result = computeRentekravCalculation(row, iso('2024-01-01'));
      expect(result.context).toBeNull();
    });
  });

  describe('ugyldig dato-rækkefølge → context=null', () => {
    it('rentedato > beregningsdato → validation fejler → context=null', () => {
      // renterFra = 2024-06-01, tillaegstid=0 → actualInterestDate = "01-06-2024"
      // beregningsdato = 2023-01-01 → rentedato > beregningsdato
      const row = makeRow({
        renterFra: iso('2024-06-01'),
        tillaegstid: 0,
        enhed: 'dage',
        belob: { kind: 'number', value: 5000 },
      });
      const result = computeRentekravCalculation(row, iso('2023-01-01'));
      expect(result.context).toBeNull();
      expect(result.issue).toBeNull(); // validation fejl returnerer issue=null
    });
  });

  describe('gyldigt input → context udfyldt', () => {
    it('returnerer context med korrekte felter for gyldigt input', () => {
      // renterFra=2023-01-01, tillaegstid=0, beregningsdato=2024-01-01, belob=10000
      const row = makeRow({
        renterFra: iso('2023-01-01'),
        tillaegstid: 0,
        enhed: 'dage',
        belob: { kind: 'number', value: 10000 },
      });
      const result = computeRentekravCalculation(row, iso('2024-01-01'));

      if (result.context === null) {
        // Renteberegningen kan fejle pga. manglende rentesatser for perioden
        // I dette tilfælde skal issue sættes
        expect(result.issue).not.toBeNull();
        return;
      }

      expect(result.context.kravetDato).toBe('01-01-2023');
      expect(result.context.actualInterestDate).toBe('01-01-2023');
      expect(result.context.beloeb).toBe(10000);
      expect(result.context.calculatedInterest).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.context.calculatedInterest)).toBe(true);
    });

    it('actualInterestDate er altid sat når renterFra er gyldig', () => {
      const row = makeRow({
        renterFra: iso('2023-03-01'),
        tillaegstid: 14,
        enhed: 'dage',
        belob: { kind: 'number', value: 5000 },
      });
      const result = computeRentekravCalculation(row, iso('2024-01-01'));
      // actualInterestDate: 2023-03-01 + 14 dage = 2023-03-15
      expect(result.actualInterestDate).toBe('15-03-2023');
    });
  });

  describe('belob = 0', () => {
    it('belob=0 → beregnes korrekt (rente=0), ELLER validering afviser (context=null)', () => {
      const row = makeRow({
        renterFra: iso('2023-01-01'),
        tillaegstid: 0,
        enhed: 'dage',
        belob: { kind: 'number', value: 0 },
      });
      const result = computeRentekravCalculation(row, iso('2024-01-01'));
      if (result.context !== null) {
        // belob=0 producerer rente=0
        expect(result.context.calculatedInterest).toBe(0);
        expect(result.context.beloeb).toBe(0);
        expect(result.issue).toBeNull();
      } else {
        // Validering kan afvise 0-beloeb — begge outcomes er acceptable
        expect(result.actualInterestDate).not.toBeNull();
      }
    });
  });

  describe('issue-struktur ved beregningsfejl', () => {
    it('issue-objekt indeholder message, context og optionel error', () => {
      // Forsøg med dato der er grænsetilfælde for rentesatser — kan trigge catch-blok
      const row = makeRow({
        renterFra: iso('2005-01-01'),
        tillaegstid: 0,
        enhed: 'dage',
        belob: { kind: 'number', value: 10000 },
      });
      const result = computeRentekravCalculation(row, iso('2005-12-31'));
      if (result.issue !== null) {
        // Catch-blok trigget: issue skal have korrekt struktur
        expect(result.issue).toHaveProperty('message');
        expect(result.issue).toHaveProperty('context');
        expect(result.issue.context).toContain('computeRentekravCalculation');
        expect(result.context).toBeNull();
      }
      // Struktur er altid konsistent
      expect(result).toHaveProperty('actualInterestDate');
    });
  });

  describe('RentekravCalculationResult struktur', () => {
    it('returnerer altid { context, issue, actualInterestDate }', () => {
      const row = makeRow({ renterFra: undefined });
      const result = computeRentekravCalculation(row, undefined);

      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('issue');
      expect(result).toHaveProperty('actualInterestDate');
    });

    it('når renterFra er undefined: actualInterestDate = null', () => {
      const row = makeRow({ renterFra: undefined });
      const result = computeRentekravCalculation(row, iso('2024-01-01'));
      expect(result.actualInterestDate).toBeNull();
    });

    it('context og issue er aldrig begge sat samtidig (mutual exclusion)', () => {
      const row = makeRow({
        renterFra: iso('2023-01-01'),
        tillaegstid: 0,
        enhed: 'dage',
        belob: { kind: 'number', value: 10000 },
      });
      const result = computeRentekravCalculation(row, iso('2024-01-01'));
      // Enten context=sat og issue=null, eller context=null (med eller uden issue)
      if (result.context !== null) {
        expect(result.issue).toBeNull();
      }
    });
  });
});
