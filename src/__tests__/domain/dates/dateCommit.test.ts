import { describe, expect, it } from 'vitest';
import { commitIsoDateFromDraftString } from '../../../domain/dates/dateCommit';

describe('commitIsoDateFromDraftString', () => {
  describe('tomt input → undefined', () => {
    it('tom streng → undefined', () => {
      expect(commitIsoDateFromDraftString('')).toBeUndefined();
    });

    it('whitespace-only streng → undefined', () => {
      expect(commitIsoDateFromDraftString('   ')).toBeUndefined();
    });
  });

  describe('gyldigt dansk datoformat (dd-mm-yyyy) → ISO dato', () => {
    it('01-01-2024 → 2024-01-01', () => {
      expect(commitIsoDateFromDraftString('01-01-2024')).toBe('2024-01-01');
    });

    it('31-12-2024 → 2024-12-31', () => {
      expect(commitIsoDateFromDraftString('31-12-2024')).toBe('2024-12-31');
    });

    it('15-06-2024 → 2024-06-15', () => {
      expect(commitIsoDateFromDraftString('15-06-2024')).toBe('2024-06-15');
    });

    it('29-02-2024 (skudår) → 2024-02-29', () => {
      expect(commitIsoDateFromDraftString('29-02-2024')).toBe('2024-02-29');
    });
  });

  describe('gyldigt ISO format (yyyy-mm-dd) → ISO dato', () => {
    it('2024-01-01 → 2024-01-01', () => {
      expect(commitIsoDateFromDraftString('2024-01-01')).toBe('2024-01-01');
    });

    it('2024-12-31 → 2024-12-31', () => {
      expect(commitIsoDateFromDraftString('2024-12-31')).toBe('2024-12-31');
    });
  });

  describe('whitespace trimmes', () => {
    it('  01-01-2024  → 2024-01-01', () => {
      expect(commitIsoDateFromDraftString('  01-01-2024  ')).toBe('2024-01-01');
    });
  });

  describe('ugyldigt format → undefined', () => {
    it('ugyldig dato-streng → undefined', () => {
      expect(commitIsoDateFromDraftString('abc')).toBeUndefined();
    });

    it('delvis dato (01-01) → undefined', () => {
      const result = commitIsoDateFromDraftString('01-01');
      // Ufuldstændig dato
      expect(result).toBeUndefined();
    });
  });
});
