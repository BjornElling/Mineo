import { isRecord, asError } from '../../utils/typeGuards';

describe('isRecord', () => {
  it('plain objekt → true', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('null → false', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('undefined → false', () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it('array → false', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
  });

  it('primitiver → false', () => {
    expect(isRecord('streng')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe('asError', () => {
  it('Error-instans returneres uændret', () => {
    const err = new Error('boom');
    expect(asError(err)).toBe(err);
  });

  it('streng pakkes i Error med samme besked', () => {
    const result = asError('noget gik galt');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('noget gik galt');
  });

  it('objekt stringificeres', () => {
    const result = asError({ code: 500 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('[object Object]');
  });

  it('null/undefined håndteres', () => {
    expect(asError(null).message).toBe('null');
    expect(asError(undefined).message).toBe('undefined');
  });
});
