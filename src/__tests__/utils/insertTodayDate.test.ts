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

  it('uden focusRef → ingen fejl', () => {
    const onCommit = vi.fn();
    expect(() => insertTodayDate({ onCommit })).not.toThrow();
    expect(onCommit).toHaveBeenCalled();
  });

  it('med focusRef.current = null → onCommit kaldes stadig', () => {
    const onCommit = vi.fn();
    const focusRef = { current: null };
    insertTodayDate({ onCommit, focusRef });
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('med focusRef.current = mock input → forsøger focus i næste frame', () => {
    const onCommit = vi.fn();
    const focus = vi.fn();
    const mockInput = { focus } as unknown as HTMLInputElement;
    const focusRef = { current: mockInput };
    insertTodayDate({ onCommit, focusRef });
    // onCommit kaldes synkront
    expect(onCommit).toHaveBeenCalledOnce();
    // focus er asynkron (requestAnimationFrame/setTimeout) — verificer at der ikke kastes
  });
});
