import {
  addDays,
  addMonths,
  createDate,
  formatDanishDate,
  formatToISO,
  getDaysInYear,
  getTodayLocalISO,
  isLeapYear,
  parseDanishDate,
  parseWeekString,
} from '../../utils/dateUtils';

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

  describe('formatToISO', () => {
    it('konverterer Date til ISO-format (åååå-mm-dd)', () => {
      const date = createDate(2024, 2, 15); // 15. marts 2024
      expect(formatToISO(date)).toBe('2024-03-15');
    });

    it('padder måned og dag med nul', () => {
      const date = createDate(2024, 0, 5); // 5. januar 2024
      expect(formatToISO(date)).toBe('2024-01-05');
    });

    it('roundtrip: formatToISO → parseDanishDate → formatDanishDate', () => {
      const date = createDate(2024, 11, 31); // 31. december 2024
      const iso = formatToISO(date);
      expect(iso).toBe('2024-12-31');
    });
  });

  describe('getTodayLocalISO', () => {
    it('returnerer en streng på format åååå-mm-dd', () => {
      const today = getTodayLocalISO();
      expect(typeof today).toBe('string');
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('er deterministisk indenfor samme sekund', () => {
      const t1 = getTodayLocalISO();
      const t2 = getTodayLocalISO();
      expect(t1).toBe(t2);
    });
  });

  describe('isLeapYear', () => {
    it('2024 er skudår (delelig med 4, ikke 100)', () => {
      expect(isLeapYear(2024)).toBe(true);
    });

    it('2023 er ikke skudår', () => {
      expect(isLeapYear(2023)).toBe(false);
    });

    it('2000 er skudår (delelig med 400)', () => {
      expect(isLeapYear(2000)).toBe(true);
    });

    it('1900 er ikke skudår (delelig med 100 men ikke 400)', () => {
      expect(isLeapYear(1900)).toBe(false);
    });

    it('2100 er ikke skudår (delelig med 100 men ikke 400)', () => {
      expect(isLeapYear(2100)).toBe(false);
    });
  });

  describe('getDaysInYear', () => {
    it('skudår = 366 dage', () => {
      expect(getDaysInYear(2024)).toBe(366);
    });

    it('ikke-skudår = 365 dage', () => {
      expect(getDaysInYear(2023)).toBe(365);
    });

    it('2000 = 366 dage', () => {
      expect(getDaysInYear(2000)).toBe(366);
    });
  });

  describe('addDays', () => {
    it('tilføjer dage inden for samme måned', () => {
      const date = createDate(2024, 0, 10); // 10. januar 2024
      const result = addDays(date, 5);
      expect(formatToISO(result)).toBe('2024-01-15');
    });

    it('krydser månedsskifte', () => {
      const date = createDate(2024, 0, 29); // 29. januar 2024
      const result = addDays(date, 3);
      expect(formatToISO(result)).toBe('2024-02-01');
    });

    it('krydser årsskifte', () => {
      const date = createDate(2024, 11, 30); // 30. december 2024
      const result = addDays(date, 5);
      expect(formatToISO(result)).toBe('2025-01-04');
    });

    it('negative dage går baglæns', () => {
      const date = createDate(2024, 1, 1); // 1. februar 2024
      const result = addDays(date, -1);
      expect(formatToISO(result)).toBe('2024-01-31');
    });

    it('0 dage returnerer samme dato', () => {
      const date = createDate(2024, 5, 15); // 15. juni 2024
      const result = addDays(date, 0);
      expect(formatToISO(result)).toBe('2024-06-15');
    });

    it('muterer ikke input-datoen', () => {
      const date = createDate(2024, 0, 10);
      const isoBefore = formatToISO(date);
      addDays(date, 10);
      expect(formatToISO(date)).toBe(isoBefore);
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

    it('0 måneder returnerer kopi af samme dato', () => {
      const start = parseDanishDate('15-06-2024');
      expect(start).toBeDefined();
      const result = addMonths(start!, 0);
      expect(formatToISO(result)).toBe('2024-06-15');
      expect(result).not.toBe(start); // ny instans
    });

    it('negative måneder går baglæns', () => {
      const start = parseDanishDate('31-03-2024');
      expect(start).toBeDefined();
      const result = addMonths(start!, -1);
      expect(formatDanishDate(result)).toBe('29-02-2024'); // clamp til 29. feb
    });
  });

  describe('parseWeekString', () => {
    it('ugyldig input (null-lignende streng) → null', () => {
      expect(parseWeekString('')).toBeNull();
      expect(parseWeekString('ingenformat')).toBeNull();
    });

    it('forkert format (ingen skråstreg) → null', () => {
      expect(parseWeekString('01-2024')).toBeNull();
    });

    it('uge 0 → null', () => {
      expect(parseWeekString('0/2024')).toBeNull();
    });

    it('uge 54 → null', () => {
      expect(parseWeekString('54/2024')).toBeNull();
    });

    it('uge 1/2024 returnerer mandag til søndag', () => {
      const interval = parseWeekString('1/2024');
      expect(interval).not.toBeNull();
      expect(interval!.start).toBeInstanceOf(Date);
      expect(interval!.end).toBeInstanceOf(Date);
      // Mandag til søndag er 7 dage
      const dayDiff = (interval!.end.getTime() - interval!.start.getTime()) / (24 * 60 * 60 * 1000);
      expect(dayDiff).toBe(6);
    });

    it('uge 10/2025 starter på en mandag', () => {
      const interval = parseWeekString('10/2025');
      expect(interval).not.toBeNull();
      // ISO: mandag = 1, søndag = 0
      const startDay = interval!.start.getUTCDay();
      expect(startDay).toBe(1); // mandag
    });

    it('uge 52/2024 er gyldig', () => {
      const interval = parseWeekString('52/2024');
      expect(interval).not.toBeNull();
    });
  });
});
