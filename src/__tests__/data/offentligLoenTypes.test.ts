import {
  toLoentrin,
  resolveOffentligLoenTypeFromLabel,
  OFFENTLIG_LOEN_TYPE_LABELS,
} from '../../data/offentligLoenTypes';

describe('toLoentrin', () => {
  it('"55+" → "55+"', () => {
    expect(toLoentrin('55+')).toBe('55+');
  });

  it('heltal 1 → 1', () => {
    expect(toLoentrin(1)).toBe(1);
  });

  it('heltal 55 → 55', () => {
    expect(toLoentrin(55)).toBe(55);
  });

  it('numerisk streng "1" → 1', () => {
    expect(toLoentrin('1')).toBe(1);
  });

  it('numerisk streng "55" → 55', () => {
    expect(toLoentrin('55')).toBe(55);
  });

  it('0 → kaster (under grænsen)', () => {
    expect(() => toLoentrin(0)).toThrow();
  });

  it('56 → kaster (over grænsen)', () => {
    expect(() => toLoentrin(56)).toThrow();
  });

  it('decimaltal → kaster', () => {
    expect(() => toLoentrin(1.5)).toThrow();
  });

  it('"0" → kaster', () => {
    expect(() => toLoentrin('0')).toThrow();
  });

  it('"56" → kaster', () => {
    expect(() => toLoentrin('56')).toThrow();
  });

  it('tom streng → kaster', () => {
    expect(() => toLoentrin('')).toThrow();
  });

  it('"abc" → kaster', () => {
    expect(() => toLoentrin('abc')).toThrow();
  });

  it('grænseværdier: 1 og 55 accepteres', () => {
    expect(toLoentrin(1)).toBe(1);
    expect(toLoentrin(55)).toBe(55);
  });

  it('midt-interval: 28 accepteres', () => {
    expect(toLoentrin(28)).toBe(28);
  });
});

describe('OFFENTLIG_LOEN_TYPE_LABELS', () => {
  it('MAANED = "Månedsløn"', () => {
    expect(OFFENTLIG_LOEN_TYPE_LABELS.MAANED).toBe('Månedsløn');
  });

  it('TIME = "Timeløn"', () => {
    expect(OFFENTLIG_LOEN_TYPE_LABELS.TIME).toBe('Timeløn');
  });
});

describe('resolveOffentligLoenTypeFromLabel', () => {
  it('"Månedsløn" → "maanedsLoen"', () => {
    expect(resolveOffentligLoenTypeFromLabel('Månedsløn')).toBe('maanedsLoen');
  });

  it('"Timeløn" → "timeLoen"', () => {
    expect(resolveOffentligLoenTypeFromLabel('Timeløn')).toBe('timeLoen');
  });

  it('undefined → undefined', () => {
    expect(resolveOffentligLoenTypeFromLabel(undefined)).toBeUndefined();
  });

  it('ukendt streng → undefined', () => {
    expect(resolveOffentligLoenTypeFromLabel('Årsløn')).toBeUndefined();
  });

  it('tom streng → undefined', () => {
    expect(resolveOffentligLoenTypeFromLabel('')).toBeUndefined();
  });

  it('lowercase → undefined (case-sensitiv)', () => {
    expect(resolveOffentligLoenTypeFromLabel('månedsløn')).toBeUndefined();
    expect(resolveOffentligLoenTypeFromLabel('timeløn')).toBeUndefined();
  });
});
