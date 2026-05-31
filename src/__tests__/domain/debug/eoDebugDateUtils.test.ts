/**
 * Tests for eoDebugDateUtils
 */

import type { ISODateString } from '../../../types/branded';
import type { DateRange } from '../../../domain/debug/eoDebugTypes';
import { toISODateString } from '../../../types/branded';
import {
  compareIso,
  rangesOverlap,
  getOverlap,
  getIsoRange,
  isDateInRange,
  minDate,
  maxDate,
} from '../../../domain/debug/eoDebugDateUtils';

describe('eoDebugDateUtils', () => {
  describe('compareIso', () => {
    it('returnerer -1 når a < b', () => {
      const a = toISODateString('2024-01-01') as ISODateString;
      const b = toISODateString('2024-01-02') as ISODateString;
      expect(compareIso(a, b)).toBe(-1);
    });

    it('returnerer 0 når a === b', () => {
      const a = toISODateString('2024-01-01') as ISODateString;
      const b = toISODateString('2024-01-01') as ISODateString;
      expect(compareIso(a, b)).toBe(0);
    });

    it('returnerer 1 når a > b', () => {
      const a = toISODateString('2024-01-02') as ISODateString;
      const b = toISODateString('2024-01-01') as ISODateString;
      expect(compareIso(a, b)).toBe(1);
    });

    it('håndterer boundary-datoer korrekt', () => {
      const nytaar = toISODateString('2024-01-01') as ISODateString;
      const nytaarsaften = toISODateString('2023-12-31') as ISODateString;
      expect(compareIso(nytaarsaften, nytaar)).toBe(-1);
    });

    it('håndterer Store Bededag boundary', () => {
      const foer = toISODateString('2023-12-31') as ISODateString;
      const paa = toISODateString('2024-01-01') as ISODateString;
      const efter = toISODateString('2024-01-02') as ISODateString;

      expect(compareIso(foer, paa)).toBe(-1);
      expect(compareIso(paa, paa)).toBe(0);
      expect(compareIso(efter, paa)).toBe(1);
    });
  });

  describe('getOverlap', () => {
    it('returnerer ingen overlap når intervaller er helt adskilt', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-15') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };

      const result = getOverlap(a, b);
      expect(result.overlaps).toBe(false);
      expect(result.start).toBeUndefined();
      expect(result.end).toBeUndefined();
      expect(result.kind).toBeUndefined();
    });

    it('returnerer touching når a.end === b.start', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-10') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };

      const result = getOverlap(a, b);
      expect(result.overlaps).toBe(true);
      expect(result.kind).toBe('touching');
      expect(result.start).toBe(toISODateString('2024-01-10'));
      expect(result.end).toBe(toISODateString('2024-01-10'));
    });

    it('returnerer touching når b.end === a.start', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-10') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };

      const result = getOverlap(a, b);
      expect(result.overlaps).toBe(true);
      expect(result.kind).toBe('touching');
      expect(result.start).toBe(toISODateString('2024-01-10'));
      expect(result.end).toBe(toISODateString('2024-01-10'));
    });

    it('returnerer partial ved delvist overlap', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-15') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-10') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };

      const result = getOverlap(a, b);
      expect(result.overlaps).toBe(true);
      expect(result.kind).toBe('partial');
      expect(result.start).toBe(toISODateString('2024-01-10'));
      expect(result.end).toBe(toISODateString('2024-01-15'));
    });

    it('returnerer contained når a er helt inden i b', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-10') as ISODateString,
        end: toISODateString('2024-01-15') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };

      const result = getOverlap(a, b);
      expect(result.overlaps).toBe(true);
      expect(result.kind).toBe('contained');
      expect(result.start).toBe(toISODateString('2024-01-10'));
      expect(result.end).toBe(toISODateString('2024-01-15'));
    });

    it('returnerer contains når a indeholder hele b', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-10') as ISODateString,
        end: toISODateString('2024-01-15') as ISODateString,
      };

      const result = getOverlap(a, b);
      expect(result.overlaps).toBe(true);
      expect(result.kind).toBe('contains');
      expect(result.start).toBe(toISODateString('2024-01-10'));
      expect(result.end).toBe(toISODateString('2024-01-15'));
    });

    it('returnerer contains når intervallerne er identiske', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };

      const result = getOverlap(a, b);
      expect(result.overlaps).toBe(true);
      expect(result.kind).toBe('contains'); // a indeholder b
      expect(result.start).toBe(toISODateString('2024-01-01'));
      expect(result.end).toBe(toISODateString('2024-01-10'));
    });
  });

  describe('rangesOverlap', () => {
    it('returnerer true ved overlap', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-15') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-10') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };

      expect(rangesOverlap(a, b)).toBe(true);
    });

    it('returnerer false ved ingen overlap', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-15') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };

      expect(rangesOverlap(a, b)).toBe(false);
    });

    it('returnerer true ved touching (samme grænse-dato)', () => {
      const a: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };
      const b: DateRange = {
        start: toISODateString('2024-01-10') as ISODateString,
        end: toISODateString('2024-01-20') as ISODateString,
      };

      expect(rangesOverlap(a, b)).toBe(true);
    });
  });

  describe('getIsoRange', () => {
    it('genererer enkelt dag når start === end', () => {
      const start = toISODateString('2024-01-01') as ISODateString;
      const end = toISODateString('2024-01-01') as ISODateString;
      const result = getIsoRange(start, end);

      expect(result).toEqual([toISODateString('2024-01-01')]);
    });

    it('genererer interval inklusiv–inklusiv', () => {
      const start = toISODateString('2024-01-01') as ISODateString;
      const end = toISODateString('2024-01-03') as ISODateString;
      const result = getIsoRange(start, end);

      expect(result).toEqual([toISODateString('2024-01-01'), toISODateString('2024-01-02'), toISODateString('2024-01-03')]);
    });

    it('håndterer månedsskifte korrekt', () => {
      const start = toISODateString('2024-01-30') as ISODateString;
      const end = toISODateString('2024-02-02') as ISODateString;
      const result = getIsoRange(start, end);

      expect(result).toEqual([
        toISODateString('2024-01-30'),
        toISODateString('2024-01-31'),
        toISODateString('2024-02-01'),
        toISODateString('2024-02-02'),
      ]);
    });

    it('håndterer årsskifte korrekt', () => {
      const start = toISODateString('2023-12-30') as ISODateString;
      const end = toISODateString('2024-01-02') as ISODateString;
      const result = getIsoRange(start, end);

      expect(result).toEqual([
        toISODateString('2023-12-30'),
        toISODateString('2023-12-31'),
        toISODateString('2024-01-01'),
        toISODateString('2024-01-02'),
      ]);
    });

    it('håndterer skudår korrekt', () => {
      const start = toISODateString('2024-02-28') as ISODateString;
      const end = toISODateString('2024-03-01') as ISODateString;
      const result = getIsoRange(start, end);

      expect(result).toEqual([toISODateString('2024-02-28'), toISODateString('2024-02-29'), toISODateString('2024-03-01')]);
    });
  });

  describe('isDateInRange', () => {
    it('returnerer true når dato er i interval', () => {
      const date = toISODateString('2024-01-05') as ISODateString;
      const range: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };

      expect(isDateInRange(date, range)).toBe(true);
    });

    it('returnerer true når dato er start-dato (inklusiv)', () => {
      const date = toISODateString('2024-01-01') as ISODateString;
      const range: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };

      expect(isDateInRange(date, range)).toBe(true);
    });

    it('returnerer true når dato er slut-dato (inklusiv)', () => {
      const date = toISODateString('2024-01-10') as ISODateString;
      const range: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };

      expect(isDateInRange(date, range)).toBe(true);
    });

    it('returnerer false når dato er før interval', () => {
      const date = toISODateString('2023-12-31') as ISODateString;
      const range: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };

      expect(isDateInRange(date, range)).toBe(false);
    });

    it('returnerer false når dato er efter interval', () => {
      const date = toISODateString('2024-01-11') as ISODateString;
      const range: DateRange = {
        start: toISODateString('2024-01-01') as ISODateString,
        end: toISODateString('2024-01-10') as ISODateString,
      };

      expect(isDateInRange(date, range)).toBe(false);
    });
  });

  describe('minDate', () => {
    it('returnerer mindste dato', () => {
      const dates = [
        toISODateString('2024-01-10') as ISODateString,
        toISODateString('2024-01-01') as ISODateString,
        toISODateString('2024-01-05') as ISODateString,
      ];

      expect(minDate(dates)).toBe(toISODateString('2024-01-01'));
    });

    it('returnerer undefined for tomt array', () => {
      expect(minDate([])).toBeUndefined();
    });

    it('returnerer enkelt element', () => {
      const dates = [toISODateString('2024-01-01') as ISODateString];
      expect(minDate(dates)).toBe(toISODateString('2024-01-01'));
    });
  });

  describe('maxDate', () => {
    it('returnerer største dato', () => {
      const dates = [
        toISODateString('2024-01-10') as ISODateString,
        toISODateString('2024-01-01') as ISODateString,
        toISODateString('2024-01-05') as ISODateString,
      ];

      expect(maxDate(dates)).toBe(toISODateString('2024-01-10'));
    });

    it('returnerer undefined for tomt array', () => {
      expect(maxDate([])).toBeUndefined();
    });

    it('returnerer enkelt element', () => {
      const dates = [toISODateString('2024-01-01') as ISODateString];
      expect(maxDate(dates)).toBe(toISODateString('2024-01-01'));
    });
  });
});
