import { describe, expect, it, vi } from 'vitest';
import { safeCompute, safeComputeMultiple } from '../safeComputation';

vi.mock('../logger', () => ({
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

  it('safeComputeMultiple stopper ved første fejl', () => {
    const second = vi.fn(() => {
      throw new Error('boom');
    });
    const third = vi.fn(() => 3);

    const result = safeComputeMultiple<number>([
      () => 1,
      second,
      third,
    ], 'test.multiple');

    expect(result.success).toBe(false);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).not.toHaveBeenCalled();
  });
});
