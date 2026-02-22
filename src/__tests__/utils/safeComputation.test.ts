import { describe, expect, it, vi } from 'vitest';
import { safeCompute } from '../../utils/safeComputation';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
}));

describe('safeComputation', () => {
  it('safeCompute returnerer success-result ved succes', () => {
    const result = safeCompute(() => 42, 'test.context');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(42);
    }
  });

  it('safeCompute returnerer failure-result ved fejl', () => {
    const result = safeCompute(() => {
      throw new Error('boom');
    }, 'test.context.error');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('boom');
    }
  });
});
