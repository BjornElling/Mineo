// @vitest-environment jsdom
import { scrollToEoRow } from '../../utils/scrollToEoRow';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import {
  EDITOR_ROUTE_ATTR,
  EDITOR_TAB_ATTR,
  FIELD_ADDRESS_ATTR,
} from '../../inputCore/react/historyRestoreTarget';
import {
  eoSvieSmertePeriodeTilField,
  eoTafPeriodeFraField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { FIELD_ATTENTION_BLINK_CLASS } from '../../inputCore/react/fieldAttentionBlink';

describe('scrollToEoRow', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalMatchMedia = window.matchMedia;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
  });

  // Uden for en Mineo-scroll-container (som i disse jsdom-tests) falder scrollTargetIntoView
  // tilbage til native scrollIntoView med block:'nearest' — dvs. "scroll kun hvis nødvendigt".
  it('scrolls to matching row id for suffix-based række-id', () => {
    document.body.innerHTML = '<div data-mineo-row-id="row-1"></div>';

    scrollToEoRow('sviesmerte.periode.row-1.fra');

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });

  it('supports loenindkomst row ids without trailing suffix', () => {
    document.body.innerHTML = '<div data-mineo-row-id="af-1"></div>';

    scrollToEoRow('loenindkomst.af-1');

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
  });

  it('uses non-animated scroll when reduced motion is preferred', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    document.body.innerHTML = '<div data-mineo-row-id="row-rm"></div>';

    scrollToEoRow('taf.periode.row-rm');

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' });
  });

  it('calls onFailure when row cannot be found within retry budget', () => {
    const onFailure = vi.fn();

    scrollToEoRow('taf.periode.missing-row', { maxRetries: 3, onFailure });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toContain('missing-row');
  });

  // ── Fokusmålet er en kanonisk feltadresse (GM-F10/INC-F14) ──────────────────────────────────────
  //
  // Før omlægningen var fokusmålet en `tableId:rowScope:rowId:colIndex`-streng, som INGEN produktionsflade
  // satte i DOM. Opslaget faldt derfor altid igennem til rækkeankeret, og ingen test opdagede det, fordi
  // ingen test overhovedet gav et `focusTarget`. Disse tests dækker netop den gren og hævder, at målet er
  // det element, der bærer feltets serialiserede adresse — samme identitet undo/redo bruger.

  /** Byg et fokuserbart element med præcis de attributter, form-/grid-surfacen sætter. */
  const mountFieldEditor = (
    address: ReturnType<typeof eoTafPeriodeFraField.bind>['address'],
    options: { hidden?: boolean } = {}
  ): HTMLInputElement => {
    const input = document.createElement('input');
    input.setAttribute(FIELD_ADDRESS_ATTR, serializeFieldAddress(address));
    input.setAttribute(EDITOR_ROUTE_ATTR, '/erstatningsopgoerelse');
    input.setAttribute(EDITOR_TAB_ATTR, 'eo_oplysninger');
    if (options.hidden) input.setAttribute('hidden', '');
    const surface = document.createElement('div');
    surface.className = 'MuiInputBase-root';
    surface.appendChild(input);
    document.body.appendChild(surface);
    return input;
  };

  it('scroller til feltets egen editor, når fokusmålet er en feltadresse', () => {
    const field = eoTafPeriodeFraField.bind('taf-1');
    // Rækkeankeret findes OGSÅ, så testen beviser at feltet vinder over det grovere mål.
    document.body.innerHTML = '<div data-mineo-row-id="taf-1"></div>';
    const editor = mountFieldEditor(field.address);

    scrollToEoRow('taf.periode.taf-1', { focusTarget: { kind: 'fieldAddress', address: field.address } });

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock.mock.instances[0]).toBe(editor);
  });

  it('rammer den rigtige rækkes felt, når to rækker har samme felt', () => {
    const first = eoTafPeriodeFraField.bind('taf-1');
    const second = eoTafPeriodeFraField.bind('taf-2');
    mountFieldEditor(first.address);
    const secondEditor = mountFieldEditor(second.address);

    scrollToEoRow('taf.periode.taf-2', { focusTarget: { kind: 'fieldAddress', address: second.address } });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(secondEditor);
  });

  it('skelner to felter i SAMME række, så kolonnen er præcis', () => {
    const til = eoSvieSmertePeriodeTilField.bind('ss-1');
    mountFieldEditor(eoTafPeriodeFraField.bind('ss-1').address);
    const tilEditor = mountFieldEditor(til.address);

    scrollToEoRow('sviesmerte.periode.ss-1', { focusTarget: { kind: 'fieldAddress', address: til.address } });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(tilEditor);
  });

  it('falder tilbage til rækkeankeret, når feltets editor ikke er synlig', () => {
    const field = eoTafPeriodeFraField.bind('taf-1');
    // Editoren er mountet men skjult (fx en besøgt, ikke-aktiv EO-fane). En scroll dertil ville ramme
    // ingenting, så rækkeankeret er det rigtige mål, indtil fanen bliver synlig.
    mountFieldEditor(field.address, { hidden: true });
    const anchor = document.createElement('div');
    anchor.setAttribute('data-mineo-row-id', 'taf-1');
    document.body.appendChild(anchor);

    scrollToEoRow('taf.periode.taf-1', { focusTarget: { kind: 'fieldAddress', address: field.address } });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(anchor);
  });

  it('blinkmarkerer det felt, linket førte brugeren hen til (BF-021)', () => {
    const field = eoTafPeriodeFraField.bind('taf-1');
    const editor = mountFieldEditor(field.address);

    scrollToEoRow('taf.periode.taf-1', { focusTarget: { kind: 'fieldAddress', address: field.address } });

    // Scroll- og fokusmålet er editoren, mens blinket skal dække den synlige MUI-skal.
    expect(editor.closest('.MuiInputBase-root')?.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
  });

  it('blinkmarkerer rækkeankeret, når fejlen ikke har ét ansvarligt felt', () => {
    // En rækkefejl uden feltadresse (fx et overlap mellem to rækker) kan kun forankres til rækken;
    // markeringen skal da pege på det grovere — men stadig sande — mål.
    const anchor = document.createElement('div');
    anchor.setAttribute('data-mineo-row-id', 'taf-1');
    document.body.appendChild(anchor);

    scrollToEoRow('taf.periode.taf-1');

    expect(anchor.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
  });

  it('rapporterer fejl, når hverken feltets editor eller rækkeankeret findes', () => {
    const onFailure = vi.fn();
    const field = eoTafPeriodeFraField.bind('taf-9');

    scrollToEoRow('taf.periode.taf-9', {
      focusTarget: { kind: 'fieldAddress', address: field.address },
      maxRetries: 3,
      onFailure,
    });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});
