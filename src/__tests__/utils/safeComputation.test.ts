import { safeCompute } from '../../utils/safeComputation';

const { reportSystemIssueMock } = vi.hoisted(() => ({
  reportSystemIssueMock: vi.fn(),
}));

vi.mock('../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

describe('safeCompute', () => {
  beforeEach(() => {
    reportSystemIssueMock.mockReset();
  });

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
    expect(reportSystemIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'safe_compute:test_context_error',
        context: 'test.context.error',
      })
    );
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

  it('kan modtage eksplicit system issue-kode', () => {
    const result = safeCompute(() => {
      throw new Error('boom');
    }, 'test.context.custom', { code: 'custom:calculation_failure' });

    expect(result.success).toBe(false);
    expect(reportSystemIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'custom:calculation_failure',
        context: 'test.context.custom',
      })
    );
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
