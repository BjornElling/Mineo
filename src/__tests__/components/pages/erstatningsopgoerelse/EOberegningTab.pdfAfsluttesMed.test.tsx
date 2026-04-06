import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';

const { downloadErstatningsopgoerelsePdfMock, downloadTafFordeltPaaAarPdfMock } = vi.hoisted(() => {
  return {
    downloadErstatningsopgoerelsePdfMock: vi.fn(async () => ({ success: true as const })),
    downloadTafFordeltPaaAarPdfMock: vi.fn(async () => ({ success: true as const })),
  };
});

const { collectAllDebugRowsMock } = vi.hoisted(() => ({
  collectAllDebugRowsMock: vi.fn(() => ({ errors: [], warnings: [], allRows: [], relevantRows: [] })),
}));

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
  useBlockingFieldIdsBySuffixForSection: () => ({}),
}));

vi.mock('../../../../domain/debug/eoDebugRowAggregator', () => ({
  collectAllDebugRows: collectAllDebugRowsMock,
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: vi.fn(),
}));

vi.mock('../../../../pdf/infrastructure/pdfService', () => ({
  downloadErstatningsopgoerelsePdf: downloadErstatningsopgoerelsePdfMock,
  downloadTafFordeltPaaAarPdf: downloadTafFordeltPaaAarPdfMock,
}));

const DEFAULT_MIDLERTIDIGT_EET_INSERT_SOURCE = {
  eetValues: { ...ERHVERVSEVNETAB_INITIAL_VALUES, ...FAELLES_AARSLOEN_INITIAL_VALUES },
  skadedato: STAMDATA_INITIAL_VALUES.skadedato,
} as const;

describe('EOberegningTab PDF-afslutning', () => {
  let eoValuesFromForm: ReturnType<typeof createErstatningsopgoerelseInitialValues>;
  let eoSnapshot: EoSnapshot;

  beforeEach(() => {
    downloadErstatningsopgoerelsePdfMock.mockReset();
    downloadTafFordeltPaaAarPdfMock.mockReset();
    downloadErstatningsopgoerelsePdfMock.mockResolvedValue({ success: true });
    downloadTafFordeltPaaAarPdfMock.mockResolvedValue({ success: true });
    collectAllDebugRowsMock.mockReset();
    collectAllDebugRowsMock.mockReturnValue({ errors: [], warnings: [], allRows: [], relevantRows: [] });

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
              midlertidigtEetInsertSource={DEFAULT_MIDLERTIDIGT_EET_INSERT_SOURCE}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByTestId('DownloadIcon')[0]);

    await waitFor(() => expect(downloadErstatningsopgoerelsePdfMock).toHaveBeenCalledTimes(1));

    const callArgs = downloadErstatningsopgoerelsePdfMock.mock.calls[0]?.[0];
    expect(callArgs.eoValues.erstatningsopgoerelseAfsluttesMed).toBe('Underskrift-linje');
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
              midlertidigtEetInsertSource={DEFAULT_MIDLERTIDIGT_EET_INSERT_SOURCE}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByTestId('DownloadIcon')[0]);

    await waitFor(() => expect(downloadErstatningsopgoerelsePdfMock).toHaveBeenCalledTimes(1));

    const submittedEo = downloadErstatningsopgoerelsePdfMock.mock.calls[0]?.[0]?.eoValues;
    expect(submittedEo.differencekravDato).toBe('2026-01-15');
  });

  it('blokerer PDF-download når Beregning-fanen har brugerfejl', async () => {
    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'forlig.dato',
        label: 'Evt. dato for forlig',
        status: 'error',
        message: 'Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Forlig',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

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
              midlertidigtEetInsertSource={DEFAULT_MIDLERTIDIGT_EET_INSERT_SOURCE}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByTestId('DownloadIcon')[0]);

    await waitFor(() => {
      expect(downloadErstatningsopgoerelsePdfMock).not.toHaveBeenCalled();
    });
  });
});
