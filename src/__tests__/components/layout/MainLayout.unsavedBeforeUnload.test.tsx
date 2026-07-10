// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../../contexts/useFormPersistence';
import type { SaveFileResult } from '../../../types/fileOperations';
import { getStorageKey } from '../../../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import type { PersistedSectionsSnapshot } from '../../../config/persistenceRegistry';
import type { StamdataValues } from '../../../schemas/formSchemas';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
}));

let pendingPwaRequest: unknown = null;

vi.mock('../../../utils/pwaLaunchQueue', () => ({
  Mineo_PWA_FILE_OPEN_EVENT: 'mineo:pwa-file-open',
  clearPendingPwaFileOpenRequest: vi.fn(async () => {
    pendingPwaRequest = null;
  }),
  getPendingPwaFileOpenRequest: () => pendingPwaRequest,
  markPendingPwaFileOpenRequestHandled: vi.fn(async (requestId: string) => {
    if ((pendingPwaRequest as { id?: string } | null)?.id === requestId) {
      pendingPwaRequest = null;
    }
  }),
}));

vi.mock('../../../utils/fileSave', () => ({
  saveToFile: vi.fn(),
}));

vi.mock('../../../utils/fileHelpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../utils/fileHelpers')>();
  return {
    ...original,
    resolveDefaultDirectoryHandle: vi.fn(async () => null),
  };
});

vi.mock('../../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: vi.fn(async () => {}),
  saveFileHandleToIndexedDB: vi.fn(async () => {}),
  deletePendingPwaOpenRequestFromIndexedDB: vi.fn(async () => true),
  loadPendingPwaOpenRequestFromIndexedDB: vi.fn(async () => null),
  savePendingPwaOpenRequestToIndexedDB: vi.fn(async () => true),
}));

vi.mock('../../../components/tables/gridCore/gridCoreRegistry', () => ({
  getGridCoreForTable: vi.fn(),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFile, loadFromFileHandle } from '../../../utils/fileLoad';
import { saveToFile } from '../../../utils/fileSave';
import { deleteFileHandleFromIndexedDB, saveFileHandleToIndexedDB } from '../../../utils/fileHandleStorage';
import { getGridCoreForTable } from '../../../components/tables/gridCore/gridCoreRegistry';
import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../../config/cellInvalidDraftScopes';
import { clickMainLayoutAction, dispatchPwaFileOpen } from './mainLayoutActionTestUtils';

const stampStamdata = (skadelidte: string): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: undefined,
  skadedato: undefined,
});

const persistedWrapper = (data: unknown) => ({
  version: PERSISTED_DATA_VERSION,
  timestamp: Date.now(),
  data,
});

const getBeforeUnloadHandler = (
  addEventListenerSpy: ReturnType<typeof vi.spyOn>
): ((event: BeforeUnloadEvent) => void) | undefined => {
  const call = addEventListenerSpy.mock.calls.find((args: unknown[]) => args[0] === 'beforeunload');
  return call?.[1] as ((event: BeforeUnloadEvent) => void) | undefined;
};

const getLastBeforeUnloadHandler = (
  addEventListenerSpy: ReturnType<typeof vi.spyOn>
): ((event: BeforeUnloadEvent) => void) | undefined => {
  const calls = addEventListenerSpy.mock.calls.filter((args: unknown[]) => args[0] === 'beforeunload');
  const lastCall = calls[calls.length - 1];
  return lastCall?.[1] as ((event: BeforeUnloadEvent) => void) | undefined;
};

const isBeforeUnloadHandlerRegistered = (
  addEventListenerSpy: ReturnType<typeof vi.spyOn>,
  removeEventListenerSpy: ReturnType<typeof vi.spyOn>
): boolean => {
  const lastHandler = getLastBeforeUnloadHandler(addEventListenerSpy);
  if (!lastHandler) return false;
  const addCount = addEventListenerSpy.mock.calls.filter(
    (args: unknown[]) => args[0] === 'beforeunload' && args[1] === lastHandler
  ).length;
  const removeCount = removeEventListenerSpy.mock.calls.filter(
    (args: unknown[]) => args[0] === 'beforeunload' && args[1] === lastHandler
  ).length;
  return addCount > removeCount;
};

const createSnapshot = (stamdataSkadelidte: string): PersistedSectionsSnapshot => ({
  stamdata: stampStamdata(stamdataSkadelidte),
  aarsloen: undefined,
  satser: undefined,
  faellesAarsloen: undefined,
  renteberegning: undefined,
  varigemen: undefined,
  forsoergertab: undefined,
  erstatningsopgoerelse: undefined,
  erhvervsevnetab: undefined,
});

describe('MainLayout (unsaved beforeunload)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    pendingPwaRequest = null;
  });

  afterEach(() => {
    document.querySelectorAll('table[data-mineo-table-navigation="true"]').forEach((el) => el.remove());
    document.querySelectorAll('[data-mineo-test-temp="true"]').forEach((el) => el.remove());
  });

  it('prevents beforeunload after committed input change', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    expect(getBeforeUnloadHandler(addEventListenerSpy)).toBeUndefined();

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Test'));
    });

    await waitFor(() => {
      expect(getBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });
    await act(async () => {});
    expect(removeEventListenerSpy.mock.calls.some((args) => args[0] === 'beforeunload')).toBe(false);
    expect(getBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();

    const handler = getBeforeUnloadHandler(addEventListenerSpy)!;
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('keeps beforeunload disabled after session hydration without a new commit', async () => {
    sessionStorage.setItem(getStorageKey('stamdata'), JSON.stringify(persistedWrapper(stampStamdata('Hydreret'))));
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(formPersistenceStore.getState().sections.stamdata?.skadelidte).toBe('Hydreret');
    });

    expect(isBeforeUnloadHandlerRegistered(addEventListenerSpy, removeEventListenerSpy)).toBe(false);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not prevent beforeunload after successful save', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const saveToFileMock = vi.mocked(saveToFile);
    saveToFileMock.mockResolvedValue({
      success: true,
      filename: 'test.eo',
    } satisfies SaveFileResult);

    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('GemMig'));
    });

    await waitFor(() => {
      expect(getBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    const beforeUnloadHandler = getBeforeUnloadHandler(addEventListenerSpy)!;

    await clickMainLayoutAction('Gem');

    await waitFor(() => {
      expect(saveToFileMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', beforeUnloadHandler);
    });

    const beforeUnloadAddCount = addEventListenerSpy.mock.calls.filter((args) => args[0] === 'beforeunload').length;
    expect(beforeUnloadAddCount).toBe(1);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('blocks save when an open locked grid editor cannot be committed', async () => {
    const saveToFileMock = vi.mocked(saveToFile);
    const getGridCoreForTableMock = vi.mocked(getGridCoreForTable);
    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const failedInput = document.createElement('input');
    failedInput.setAttribute('data-mineo-test-temp', 'true');
    document.body.appendChild(failedInput);
    const table = document.createElement('table');
    table.setAttribute('data-mineo-test-temp', 'true');
    table.setAttribute('data-mineo-table-navigation', 'true');
    table.appendChild(document.createElement('tbody'));
    document.body.appendChild(table);

    getGridCoreForTableMock.mockImplementation((node: HTMLTableElement) => {
      if (node !== table) return null;
      return {
        getEditingCell: () => ({ rowId: 'r1', colIndex: 0 }),
        getEditor: () => ({
          getElement: () => failedInput,
          getIsLocked: () => true,
          commitCurrent: () => false,
          clearAndCommit: () => {},
          cancelEdit: () => {},
          prepareEditFromKey: () => false,
          selectAll: () => {},
        }),
        clearFocusPlan: () => {},
        closeEditing: () => {},
      } as unknown as ReturnType<typeof getGridCoreForTable>;
    });

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('GemBlokeres'));
    });

    await clickMainLayoutAction('Gem');

    await waitFor(() => {
      expect(saveToFileMock).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(failedInput);
    });
  });

  it('focuses the visible invalid field when save is blocked by a blocking field error', async () => {
    const saveToFileMock = vi.mocked(saveToFile);
    let ctx: ReturnType<typeof useFormPersistence> | null = null;
    const getClientRectsSpy = vi
      .spyOn(HTMLElement.prototype, 'getClientRects')
      .mockReturnValue([{ width: 100, height: 20 } as DOMRect] as unknown as DOMRectList);
    // Scroll-adfærden ejes nu af scrollTargetIntoView (enheds-testet separat). Her er kontrakten,
    // at det blokerende, synlige felt på den aktuelle fane FOKUSERES uden at Gem hopper væk —
    // derfor stubbes scroll-API'erne blot til no-ops, og vi asserter på fokus.
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div className="Mui-error">
                <input aria-describedby="skadedato-error" readOnly />
                <span id="skadedato-error">Ugyldig dato</span>
              </div>
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('GemBlokeres'));
      ctx!.setFieldError('stamdata', 'skadedato', 'input', {
        message: 'Ugyldig dato',
        severity: 'error',
        blocksSave: true,
      });
    });

    await clickMainLayoutAction('Gem');

    await waitFor(() => {
      expect(saveToFileMock).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByRole('textbox'));
    });

    getClientRectsSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('blocks save when a table input has an uncommittable local input error', async () => {
    const saveToFileMock = vi.mocked(saveToFile);
    let ctx: ReturnType<typeof useFormPersistence> | null = null;
    const cellFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:0');
    const input = document.createElement('input');
    input.setAttribute('data-mineo-field-path', cellFieldPath);
    document.body.appendChild(input);
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('GemBlokeresAfTabelInput'));
      // En grid-celles ikke-committbare rå draft blokerer nu Gem via invalidDrafts (ikke et registry).
      ctx!.commitInvalidDraft('erstatningsopgoerelse', cellFieldPath, '12.x.2020');
    });

    await clickMainLayoutAction('Gem');

    await screen.findByText('Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.');
    expect(saveToFileMock).not.toHaveBeenCalled();

    act(() => {
      ctx!.clearInvalidDraft('erstatningsopgoerelse', cellFieldPath);
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('allows save when field error is UI-only and committed data already exists', async () => {
    const saveToFileMock = vi.mocked(saveToFile);
    saveToFileMock.mockResolvedValue({
      success: true,
      filename: 'range-ok.eo',
    } satisfies SaveFileResult);

    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Gem trods rangefejl'));
      ctx!.setFieldError('stamdata', 'skadedato', 'input', {
        message: 'Datoen ligger uden for intervallet',
        severity: 'error',
        blocksSave: false,
      });
    });

    await clickMainLayoutAction('Gem');

    await waitFor(() => {
      expect(saveToFileMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.')).not.toBeInTheDocument();
  });

  it('shows verification warning after successful save with warning details', async () => {
    const saveToFileMock = vi.mocked(saveToFile);
    saveToFileMock.mockResolvedValue({
      success: true,
      filename: 'warning.eo',
      warning: 'ADVARSEL: Manglende sektioner: stamdata',
    } satisfies SaveFileResult);

    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Gem med warning'));
    });

    await clickMainLayoutAction('Gem');

    const matches = await screen.findAllByText((_, element) => {
      const text = element?.textContent ?? '';
      return text.includes('Gemt med advarsel') && text.includes('ADVARSEL: Manglende sektioner: stamdata');
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('blocks manual load when an open locked grid editor cannot be committed', async () => {
    const loadFromFileMock = vi.mocked(loadFromFile);
    const getGridCoreForTableMock = vi.mocked(getGridCoreForTable);

    const failedInput = document.createElement('input');
    failedInput.setAttribute('data-mineo-test-temp', 'true');
    document.body.appendChild(failedInput);
    const table = document.createElement('table');
    table.setAttribute('data-mineo-test-temp', 'true');
    table.setAttribute('data-mineo-table-navigation', 'true');
    table.appendChild(document.createElement('tbody'));
    document.body.appendChild(table);

    getGridCoreForTableMock.mockImplementation((node: HTMLTableElement) => {
      if (node !== table) return null;
      return {
        getEditingCell: () => ({ rowId: 'r1', colIndex: 0 }),
        getEditor: () => ({
          getElement: () => failedInput,
          getIsLocked: () => true,
          commitCurrent: () => false,
          clearAndCommit: () => {},
          cancelEdit: () => {},
          prepareEditFromKey: () => false,
          selectAll: () => {},
        }),
        clearFocusPlan: () => {},
        closeEditing: () => {},
      } as unknown as ReturnType<typeof getGridCoreForTable>;
    });

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await clickMainLayoutAction('Hent');

    expect(loadFromFileMock).not.toHaveBeenCalled();
    await screen.findByText('Kan ikke indlæse fil: afslut eller ret det aktive felt først.');
    await waitFor(() => {
      expect(document.activeElement).toBe(failedInput);
    });
  });

  it('persists loaded file handle for later overwrite', async () => {
    const loadFromFileMock = vi.mocked(loadFromFile);
    const saveFileHandleMock = vi.mocked(saveFileHandleToIndexedDB);
    const loadedHandle = { name: 'indlaest.eo', getFile: vi.fn() } as unknown as FileSystemFileHandle;

    loadFromFileMock.mockResolvedValue({
      success: true,
      source: 'manual',
      filename: 'indlaest.eo',
      fileHandle: loadedHandle,
      snapshot: createSnapshot('Indlæst sag'),
      fieldCount: 1,
      sections: 1,
      version: '1.0.0',
    });

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await clickMainLayoutAction('Hent');

    await screen.findByText('Hentet');
    expect(saveFileHandleMock).toHaveBeenCalledWith(loadedHandle);
  });

  it('blocks PWA load when an open locked grid editor cannot be committed', async () => {
    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    const getGridCoreForTableMock = vi.mocked(getGridCoreForTable);

    const failedInput = document.createElement('input');
    failedInput.setAttribute('data-mineo-test-temp', 'true');
    document.body.appendChild(failedInput);
    const table = document.createElement('table');
    table.setAttribute('data-mineo-test-temp', 'true');
    table.setAttribute('data-mineo-table-navigation', 'true');
    table.appendChild(document.createElement('tbody'));
    document.body.appendChild(table);

    getGridCoreForTableMock.mockImplementation((node: HTMLTableElement) => {
      if (node !== table) return null;
      return {
        getEditingCell: () => ({ rowId: 'r1', colIndex: 0 }),
        getEditor: () => ({
          getElement: () => failedInput,
          getIsLocked: () => true,
          commitCurrent: () => false,
          clearAndCommit: () => {},
          cancelEdit: () => {},
          prepareEditFromKey: () => false,
          selectAll: () => {},
        }),
        clearFocusPlan: () => {},
        closeEditing: () => {},
      } as unknown as ReturnType<typeof getGridCoreForTable>;
    });

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    pendingPwaRequest = {
      id: 'pwa-open-blocked',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'blocked.eo',
      ignoredFileCount: 0,
    };

    await dispatchPwaFileOpen();

    expect(loadFromFileHandleMock).not.toHaveBeenCalled();
    await screen.findByText('Kan ikke indlæse fil: afslut eller ret det aktive felt først.');
    await waitFor(() => {
      expect(document.activeElement).toBe(failedInput);
    });
  });

  it('keeps beforeunload active when user edits while save is in progress', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const saveToFileMock = vi.mocked(saveToFile);

    let resolveSave: ((value: SaveFileResult) => void) | null = null;
    const pendingSave = new Promise<SaveFileResult>((resolve) => {
      resolveSave = resolve;
    });
    saveToFileMock.mockReturnValue(pendingSave);

    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Før gem'));
    });

    await waitFor(() => {
      expect(getLastBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    await clickMainLayoutAction('Gem');

    await waitFor(() => {
      expect(saveToFileMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Ændret under gem'));
    });

    await act(async () => {
      resolveSave?.({ success: true, filename: 'test.eo' });
      await pendingSave;
    });

    const lastHandler = getLastBeforeUnloadHandler(addEventListenerSpy);
    expect(lastHandler).toBeDefined();
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    lastHandler!(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');
    expect(isBeforeUnloadHandlerRegistered(addEventListenerSpy, removeEventListenerSpy)).toBe(true);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('clears unsaved warning on authoritative replace and re-enables on later edits', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Før'));
    });

    await waitFor(() => {
      expect(getLastBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    const firstHandler = getLastBeforeUnloadHandler(addEventListenerSpy)!;

    act(() => {
      ctx!.replaceAllPersistedData(createSnapshot('Efter load'));
    });

    await waitFor(() => {
      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', firstHandler);
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Ny ændring'));
    });

    await waitFor(() => {
      expect(getLastBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    const secondHandler = getLastBeforeUnloadHandler(addEventListenerSpy)!;
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    secondHandler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('keeps beforeunload disabled after authoritative replace until a new committed edit happens', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.replaceAllPersistedData(createSnapshot('Load baseline'));
    });

    expect(isBeforeUnloadHandlerRegistered(addEventListenerSpy, removeEventListenerSpy)).toBe(false);

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Ny ændring'));
    });

    await waitFor(() => {
      expect(getLastBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    const handler = getLastBeforeUnloadHandler(addEventListenerSpy)!;
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not leave beforeunload suppression enabled after failed "Slet alt"', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deleteFileHandleMock = vi.mocked(deleteFileHandleFromIndexedDB);
    deleteFileHandleMock.mockRejectedValue(new Error('Simuleret cleanup-fejl'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Probe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </FormPersistenceProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Før fejl'));
    });

    await clickMainLayoutAction('Slet alt');

    await waitFor(() => {
      expect(deleteFileHandleMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      ctx!.persistData('stamdata', stampStamdata('Efter fejl'));
    });

    await waitFor(() => {
      expect(getLastBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    const handler = getLastBeforeUnloadHandler(addEventListenerSpy)!;
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');
    expect(confirmSpy).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    confirmSpy.mockRestore();
  });
});
