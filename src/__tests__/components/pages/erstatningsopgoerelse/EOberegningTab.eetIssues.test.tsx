import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoInvariant } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';

const { collectAllDebugRowsMock } = vi.hoisted(() => ({
  collectAllDebugRowsMock: vi.fn(() => ({ errors: [], warnings: [], allRows: [], relevantRows: [] })),
}));

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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

const { downloadErstatningsopgoerelsePdfMock, downloadTafFordeltPaaAarPdfMock } = vi.hoisted(() => ({
  downloadErstatningsopgoerelsePdfMock: vi.fn(async () => ({ success: true as const })),
  downloadTafFordeltPaaAarPdfMock: vi.fn(async () => ({ success: true as const })),
}));

vi.mock('../../../../pdf/infrastructure/pdfService', () => ({
  downloadErstatningsopgoerelseDokument: downloadErstatningsopgoerelsePdfMock,
  downloadTafFordeltPaaAarDokument: downloadTafFordeltPaaAarPdfMock,
}));

const { eoSnapshotToEoPdfDocumentMock, eoSnapshotToTafPerYearPdfDocumentMock } = vi.hoisted(() => ({
  eoSnapshotToEoPdfDocumentMock: vi.fn(),
  eoSnapshotToTafPerYearPdfDocumentMock: vi.fn(),
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument', () => ({
  eoSnapshotToEoPdfDocument: eoSnapshotToEoPdfDocumentMock,
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearPdfDocument', () => ({
  eoSnapshotToTafPerYearPdfDocument: eoSnapshotToTafPerYearPdfDocumentMock,
}));

const renderTab = (params: Readonly<{
  eoValues?: ReturnType<typeof createErstatningsopgoerelseInitialValues>;
  invariants: readonly EoInvariant[];
}>) => {
  const eoValues = params.eoValues ?? {
    ...createErstatningsopgoerelseInitialValues(),
    midlertidigtEetFraEetSiden: 'Ja' as const,
  };
  const snapshot: EoSnapshot = {
    revision: 'eet-issues-test',
    status: 'error',
    invariants: params.invariants,
    data: null,
    debugSnapshot: null,
    input: {
      stamdata: STAMDATA_INITIAL_VALUES,
      erstatningsopgoerelse: eoValues,
    },
  };

  render(
    <MemoryRouter>
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <EOberegningTab
            activeTab="beregning"
            setActiveTab={vi.fn()}
            isActive={true}
            eoSnapshot={snapshot}
            stamdataValues={STAMDATA_INITIAL_VALUES}
            eoValues={eoValues}
            setEOValues={vi.fn()}
          />
        </FormPersistenceProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

const makeEetInvariant = (severity: 'error' | 'warning'): EoInvariant => ({
  id: `midlertidigt_eet_source:${severity}`,
  passed: false,
  severity,
  source: 'validation',
  message: severity === 'error'
    ? 'Midlertidigt EET fra Erhvervsevnetab-siden: Årsløn er ikke udfyldt.'
    : 'Midlertidigt EET fra Erhvervsevnetab-siden: Der er indtastet en afgørelse med < 15 % erhvervsevnetab.',
  evidence: ['erhvervsevnetab'],
  blocksAuthoritativeComputation: severity === 'error',
  blocksOutputs: severity === 'error' ? ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'] : [],
});

describe('EOberegningTab EET-issues', () => {
  beforeEach(() => {
    collectAllDebugRowsMock.mockReset();
    collectAllDebugRowsMock.mockReturnValue({ errors: [], warnings: [], allRows: [], relevantRows: [] });
    navigateMock.mockReset();
    downloadErstatningsopgoerelsePdfMock.mockClear();
    downloadTafFordeltPaaAarPdfMock.mockClear();
    eoSnapshotToEoPdfDocumentMock.mockReset();
    eoSnapshotToTafPerYearPdfDocumentMock.mockReset();
    eoSnapshotToEoPdfDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
    eoSnapshotToTafPerYearPdfDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
  });

  it('viser EET-fejl fra snapshot-invarianter når togglen er aktiv', () => {
    renderTab({ invariants: [makeEetInvariant('error')] });

    expect(screen.getByText('Midlertidigt EET fra Erhvervsevnetab-siden: Årsløn er ikke udfyldt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Løbende ydelser' })).toBeInTheDocument();
  });

  it('viser EET-advarsler fra snapshot-invarianter når togglen er aktiv', () => {
    renderTab({ invariants: [makeEetInvariant('warning')] });

    expect(screen.getByText('Midlertidigt EET fra Erhvervsevnetab-siden: Der er indtastet en afgørelse med < 15 % erhvervsevnetab.')).toBeInTheDocument();
  });

  it('skjuler EET-issues når togglen ikke er aktiv', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      midlertidigtEetFraEetSiden: 'Nej' as const,
    };
    renderTab({ eoValues, invariants: [makeEetInvariant('error')] });

    expect(screen.queryByText('Midlertidigt EET fra Erhvervsevnetab-siden: Årsløn er ikke udfyldt.')).not.toBeInTheDocument();
  });

  it('navigerer til Erhvervsevnetab-siden når brugeren klikker på Løbende ydelser-linket', () => {
    renderTab({ invariants: [makeEetInvariant('error')] });

    fireEvent.click(screen.getByRole('button', { name: 'Løbende ydelser' }));

    expect(navigateMock).toHaveBeenCalledWith('/erhvervsevnetab');
  });

  it('blokerer download af EO- og TAF-PDF når der er en EET-fejl, selv hvis PDF-projektionerne er ok', async () => {
    eoSnapshotToEoPdfDocumentMock.mockReturnValue({ kind: 'ok', document: {} as never });
    eoSnapshotToTafPerYearPdfDocumentMock.mockReturnValue({ kind: 'ok', document: {} as never });

    renderTab({ invariants: [makeEetInvariant('error')] });

    const disabledDownloadBoxes = screen.getAllByLabelText(
      'Midlertidigt EET fra Erhvervsevnetab-siden: Årsløn er ikke udfyldt.'
    );
    expect(disabledDownloadBoxes.length).toBeGreaterThan(0);
    disabledDownloadBoxes.forEach((box) => fireEvent.click(box));
    expect(downloadErstatningsopgoerelsePdfMock).not.toHaveBeenCalled();
    expect(downloadTafFordeltPaaAarPdfMock).not.toHaveBeenCalled();
  });
});
