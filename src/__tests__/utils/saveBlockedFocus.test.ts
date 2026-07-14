// @vitest-environment jsdom
import { setActiveTabForPage } from '../../hooks/usePersistedActiveTab';
import {
  focusFirstVisibleBlockingInputError,
  getFirstBlockingInputErrorTarget,
  navigateToBlockingInputError,
} from '../../utils/saveBlockedFocus';
import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../config/cellInvalidDraftScopes';

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

  it('returnerer en invalidDrafts-entry (ikke-committbart input) før fieldErrors og bruger fieldPath direkte', () => {
    const cellFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:0');
    const errorsSnapshot = () => ({});
    const invalidDraftsSnapshot = (pageKey: string) =>
      pageKey === 'erstatningsopgoerelse' ? { [cellFieldPath]: '12.x.2020' } : {};

    const target = getFirstBlockingInputErrorTarget(errorsSnapshot as never, invalidDraftsSnapshot);
    expect(target).toEqual({ kind: 'field', pageKey: 'erstatningsopgoerelse', fieldName: cellFieldPath, message: '' });
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
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('fokuserer en synlig blokerende celle på nuværende fane via data-mineo-field-path i stedet for at navigere', async () => {
    const cellFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:2');
    // Synlig, blokerende grid-celle på den aktuelle fane (bærer data-mineo-field-path).
    const cell = document.createElement('input');
    cell.setAttribute('data-mineo-field-path', cellFieldPath);
    document.body.appendChild(cell);

    const target = { kind: 'field' as const, pageKey: 'erstatningsopgoerelse' as const, fieldName: cellFieldPath, message: '' };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    // Ingen navigation væk fra den aktuelle fane; cellen blev fokuseret.
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(cell);
  });

  it('navigerer til felt-målets side når ingen blokerende fejl er synlig på nuværende fane', async () => {
    // Intet element med matchende data-mineo-field-path, og intet .Mui-error i DOM → ingen synlig fejl.
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

describe('navigateToBlockingInputError — fane-routing', () => {
  // Hent mocken på run-time (i beforeEach/assertions), IKKE som en collection-tidspunkt-capture.
  // En `const ... = vi.mocked(...)` i describe-kroppen evalueres under test-collection, hvor
  // modul-mock-applikationen sjældent kan race på tværs af filer ved kold parallel-collection og
  // efterlade en u-mocket binding (gav flaky "mockClear is not a function"). På run-time er mocken
  // altid anvendt.
  const setActiveTabMock = () => vi.mocked(setActiveTabForPage);

  beforeEach(() => {
    document.body.innerHTML = '';
    setActiveTabMock().mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ruter en celle-invalidDraft fieldPath til den korrekte fane via tableId-præfikset (offentlige ydelser)', async () => {
    const cellFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:0');
    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: cellFieldPath,
      message: '',
    };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(navigate).toHaveBeenCalledWith('/erstatningsopgoerelse');
    expect(setActiveTabMock()).toHaveBeenCalledWith('erstatningsopgoerelse', 'offentlige_ydelser');
  });

  it('ruter en lønindkomst-celle (standardløn pr. ansættelsesforhold) til lønindkomst-fanen', async () => {
    const cellFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-123', 'row1:2');
    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: cellFieldPath,
      message: '',
    };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(setActiveTabMock()).toHaveBeenCalledWith('erstatningsopgoerelse', 'loenindkomst');
  });

  it('ruter et nested ansættelsesforholdsfelt til lønindkomst-fanen', async () => {
    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: 'af-123:feriePct',
      message: '',
    };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(navigate).toHaveBeenCalledWith('/erstatningsopgoerelse');
    expect(setActiveTabMock()).toHaveBeenCalledWith('erstatningsopgoerelse', 'loenindkomst');
  });

  it('ruter en "angivet løn"-lønudviklingscelle til EO-oplysninger-fanen', async () => {
    const cellFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoAngivetLoenudvikling, '', 'loenudvikling1:1');
    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: cellFieldPath,
      message: '',
    };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(setActiveTabMock()).toHaveBeenCalledWith('erstatningsopgoerelse', 'eo_oplysninger');
  });

  it('ruter den syntetiske :loenindkomst-aggregatfejl (pr. ansættelsesforhold) til lønindkomst-fanen', async () => {
    // Aggregatet bevares for PDF/debug-gaten; routing-fallback til lønindkomst-fanen er stadig gyldig.
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
    expect(setActiveTabMock()).toHaveBeenCalledWith('erstatningsopgoerelse', 'loenindkomst');
  });

  it('ruter "angivet løn"-aggregatfejlen til EO-oplysninger-fanen', async () => {
    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: 'eo-angivet-loen:loenindkomst',
      message: 'Ugyldig manuel regulering',
    };
    const navigate = vi.fn();

    await navigateToBlockingInputError(target, '/stamdata', navigate as never);
    await flushRaf();

    expect(setActiveTabMock()).toHaveBeenCalledWith('erstatningsopgoerelse', 'eo_oplysninger');
  });
});

describe('focusFirstVisibleBlockingInputError — grid-celle via data-mineo-field-path', () => {
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
    getClientRectsSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    document.body.innerHTML = '';
  });

  it('fokuserer en grid-celle via data-mineo-field-path (cellen bærer IKKE .Mui-error)', async () => {
    // Mineos grid-celler bærer ikke .Mui-error, så findFirstVisibleErrorElement finder dem ikke;
    // de lokaliseres via deres stabile data-mineo-field-path (= den fuldt kvalificerede fieldPath).
    const cellFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoStandardLoen, 'af-123', 'row1:2');
    const cell = document.createElement('input');
    cell.setAttribute('data-mineo-field-path', cellFieldPath);
    document.body.appendChild(cell);

    const target = {
      kind: 'field' as const,
      pageKey: 'erstatningsopgoerelse' as const,
      fieldName: cellFieldPath,
      message: '',
    };

    const focused = await focusFirstVisibleBlockingInputError(target);

    expect(focused).toBe(true);
    expect(document.activeElement).toBe(cell);
  });
});
