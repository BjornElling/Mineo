// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../inputCore/runtime/slimInputStore';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import type { SaveFileResult } from '../../../types/fileOperations';
import {
  ProductionInputRuntimeProvider,
  bootstrapProductionInputRuntime,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { dispatchInput } from '../../../inputCore/runtime/dispatchInput';
import { replaceCase, settleField } from '../../../inputCore/inputReducer';
import { satserAargangField } from '../../../inputCore/catalog/satserDescriptors';
import type { SettledInput, SettledInputCandidate } from '../../../inputCore/settledInput';

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
  SaveValidationError: class FakeSaveValidationError extends Error {},
}));

vi.mock('../../../utils/fileHelpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../utils/fileHelpers')>();
  return {
    ...original,
    resolveDefaultDirectoryHandle: vi.fn(async () => null),
  };
});

vi.mock('../../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: vi.fn(async () => true),
  saveFileHandleToIndexedDB: vi.fn(async () => true),
  deletePendingPwaOpenRequestFromIndexedDB: vi.fn(async () => true),
  loadPendingPwaOpenRequestFromIndexedDB: vi.fn(async () => null),
  savePendingPwaOpenRequestToIndexedDB: vi.fn(async () => true),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFile, loadFromFileHandle } from '../../../utils/fileLoad';
import { saveToFile } from '../../../utils/fileSave';
import { deleteFileHandleFromIndexedDB } from '../../../utils/fileHandleStorage';
import { clickMainLayoutAction, dispatchPwaFileOpen } from './mainLayoutActionTestUtils';
import { OpenEditor } from './editorTestUtils';

// Al "unsaved changes"-adfærd drives gennem den ENE runtime.
//  - "committed input change" → en ægte settle (revision > baseline → beforeunload aktiveres).
//  - "authoritative replace / load baseline" → en `replaceCase`-command (hæver replacementGeneration →
//    guardens baseline nulstilles).
//  - "uncommittable field/celle" (blokerer save) → et REJECTED format-råinput (settle "abc" på satsåret).
//  - "åben editor kan ikke committes" → en åben greenfield-editor, hvis settle KASTER (§1.4).
//
// §1.4-semantik-ændring: load settler ALDRIG og blokeres ALDRIG af en åben editor (replace-policy). De to
// legacy "blocks (manual|PWA) load when open locked grid editor cannot be committed"-tests er derfor rebaset
// til at hævde det modsatte: load GENNEMFØRES trods åben editor.

const catalog = getProductionInputCatalog();

// Kør den idempotente produktions-bootstrap ÉN gang før nogen render, så MainLayouts bootstrap-effekt
// ikke seeder en ny sag (og hæver revisionen) på den første mount. `beforeEach`-hydraten overskriver
// derefter et eventuelt seed med et rent tomt input + frisk baseline.
bootstrapProductionInputRuntime();

const emptyInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

/** En ægte committed input-ændring: hæver revisionen over baseline → aktiverer beforeunload-guarden. */
const commitInputChange = (raw = '2020') => {
  act(() => {
    dispatchInput(slimInputStore, catalog, settleField(satserAargangField.bind(), raw));
  });
};

/** Et REJECTED format-råinput (ikke-parsebart satsår): committer canonical tomt + bevaret råtekst → blokerer save. */
const commitRejectedInput = () => {
  act(() => {
    dispatchInput(slimInputStore, catalog, settleField(satserAargangField.bind(), 'ikke-et-tal'));
  });
};

/** En autoritativ hel-sags-replacement (load-baseline): hæver replacementGeneration. */
const authoritativeReplace = (candidate: SettledInputCandidate = { sections: emptyInput().sections, rejectedInputs: {} }) => {
  act(() => {
    dispatchInput(slimInputStore, catalog, replaceCase(candidate));
  });
};

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

const renderLayout = (initialEntry = '/stamdata', children: React.ReactNode = <div />) =>
  render(
    <AppSettingsProvider>
      <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <MainLayout>{children}</MainLayout>
        </MemoryRouter>
      </ProductionInputRuntimeProvider>
    </AppSettingsProvider>
  );

describe('MainLayout (unsaved beforeunload)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    pendingPwaRequest = null;
    __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  afterEach(() => {
    __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  it('prevents beforeunload after committed input change', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderLayout();

    expect(getBeforeUnloadHandler(addEventListenerSpy)).toBeUndefined();

    commitInputChange();

    await waitFor(() => {
      expect(getBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });
    await act(async () => {});
    expect(getBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();

    const handler = getLastBeforeUnloadHandler(addEventListenerSpy)!;
    const event = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('keeps beforeunload disabled after session hydration without a new commit', async () => {
    // Hydration sætter baseline uden at hæve revisionen ud over den → ingen unsaved-guard.
    __hydrateSlimInputStoreForTest(slimInputStore,
      catalog.validateSettledInput({
        sections: { ...emptyInput().sections, satser: { aargang: 2020 } },
        rejectedInputs: {},
      })
    );
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderLayout();

    await act(async () => {});
    expect(isBeforeUnloadHandlerRegistered(addEventListenerSpy, removeEventListenerSpy)).toBe(false);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not prevent beforeunload after successful save', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const saveToFileMock = vi.mocked(saveToFile);
    saveToFileMock.mockResolvedValue({
      status: 'saved',
      filename: 'test.eo',
    } satisfies SaveFileResult);

    renderLayout();

    commitInputChange();

    await waitFor(() => {
      expect(getLastBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    const beforeUnloadHandler = getLastBeforeUnloadHandler(addEventListenerSpy)!;

    await clickMainLayoutAction('Gem');

    await waitFor(() => {
      expect(saveToFileMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', beforeUnloadHandler);
    });

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('blocks save when an open editor cannot be committed', async () => {
    const saveToFileMock = vi.mocked(saveToFile);

    renderLayout('/stamdata', <OpenEditor label="Låst gridfelt" />);

    commitInputChange();

    await clickMainLayoutAction('Gem');

    const failedInput = screen.getByLabelText('Låst gridfelt');

    await waitFor(() => {
      expect(saveToFileMock).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(failedInput);
    });
  });

  it('blocks save when an uncommittable rejected field error exists', async () => {
    const saveToFileMock = vi.mocked(saveToFile);

    renderLayout();

    // Et REJECTED format-råinput (uncommittable) blokerer save (§1.6).
    commitRejectedInput();

    await clickMainLayoutAction('Gem');

    await screen.findByText('Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.');
    expect(saveToFileMock).not.toHaveBeenCalled();
  });

  it('blocks save when an EO-page rejected input cannot be committed', async () => {
    const saveToFileMock = vi.mocked(saveToFile);

    renderLayout('/erstatningsopgoerelse');

    // En ikke-committbar rå draft (rejected format) blokerer Gem via save-evalueringen (§1.6),
    // uanset hvilken side den ligger på.
    commitRejectedInput();

    await clickMainLayoutAction('Gem');

    await screen.findByText('Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.');
    expect(saveToFileMock).not.toHaveBeenCalled();
  });

  it('allows save when field error is a canonical bounds error and committed data already exists', async () => {
    const saveToFileMock = vi.mocked(saveToFile);
    saveToFileMock.mockResolvedValue({
      status: 'saved',
      filename: 'range-ok.eo',
    } satisfies SaveFileResult);

    renderLayout();

    // Et velformet satsår uden for [minYear, maxYear] committes canonical (kun bounds-issue, ikke rejected).
    // Det blokerer IKKE save (§1.6): save gennemføres.
    commitInputChange('1000');

    await clickMainLayoutAction('Gem');

    await waitFor(() => {
      expect(saveToFileMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.')).not.toBeInTheDocument();
  });

  it('shows verification warning after successful save with warning details', async () => {
    const saveToFileMock = vi.mocked(saveToFile);
    saveToFileMock.mockResolvedValue({
      status: 'saved',
      filename: 'warning.eo',
      warning: 'ADVARSEL: Manglende sektioner: stamdata',
    } satisfies SaveFileResult);

    renderLayout();

    commitInputChange();

    await clickMainLayoutAction('Gem');

    const matches = await screen.findAllByText((_, element) => {
      const text = element?.textContent ?? '';
      return text.includes('Gemt med advarsel') && text.includes('ADVARSEL: Manglende sektioner: stamdata');
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('completes manual load without settle even with an open editor (§1.4 replace-policy)', async () => {
    // Rebaset §1.4: load settler ALDRIG og blokeres ALDRIG af en åben editor — draften kasseres først ved
    // succes. (Legacy hævdede at load blokeres; det er nu FORKERT mod §1.4.)
    const loadFromFileMock = vi.mocked(loadFromFile);
    loadFromFileMock.mockResolvedValue({
      status: 'loaded',
      source: 'manual',
      filename: 'indlaest.eo',
      snapshot: { stamdata: { skadelidte: 'Indlæst sag' } },
    });

    renderLayout('/stamdata', <OpenEditor label="Låst gridfelt" />);

    await clickMainLayoutAction('Hent');

    expect(loadFromFileMock).toHaveBeenCalledTimes(1);
    await screen.findByText('Hentet');
    expect(
      screen.queryByText('Kan ikke indlæse fil: afslut eller ret det aktive felt først.')
    ).toBeNull();
  });

  it('completes PWA load without settle even with an open editor (§1.4 replace-policy)', async () => {
    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    loadFromFileHandleMock.mockResolvedValue({
      status: 'loaded',
      source: 'pwa',
      requestId: 'pwa-open-1',
      filename: 'indlaest.eo',
      snapshot: { stamdata: { skadelidte: 'Indlæst sag' } },
    });

    renderLayout('/stamdata', <OpenEditor label="Låst gridfelt" />);

    pendingPwaRequest = {
      id: 'pwa-open-1',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'indlaest.eo',
      ignoredFileCount: 0,
    };

    await dispatchPwaFileOpen();

    await waitFor(() => {
      expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.queryByText('Kan ikke indlæse fil: afslut eller ret det aktive felt først.')
    ).toBeNull();
  });

  it('clears unsaved warning on authoritative replace and re-enables on later edits', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    renderLayout();

    commitInputChange();

    await waitFor(() => {
      expect(getLastBeforeUnloadHandler(addEventListenerSpy)).toBeDefined();
    });

    const firstHandler = getLastBeforeUnloadHandler(addEventListenerSpy)!;

    authoritativeReplace();

    await waitFor(() => {
      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', firstHandler);
    });

    commitInputChange('2021');

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

    renderLayout();

    authoritativeReplace({
      sections: { ...emptyInput().sections, satser: { aargang: 2020 } },
      rejectedInputs: {},
    });

    await act(async () => {});
    expect(isBeforeUnloadHandlerRegistered(addEventListenerSpy, removeEventListenerSpy)).toBe(false);

    commitInputChange('2021');

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

    renderLayout();

    commitInputChange();

    await clickMainLayoutAction('Slet alt');

    await waitFor(() => {
      expect(deleteFileHandleMock).toHaveBeenCalledTimes(1);
    });

    commitInputChange('2021');

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
