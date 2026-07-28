// @vitest-environment jsdom
import { focusFirstBlockingRejectedField } from '../../../inputCore/react/saveBlockedFocus';
import { lookupEditorLocation } from '../../../inputCore/react/editorLocationDestination';
import {
  FIELD_ADDRESS_ATTR,
  EDITOR_LOCATION_ATTR,
  EDITOR_ROUTE_ATTR,
  EDITOR_TAB_ATTR,
} from '../../../inputCore/react/historyRestoreTarget';
import { serializeFieldAddress, type FieldAddress } from '../../../inputCore/fieldAddress';
import { setActiveTabForPage } from '../../../hooks/usePersistedActiveTab';

// Greenfield save-blocking focus (§1.6/§3.2/§3.9): målet lokaliseres via den FULDE serialiserede feltadresse —
// samme identitet som undo/redo-restoren. Adressen reduceres ALDRIG til et feltnavn: to celler i forskellige
// rækker deler feltnavn, så en navnebaseret søgning kunne fokusere den forkerte celle.
//
// DESTINATIONEN ejes af editorlokationen (§3.2, R7-F03). Der findes ikke længere en global feltadresse→fane-
// afbildning: den mounted editor bærer sin egen route + fane i DOM. Testene nedenfor er skrevet mod netop det
// skift — særligt "hidden mounted editor vinder over sektionens side" og "et spejlet felt følger den editor,
// brugeren står ved", som den globale model kun kunne ramme med særregler for `currentPathname`.

vi.mock('../../../hooks/usePersistedActiveTab', () => ({ setActiveTabForPage: vi.fn() }));

const stamdataSkadedato: FieldAddress = { section: 'stamdata', path: [], field: 'skadedato' };

const oevrigeKravRow = (rowId: string, field: string): FieldAddress => ({
  section: 'erstatningsopgoerelse',
  path: [{ kind: 'entity', collection: 'oevrigeKravPerioder', entityId: rowId }],
  field,
});

/** Det delte forligsfelt, som renderes BÅDE på EO-oplysninger og på EETs Differencekrav-fane. */
const forligDato: FieldAddress = { section: 'erstatningsopgoerelse', path: [], field: 'forligDato' };

type MountOptions = Readonly<{
  locationId?: string;
  route?: string;
  tabKey?: string | null;
  /** Skjuler elementet, som en ikke-aktiv (men mountet) fane gør. */
  hidden?: boolean;
}>;

/** Monterer et fokuserbart element, der bærer feltadresse + lokationens erklærede destination. */
const mountFieldAt = (address: FieldAddress, options: MountOptions = {}): HTMLInputElement => {
  const input = document.createElement('input');
  input.setAttribute(FIELD_ADDRESS_ATTR, serializeFieldAddress(address));
  input.setAttribute(EDITOR_LOCATION_ATTR, options.locationId ?? `loc:${address.field}`);
  input.setAttribute(EDITOR_ROUTE_ATTR, options.route ?? `/${address.section}`);
  input.setAttribute(EDITOR_TAB_ATTR, options.tabKey ?? '');

  const host = document.createElement('div');
  if (options.hidden === true) host.setAttribute('hidden', '');
  host.appendChild(input);
  document.body.appendChild(host);
  return input;
};

describe('lookupEditorLocation — destinationen ejes af editorlokationen', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
      [{ width: 100, height: 20 } as DOMRect] as unknown as DOMRectList
    );
  });
  afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

  it('læser route og fane af den editor, der faktisk renderer feltet', () => {
    mountFieldAt(oevrigeKravRow('row-1', 'belob'), {
      route: '/erstatningsopgoerelse',
      tabKey: 'eo_oplysninger',
      hidden: true,
    });

    const lookup = lookupEditorLocation(serializeFieldAddress(oevrigeKravRow('row-1', 'belob')));

    expect(lookup.kind).toBe('mounted');
    if (lookup.kind !== 'mounted') return;
    expect(lookup.destination).toEqual({ route: '/erstatningsopgoerelse', tabKey: 'eo_oplysninger' });
  });

  it('giver tabKey: null for en side uden faner (tom fane-attribut er IKKE en manglende attribut)', () => {
    mountFieldAt(stamdataSkadedato, { route: '/stamdata', tabKey: null, hidden: true });

    const lookup = lookupEditorLocation(serializeFieldAddress(stamdataSkadedato));

    expect(lookup.kind).toBe('mounted');
    if (lookup.kind !== 'mounted') return;
    expect(lookup.destination.tabKey).toBeNull();
  });

  it('behandler en lokation UDEN route (standalone/devtools) som ikke-navigerbar', () => {
    mountFieldAt(stamdataSkadedato, { route: '', hidden: true });

    expect(lookupEditorLocation(serializeFieldAddress(stamdataSkadedato)).kind).toBe('unmounted');
  });

  it('lader en SYNLIG editor vinde over en skjult spejling af samme felt', () => {
    mountFieldAt(forligDato, { route: '/erstatningsopgoerelse', tabKey: 'eo_oplysninger', hidden: true });
    const visible = mountFieldAt(forligDato, { route: '/erhvervsevnetab', tabKey: 'differencekrav' });

    const lookup = lookupEditorLocation(serializeFieldAddress(forligDato));

    expect(lookup.kind).toBe('visible');
    if (lookup.kind !== 'visible') return;
    expect(lookup.element).toBe(visible);
  });
});

describe('focusFirstBlockingRejectedField', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.mocked(setActiveTabForPage).mockClear();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
      [{ width: 100, height: 20 } as DOMRect] as unknown as DOMRectList
    );
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('fokuserer det felt adressen peger på, når det er synligt (ingen navigation væk)', async () => {
    const target = mountFieldAt(stamdataSkadedato);
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField([serializeFieldAddress(stamdataSkadedato)], '/stamdata', navigate as never);

    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(target);
  });

  // Kernen i adressebaseret targeting: to rækker deler feltnavnet `belob`. En navnebaseret søgning ville
  // fokusere den første celle; adressen udpeger den RIGTIGE række.
  it('rammer den korrekte række, når to rækker deler feltnavn', async () => {
    const firstRow = mountFieldAt(oevrigeKravRow('row-1', 'belob'));
    const secondRow = mountFieldAt(oevrigeKravRow('row-2', 'belob'));
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress(oevrigeKravRow('row-2', 'belob'))],
      '/erstatningsopgoerelse',
      navigate as never
    );

    expect(document.activeElement).toBe(secondRow);
    expect(document.activeElement).not.toBe(firstRow);
  });

  // R7-F03's kerne: fanen kommer fra editoren, ikke fra et globalt adresse→fane-kort. Feltet her er en
  // øvrige-krav-celle, hvis editor selv erklærer Beregning-fanen — den globale model havde nøglet dens
  // collection til EO-oplysninger og var derfor uenig med den flade, feltet faktisk står på.
  it('aktiverer den fane, DEN MOUNTEDE editor erklærer — ikke en fane udledt af adressen', async () => {
    mountFieldAt(oevrigeKravRow('row-9', 'belob'), {
      route: '/erstatningsopgoerelse',
      tabKey: 'beregning',
      hidden: true,
    });
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress(oevrigeKravRow('row-9', 'belob'))],
      '/erstatningsopgoerelse',
      navigate as never
    );

    expect(setActiveTabForPage).toHaveBeenCalledWith('erstatningsopgoerelse', 'beregning');
    // Vi står allerede på routen; der navigeres ikke.
    expect(navigate).not.toHaveBeenCalled();
  });

  // Det kontekst-delte forligsfelt. Den globale model måtte kende feltnavnet OG brugerens route for at holde
  // brugeren på Differencekrav. Her følger vi blot den synlige editor — ingen særregel findes.
  it('holder brugeren ved den SYNLIGE spejling af et delt felt uden en kontekst-særregel', async () => {
    mountFieldAt(forligDato, { route: '/erstatningsopgoerelse', tabKey: 'eo_oplysninger', hidden: true });
    const onEet = mountFieldAt(forligDato, { route: '/erhvervsevnetab', tabKey: 'differencekrav' });
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress(forligDato)],
      '/erhvervsevnetab',
      navigate as never
    );

    expect(document.activeElement).toBe(onEet);
    expect(navigate).not.toHaveBeenCalled();
    expect(setActiveTabForPage).not.toHaveBeenCalled();
  });

  it('navigerer til sektionens side, når INGEN editor for feltet er monteret', async () => {
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress({ section: 'erhvervsevnetab', path: [], field: 'ealEetPct' })],
      '/stamdata',
      navigate as never
    );

    expect(navigate).toHaveBeenCalledWith('/erhvervsevnetab');
    // Ingen fane gættes: kun editorlokationen ved, hvilken fane feltet redigeres på.
    expect(setActiveTabForPage).not.toHaveBeenCalled();
  });

  // `faellesAarsloen` har bevidst ingen egen route. Uden en mounted editor findes intet at vælge ud fra, og vi
  // navigerer da ikke frem for at gætte en af de to mulige sider.
  it('navigerer ikke for en delt sektion uden egen route, når intet er monteret', async () => {
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress({ section: 'faellesAarsloen', path: [], field: 'aslAarsloen' })],
      '/stamdata',
      navigate as never
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it('er et no-op uden navigation når der ingen rejected adresser er', async () => {
    const navigate = vi.fn();
    await focusFirstBlockingRejectedField([], '/stamdata', navigate as never);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('er fail-soft ved en ikke-kanonisk adresse (ingen navigation, ingen fokus-flytning)', async () => {
    const navigate = vi.fn();
    await focusFirstBlockingRejectedField(['ikke-en-adresse'], '/stamdata', navigate as never);
    expect(navigate).not.toHaveBeenCalled();
  });
});
