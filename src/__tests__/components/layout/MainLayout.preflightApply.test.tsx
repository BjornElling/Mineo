// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import {
  ProductionInputRuntimeProvider,
  bootstrapProductionInputRuntime,
  createProductionInputRuntimeBinding,
  getProductionInputEvaluation,
} from '../../../inputCore/react/productionInputRuntime';
import { useSettledSnapshot } from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { dispatchInput } from '../../../inputCore/runtime/dispatchInput';
import { settleField } from '../../../inputCore/inputReducer';
import { satserAargangField } from '../../../inputCore/catalog/satserDescriptors';
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
  deletePendingPwaOpenRequestFromIndexedDB: vi.fn(async () => true),
  loadPendingPwaOpenRequestFromIndexedDB: vi.fn(async () => null),
  savePendingPwaOpenRequestToIndexedDB: vi.fn(async () => true),
}));

import MainLayout from '../../../components/layout/MainLayout';
import { loadFromFile } from '../../../utils/fileLoad';
import { clickMainLayoutAction } from './mainLayoutActionTestUtils';

// Greenfield-shell (WI-002 Fase 4): preflight-apply routes gennem replacement-grænsen. "Feltfejl ryddes ved
// load" er nu strukturelt: en `replaceCase` erstatter hele inputtet (rejected råtekst inklusive), hæver
// `replacementGeneration` og efterlader et rent issue-snapshot. Vi hævder mod runtime i stedet for det legacy
// fieldErrors-lager.

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

describe('MainLayout (preflight apply)', () => {
  const GenerationProbe = () => {
    const { replacementGeneration } = useSettledSnapshot();
    const location = useLocation();
    return (
      <>
        <div data-testid="epoch">{String(replacementGeneration)}</div>
        <div data-testid="pathname">{location.pathname}</div>
      </>
    );
  };

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    slimInputStore.getState().hydrate(emptyInput());
  });

  afterEach(() => {
    slimInputStore.getState().hydrate(emptyInput());
  });

  it('applies only schema-valid sections on "Indlæs trods fejl" and clears runtime field issues', async () => {
    const loadFromFileMock = vi.mocked(loadFromFile);
    loadFromFileMock.mockResolvedValue({
      status: 'preflight',
      source: 'manual',
      filename: 'broken.eo',
      snapshot: { stamdata: stampStamdata('Y') },
      preflightWarning: {
        expectedCount: 10,
        loadedCount: 9,
        failedCount: 1,
        issues: [{ kind: 'sectionDropped', path: 'satser', reason: 'Sektionen kunne ikke indlæses (Forkert format) og blev ikke indlæst' }],
      },
    } satisfies LoadFileResult);

    // Etabler et REJECTED format-issue på satsåret, så der findes et rødt feltissue før load.
    dispatchInput(slimInputStore, catalog, settleField(satserAargangField.bind(), 'ikke-et-tal'));
    expect(getProductionInputEvaluation().issues.all.length).toBeGreaterThan(0);

    render(
      <AppSettingsProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <MemoryRouter initialEntries={['/mineo']}>
            <GenerationProbe />
            <MainLayout>
              <div />
            </MainLayout>
          </MemoryRouter>
        </ProductionInputRuntimeProvider>
      </AppSettingsProvider>
    );

    await clickMainLayoutAction('Hent');

    await screen.findByText('Nogle felter blev sat til standardværdier');

    // Fang den autoritative generation umiddelbart FØR applyet (preflight/overwrite-dialog bumper den ikke).
    const generationBeforeApply = slimInputStore.getState().replacementGeneration;

    await clickMainLayoutAction('Indlæs trods fejl');

    // Et rejected råinput tæller som data (§1.6), så preflight-godkendelsen fører videre til
    // overwrite-bekræftelse; applyet sker først ved "Overskriv".
    await screen.findByText('Overskriv eksisterende data?');
    await clickMainLayoutAction('Overskriv');

    await waitFor(() => {
      const nextGeneration = Number(screen.getByTestId('epoch').textContent ?? '0');
      expect(nextGeneration).toBe(generationBeforeApply + 1);
    });
    expect(screen.getByTestId('pathname')).toHaveTextContent('/stamdata');

    // Load erstattede hele inputtet: rejected råtekst er væk → intet resterende feltissue.
    expect(getProductionInputEvaluation().issues.all.length).toBe(0);

    const stored = parseCurrentEnvelope(sessionStorage.getItem(getCurrentInputEnvelopeStorageKey())!);
    expect(stored.sections.stamdata?.skadelidte).toBe('Y');
    expect(stored.sections.satser).toBeNull();
    expect(Object.keys(stored.rejectedInputs).length).toBe(0);
  });
});
