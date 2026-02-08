import { addMonths, formatDanishDate, parseDanishDate } from '../../utils/dateUtils';

describe('dateUtils', () => {
  describe('parseDanishDate', () => {
    it('roundtrip: parse + format giver samme dato', () => {
      const parsed = parseDanishDate('15-03-2025');
      expect(parsed).toBeDefined();
      expect(formatDanishDate(parsed!)).toBe('15-03-2025');
    });

    it('afviser ugyldige datoer', () => {
      expect(parseDanishDate('31-02-2024')).toBeNull();
      expect(parseDanishDate('01-01-1899')).toBeNull();
    });
  });

  describe('addMonths', () => {
    it('clamp: 31-01-2024 + 1 måned = 29-02-2024', () => {
      const start = parseDanishDate('31-01-2024');
      expect(start).toBeDefined();
      const result = addMonths(start!, 1);
      expect(formatDanishDate(result)).toBe('29-02-2024');
    });

    it('30-11-2024 + 1 måned = 30-12-2024', () => {
      const start = parseDanishDate('30-11-2024');
      expect(start).toBeDefined();
      const result = addMonths(start!, 1);
      expect(formatDanishDate(result)).toBe('30-12-2024');
    });

    it('29-02-2024 + 12 måneder = 28-02-2025', () => {
      const start = parseDanishDate('29-02-2024');
      expect(start).toBeDefined();
      const result = addMonths(start!, 12);
      expect(formatDanishDate(result)).toBe('28-02-2025');
    });
  });
});
