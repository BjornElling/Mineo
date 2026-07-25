// @vitest-environment jsdom
import { focusFirstBlockingRejectedField } from '../../../inputCore/react/saveBlockedFocus';
import { resolveFieldAddressDestination } from '../../../inputCore/react/fieldAddressDestination';
import { FIELD_ADDRESS_ATTR } from '../../../inputCore/react/historyRestoreTarget';
import { serializeFieldAddress, type FieldAddress } from '../../../inputCore/fieldAddress';

// Greenfield save-blocking focus (§1.6/§3.2/§3.9): målet lokaliseres via den FULDE serialiserede feltadresse —
// samme identitet som undo/redo-restoren. Adressen reduceres ALDRIG til et feltnavn: to celler i forskellige
// rækker deler feltnavn, så en navnebaseret søgning kunne fokusere den forkerte celle.

const stamdataSkadedato: FieldAddress = { section: 'stamdata', path: [], field: 'skadedato' };

const oevrigeKravRow = (rowId: string, field: string): FieldAddress => ({
  section: 'erstatningsopgoerelse',
  path: [{ kind: 'entity', collection: 'oevrigeKravPerioder', entityId: rowId }],
  field,
});

const loenindkomstCell = (afId: string, field: string): FieldAddress => ({
  section: 'erstatningsopgoerelse',
  path: [{ kind: 'entity', collection: 'loenindkomstAnsaettelsesforhold', entityId: afId }],
  field,
});

/** Monterer et fokuserbart element, der bærer feltadressen — som et greenfield-felt/celle gør. */
const mountFieldAt = (address: FieldAddress): HTMLInputElement => {
  const input = document.createElement('input');
  input.setAttribute(FIELD_ADDRESS_ATTR, serializeFieldAddress(address));
  document.body.appendChild(input);
  return input;
};

describe('resolveFieldAddressDestination', () => {
  it('udleder EO-fanen af adressens STRUKTUR, ikke af feltnavns-præfikser', () => {
    expect(resolveFieldAddressDestination(loenindkomstCell('af-1', 'belob'), '/stamdata').tabKey)
      .toBe('loenindkomst');
    expect(
      resolveFieldAddressDestination(
        { section: 'erstatningsopgoerelse', path: [{ kind: 'entity', collection: 'offentligeYdelserRows', entityId: 'r1' }], field: 'belob' },
        '/stamdata'
      ).tabKey
    ).toBe('offentlige_ydelser');
  });

  it('router den DELTE faellesAarsloen-sektion efter hvor brugeren står', () => {
    const address: FieldAddress = { section: 'faellesAarsloen', path: [], field: 'aslAarsloen' };
    expect(resolveFieldAddressDestination(address, '/forsoergertab').route).toBe('/forsoergertab');
    expect(resolveFieldAddressDestination(address, '/erhvervsevnetab').route).toBe('/erhvervsevnetab');
  });
});

describe('focusFirstBlockingRejectedField', () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    document.body.innerHTML = '';
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

  it('navigerer til adressens side, når målet ikke er monteret på den aktuelle side', async () => {
    const navigate = vi.fn();

    await focusFirstBlockingRejectedField(
      [serializeFieldAddress({ section: 'erhvervsevnetab', path: [], field: 'ealEetPct' })],
      '/stamdata',
      navigate as never
    );

    expect(navigate).toHaveBeenCalledWith('/erhvervsevnetab');
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
