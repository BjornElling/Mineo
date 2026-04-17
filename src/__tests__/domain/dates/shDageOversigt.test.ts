import { toISODateString } from '../../../types/branded';
import { createDate } from '../../../utils/dateUtils';
import {
  findNamedHolidaysInDateRanges,
  findNamedHolidaysInIsoRanges,
} from '../../../domain/dates/shDageOversigt';

describe('shDageOversigt', () => {
  describe('findNamedHolidaysInDateRanges', () => {
    it('samler overlappende og sammenhængende perioder uden dubletter', () => {
      const rows = findNamedHolidaysInDateRanges([
        { start: createDate(2023, 11, 25), end: createDate(2023, 11, 26) },
        { start: createDate(2023, 11, 26), end: createDate(2024, 0, 1) },
      ]);

      expect(rows.map((row) => row.navn)).toEqual([
        'Juledag',
        'Anden juledag',
        'Nytårsdag',
      ]);
      expect(rows.every((row) => row.erHverdag)).toBe(true);
    });

    it('sorterer kronologisk og medtager weekendhelligdage som ikke-SH-dage', () => {
      const rows = findNamedHolidaysInDateRanges([
        { start: createDate(2024, 4, 18), end: createDate(2024, 4, 20) },
      ]);

      expect(rows.map((row) => row.navn)).toEqual([
        'Pinsedag',
        'Anden pinsedag',
      ]);
      expect(rows.map((row) => row.erHverdag)).toEqual([false, true]);
    });
  });

  describe('findNamedHolidaysInIsoRanges', () => {
    it('returnerer tom liste ved ugyldigt interval', () => {
      const rows = findNamedHolidaysInIsoRanges([
        { fra: toISODateString('2024-01-10'), til: toISODateString('2024-01-01') },
      ]);

      expect(rows).toEqual([]);
    });

    it('samler sammenhængende ISO-intervaller uden dubletter', () => {
      const rows = findNamedHolidaysInIsoRanges([
        { fra: toISODateString('2024-03-28'), til: toISODateString('2024-03-28') },
        { fra: toISODateString('2024-03-29'), til: toISODateString('2024-04-01') },
      ]);

      expect(rows.map((row) => row.navn)).toEqual([
        'Skærtorsdag',
        'Langfredag',
        'Påskedag',
        'Anden påskedag',
      ]);
      expect(rows.map((row) => row.erHverdag)).toEqual([true, true, false, true]);
    });
  });
});
