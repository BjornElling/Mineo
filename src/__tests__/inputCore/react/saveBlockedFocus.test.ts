// @vitest-environment jsdom
import { focusFirstBlockingRejectedField as focusFirstBlockingRejectedFieldImpl } from '../../../inputCore/react/saveBlockedFocus';
import { lookupEditorLocation } from '../../../inputCore/react/editorLocationDestination';
import {
  FIELD_ADDRESS_ATTR,
  EDITOR_LOCATION_ATTR,
  EDITOR_ROUTE_ATTR,
  EDITOR_TAB_ATTR,
} from '../../../inputCore/react/historyRestoreTarget';
import { serializeFieldAddress, type FieldAddress } from '../../../inputCore/fieldAddress';
import { FIELD_ATTENTION_BLINK_CLASS } from '../../../inputCore/react/fieldAttentionBlink';
import { setActiveTabForPage } from '../../../hooks/usePersistedActiveTab';
import {
  getProductionInputCatalog,
  productionInputFields,
} from '../../../inputCore/catalog/productionCatalog';

// Greenfield save-blocking focus (§1.6/§3.2/§3.9): målet lokaliseres via den FULDE serialiserede feltadresse —
// samme identitet som undo/redo-restoren. Adressen reduceres ALDRIG til et feltnavn: to celler i forskellige
// rækker deler feltnavn, så en navnebaseret søgning kunne fokusere den forkerte celle.
//
// DESTINATIONEN ejes af editorlokationen (§3.2, R7-F03). Der findes ikke længere en global feltadresse→fane-
// afbildning: den mounted editor bærer sin egen route + fane i DOM. Testene nedenfor er skrevet mod netop det
// skift — særligt "hidden mounted editor vinder over sektionens side" og "et spejlet felt følger den editor,
// brugeren står ved", som den globale model kun kunne ramme med route-særregler.

vi.mock('../../../hooks/usePersistedActiveTab', () => ({ setActiveTabForPage: vi.fn() }));

const focusFirstBlockingRejectedField = (
  addresses: readonly string[],
  navigate: Parameters<typeof focusFirstBlockingRejectedFieldImpl>[1]
) => focusFirstBlockingRejectedFieldImpl(
  addresses,
  navigate,
  getProductionInputCatalog().resolveFieldLocation
);

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
    window.history.replaceState(null, '', '/stamdata');
    vi.mocked(setActiveTabForPage).mockReset();
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

    await focusFirstBlockingRejectedField([serializeFieldAddress(stamdataSkadedato)], navigate as never);

    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(target);
  });

  it('blinkmarkerer det blokerende felt med den delte markering (BF-020)', async () => {
    // Et blokeret Gem kan sende brugeren til en anden fane; uden markeringen skulle brugeren selv
    // finde det røde felt blandt de øvrige på siden.
    const target = mountFieldAt(stamdataSkadedato);
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField([serializeFieldAddress(stamdataSkadedato)], navigate as never);

    expect(target.classList.contains(FIELD_ATTENTION_BLINK_CLASS)).toBe(true);
  });

  // Kernen i adressebaseret targeting: to rækker deler feltnavnet `belob`. En navnebaseret søgning ville
  // fokusere den første celle; adressen udpeger den RIGTIGE række.
  it('rammer den korrekte række, når to rækker deler feltnavn', async () => {
    const firstRow = mountFieldAt(oevrigeKravRow('row-1', 'belob'));
    const secondRow = mountFieldAt(oevrigeKravRow('row-2', 'belob'));
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress(oevrigeKravRow('row-2', 'belob'))],
      navigate as never
    );

    expect(document.activeElement).toBe(secondRow);
    expect(document.activeElement).not.toBe(firstRow);
  });

  // R7-F03's kerne: fanen kommer fra editoren, ikke fra et globalt adresse→fane-kort. Feltet her er en
  // øvrige-krav-celle, hvis editor selv erklærer Beregning-fanen — den globale model havde nøglet dens
  // collection til EO-oplysninger og var derfor uenig med den flade, feltet faktisk står på.
  it('aktiverer den fane, DEN MOUNTEDE editor erklærer — ikke en fane udledt af adressen', async () => {
    window.history.replaceState(null, '', '/erstatningsopgoerelse');
    mountFieldAt(oevrigeKravRow('row-9', 'belob'), {
      route: '/erstatningsopgoerelse',
      tabKey: 'beregning',
      hidden: true,
    });
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress(oevrigeKravRow('row-9', 'belob'))],
      navigate as never
    );

    expect(setActiveTabForPage).toHaveBeenCalledWith('erstatningsopgoerelse', 'beregning');
    // Vi står allerede på routen; der navigeres ikke.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sammenligner destinationen med den aktuelle route efter det asynkrone mount-vent', async () => {
    const target = mountFieldAt(oevrigeKravRow('row-current-route', 'belob'), {
      route: '/erstatningsopgoerelse',
      tabKey: 'beregning',
      hidden: true,
    });
    vi.mocked(setActiveTabForPage).mockImplementation(() => {
      target.parentElement?.removeAttribute('hidden');
    });
    const navigate = vi.fn();

    const focusPromise = focusFirstBlockingRejectedField(
      [serializeFieldAddress(oevrigeKravRow('row-current-route', 'belob'))],
      navigate as never
    );
    // Simulér at routen skifter, mens fokusforløbet afventer næste frame.
    window.history.replaceState(null, '', '/erstatningsopgoerelse');
    await focusPromise;

    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(target);
  });

  // Det kontekst-delte forligsfelt. Den globale model måtte kende feltnavnet OG brugerens route for at holde
  // brugeren på Differencekrav. Her følger vi blot den synlige editor — ingen særregel findes.
  it('holder brugeren ved den SYNLIGE spejling af et delt felt uden en kontekst-særregel', async () => {
    mountFieldAt(forligDato, { route: '/erstatningsopgoerelse', tabKey: 'eo_oplysninger', hidden: true });
    const onEet = mountFieldAt(forligDato, { route: '/erhvervsevnetab', tabKey: 'differencekrav' });
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress(forligDato)],
      navigate as never
    );

    expect(document.activeElement).toBe(onEet);
    expect(navigate).not.toHaveBeenCalled();
    expect(setActiveTabForPage).not.toHaveBeenCalled();
  });

  it('aktiverer den statiske fane, når INGEN editor for feltet er monteret', async () => {
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress({ section: 'erhvervsevnetab', path: [], field: 'ealEetPct' })],
      navigate as never
    );

    expect(navigate).toHaveBeenCalledWith('/erhvervsevnetab');
    expect(setActiveTabForPage).toHaveBeenCalledWith('erhvervsevnetab', 'eet-oplysninger');
  });

  it.each([
    {
      name: 'EOs Lønindkomst-fane',
      address: {
        section: 'erstatningsopgoerelse',
        path: [{ kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: 'ans-1' }],
        field: 'navnPaaArbejdssted',
      } satisfies FieldAddress,
      route: '/erstatningsopgoerelse',
      page: 'erstatningsopgoerelse',
      tab: 'loenindkomst',
    },
    {
      name: 'EOs Offentlige ydelser-fane',
      address: {
        section: 'erstatningsopgoerelse',
        path: [{ kind: 'entity', collection: 'offentligeYdelserRows', entityId: 'ydelse-1' }],
        field: 'ydelse',
      } satisfies FieldAddress,
      route: '/erstatningsopgoerelse',
      page: 'erstatningsopgoerelse',
      tab: 'offentlige_ydelser',
    },
    {
      name: 'EOs Beregning-fane',
      address: {
        section: 'erstatningsopgoerelse',
        path: [{ kind: 'property', name: 'eoBilagSelection' }],
        field: 'midlertidigEet',
      } satisfies FieldAddress,
      route: '/erstatningsopgoerelse',
      page: 'erstatningsopgoerelse',
      tab: 'beregning',
    },
    {
      name: 'EETs Løbende ydelser-fane',
      address: {
        section: 'erhvervsevnetab',
        path: [{ kind: 'property', name: 'eetDifferencekravBilagSelection' }],
        field: 'visUdvidetSpecifikation',
      } satisfies FieldAddress,
      route: '/erhvervsevnetab',
      page: 'erhvervsevnetab',
      tab: 'loebende-ydelser',
    },
    {
      name: 'EETs Differencekrav-fane',
      address: {
        section: 'erhvervsevnetab',
        path: [{ kind: 'property', name: 'eetDifferencekravBilagSelection' }],
        field: 'kapitalisering',
      } satisfies FieldAddress,
      route: '/erhvervsevnetab',
      page: 'erhvervsevnetab',
      tab: 'differencekrav',
    },
  ])('kan mounte og fokusere rejected input på en aldrig besøgt $name', async ({
    address,
    route,
    page,
    tab,
  }) => {
    const navigate = vi.fn();
    let mountedTarget: HTMLInputElement | null = null;
    vi.mocked(setActiveTabForPage).mockImplementation(() => {
      mountedTarget = mountFieldAt(address, { route, tabKey: tab });
    });

    await focusFirstBlockingRejectedField([serializeFieldAddress(address)], navigate as never);

    expect(setActiveTabForPage).toHaveBeenCalledWith(page, tab);
    expect(navigate).toHaveBeenCalledWith(route);
    expect(mountedTarget).not.toBeNull();
    expect(document.activeElement).toBe(mountedTarget);
  });

  it('sender den delte årsløn til den prioriterede EET-editor, når ingen spejling er mounted', async () => {
    const navigate = vi.fn();
    const address = { section: 'faellesAarsloen', path: [], field: 'aslAarsloen' } satisfies FieldAddress;
    let mountedTarget: HTMLInputElement | null = null;
    vi.mocked(setActiveTabForPage).mockImplementation(() => {
      mountedTarget = mountFieldAt(address, {
        route: '/erhvervsevnetab',
        tabKey: 'eet-oplysninger',
      });
    });

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress(address)],
      navigate as never
    );

    expect(setActiveTabForPage).toHaveBeenCalledWith('erhvervsevnetab', 'eet-oplysninger');
    expect(navigate).toHaveBeenCalledWith('/erhvervsevnetab');
    expect(document.activeElement).toBe(mountedTarget);
  });

  it('er et no-op uden navigation når der ingen rejected adresser er', async () => {
    const navigate = vi.fn();
    await focusFirstBlockingRejectedField([], navigate as never);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('er fail-soft ved en ikke-kanonisk adresse (ingen navigation, ingen fokus-flytning)', async () => {
    const navigate = vi.fn();
    await focusFirstBlockingRejectedField(['ikke-en-adresse'], navigate as never);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('statisk feltlokationskatalog', () => {
  it('dækker hvert produktionsdescriptor præcis én gang', () => {
    expect(getProductionInputCatalog().fieldLocationCount).toBe(productionInputFields.length);
    for (const descriptor of productionInputFields) {
      expect(getProductionInputCatalog().resolveFieldLocation(descriptor.bind(
        ...descriptor.template.path
          .filter((segment) => segment.kind === 'entity')
          .map((_, index) => `entity-${index}`)
      ).address), descriptor.id).not.toBeNull();
    }
  });
});
