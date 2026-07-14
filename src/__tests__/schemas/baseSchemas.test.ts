import { toISODateString } from '../../types/branded';
import {
  decimalNumber,
  optionalIsoDateString,
  wholeNumber,
} from '../../schemas/formSchemas/baseSchemas';

describe('wholeNumber', () => {
  it('accepterer sikre positive og negative heltal uden domænegrænser', () => {
    expect(wholeNumber.parse('1.234')).toBe(1234);
    expect(wholeNumber.parse(-1)).toBe(-1);
    expect(wholeNumber.parse(999999)).toBe(999999);
  });

  it('normaliserer tomt input, men afviser decimaler og ufuldstændige talstrenge', () => {
    expect(wholeNumber.parse('')).toBeUndefined();
    expect(wholeNumber.parse(undefined)).toBeUndefined();
    expect(wholeNumber.parse(null)).toBeUndefined();
    expect(wholeNumber.safeParse('30,9').success).toBe(false);
    expect(wholeNumber.safeParse('30,0').success).toBe(false);
    expect(wholeNumber.safeParse(30.9).success).toBe(false);
    expect(wholeNumber.safeParse('123abc').success).toBe(false);
  });

  it('afviser non-finite og usikre heltal', () => {
    expect(wholeNumber.safeParse(Infinity).success).toBe(false);
    expect(wholeNumber.safeParse(NaN).success).toBe(false);
    expect(wholeNumber.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });
});

describe('decimalNumber', () => {
  it('coercer et fuldt dansk tal uden at håndhæve domænegrænser', () => {
    expect(decimalNumber.parse('1,5')).toBe(1.5);
    expect(decimalNumber.parse(-0.01)).toBe(-0.01);
    expect(decimalNumber.parse(100.01)).toBe(100.01);
  });

  it('afviser punktum som decimaltegn og numeriske præfikser med resttekst', () => {
    expect(decimalNumber.safeParse('1.5').success).toBe(false);
    expect(decimalNumber.safeParse('123abc').success).toBe(false);
  });

  it('afviser ikke-numerisk, non-finite og usikkert input', () => {
    expect(decimalNumber.safeParse('abc').success).toBe(false);
    expect(decimalNumber.safeParse(Infinity).success).toBe(false);
    expect(decimalNumber.safeParse(NaN).success).toBe(false);
    expect(decimalNumber.safeParse('90071992547409,92').success).toBe(false);
  });

  it('normaliserer tomt input til undefined', () => {
    expect(decimalNumber.parse('')).toBeUndefined();
    expect(decimalNumber.parse(undefined)).toBeUndefined();
  });
});

describe('optionalIsoDateString', () => {
  it('validerer kalenderdage, ikke kun formatet', () => {
    expect(optionalIsoDateString.parse(toISODateString('2024-01-31'))).toBe(toISODateString('2024-01-31'));
    expect(optionalIsoDateString.safeParse('2024-02-30').success).toBe(false);
    expect(optionalIsoDateString.safeParse('2024-13-40').success).toBe(false);
    expect(optionalIsoDateString.safeParse('31-01-2024').success).toBe(false);
  });

  it('normaliserer tom streng/null til undefined', () => {
    expect(optionalIsoDateString.parse('')).toBeUndefined();
    expect(optionalIsoDateString.parse(null)).toBeUndefined();
    expect(optionalIsoDateString.parse(undefined)).toBeUndefined();
  });
});
