// @vitest-environment jsdom
import { scrollToEoRow } from '../../utils/scrollToEoRow';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import {
  EDITOR_ROUTE_ATTR,
  EDITOR_TAB_ATTR,
  FIELD_ADDRESS_ATTR,
} from '../../inputCore/react/historyRestoreTarget';
import {
  eoFerieperiodeFraField,
  eoSfggBeregningskildeField,
  eoSvieSmertePeriodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
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
  // tilbage til native scrollIntoView med block:'nearest' – dvs. "scroll kun hvis nødvendigt".
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

  // ── Fokusmålet er en kanonisk feltadresse ───────────────────────────────────────────────────────
  //
  // Fejlformen: en `tableId:rowScope:rowId:colIndex`-streng svarer ikke til nogen produktionsflades
  // identitet i DOM, så opslaget falder tavst igennem til rækkeankeret – og en testsuite, der aldrig
  // giver et `focusTarget`, opdager det ikke. Disse tests dækker netop den gren og hævder, at målet er
  // det element, der bærer feltets serialiserede adresse – samme identitet undo/redo bruger.

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

  it('lader SFGG-beregningskildens felt vinde over ansættelsesforholdets kort', () => {
    const field = eoSfggBeregningskildeField.bind('af-1');
    const employmentCard = document.createElement('div');
    employmentCard.setAttribute('data-mineo-row-id', 'af-1');
    document.body.appendChild(employmentCard);
    const editor = mountFieldEditor(field.address);

    scrollToEoRow('sfgg.beregningskilde.af-1', {
      focusTarget: { kind: 'fieldAddress', address: field.address },
    });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(editor);
    expect(editor.closest('.MuiInputBase-root')?.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
    expect(employmentCard.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(false);
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

  it('blinkmarkerer det felt, linket førte brugeren hen til', () => {
    const field = eoTafPeriodeFraField.bind('taf-1');
    const editor = mountFieldEditor(field.address);

    scrollToEoRow('taf.periode.taf-1', { focusTarget: { kind: 'fieldAddress', address: field.address } });

    // Scroll- og fokusmålet er editoren, mens blinket skal dække den synlige MUI-skal.
    expect(editor.closest('.MuiInputBase-root')?.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
  });

  it('blinkmarkerer rækkeankeret, når fejlen ikke har ét ansvarligt felt', () => {
    // En rækkefejl uden feltadresse (fx et overlap mellem to rækker) kan kun forankres til rækken;
    // markeringen skal da pege på det grovere – men stadig sande – mål.
    const anchor = document.createElement('div');
    anchor.setAttribute('data-mineo-row-id', 'taf-1');
    document.body.appendChild(anchor);

    scrollToEoRow('taf.periode.taf-1');

    expect(anchor.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
  });

  it('falder ikke fra et eksplicit samlet fokusmål til et overordnet kort', () => {
    const onFailure = vi.fn();
    // Ankeret her er BEVIDST et andet kort end det, målet navngiver: et samlet rækkeanker må ikke
    // kunne glide over på en nabo-flade, for så ville linket blinke noget, der ikke er årsagen.
    const otherCard = document.createElement('div');
    otherCard.setAttribute('data-mineo-row-id', 'af-2');
    document.body.appendChild(otherCard);

    scrollToEoRow('sfgg.dagssats.af-1', {
      focusTarget: { kind: 'rowId', rowId: 'af-1' },
      maxRetries: 3,
      onFailure,
    });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(otherCard.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(false);
  });

  // ── Den endnu ikke oprettede indtastning ────────────────────────────────────────────────────────
  //
  // Fejlformen der begrunder disse tests: advarslen «Der er ikke angivet nogen TAF-periode i
  // EO-perioden» handler om en række, brugeren IKKE har oprettet. Den bar tidligere et rækkeanker på
  // sit eget synthetiske id, og da `data-mineo-row-id` kun sættes på virkelige collection-rækker,
  // kunne opslaget aldrig finde noget: linket skiftede fane og blinkede intet. Tabellen viser til
  // gengæld altid sin tomme indtastningsrække, hvis celler bærer en fuldt bundet feltadresse.

  it('blinker den tomme indtastningsrækkes celle, når rækken endnu ikke findes', () => {
    // Placeholderens række-id dannes i UI'et og kan ikke kendes i domænet – her et vilkårligt slot-id.
    const placeholder = mountFieldEditor(eoTafPeriodeFraField.bind('placeholder-slot-1').address);

    scrollToEoRow('taf.ingenTafIEoPerioden', {
      focusTarget: { kind: 'collectionField', template: eoTafPeriodeFraField.template },
    });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(placeholder);
    expect(placeholder.closest('.MuiInputBase-root')?.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
  });

  it('vælger den FØRSTE række, når tabellen har flere', () => {
    const first = mountFieldEditor(eoTafPeriodeFraField.bind('taf-1').address);
    mountFieldEditor(eoTafPeriodeFraField.bind('taf-2').address);

    scrollToEoRow('taf.ophoerSkyldes', {
      focusTarget: { kind: 'collectionField', template: eoTafPeriodeFraField.template },
    });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(first);
  });

  it('rammer kun det navngivne felt – ikke en naboKOLONNE i samme collection', () => {
    // Til-cellen står FØRST i DOM, så en template-match, der kun så på collectionen, ville tage den.
    mountFieldEditor(eoTafPeriodeTilField.bind('taf-1').address);
    const fraEditor = mountFieldEditor(eoTafPeriodeFraField.bind('taf-1').address);

    scrollToEoRow('taf.ingenTafIEoPerioden', {
      focusTarget: { kind: 'collectionField', template: eoTafPeriodeFraField.template },
    });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(fraEditor);
  });

  it('rammer kun den navngivne COLLECTION – ikke en anden tabels felt med samme feltnavn', () => {
    // Ferie- og TAF-perioderne har begge et `fra`-felt; kun sektionen og collectionen skiller dem.
    mountFieldEditor(eoFerieperiodeFraField.bind('f-1').address);
    const tafEditor = mountFieldEditor(eoTafPeriodeFraField.bind('taf-1').address);

    scrollToEoRow('taf.ingenTafIEoPerioden', {
      focusTarget: { kind: 'collectionField', template: eoTafPeriodeFraField.template },
    });

    expect(scrollIntoViewMock.mock.instances[0]).toBe(tafEditor);
  });

  it('springer en skjult editor over og venter på den synlige', () => {
    // Samme regel som for en konkret feltadresse: et mountet-men-skjult felt (fx på en besøgt, men
    // ikke-aktiv fane) er ikke et brugbart mål.
    mountFieldEditor(eoTafPeriodeFraField.bind('taf-1').address, { hidden: true });
    const onFailure = vi.fn();

    scrollToEoRow('taf.ingenTafIEoPerioden', {
      focusTarget: { kind: 'collectionField', template: eoTafPeriodeFraField.template },
      maxRetries: 3,
      onFailure,
    });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
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
