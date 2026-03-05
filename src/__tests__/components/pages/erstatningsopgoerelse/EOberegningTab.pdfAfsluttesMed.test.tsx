import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../../domain/erstatningsopgoerelse/eoSnapshot';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/eoSnapshot';

const { generateErstatningsopgoerelsePdfMock, loadErstatningsopgoerelsePdfModuleMock } = vi.hoisted(() => {
  return {
    generateErstatningsopgoerelsePdfMock: vi.fn(),
    loadErstatningsopgoerelsePdfModuleMock: vi.fn(async () => ({
      generateErstatningsopgoerelsePdf: generateErstatningsopgoerelsePdfMock,
    })),
  };
});

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
}));

vi.mock('../../../../domain/debug/eoDebugRowAggregator', () => ({
  collectAllDebugRows: () => ({ errors: [], warnings: [], allRows: [], relevantRows: [] }),
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: vi.fn(),
}));

vi.mock('../../../../utils/pdf/pdfLoader', () => ({
  loadErstatningsopgoerelsePdfModule: loadErstatningsopgoerelsePdfModuleMock,
  loadTafFordeltPaaAarPdfModule: vi.fn(async () => ({ generateTafFordeltPaaAarPdf: vi.fn() })),
}));

describe('EOberegningTab PDF-afslutning', () => {
  let eoValuesFromForm: ReturnType<typeof createErstatningsopgoerelseInitialValues>;
  let eoSnapshot: EoSnapshot;

  beforeEach(() => {
    generateErstatningsopgoerelsePdfMock.mockReset();
    loadErstatningsopgoerelsePdfModuleMock.mockClear();

    eoValuesFromForm = createErstatningsopgoerelseInitialValues();
    eoValuesFromForm.beregnesSvieSmerteGodtgoerelse = 'Nej';
    eoValuesFromForm.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValuesFromForm.erstatningsopgoerelseAfsluttesMed = 'Underskrift-linje';
    eoValuesFromForm.differencekravDato = '2026-01-15';
    eoSnapshot = computeEoSnapshot({
      revision: 'rev-1',
      stamdataValues: structuredClone(STAMDATA_INITIAL_VALUES),
      eoValues: eoValuesFromForm,
    });
  });

  it('sender committed EO-værdi for afslutningstype til PDF-generator', async () => {
    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <EOberegningTab
              activeTab="beregning"
              setActiveTab={vi.fn()}
              isActive={true}
              eoSnapshot={eoSnapshot}
              stamdataValues={structuredClone(STAMDATA_INITIAL_VALUES)}
              eoValues={eoValuesFromForm}
              setEOValues={vi.fn()}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByTestId('DownloadIcon')[0]);

    await waitFor(() => expect(generateErstatningsopgoerelsePdfMock).toHaveBeenCalledTimes(1));

    const options = generateErstatningsopgoerelsePdfMock.mock.calls[0]?.[3];
    expect(options.erstatningsopgoerelseAfsluttesMed).toBe('Underskrift-linje');
  });

  it('bruger aktuelle EO-værdier ved PDF-download, ikke stale persisted snapshot', async () => {
    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <EOberegningTab
              activeTab="beregning"
              setActiveTab={vi.fn()}
              isActive={true}
              eoSnapshot={eoSnapshot}
              stamdataValues={structuredClone(STAMDATA_INITIAL_VALUES)}
              eoValues={eoValuesFromForm}
              setEOValues={vi.fn()}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByTestId('DownloadIcon')[0]);

    await waitFor(() => expect(generateErstatningsopgoerelsePdfMock).toHaveBeenCalledTimes(1));

    const submittedEo = generateErstatningsopgoerelsePdfMock.mock.calls[0]?.[1];
    expect(submittedEo.differencekravDato).toBe('2026-01-15');
  });
});
