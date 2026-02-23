import { describe, expect, it } from 'vitest';
import { ok, err, isErr } from '../../types/result';
import type { Result } from '../../types/result';

describe('ok', () => {
  it('wrapper en værdi i success result', () => {
    const result = ok(42);
    expect(result.success).toBe(true);
    if (result.success) expect(result.value).toBe(42);
  });

  it('fungerer med string-værdier', () => {
    const result = ok('hello');
    expect(result.success).toBe(true);
    if (result.success) expect(result.value).toBe('hello');
  });

  it('fungerer med null', () => {
    const result = ok(null);
    expect(result.success).toBe(true);
    if (result.success) expect(result.value).toBeNull();
  });

  it('fungerer med undefined', () => {
    const result = ok(undefined);
    expect(result.success).toBe(true);
  });

  it('fungerer med objekt', () => {
    const obj = { a: 1, b: 'test' };
    const result = ok(obj);
    expect(result.success).toBe(true);
    if (result.success) expect(result.value).toBe(obj);
  });
});

describe('err', () => {
  it('wrapper en fejl i failure result', () => {
    const result = err('FEJL');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('FEJL');
  });

  it('fungerer med Error-instans', () => {
    const error = new Error('noget gik galt');
    const result = err(error);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe(error);
  });

  it('fungerer med custom error type', () => {
    type MyError = 'MISSING_INPUT' | 'INVALID_DATE';
    const result = err<MyError>('MISSING_INPUT');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('MISSING_INPUT');
  });
});

describe('isErr', () => {
  it('success result → false', () => {
    expect(isErr(ok(42))).toBe(false);
  });

  it('failure result → true', () => {
    expect(isErr(err('FEJL'))).toBe(true);
  });

  it('kan bruges som type guard', () => {
    const result: Result<number, string> = err('FEJL');
    if (isErr(result)) {
      // Typesystem ved at result.error er string
      expect(typeof result.error).toBe('string');
    }
  });
});

describe('Result type', () => {
  it('success og failure er distinkte shapes', () => {
    const success: Result<number, string> = { success: true, value: 10 };
    const failure: Result<number, string> = { success: false, error: 'FEJL' };

    expect(success.success).toBe(true);
    expect(failure.success).toBe(false);
  });

  it('isErr-guard giver adgang til error-field på narrowed type', () => {
    const result: Result<number, string> = err('MANGLER');
    if (isErr(result)) {
      expect(result.error).toBe('MANGLER');
    } else {
      throw new Error('Forventede failure');
    }
  });
});
