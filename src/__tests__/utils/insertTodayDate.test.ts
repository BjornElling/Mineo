// @vitest-environment jsdom
import { insertTodayDate, resolveInsertTodayDisabledReason } from '../../utils/insertTodayDate';
import { toISODateString } from '../../types/branded';

// ─── resolveInsertTodayDisabledReason ─────────────────────────────────────────

describe('resolveInsertTodayDisabledReason', () => {
  const today = toISODateString('2026-11-18');
  const max = toISODateString('2026-12-31');

  it('er aktiv, når dags dato ligger inden for feltets interval', () => {
    expect(resolveInsertTodayDisabledReason({
      today, max, lowerBounds: [{ date: toISODateString('2026-11-18'), labelBestemt: 'virkningsdatoen' }],
    })).toBeUndefined();
  });

  it('navngiver satsdækningens slutdato, når dags dato er efter den', () => {
    expect(resolveInsertTodayDisabledReason({ today, max: toISODateString('2025-12-31') }))
      .toBe('Der kan kun foretages beregninger frem til 31. december 2025');
  });

  it('navngiver den første nedre grænse, dags dato er før', () => {
    expect(resolveInsertTodayDisabledReason({
      today,
      max,
      lowerBounds: [
        undefined,
        { date: toISODateString('2026-12-01'), labelBestemt: 'virkningsdatoen' },
        { date: toISODateString('2026-12-15'), labelBestemt: 'skadedatoen' },
      ],
    })).toBe('Dags dato er før virkningsdatoen (01-12-2026)');
  });
});

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
