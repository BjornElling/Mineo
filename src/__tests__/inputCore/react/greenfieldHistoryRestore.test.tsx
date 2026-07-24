// @vitest-environment jsdom
import {
  scheduleGreenfieldHistoryTargetRestore,
  findGreenfieldRestoreTarget,
  buildRestoreTargetAttributes,
  GREENFIELD_FIELD_ADDRESS_ATTR,
  GREENFIELD_EDITOR_LOCATION_ATTR,
} from '../../../inputCore/react/greenfieldHistoryRestore';
import { serializeFieldAddress, type FieldAddress } from '../../../inputCore/fieldAddress';
import type { HistoryOrigin } from '../../../inputCore/inputHistory';

/**
 * WI-003: greenfield undo/redo-fokusrestore lokaliserer målet PRÆCIST via BÅDE feltadresse OG editorlokation
 * (ikke `name`), så samme datafelt redigeret flere steder fokuserer den editor, ændringen kom fra. Testen driver
 * kun den offentlige funktion og styrer requestAnimationFrame manuelt (samme mønster som legacy-restoren).
 */

const address: FieldAddress = { section: 'faellesAarsloen', path: [], field: 'aslAarsloen' };
const serialized = serializeFieldAddress(address);

const originFor = (editorLocationId: string): HistoryOrigin => ({
  field: address,
  editorLocationId,
  route: '/erhvervsevnetab',
  tabKey: 'eet-oplysninger',
});

// Byg et input-element, der bærer restore-target-attributterne for en given editorlokation.
const makeInput = (editorLocationId: string): HTMLInputElement => {
  const input = document.createElement('input');
  const attrs = buildRestoreTargetAttributes(serialized, editorLocationId);
  input.setAttribute(GREENFIELD_FIELD_ADDRESS_ATTR, attrs[GREENFIELD_FIELD_ADDRESS_ATTR]);
  input.setAttribute(GREENFIELD_EDITOR_LOCATION_ATTR, attrs[GREENFIELD_EDITOR_LOCATION_ATTR]);
  document.body.appendChild(input);
  return input;
};

describe('findGreenfieldRestoreTarget — feltadresse + editorlokation (§3.7)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('finder KUN elementet, der bærer BÅDE feltadresse OG editorlokation', () => {
    const eet = makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    const forsoerger = makeInput('forsoergertab:aslAarsloen');

    // Samme feltadresse, to editorlokationer → restoren rammer den, ændringen kom fra.
    expect(findGreenfieldRestoreTarget(originFor('erhvervsevnetab:oplysninger:aslAarsloen'))).toBe(eet);
    expect(findGreenfieldRestoreTarget(originFor('forsoergertab:aslAarsloen'))).toBe(forsoerger);
  });

  it('returnerer null, når kun feltadressen matcher (editorlokation afviger)', () => {
    makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    expect(findGreenfieldRestoreTarget(originFor('en-anden-lokation'))).toBeNull();
  });

  it('springer et skjult mål over (display:none)', () => {
    const input = makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    input.style.display = 'none';
    expect(findGreenfieldRestoreTarget(originFor('erhvervsevnetab:oplysninger:aslAarsloen'))).toBeNull();
  });
});

describe('scheduleGreenfieldHistoryTargetRestore — fokus/scroll/fokus-ring + retry (§3.7)', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  let rafQueue: FrameRequestCallback[] = [];
  let rafSpy: ReturnType<typeof vi.fn>;

  const runNextFrame = (): void => {
    const callbacks = rafQueue;
    rafQueue = [];
    for (const cb of callbacks) cb(0);
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    rafQueue = [];
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    globalThis.requestAnimationFrame = rafSpy as unknown as typeof requestAnimationFrame;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  it('fokuserer det matchende mål og markerer det med fokus-ring-attributten', () => {
    const input = makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    scheduleGreenfieldHistoryTargetRestore(originFor('erhvervsevnetab:oplysninger:aslAarsloen'));
    runNextFrame();

    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('data-mineo-undo-focused')).toBe('true');
  });

  it('giver op efter 15 forsøg, når målet aldrig mounter', () => {
    scheduleGreenfieldHistoryTargetRestore(originFor('findes-aldrig'));
    let guard = 0;
    while (rafQueue.length > 0 && guard < 50) {
      runNextFrame();
      guard += 1;
    }
    expect(rafSpy).toHaveBeenCalledTimes(15);
  });

  it('afbryder, når brugeren imens flytter fokus til et andet brugbart felt', () => {
    const originalField = document.createElement('input');
    document.body.appendChild(originalField);
    originalField.focus();

    const foreignField = document.createElement('input');
    document.body.appendChild(foreignField);

    scheduleGreenfieldHistoryTargetRestore(originFor('erhvervsevnetab:oplysninger:aslAarsloen'));

    // Tick 0: målet findes endnu ikke → attempts bliver > 0.
    runNextFrame();
    expect(rafSpy).toHaveBeenCalledTimes(2);

    // Brugeren flytter fokus, og målet mounter nu.
    foreignField.focus();
    makeInput('erhvervsevnetab:oplysninger:aslAarsloen');

    // Tick 1: fremmed fokus uden for scope → afbryd uden at flytte fokus tilbage.
    runNextFrame();
    expect(document.activeElement).toBe(foreignField);
    expect(rafSpy).toHaveBeenCalledTimes(2);
  });
});
