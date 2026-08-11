// @vitest-environment jsdom
import { insertTodayDate } from '../../utils/insertTodayDate';

// ─── insertTodayDate ──────────────────────────────────────────────────────────

describe('insertTodayDate', () => {
  it('kalder onCommit med dags dato som ISO-streng', () => {
    const onCommit = vi.fn();
    insertTodayDate({ onCommit });
    expect(onCommit).toHaveBeenCalledOnce();
    const called = onCommit.mock.calls[0][0] as string;
    expect(called).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('onCommit modtager en dato der er i dag eller nær dags dato', () => {
    const onCommit = vi.fn();
    const before = Date.now();
    insertTodayDate({ onCommit });
    const after = Date.now();
    const called = onCommit.mock.calls[0][0] as string;
    const calledMs = new Date(called).getTime();
    // Tillad ±2 dage (tidszoner kan give dag-offset)
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    expect(calledMs).toBeGreaterThan(before - twoDaysMs);
    expect(calledMs).toBeLessThan(after + twoDaysMs);
  });
});
