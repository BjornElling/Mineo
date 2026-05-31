import {
  DEFAULT_NUMERIC_TOLERANCE,
  isWithinTolerance,
  isEffectivelyZero,
  differsFromZero,
  isGreaterThanWithTolerance,
  clampToNonNegative,
} from '../../utils/numberComparison';

// ─── isWithinTolerance ─────────────────────────────────────────────────────

describe('isWithinTolerance', () => {
  it('identiske tal → true', () => {
    expect(isWithinTolerance(5, 5)).toBe(true);
  });

  it('forskel under standard-tolerance → true', () => {
    expect(isWithinTolerance(1, 1 + DEFAULT_NUMERIC_TOLERANCE / 2)).toBe(true);
  });

  it('forskel over standard-tolerance → false', () => {
    expect(isWithinTolerance(1, 1.01)).toBe(false);
  });

  it('eksakt på tolerance-grænsen → true (≤)', () => {
    expect(isWithinTolerance(0, DEFAULT_NUMERIC_TOLERANCE)).toBe(true);
  });

  it('eksplicit tolerance respekteres', () => {
    expect(isWithinTolerance(10, 10.5, 1)).toBe(true);
    expect(isWithinTolerance(10, 11.5, 1)).toBe(false);
  });

  it('negativ tolerance behandles som absolut', () => {
    expect(isWithinTolerance(10, 10.5, -1)).toBe(true);
  });

  it('NaN/Infinity → false (fail-closed)', () => {
    expect(isWithinTolerance(Number.NaN, 0)).toBe(false);
    expect(isWithinTolerance(0, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isWithinTolerance(0, 0, Number.NaN)).toBe(false);
  });
});

// ─── isEffectivelyZero / differsFromZero ───────────────────────────────────

describe('isEffectivelyZero', () => {
  it('0 → true', () => {
    expect(isEffectivelyZero(0)).toBe(true);
  });

  it('undefined behandles som 0 → true', () => {
    expect(isEffectivelyZero(undefined)).toBe(true);
  });

  it('lille værdi under tolerance → true', () => {
    expect(isEffectivelyZero(DEFAULT_NUMERIC_TOLERANCE / 2)).toBe(true);
  });

  it('værdi over tolerance → false', () => {
    expect(isEffectivelyZero(0.5)).toBe(false);
  });
});

describe('differsFromZero', () => {
  it('er negation af isEffectivelyZero', () => {
    expect(differsFromZero(0)).toBe(false);
    expect(differsFromZero(undefined)).toBe(false);
    expect(differsFromZero(0.5)).toBe(true);
  });
});

// ─── isGreaterThanWithTolerance ────────────────────────────────────────────

describe('isGreaterThanWithTolerance', () => {
  it('klart større → true', () => {
    expect(isGreaterThanWithTolerance(5, 1)).toBe(true);
  });

  it('lige store → false (skal være strengt større end + tolerance)', () => {
    expect(isGreaterThanWithTolerance(5, 5)).toBe(false);
  });

  it('marginalt større inden for tolerance → false', () => {
    expect(isGreaterThanWithTolerance(5 + DEFAULT_NUMERIC_TOLERANCE / 2, 5)).toBe(false);
  });

  it('NaN → false', () => {
    expect(isGreaterThanWithTolerance(Number.NaN, 0)).toBe(false);
  });
});

// ─── clampToNonNegative ────────────────────────────────────────────────────

describe('clampToNonNegative', () => {
  it('positiv → uændret', () => {
    expect(clampToNonNegative(5)).toBe(5);
  });

  it('negativ → 0', () => {
    expect(clampToNonNegative(-5)).toBe(0);
  });

  it('0 → 0', () => {
    expect(clampToNonNegative(0)).toBe(0);
  });

  it('NaN/Infinity → 0 (fail-closed)', () => {
    expect(clampToNonNegative(Number.NaN)).toBe(0);
    expect(clampToNonNegative(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
