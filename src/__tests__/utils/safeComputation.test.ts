import { safeCompute } from '../../utils/safeComputation';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
}));

describe('safeCompute', () => {
  it('returnerer success-result ved succes', () => {
    const result = safeCompute(() => 42, 'test.context');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(42);
    }
  });

  it('returnerer failure-result ved Error-kast', () => {
    const result = safeCompute(() => {
      throw new Error('boom');
    }, 'test.context.error');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('boom');
    }
  });

  it('returnerer failure-result ved ikke-Error-kast (string)', () => {
    const result = safeCompute(() => {
      throw 'en streng';
    }, 'test.context.string');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('en streng');
    }
  });

  it('value kan returnere undefined', () => {
    const result = safeCompute(() => undefined, 'test.context.undefined');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBeUndefined();
    }
  });

  it('value kan returnere objekt', () => {
    const result = safeCompute(() => ({ a: 1 }), 'test.context.object');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ a: 1 });
    }
  });
});
