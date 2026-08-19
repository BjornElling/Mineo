import { danishDateToComparableNumber, coerceToDanishDateString, coerceToISODateString, danishToISO, dateToISO, isDanishDateString, isISODateString, isoToDanish, parseISODate, toDanishDateString, toISODateString } from '../../types/branded';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';

describe('branded.ts - Dato roundtrip tests', () => {
  describe('Roundtrip: Danish ↔ ISO', () => {
    it('roundtrip: dansk til ISO og tilbage', () => {
      const danish = '15-03-2025';
      const iso = danishToISO(danish);
      expect(iso).toBe(toISODateString('2025-03-15'));

      const backToDanish = isoToDanish(iso!);
      expect(backToDanish).toBe(danish);
    });

    it('roundtrip: batch af datoer', () => {
      const dates = [
        '01-01-2025',
        '15-06-2025',
        '31-12-2025',
        '29-02-2024',  // Skudår
      ];

      for (const danish of dates) {
        const iso = danishToISO(danish);
        expect(iso).toBeDefined();
        const backToDanish = isoToDanish(iso!);
        expect(backToDanish).toBe(danish);
      }
    });
  });

  describe('Roundtrip: ISO ↔ Date ↔ ISO', () => {
    it('roundtrip: ISO til Date til ISO', () => {
      const iso = toISODateString('2025-03-15');
      const date = parseISODate(iso);
      expect(date).toBeDefined();

      const backToIso = dateToISO(date!);
      expect(backToIso).toBe(iso);
    });

    it('roundtrip: batch af ISO-datoer', () => {
      const isoDates = [
        toISODateString('2025-01-01'),
        toISODateString('2025-06-15'),
        toISODateString('2025-12-31'),
        toISODateString('2024-02-29'),  // Skudår
      ];

      for (const iso of isoDates) {
        const isoDate = toISODateString(iso);
        const date = parseISODate(isoDate);
        expect(date).toBeDefined();
        const backToIso = dateToISO(date!);
        expect(backToIso).toBe(iso);
      }
    });
  });

  describe('Edge cases: Skudår', () => {
    it('håndterer 29. februar i skudår', () => {
      const danish = '29-02-2024';  // 2024 er skudår
      const iso = danishToISO(danish);
      expect(iso).toBe(toISODateString('2024-02-29'));

      // Roundtrip
      const backToDanish = isoToDanish(iso!);
      expect(backToDanish).toBe(danish);
    });

    it('afviser 29. februar i ikke-skudår', () => {
      const danish = '29-02-2025';  // 2025 er IKKE skudår
      const iso = danishToISO(danish);
      expect(iso).toBeUndefined();
    });

    it('accepterer 28. februar i alle år', () => {
      const feb28_2024 = danishToISO('28-02-2024');
      const feb28_2025 = danishToISO('28-02-2025');
      expect(feb28_2024).toBe(toISODateString('2024-02-28'));
      expect(feb28_2025).toBe(toISODateString('2025-02-28'));
    });
  });

  describe('toDanishDateString', () => {
    it('accepterer gyldig skudårs-dato', () => {
      expect(toDanishDateString('29-02-2024')).toBe('29-02-2024');
    });

    it('afviser ikke-eksisterende dato', () => {
      expect(() => toDanishDateString('31-02-2024')).toThrow('Invalid Danish date string');
    });

    it('afviser dag 00', () => {
      expect(() => toDanishDateString('00-01-2024')).toThrow('Invalid Danish date string');
    });
  });

  describe('Edge cases: Månedsskift', () => {
    it('håndterer 31. december → 1. januar over årsskifte', () => {
      const dec31 = toISODateString('2024-12-31');
      const date = parseISODate(dec31)!;

      // Manuel operation: Tilføj én dag
      date.setUTCDate(date.getUTCDate() + 1);
      const newYear = dateToISO(date);

      expect(newYear).toBe(toISODateString('2025-01-01'));
    });

    it('håndterer 31. januar → 1. februar', () => {
      const jan31 = toISODateString('2025-01-31');
      const date = parseISODate(jan31)!;

      date.setUTCDate(date.getUTCDate() + 1);
      const feb1 = dateToISO(date);

      expect(feb1).toBe(toISODateString('2025-02-01'));
    });

    it('håndterer månedsslut med getDayBeforeIso', () => {
      const firstOfMonth = toISODateString('2025-03-01');
      const lastOfPrevMonth = getDayBeforeIso(firstOfMonth);

      expect(lastOfPrevMonth).toBe(toISODateString('2025-02-28'));
    });
  });

  describe('Edge cases: DST (sommertid) - roundtrip stabilitet', () => {
    it('roundtrip over DST-skift i marts (sidste søndag kl. 02:00 → 03:00)', () => {
      // 2025-03-30 er sidste søndag i marts (DST starter)
      const dates = [
        toISODateString('2025-03-29'),  // Lørdag før DST
        toISODateString('2025-03-30'),  // Søndag (DST starter kl. 02:00)
        toISODateString('2025-03-31'),  // Mandag efter DST
      ];

      for (const isoDate of dates) {
        const iso = toISODateString(isoDate);
        const date = parseISODate(iso);
        expect(date).toBeDefined();

        // Roundtrip skal være stabil
        const backToIso = dateToISO(date!);
        expect(backToIso).toBe(isoDate);
      }
    });

    it('roundtrip over DST-skift i oktober (sidste søndag kl. 03:00 → 02:00)', () => {
      // 2025-10-26 er sidste søndag i oktober (DST slutter)
      const dates = [
        toISODateString('2025-10-25'),  // Lørdag før DST-shift
        toISODateString('2025-10-26'),  // Søndag (DST slutter kl. 03:00)
        toISODateString('2025-10-27'),  // Mandag efter DST
      ];

      for (const isoDate of dates) {
        const iso = toISODateString(isoDate);
        const date = parseISODate(iso);
        expect(date).toBeDefined();

        // Roundtrip skal være stabil
        const backToIso = dateToISO(date!);
        expect(backToIso).toBe(isoDate);
      }
    });

    it('dato-arithmetik over DST er stabil', () => {
      // Start før DST, tilføj dage, verificer roundtrip
      const beforeDst = toISODateString('2025-03-28');
      const date = parseISODate(beforeDst)!;

      // Tilføj 3 dage (går over DST-skift)
      date.setUTCDate(date.getUTCDate() + 3);
      const afterDst = dateToISO(date);

      expect(afterDst).toBe(toISODateString('2025-03-31'));

      // Roundtrip tilbage
      const roundtrip = parseISODate(afterDst);
      expect(dateToISO(roundtrip!)).toBe(afterDst);
    });
  });

  describe('Invalide datoer', () => {
    it('afviser 31. april (april har kun 30 dage)', () => {
      const iso = danishToISO('31-04-2025');
      expect(iso).toBeUndefined();
    });

    it('afviser 32. januar', () => {
      const iso = danishToISO('32-01-2025');
      expect(iso).toBeUndefined();
    });

    it('afviser måned 13', () => {
      const iso = danishToISO('15-13-2025');
      expect(iso).toBeUndefined();
    });

    it('afviser 0. dag', () => {
      const iso = danishToISO('00-03-2025');
      expect(iso).toBeUndefined();
    });

    it('afviser måned 0', () => {
      const iso = danishToISO('15-00-2025');
      expect(iso).toBeUndefined();
    });
  });
});

describe('branded.ts – type guards', () => {
  describe('isISODateString', () => {
    it('accepterer gyldigt ISO-format', () => {
      expect(isISODateString(toISODateString('2024-06-15'))).toBe(true);
    });

    it('accepterer grænseår 1900', () => {
      expect(isISODateString(toISODateString('1900-01-01'))).toBe(true);
    });

    it('accepterer grænseår 2100', () => {
      expect(isISODateString(toISODateString('2100-12-31'))).toBe(true);
    });

    it('afviser år udenfor 1900–2100', () => {
      expect(isISODateString('1899-12-31')).toBe(false);
      expect(isISODateString('2101-01-01')).toBe(false);
    });

    it('afviser ugyldig dato (31-02)', () => {
      expect(isISODateString('2024-02-31')).toBe(false);
    });

    it('afviser dansk format', () => {
      expect(isISODateString('15-06-2024')).toBe(false);
    });

    it('afviser ikke-streng', () => {
      expect(isISODateString(20240615)).toBe(false);
      expect(isISODateString(null)).toBe(false);
      expect(isISODateString(undefined)).toBe(false);
    });
  });

  describe('isDanishDateString', () => {
    it('accepterer gyldigt dansk format', () => {
      expect(isDanishDateString('15-06-2024')).toBe(true);
    });

    it('afviser ISO-format', () => {
      expect(isDanishDateString(toISODateString('2024-06-15'))).toBe(false);
    });

    it('afviser ugyldig dato (31-04)', () => {
      expect(isDanishDateString('31-04-2024')).toBe(false);
    });

    it('afviser ikke-streng', () => {
      expect(isDanishDateString(42)).toBe(false);
      expect(isDanishDateString(null)).toBe(false);
    });
  });

  describe('coerceToISODateString', () => {
    it('ISO-input returneres direkte', () => {
      expect(coerceToISODateString(toISODateString('2024-06-15'))).toBe(toISODateString('2024-06-15'));
    });

    it('dansk input konverteres til ISO', () => {
      expect(coerceToISODateString('15-06-2024')).toBe(toISODateString('2024-06-15'));
    });

    it('ugyldig streng → undefined', () => {
      expect(coerceToISODateString('ingenformat')).toBeUndefined();
    });

    it('ikke-streng → undefined', () => {
      expect(coerceToISODateString(null)).toBeUndefined();
      expect(coerceToISODateString(42)).toBeUndefined();
    });
  });

  describe('coerceToDanishDateString', () => {
    it('dansk input returneres direkte', () => {
      expect(coerceToDanishDateString('15-06-2024')).toBe('15-06-2024');
    });

    it('ISO input konverteres til dansk', () => {
      expect(coerceToDanishDateString(toISODateString('2024-06-15'))).toBe('15-06-2024');
    });

    it('ugyldig streng → undefined', () => {
      expect(coerceToDanishDateString('ingenformat')).toBeUndefined();
    });

    it('ikke-streng → undefined', () => {
      expect(coerceToDanishDateString(null)).toBeUndefined();
      expect(coerceToDanishDateString(undefined)).toBeUndefined();
    });
  });

  describe('danishDateToComparableNumber', () => {
    it('giver ÅÅÅÅMMDD som heltal', () => {
      expect(danishDateToComparableNumber(toDanishDateString('15-06-2024'))).toBe(20240615);
      expect(danishDateToComparableNumber(toDanishDateString('01-01-2001'))).toBe(20010101);
      expect(danishDateToComparableNumber(toDanishDateString('31-12-2026'))).toBe(20261231);
    });

    it('sorterer kronologisk – også over årsskifte og cifferbredder', () => {
      const datoer = ['01-10-2026', '01-04-2005', '15-06-2024', '31-12-2005']
        .map((d) => danishDateToComparableNumber(toDanishDateString(d)));
      expect([...datoer].sort((a, b) => a - b)).toEqual([20050401, 20051231, 20240615, 20261001]);
    });

    /**
     * Den ene kopi denne form afløste, splittede strengen rå. En syntaktisk gyldig, men
     * ugyldig dato blev derfor til et tal, som sorterede EFTER alle rigtige datoer – en tavs
     * fejlordning i stedet for en fejl.
     */
    it('kaster ved en syntaktisk gyldig, men ugyldig dato (frem for at give et for stort tal)', () => {
      expect(() => danishDateToComparableNumber('32-13-2024' as never)).toThrow(/Ugyldig dato/);
      expect(() => danishDateToComparableNumber('31-02-2024' as never)).toThrow(/Ugyldig dato/);
    });

    it('kaster ved uparsbar streng', () => {
      expect(() => danishDateToComparableNumber('ikke-en-dato' as never)).toThrow(/Ugyldig dato/);
    });
  });
});
