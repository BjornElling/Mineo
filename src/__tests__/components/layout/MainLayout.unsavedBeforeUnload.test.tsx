import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../../contexts/useFormPersistence';
import type { SaveFileResult } from '../../../types/fileOperations';
import type { StorageKey } from '../../../config/storageManifest';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
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
}));

vi.mock('../../../components/tables/gridCoreRegistry', () => ({
  getGridCoreForTable: vi.fn(),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { saveToFile } from '../../../utils/fileSave';
import { deleteFileHandleFromIndexedDB } from '../../../utils/fileHandleStorage';
import { getGridCoreForTable } from '../../../components/tables/gridCoreRegistry';

const stampStamdata = (skadelidte: string) => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: '',
  skadesdato: '',
});

const getBeforeUnloadHandler = (
  addEventListenerSpy: ReturnType<typeof vi.spyOn>
): ((event: BeforeUnloadEvent) => void) | undefined => {
  const call = addEventListenerSpy.mock.calls.find((args) => args[0] === 'beforeunload');
  return call?.[1] as ((event: BeforeUnloadEvent) => void) | undefined;
};

const getLastBeforeUnloadHandler = (
  addEventListenerSpy: ReturnType<typeof vi.spyOn>
): ((event: BeforeUnloadEvent) => void) | undefined => {
  const calls = addEventListenerSpy.mock.calls.filter((args) => args[0] === 'beforeunload');
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
    (args) => args[0] === 'beforeunload' && args[1] === lastHandler
  ).length;
  const removeCount = removeEventListenerSpy.mock.calls.filter(
    (args) => args[0] === 'beforeunload' && args[1] === lastHandler
  ).length;
  return addCount > removeCount;
};

const createSnapshot = (stamdataSkadelidte: string): Record<StorageKey, unknown | undefined> => ({
  stamdata: stampStamdata(stamdataSkadelidte),
  aarsloen: undefined,
  satser: undefined,
  renteberegning: undefined,
  varigemen: undefined,
  erstatningsopgoerelse: undefined,
});

describe('MainLayout (unsaved beforeunload)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
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
        <FormPersistenceProvider>
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
        <FormPersistenceProvider>
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

    await act(async () => {
      screen.getByText('Gem').click();
    });

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
        <FormPersistenceProvider>
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

    await act(async () => {
      screen.getByText('Gem').click();
    });

    await waitFor(() => {
      expect(saveToFileMock).not.toHaveBeenCalled();
    });

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
        <FormPersistenceProvider>
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

    await act(async () => {
      screen.getByText('Gem').click();
    });

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
        <FormPersistenceProvider>
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
        <FormPersistenceProvider>
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
        <FormPersistenceProvider>
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

    await act(async () => {
      screen.getByText('Slet alt').click();
    });

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
    confirmSpy.mockRestore();
  });
});
