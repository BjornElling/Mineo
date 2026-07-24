// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import {
  ProductionInputRuntimeProvider,
  bootstrapProductionInputRuntime,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { parseCurrentEnvelope } from '../../../inputCore/runtime/currentSessionEnvelope';
import type { SettledInput } from '../../../inputCore/settledInput';
import type { LoadFileResult } from '../../../types/fileOperations';

vi.mock('../../../utils/fileLoad', () => ({
  loadFromFile: vi.fn(),
  loadFromFileHandle: vi.fn(),
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

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFile, loadFromFileHandle } from '../../../utils/fileLoad';
import {
  clickMainLayoutAction,
  dispatchPwaFileOpen,
  flushMainLayoutAsyncAction,
} from './mainLayoutActionTestUtils';

// Greenfield-shell (WI-002 Fase 4): "der findes allerede data" læses fra runtime (`ops.file.hasAnyData()`),
// ikke fra legacy per-sektions-sessionStorage. Vi hydrerer derfor den ægte runtime med data i stedet for at
// seede `mineo_*`-nøgler, og læser den anvendte tilstand fra den ene greenfield current-envelope.

const catalog = getProductionInputCatalog();
bootstrapProductionInputRuntime();

const emptyInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const stampStamdata = (skadelidte: string) => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte,
  skadestype: undefined,
  skadedato: undefined,
});

const stampSatser = (aargang: number) => ({ aargang });

const hydrateWithData = (skadelidte: string, aargang: number): void => {
  slimInputStore.getState().hydrate(
    catalog.validateSettledInput({
      sections: { ...emptyInput().sections, stamdata: stampStamdata(skadelidte), satser: stampSatser(aargang) },
      rejectedInputs: {},
    })
  );
};

// Runtime-sandheden er den ene afsluttede store-tilstand. `hydrate` sætter kun store-state (skriver ikke
// envelopen), mens et apply (`replaceCase` gennem load) BÅDE opdaterer store og skriver envelopen; vi læser
// derfor den autoritative store, og verificerer separat at et gennemført apply skrev den ene envelope.
const storedInput = (): SettledInput => slimInputStore.getState().input;

const persistedEnvelopeInput = (): SettledInput => parseCurrentEnvelope(
  sessionStorage.getItem(getCurrentInputEnvelopeStorageKey())!
);

describe('MainLayout (overwrite gating)', () => {
  const RouteProbe = () => {
    const location = useLocation();
    return <div data-testid="pathname">{location.pathname}</div>;
  };

  const renderLayout = (initialEntry: string) => render(
    <AppSettingsProvider>
      <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <RouteProbe />
          <MainLayout>
            <div />
          </MainLayout>
        </MemoryRouter>
      </ProductionInputRuntimeProvider>
    </AppSettingsProvider>
  );

  beforeEach(() => {
    pendingPwaRequest = null;
    vi.clearAllMocks();
    sessionStorage.clear();
    slimInputStore.getState().hydrate(emptyInput());
  });

  afterEach(() => {
    slimInputStore.getState().hydrate(emptyInput());
  });

  it('navigates to Stamdata after a successful manual load without overwrite dialog', async () => {
    const loadFromFileMock = vi.mocked(loadFromFile);
    loadFromFileMock.mockResolvedValue({
      status: 'loaded',
      source: 'manual',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y') },
    } satisfies LoadFileResult);

    renderLayout('/open');

    await clickMainLayoutAction('Hent');

    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
    });
    expect(storedInput().sections.stamdata?.skadelidte).toBe('Y');
  });

  it('shows overwrite dialog when data exists; does not mutate until confirm', async () => {
    hydrateWithData('X', 2020);

    const loadFromFileMock = vi.mocked(loadFromFile);
    loadFromFileMock.mockResolvedValue({
      status: 'loaded',
      source: 'manual',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult);

    renderLayout('/open');

    await clickMainLayoutAction('Hent');

    await screen.findByText('Overskriv eksisterende data?');

    expect(storedInput().sections.stamdata?.skadelidte).toBe('X');
    expect(storedInput().sections.satser?.aargang).toBe(2020);

    await act(async () => {
      screen.getByText('Stop og gør intet').click();
    });

    await waitFor(() => {
      expect(screen.queryByText('Overskriv eksisterende data?')).toBeNull();
    });
    expect(storedInput().sections.stamdata?.skadelidte).toBe('X');
    expect(storedInput().sections.satser?.aargang).toBe(2020);

    await clickMainLayoutAction('Hent');
    await screen.findByText('Overskriv eksisterende data?');

    await clickMainLayoutAction('Overskriv');

    expect(storedInput().sections.stamdata?.skadelidte).toBe('Y');
    expect(storedInput().sections.satser?.aargang).toBe(2021);
    // Applyet skrev den ene greenfield current-envelope (§3.6).
    expect(persistedEnvelopeInput().sections.stamdata?.skadelidte).toBe('Y');
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
  });

  it('shows the same overwrite dialog for PWA-opened files and does not mutate until confirm', async () => {
    hydrateWithData('X', 2020);

    const loadFromFileHandleMock = vi.mocked(loadFromFileHandle);
    let resolvePwaLoad: ((result: LoadFileResult) => void) | null = null;
    const pwaLoad = new Promise<LoadFileResult>((resolve) => {
      resolvePwaLoad = resolve;
    });
    loadFromFileHandleMock.mockReturnValueOnce(pwaLoad);
    const pwaLoadResult = {
      status: 'loaded',
      source: 'pwa',
      requestId: 'pwa-open-1',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult;

    pendingPwaRequest = {
      id: 'pwa-open-1',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'clean.eo',
      ignoredFileCount: 0,
    };

    renderLayout('/mineo');

    await waitFor(() => {
      expect(loadFromFileHandleMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      resolvePwaLoad?.(pwaLoadResult);
      await pwaLoad;
      for (let attempt = 0; attempt < 5 && !document.body.textContent?.includes('Overskriv eksisterende data?'); attempt += 1) {
        await flushMainLayoutAsyncAction();
      }
    });

    expect(screen.getByText('Overskriv eksisterende data?')).toBeInTheDocument();

    expect(storedInput().sections.stamdata?.skadelidte).toBe('X');
    expect(storedInput().sections.satser?.aargang).toBe(2020);

    await clickMainLayoutAction('Stop og gør intet');

    await waitFor(() => {
      expect(screen.queryByText('Overskriv eksisterende data?')).toBeNull();
    });
    expect(storedInput().sections.stamdata?.skadelidte).toBe('X');
    expect(storedInput().sections.satser?.aargang).toBe(2020);

    let resolveSecondPwaLoad: ((result: LoadFileResult) => void) | null = null;
    const secondPwaLoad = new Promise<LoadFileResult>((resolve) => {
      resolveSecondPwaLoad = resolve;
    });
    loadFromFileHandleMock.mockReturnValueOnce(secondPwaLoad);
    const secondPwaLoadResult = {
      status: 'loaded',
      source: 'pwa',
      requestId: 'pwa-open-2',
      filename: 'clean.eo',
      snapshot: { stamdata: stampStamdata('Y'), satser: stampSatser(2021) },
    } satisfies LoadFileResult;
    pendingPwaRequest = {
      id: 'pwa-open-2',
      createdAtEpochMs: Date.now(),
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'clean.eo',
      ignoredFileCount: 0,
    };

    await dispatchPwaFileOpen();
    await waitFor(() => {
      expect(loadFromFileHandleMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      resolveSecondPwaLoad?.(secondPwaLoadResult);
      await secondPwaLoad;
      for (let attempt = 0; attempt < 5 && !document.body.textContent?.includes('Overskriv eksisterende data?'); attempt += 1) {
        await flushMainLayoutAsyncAction();
      }
    });

    expect(screen.getByText('Overskriv eksisterende data?')).toBeInTheDocument();

    await clickMainLayoutAction('Overskriv');

    expect(storedInput().sections.stamdata?.skadelidte).toBe('Y');
    expect(storedInput().sections.satser?.aargang).toBe(2021);
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');
  });

});
