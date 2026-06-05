// @vitest-environment jsdom
import { setActiveTabForPage } from '../../hooks/usePersistedActiveTab';
import {
  focusFirstVisibleBlockingInputError,
  getFirstBlockingInputErrorTarget,
  navigateToBlockingInputError,
} from '../../utils/saveBlockedFocus';
import { setTableInputError, clearTableInputError } from '../../utils/tableInputErrorRegistry';

vi.mock('../../hooks/usePersistedActiveTab', () => ({
  setActiveTabForPage: vi.fn(),
}));

const flushRaf = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

describe('getFirstBlockingInputErrorTarget — aktiv fejl-resolution', () => {
  it('returnerer IKKE en overskygget/inaktiv kilde som blokerende', () => {
    // Begge kilder er severity 'error', så source-prioritet (input før schema) afgør: input vinder.
    // Den AKTIVE fejl (input) er UI-only (blocksSave:false). Den inaktive schema-kilde ser blokerende
    // ud, men er overskygget. Feltet må derfor IKKE rapporteres som blokerende (gammel kode gjorde det).
    const snapshot = (pageKey: string) =>
      pageKey === 'stamdata'
        ? {
            skadedato: {
              input: { message: 'Uden for interval', severity: 'error', source: 'input', blocksSave: false },
              schema: { message: 'Schema-fejl', severity: 'error', source: 'schema', blocksSave: true },
            },
          }
        : {};

    const target = getFirstBlockingInputErrorTarget(snapshot as never);
    expect(target).toBeNull();
  });

  it('returnerer den aktive blokerende fejl når den faktisk er aktiv', () => {
    const snapshot = (pageKey: string) =>
      pageKey === 'stamdata'
        ? {
            skadedato: {
              input: { message: 'Ugyldig dato', severity: 'error', source: 'input', blocksSave: true },
            },
          }
        : {};

    const target = getFirstBlockingInputErrorTarget(snapshot as never);
    expect(target).toEqual({ kind: 'field', pageKey: 'stamdata', fieldName: 'skadedato', message: 'Ugyldig dato' });
  });

  it('ignorerer UI-only fejl (blocksSave:false)', () => {
    const snapshot = (pageKey: string) =>
      pageKey === 'stamdata'
        ? {
            skadedato: {
              input: { message: 'Uden for interval', severity: 'error', source: 'input', blocksSave: false },
            },
          }
        : {};

    expect(getFirstBlockingInputErrorTarget(snapshot as never)).toBeNull();
  });
});

describe('navigateToBlockingInputError — synlig fejl på nuværende fane har forrang', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    document.body.innerHTML = '';
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    // jsdom: lad elementer fremstå synlige for isVisible (getClientRects + style).
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
      [{ width: 100, height: 20 } as DOMRect] as unknown as DOMRectList
    );
  });

  afterEach(() => {
    clearTableInputError('cell-1');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('fokuserer en synlig tabelcelle-fejl på nuværende fane i stedet for at navigere til et felt-mål på en anden side', async () => {
    // Synlig, blokerende tabelcelle på den aktuelle fane.
    const cell = document.createElement('input');
    document.body.appendChild(cell);
    setTableInputError('cell-1', { message: 'Ugyldig værdi', getElement: () => cell });

    // Felt-mål peger på en ANDEN side (erhvervsevnetab) — det må IKKE vinde, når cellen er synlig.
    const target = { kind: 'field' as const, pageKey: 'erhvervsevnetab' as const, fieldName: 'foo', message: 'Andet' };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    // Ingen navigation væk fra den aktuelle fane; cellen blev fokuseret.
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(cell);
  });

  it('navigerer til felt-målets side når ingen blokerende fejl er synlig på nuværende fane', async () => {
    // Ingen tabel-registret-fejl, og intet .Mui-error i DOM → ingen synlig fejl på nuværende fane.
    const target = { kind: 'field' as const, pageKey: 'erhvervsevnetab' as const, fieldName: 'foo', message: 'Andet' };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(navigate).toHaveBeenCalledWith('/erhvervsevnetab');
  });

  it('ruter faellesAarsloen til forsørgertab når brugeren står der (delt sektion, kontekst-route)', async () => {
    const target = { kind: 'field' as const, pageKey: 'faellesAarsloen' as const, fieldName: 'aarsloenMax', message: 'Mangler' };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/forsoergertab', navigate as never);
    await flushRaf();

    // Allerede på forsørgertab → ingen navigation (route === currentPathname).
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ruter faellesAarsloen til erhvervsevnetab fra enhver anden side', async () => {
    const target = { kind: 'field' as const, pageKey: 'faellesAarsloen' as const, fieldName: 'aarsloenMax', message: 'Mangler' };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(navigate).toHaveBeenCalledWith('/erhvervsevnetab');
  });
});

describe('navigateToBlockingInputError — fane-routing for EO tabel-input-fejl', () => {
  const setActiveTabMock = vi.mocked(setActiveTabForPage);

  beforeEach(() => {
    document.body.innerHTML = '';
    setActiveTabMock.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ruter en :loenindkomst-tabelfejl (pr. ansættelsesforhold) til lønindkomst-fanen', async () => {
    // Bruger står på stamdata; lønindkomst-tabellen (anden fane) har en blokerende, dynamisk fejl.
    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: 'af-123:loenindkomst',
      message: 'Ugyldig manuel regulering',
    };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(navigate).toHaveBeenCalledWith('/erstatningsopgoerelse');
    expect(setActiveTabMock).toHaveBeenCalledWith('erstatningsopgoerelse', 'loenindkomst');
  });

  it('ruter "angivet løn"-tabelfejlen til EO-oplysninger-fanen', async () => {
    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: 'eo-angivet-loen:loenindkomst',
      message: 'Ugyldig manuel regulering',
    };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(setActiveTabMock).toHaveBeenCalledWith('erstatningsopgoerelse', 'eo_oplysninger');
  });

});

describe('focusFirstVisibleBlockingInputError — fallback til tabel-registret', () => {
  let getClientRectsSpy: ReturnType<typeof vi.spyOn>;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    getClientRectsSpy = vi
      .spyOn(HTMLElement.prototype, 'getClientRects')
      .mockReturnValue([{ width: 100, height: 20 } as DOMRect] as unknown as DOMRectList);
  });

  afterEach(() => {
    clearTableInputError('loen-cell');
    getClientRectsSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    document.body.innerHTML = '';
  });

  it('fokuserer en grid-celle via tabel-registret når felt-målets message ikke matcher et .Mui-error-element', async () => {
    // Mineos grid-celler bærer IKKE .Mui-error, så findFirstVisibleErrorElement finder dem ikke.
    // Den blokerende fejl er et 'field'-mål (dynamisk ':loenindkomst'), men cellen ligger i registret.
    const cell = document.createElement('input');
    document.body.appendChild(cell);
    setTableInputError('loen-cell', { message: 'Indtastning mangler', getElement: () => cell });

    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: 'af-123:loenindkomst',
      message: 'Ugyldig manuel regulering',
    };

    const focused = await focusFirstVisibleBlockingInputError(target);

    expect(focused).toBe(true);
    expect(document.activeElement).toBe(cell);
  });
});
