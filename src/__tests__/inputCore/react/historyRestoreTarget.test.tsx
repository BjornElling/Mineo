// @vitest-environment jsdom
import {
  scheduleHistoryTargetRestore,
  findRestoreTarget,
  buildRestoreTargetAttributes,
  FIELD_ADDRESS_ATTR,
  EDITOR_LOCATION_ATTR,
} from '../../../inputCore/react/historyRestoreTarget';
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
  kind: 'field' as const,
  field: address,
  editorLocationId,
  route: '/erhvervsevnetab',
  tabKey: 'eet-oplysninger',
});

// Byg et input-element, der bærer restore-target-attributterne for en given editorlokation.
const makeInput = (editorLocationId: string): HTMLInputElement => {
  const input = document.createElement('input');
  const attrs = buildRestoreTargetAttributes(serialized, editorLocationId, '/erhvervsevnetab', 'eet-oplysninger');
  input.setAttribute(FIELD_ADDRESS_ATTR, attrs[FIELD_ADDRESS_ATTR]);
  input.setAttribute(EDITOR_LOCATION_ATTR, attrs[EDITOR_LOCATION_ATTR]);
  document.body.appendChild(input);
  return input;
};

describe('findRestoreTarget — feltadresse + editorlokation (§3.7)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('finder KUN elementet, der bærer BÅDE feltadresse OG editorlokation', () => {
    const eet = makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    const forsoerger = makeInput('forsoergertab:aslAarsloen');

    // Samme feltadresse, to editorlokationer → restoren rammer den, ændringen kom fra.
    expect(findRestoreTarget(originFor('erhvervsevnetab:oplysninger:aslAarsloen'))).toBe(eet);
    expect(findRestoreTarget(originFor('forsoergertab:aslAarsloen'))).toBe(forsoerger);
  });

  it('returnerer null, når kun feltadressen matcher (editorlokation afviger)', () => {
    makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    expect(findRestoreTarget(originFor('en-anden-lokation'))).toBeNull();
  });

  it('springer et skjult mål over (display:none)', () => {
    const input = makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    input.style.display = 'none';
    expect(findRestoreTarget(originFor('erhvervsevnetab:oplysninger:aslAarsloen'))).toBeNull();
  });

  // En STRUKTUREL rækkehandling (insert/delete/reorder) har ingen feltadresse: der findes intet enkelt felt at
  // fokusere. Origin bærer stadig route + fane, så shellen kan navigere til den tabel, ændringen kom fra.
  // Unionens `kind` gør forskellen type-synlig — en `collection`-origin KAN ikke bære en feltadresse.
  it('har intet fokusmål for en rækkehandlings-origin (kind: collection)', () => {
    makeInput('eo.oevrigeKrav:rows:oevrigeKravPerioder');
    const rowOrigin: HistoryOrigin = {
      kind: 'collection',
      collection: 'oevrigeKravPerioder',
      editorLocationId: 'eo.oevrigeKrav:rows:oevrigeKravPerioder',
      route: '/erstatningsopgoerelse',
      tabKey: 'eo_oplysninger',
    };

    expect(findRestoreTarget(rowOrigin)).toBeNull();
    // Navigationsmetadata er bevaret, så shellen fortsat kan sætte fane + route.
    expect(rowOrigin.route).toBe('/erstatningsopgoerelse');
    expect(rowOrigin.tabKey).toBe('eo_oplysninger');
  });
});

describe('scheduleHistoryTargetRestore — fokus/scroll/fokus-ring + retry (§3.7)', () => {
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
    scheduleHistoryTargetRestore(originFor('erhvervsevnetab:oplysninger:aslAarsloen'));
    runNextFrame();

    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('data-mineo-undo-focused')).toBe('true');
  });

  /**
   * Et mål, der aldrig dukker op, er en BRUDT INVARIANT (undo-redo-contract §5): efter en gennemført restore er
   * originens tilstand aktuel igen, så dens editorlokation skal findes i DOM. Klassen var usynlig, netop fordi
   * løkken opgav tavst — brugeren så blot, at fokus ikke flyttede sig, og BF-005 kunne leve i månedsvis.
   * Diagnostikken skal derfor navngive BEGGE halvdele af identiteten, for et brud sidder typisk i
   * editorlokationen og ikke i feltadressen.
   */
  it('giver op efter 15 forsøg og rapporterer den brudte invariant, når målet aldrig mounter', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    scheduleHistoryTargetRestore(originFor('findes-aldrig'));
    let guard = 0;
    while (rafQueue.length > 0 && guard < 50) {
      runNextFrame();
      guard += 1;
    }
    expect(rafSpy).toHaveBeenCalledTimes(15);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = String(errorSpy.mock.calls[0]?.[0]);
    expect(message).toContain('[undo/redo]');
    expect(message).toContain('findes-aldrig');
  });

  /** Modstykket: lykkes restoren, er der intet at rapportere. Ellers ville værnet støje ved normal brug. */
  it('rapporterer ikke, når målet findes og fokuseres', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    makeInput('erhvervsevnetab:oplysninger:aslAarsloen');
    scheduleHistoryTargetRestore(originFor('erhvervsevnetab:oplysninger:aslAarsloen'));
    runNextFrame();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('afbryder, når brugeren imens flytter fokus til et andet brugbart felt', () => {
    const originalField = document.createElement('input');
    document.body.appendChild(originalField);
    originalField.focus();

    const foreignField = document.createElement('input');
    document.body.appendChild(foreignField);

    scheduleHistoryTargetRestore(originFor('erhvervsevnetab:oplysninger:aslAarsloen'));

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
