// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoInvariant } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import { createActiveTabStorageKey } from '../../../../config/storageManifest';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../../../domain/erhvervsevnetab/eetIssueNavigation';

const { collectAllEoRowsMock } = vi.hoisted(() => ({
  collectAllEoRowsMock: vi.fn<() => import('../../../../domain/eoRowEvaluation/eoRowAggregator').BeregningErrorSummary>(
    () => ({ errors: [], warnings: [], allRows: [], relevantRows: [] })
  ),
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

vi.mock('../../../../domain/eoRowEvaluation/eoRowAggregator', () => ({
  collectAllEoRows: collectAllEoRowsMock,
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: vi.fn(),
}));

const {
  downloadErstatningsopgoerelseDokumentMock,
  downloadTafFordeltPaaAarDokumentMock,
  downloadTafOpreguleretPaaAarDokumentMock,
  downloadTafKravGrafDokumentMock,
} = vi.hoisted(() => ({
  downloadErstatningsopgoerelseDokumentMock: vi.fn(async () => ({ success: true as const })),
  downloadTafFordeltPaaAarDokumentMock: vi.fn(async () => ({ success: true as const })),
  downloadTafOpreguleretPaaAarDokumentMock: vi.fn(async () => ({ success: true as const })),
  downloadTafKravGrafDokumentMock: vi.fn(async () => ({ success: true as const })),
}));

vi.mock('../../../../document/service/documentService', () => ({
  downloadErstatningsopgoerelseDokument: downloadErstatningsopgoerelseDokumentMock,
  downloadTafFordeltPaaAarDokument: downloadTafFordeltPaaAarDokumentMock,
  downloadTafOpreguleretPaaAarDokument: downloadTafOpreguleretPaaAarDokumentMock,
  downloadTafKravGrafDokument: downloadTafKravGrafDokumentMock,
}));

const {
  eoSnapshotToEoDocumentMock,
  eoSnapshotToTafPerYearDocumentMock,
  eoSnapshotToTafPerYearOpreguleretDocumentMock,
  eoSnapshotToTafKravGrafDocumentMock,
} = vi.hoisted(() => ({
  eoSnapshotToEoDocumentMock: vi.fn(),
  eoSnapshotToTafPerYearDocumentMock: vi.fn(),
  eoSnapshotToTafPerYearOpreguleretDocumentMock: vi.fn(),
  eoSnapshotToTafKravGrafDocumentMock: vi.fn(),
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument', () => ({
  eoSnapshotToEoDocument: eoSnapshotToEoDocumentMock,
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument', () => ({
  eoSnapshotToTafPerYearDocument: eoSnapshotToTafPerYearDocumentMock,
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument', () => ({
  eoSnapshotToTafPerYearOpreguleretDocument: eoSnapshotToTafPerYearOpreguleretDocumentMock,
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument', () => ({
  eoSnapshotToTafKravGrafDocument: eoSnapshotToTafKravGrafDocumentMock,
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
    inspektionSnapshot: null,
    input: {
      stamdata: STAMDATA_INITIAL_VALUES,
      erstatningsopgoerelse: eoValues,
    },
  };

  render(
    <MemoryRouter>
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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
    ? 'Årsløn er ikke udfyldt'
    : 'Der er indtastet en afgørelse med under 15 % erhvervsevnetab',
  evidence: ['erhvervsevnetab'],
  blocksAuthoritativeComputation: severity === 'error',
  blocksOutputs: severity === 'error' ? ['beregning', 'inspektion', 'eo_pdf', 'taf_per_year_pdf'] : [],
});

describe('EOberegningTab EET-issues', () => {
  beforeEach(() => {
    sessionStorage.clear();
    collectAllEoRowsMock.mockReset();
    collectAllEoRowsMock.mockReturnValue({ errors: [], warnings: [], allRows: [], relevantRows: [] });
    navigateMock.mockReset();
    downloadErstatningsopgoerelseDokumentMock.mockClear();
    downloadTafFordeltPaaAarDokumentMock.mockClear();
    downloadTafOpreguleretPaaAarDokumentMock.mockClear();
    downloadTafKravGrafDokumentMock.mockClear();
    eoSnapshotToEoDocumentMock.mockReset();
    eoSnapshotToTafPerYearDocumentMock.mockReset();
    eoSnapshotToTafPerYearOpreguleretDocumentMock.mockReset();
    eoSnapshotToTafKravGrafDocumentMock.mockReset();
    eoSnapshotToEoDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
    eoSnapshotToTafPerYearDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
    eoSnapshotToTafPerYearOpreguleretDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
    eoSnapshotToTafKravGrafDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
  });

  it('viser EET-fejl fra snapshot-invarianter når togglen er aktiv', () => {
    renderTab({ invariants: [makeEetInvariant('error')] });

    expect(screen.getByText('Årsløn er ikke udfyldt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EET oplysninger' })).toBeInTheDocument();
  });

  it('viser EET-advarsler fra snapshot-invarianter når togglen er aktiv', () => {
    renderTab({ invariants: [makeEetInvariant('warning')] });

    expect(screen.getByText('Der er indtastet en afgørelse med under 15 % erhvervsevnetab')).toBeInTheDocument();
  });

  it('skjuler EET-issues når togglen ikke er aktiv', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      midlertidigtEetFraEetSiden: 'Nej' as const,
    };
    renderTab({ eoValues, invariants: [makeEetInvariant('error')] });

    expect(screen.queryByText('Årsløn er ikke udfyldt')).not.toBeInTheDocument();
  });

  it('navigerer til Erhvervsevnetab-sidens inputfane når brugeren klikker på linket', () => {
    sessionStorage.setItem(
      createActiveTabStorageKey('erhvervsevnetab'),
      ERHVERVSEVNETAB_TAB_KEYS.EET_EAL
    );
    renderTab({ invariants: [makeEetInvariant('error')] });

    fireEvent.click(screen.getByRole('button', { name: 'EET oplysninger' }));

    expect(sessionStorage.getItem(createActiveTabStorageKey('erhvervsevnetab'))).toBe(
      ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER
    );
    expect(navigateMock).toHaveBeenCalledWith('/erhvervsevnetab');
  });

  it('blokerer download af alle fire Beregning-fane-dokumenter ved en EET-fejl, selv når alle projektioner er ok', async () => {
    // Alle fire projektioner sættes til ok, så det ENESTE der blokerer er EET-fejlen (række-/issue-gaten).
    // Tidligere dækkede testen kun EO + TAF-fordelt; nu verificeres også TAF-opreguleret + Visuel graf.
    eoSnapshotToEoDocumentMock.mockReturnValue({ kind: 'ok', document: {} as never });
    eoSnapshotToTafPerYearDocumentMock.mockReturnValue({ kind: 'ok', document: {} as never });
    eoSnapshotToTafPerYearOpreguleretDocumentMock.mockReturnValue({ kind: 'ok', document: {} as never });
    eoSnapshotToTafKravGrafDocumentMock.mockReturnValue({ kind: 'ok', document: {} as never });

    renderTab({ invariants: [makeEetInvariant('error')] });

    const disabledDownloadBoxes = screen.getAllByLabelText(
      'Opgørelse kan ikke hentes, når der er fejl ovenfor'
    );
    expect(disabledDownloadBoxes.length).toBeGreaterThan(0);
    disabledDownloadBoxes.forEach((box) => fireEvent.click(box));
    expect(downloadErstatningsopgoerelseDokumentMock).not.toHaveBeenCalled();
    expect(downloadTafFordeltPaaAarDokumentMock).not.toHaveBeenCalled();
    expect(downloadTafOpreguleretPaaAarDokumentMock).not.toHaveBeenCalled();
    expect(downloadTafKravGrafDokumentMock).not.toHaveBeenCalled();
  });
});

/**
 * Sikkerhedsnet-garanti: download må ALDRIG blokeres uden en synlig fejl i "Fejl og advarsler".
 *
 * En autoritativt-blokerende validerings-invariant (kilde: `erstatningsopgoerelseValidator`) blokerer
 * download. Den forventes reproduceret som en synlig `collectAllEoRows`-række, men hvis en row-builder
 * ikke dækker reglen — eller `eoSnapshot.data` er null, så en resultat-afhængig række ikke kan dannes —
 * skal invariantens besked i stedet vises af sikkerhedsnettet i view-modellen. Her mockes
 * `collectAllEoRows` til tom, så vi rammer netop denne "boksen ville ellers være tom"-tilstand.
 */
const makeValidationInvariant = (message: string): EoInvariant => ({
  id: 'validation:regulerOffentligeYdelser',
  passed: false,
  severity: 'error',
  source: 'validation',
  message,
  evidence: ['regulerOffentligeYdelser'],
  blocksAuthoritativeComputation: true,
  blocksOutputs: ['beregning', 'inspektion', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'],
});

describe('EOberegningTab download-blokerings-sikkerhedsnet', () => {
  beforeEach(() => {
    sessionStorage.clear();
    collectAllEoRowsMock.mockReset();
    collectAllEoRowsMock.mockReturnValue({ errors: [], warnings: [], allRows: [], relevantRows: [] });
    navigateMock.mockReset();
    eoSnapshotToEoDocumentMock.mockReset();
    eoSnapshotToTafPerYearDocumentMock.mockReset();
    eoSnapshotToTafPerYearOpreguleretDocumentMock.mockReset();
    eoSnapshotToTafKravGrafDocumentMock.mockReset();
    eoSnapshotToEoDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
    eoSnapshotToTafPerYearDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
    eoSnapshotToTafPerYearOpreguleretDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
    eoSnapshotToTafKravGrafDocumentMock.mockReturnValue({ kind: 'blocked', message: '', invariants: [] });
  });

  it('viser en blokerende validerings-invariant i boksen, når ingen række ellers forklarer blokeringen', () => {
    const message = 'Offentlige ydelser kan ikke reguleres efter 2027, fordi reguleringssatsen mangler';
    renderTab({ invariants: [makeValidationInvariant(message)] });

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('dubler IKKE beskeden, når collectAllEoRows allerede giver en synlig fejlrække', () => {
    const invariantMessage = 'Offentlige ydelser kan ikke reguleres efter 2027, fordi reguleringssatsen mangler';
    collectAllEoRowsMock.mockReturnValue({
      errors: [
        {
          id: 'loenindkomst.af-1.satserSkadestidspunkt',
          label: 'Satser på skadedatoen',
          displayValue: 'Fejl (Feriegodtgørelse/-tillæg er ikke udfyldt)',
          status: 'error',
          navigation: { kind: 'unsupported', reason: 'test', displayPath: 'Lønindkomst' },
        },
      ],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    renderTab({ invariants: [makeValidationInvariant(invariantMessage)] });

    // Den målrettede rækkefejl vises …
    expect(screen.getByText(/Feriegodtgørelse\/-tillæg er ikke udfyldt/)).toBeInTheDocument();
    // … og sikkerhedsnettet dublerer ikke invariant-beskeden.
    expect(screen.queryByText(invariantMessage)).not.toBeInTheDocument();
  });
});
