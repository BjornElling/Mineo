import {
  danishToISO,
  isoToDanish,
  parseISODate,
  dateToISO,
  subtractOneDay,
  toISODateString,
} from '../../types/branded';

describe('branded.ts - Dato roundtrip tests', () => {
  describe('Roundtrip: Danish ↔ ISO', () => {
    it('roundtrip: dansk til ISO og tilbage', () => {
      const danish = '15-03-2025';
      const iso = danishToISO(danish);
      expect(iso).toBe('2025-03-15');

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
        '2025-01-01',
        '2025-06-15',
        '2025-12-31',
        '2024-02-29',  // Skudår
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
      expect(iso).toBe('2024-02-29');

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
      expect(feb28_2024).toBe('2024-02-28');
      expect(feb28_2025).toBe('2025-02-28');
    });
  });

  describe('Edge cases: Månedsskift', () => {
    it('håndterer 31. december → 1. januar over årsskifte', () => {
      const dec31 = toISODateString('2024-12-31');
      const date = parseISODate(dec31)!;

      // Manuel operation: Tilføj én dag
      date.setDate(date.getDate() + 1);
      const newYear = dateToISO(date);

      expect(newYear).toBe('2025-01-01');
    });

    it('håndterer 31. januar → 1. februar', () => {
      const jan31 = toISODateString('2025-01-31');
      const date = parseISODate(jan31)!;

      date.setDate(date.getDate() + 1);
      const feb1 = dateToISO(date);

      expect(feb1).toBe('2025-02-01');
    });

    it('håndterer månedsslut med subtractOneDay', () => {
      const firstOfMonth = toISODateString('2025-03-01');
      const lastOfPrevMonth = subtractOneDay(firstOfMonth);

      expect(lastOfPrevMonth).toBe('2025-02-28');
    });
  });

  describe('Edge cases: DST (sommertid) - roundtrip stabilitet', () => {
    it('roundtrip over DST-skift i marts (sidste søndag kl. 02:00 → 03:00)', () => {
      // 2025-03-30 er sidste søndag i marts (DST starter)
      const dates = [
        '2025-03-29',  // Lørdag før DST
        '2025-03-30',  // Søndag (DST starter kl. 02:00)
        '2025-03-31',  // Mandag efter DST
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
        '2025-10-25',  // Lørdag før DST-shift
        '2025-10-26',  // Søndag (DST slutter kl. 03:00)
        '2025-10-27',  // Mandag efter DST
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
      date.setDate(date.getDate() + 3);
      const afterDst = dateToISO(date);

      expect(afterDst).toBe('2025-03-31');

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
