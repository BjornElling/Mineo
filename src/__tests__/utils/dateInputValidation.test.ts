import {
  isValidDate,
  interpretYear,
} from '../../utils/dateInputValidation';

// ─── isValidDate ──────────────────────────────────────────────────────────

describe('isValidDate', () => {
  it('15-06-2024 → gyldig', () => {
    expect(isValidDate(15, 6, 2024)).toBe(true);
  });

  it('1-1-2024 → gyldig (grænseværdi)', () => {
    expect(isValidDate(1, 1, 2024)).toBe(true);
  });

  it('31-12-2024 → gyldig (grænseværdi)', () => {
    expect(isValidDate(31, 12, 2024)).toBe(true);
  });

  it('29-02-2024 (skudår) → gyldig', () => {
    expect(isValidDate(29, 2, 2024)).toBe(true);
  });

  it('29-02-2023 (ikke-skudår) → ugyldig', () => {
    expect(isValidDate(29, 2, 2023)).toBe(false);
  });

  it('28-02-2023 (ikke-skudår) → gyldig', () => {
    expect(isValidDate(28, 2, 2023)).toBe(true);
  });

  it('31-04-2024 (april har 30 dage) → ugyldig', () => {
    expect(isValidDate(31, 4, 2024)).toBe(false);
  });

  it('30-04-2024 → gyldig', () => {
    expect(isValidDate(30, 4, 2024)).toBe(true);
  });

  it('dag = 0 → ugyldig', () => {
    expect(isValidDate(0, 6, 2024)).toBe(false);
  });

  it('dag = 32 → ugyldig', () => {
    expect(isValidDate(32, 6, 2024)).toBe(false);
  });

  it('måned = 0 → ugyldig', () => {
    expect(isValidDate(15, 0, 2024)).toBe(false);
  });

  it('måned = 13 → ugyldig', () => {
    expect(isValidDate(15, 13, 2024)).toBe(false);
  });

  it('31-01-2024 → gyldig', () => {
    expect(isValidDate(31, 1, 2024)).toBe(true);
  });

  it('31-06-2024 (juni har 30 dage) → ugyldig', () => {
    expect(isValidDate(31, 6, 2024)).toBe(false);
  });
});

// ─── interpretYear ────────────────────────────────────────────────────────

describe('interpretYear', () => {
  it('4-cifret år → returnerer som-er', () => {
    expect(interpretYear('2024')).toBe(2024);
    expect(interpretYear('1990')).toBe(1990);
  });

  it('1-cifret år → fortolkes som 200x', () => {
    expect(interpretYear('5')).toBe(2005);
    expect(interpretYear('9')).toBe(2009);
  });

  it('flytter løbende grænsen for tocifrede år med kalenderåret', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2024, 0, 1));
      expect(interpretYear('30')).toBe(1930);

      vi.setSystemTime(new Date(2025, 0, 1));
      expect(interpretYear('30')).toBe(2030);
      expect(interpretYear('31')).toBe(1931);
    } finally {
      vi.useRealTimers();
    }
  });

  it('3-cifret år → null (ugyldigt)', () => {
    expect(interpretYear('202')).toBeNull();
  });

  it('ikke-numerisk input → null (fail-closed, ikke NaN)', () => {
    // Værn mod NaN-lækage: parseInt("ab") = NaN, og uden guard ville fx
    // 2-cifret-grenen returnere 2000 + NaN = NaN i strid med number|null.
    expect(interpretYear('ab')).toBeNull();
    expect(interpretYear('x')).toBeNull();
    expect(interpretYear('abcd')).toBeNull();
  });
});
