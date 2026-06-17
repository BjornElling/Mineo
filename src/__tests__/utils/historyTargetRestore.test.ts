// @vitest-environment jsdom
import type { HistoryFrame, HistoryFrameOrigin } from '../../stores/undoRedoStore';
import { scheduleHistoryTargetRestore } from '../../utils/historyTargetRestore';

/**
 * scheduleHistoryTargetRestore re-targeterer fokus til det felt en undo/redo-frame stammer fra,
 * når feltet er mountet på den restored fane. Her hævdes de tre trust-kritiske invarianter, der
 * tidligere var utestede (jf. review 9.4 / kilde 2.3):
 * 1. Kun et SYNLIGT mål må modtage fokus (isRestoreTargetVisible — skjult mål springes over).
 * 2. rAF-retry-løkken giver op efter et fast antal forsøg (HISTORY_TARGET_RESTORE_MAX_ATTEMPTS = 15).
 * 3. Restore AFBRYDER, hvis brugeren imens har flyttet fokus til et andet brugbart felt
 *    (isSameFocusScope) — undo/redo må aldrig stjæle fokus tilbage fra brugeren mid-flight.
 *
 * Vi driver kun den offentlige funktion (ikke modul-private helpers) og styrer requestAnimationFrame
 * manuelt, så hvert tick kan inspiceres og DOM/fokus ændres imellem ticks.
 */
describe('scheduleHistoryTargetRestore', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  let rafQueue: FrameRequestCallback[] = [];
  let rafSpy: ReturnType<typeof vi.fn>;

  // Kør ét tick: tøm den nuværende kø og kald dens callbacks. Et tick kan planlægge det næste,
  // som så ligger klar til næste runNextFrame().
  const runNextFrame = (): void => {
    const callbacks = rafQueue;
    rafQueue = [];
    for (const cb of callbacks) cb(0);
  };

  const makeFrame = (origin: Partial<HistoryFrameOrigin>): HistoryFrame =>
    // scheduleHistoryTargetRestore læser kun frame.origin.fieldPath/focusToken; resten er irrelevant.
    ({
      origin: { route: '/stamdata', tabKey: null, sectionKey: 'stamdata', fieldPath: null, focusToken: null, ...origin },
    } as unknown as HistoryFrame);

  beforeEach(() => {
    document.body.innerHTML = '';
    rafQueue = [];
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    globalThis.requestAnimationFrame = rafSpy as unknown as typeof requestAnimationFrame;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  it('returnerer uden at planlægge noget, når framet hverken har fieldPath eller focusToken', () => {
    scheduleHistoryTargetRestore(makeFrame({ fieldPath: null, focusToken: null }));
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('fokuserer et synligt mål fundet via fieldPath og markerer det med fokus-attributten', () => {
    const input = document.createElement('input');
    input.setAttribute('data-mineo-undo-field-path', 'row-1:0');
    document.body.appendChild(input);

    scheduleHistoryTargetRestore(makeFrame({ fieldPath: 'row-1:0' }));
    runNextFrame();

    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('data-mineo-undo-focused')).toBe('true');
  });

  it('springer et skjult mål over og giver op efter 15 forsøg uden at fokusere', () => {
    const input = document.createElement('input');
    input.setAttribute('data-mineo-undo-field-path', 'row-1:0');
    // display:none gør målet usynligt → isRestoreTargetVisible returnerer false → aldrig fokus.
    input.style.display = 'none';
    document.body.appendChild(input);

    scheduleHistoryTargetRestore(makeFrame({ fieldPath: 'row-1:0' }));

    // Kør indtil løkken selv stopper (ingen flere planlagte frames), med et loft som sikkerhedsnet.
    let guard = 0;
    while (rafQueue.length > 0 && guard < 50) {
      runNextFrame();
      guard += 1;
    }

    expect(document.activeElement).not.toBe(input);
    // 1 initial + 14 reschedules (attempts 1..14 < 15); ved attempts === 15 stopper løkken.
    expect(rafSpy).toHaveBeenCalledTimes(15);
  });

  it('afbryder restore, når brugeren imens har flyttet fokus til et andet brugbart felt', () => {
    // Brugerens oprindelige fokus (originalActiveElement) ved schedule-tidspunktet.
    const originalField = document.createElement('input');
    document.body.appendChild(originalField);
    originalField.focus();

    // Et fremmed felt brugeren flytter til mid-flight (hverken target eller original scope).
    const foreignField = document.createElement('input');
    document.body.appendChild(foreignField);

    scheduleHistoryTargetRestore(makeFrame({ fieldPath: 'row-1:0' }));

    // Tick 0: målet findes endnu ikke (attempts bliver > 0). Ingen abort på første tick.
    runNextFrame();
    expect(rafSpy).toHaveBeenCalledTimes(2); // initial + ét reschedule

    // Brugeren flytter fokus til det fremmede felt, og målet mountes nu.
    foreignField.focus();
    const target = document.createElement('input');
    target.setAttribute('data-mineo-undo-field-path', 'row-1:0');
    document.body.appendChild(target);

    // Tick 1: attempts > 0 + fremmed fokus uden for scope → afbryd uden at flytte fokus.
    runNextFrame();

    expect(document.activeElement).toBe(foreignField);
    expect(target.getAttribute('data-mineo-undo-focused')).toBeNull();
    // Ingen yderligere frame planlagt efter afbrydelsen.
    expect(rafSpy).toHaveBeenCalledTimes(2);
  });
});
