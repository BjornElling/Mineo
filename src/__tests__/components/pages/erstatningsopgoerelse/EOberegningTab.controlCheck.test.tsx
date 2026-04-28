import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { buildControlMismatchInvariant } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';

const { collectAllDebugRowsMock } = vi.hoisted(() => ({
  collectAllDebugRowsMock: vi.fn(),
}));

const { scrollToSectionMock, scrollToDebugRowMock } = vi.hoisted(() => ({
  scrollToSectionMock: vi.fn(),
  scrollToDebugRowMock: vi.fn(),
}));

const { reportSystemIssueMock } = vi.hoisted(() => ({
  reportSystemIssueMock: vi.fn(),
}));

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
  useBlockingFieldIdsBySuffixForSection: () => ({}),
}));

vi.mock('../../../../domain/debug/eoDebugRowAggregator', () => ({
  collectAllDebugRows: collectAllDebugRowsMock,
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: scrollToSectionMock,
}));

vi.mock('../../../../utils/scrollToDebugRow', () => ({
  scrollToDebugRow: scrollToDebugRowMock,
}));

vi.mock('../../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

const renderTab = (props: React.ComponentProps<typeof EOberegningTab>) => {
  return render(
    <MemoryRouter>
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <EOberegningTab {...props} />
        </FormPersistenceProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

const createEmployment = (overrides: Record<string, unknown> = {}) => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-base',
  ...overrides,
});

describe('EOberegningTab kontroltjek', () => {
  const baseStamdataValues = structuredClone(STAMDATA_INITIAL_VALUES);
  const baseEoValues = createErstatningsopgoerelseInitialValues();
  const baseSetEoValues = vi.fn();

  beforeEach(() => {
    baseSetEoValues.mockReset();
    reportSystemIssueMock.mockReset();
    collectAllDebugRowsMock.mockReset();
    scrollToSectionMock.mockReset();
    scrollToDebugRowMock.mockReset();
    collectAllDebugRowsMock.mockReturnValue({ errors: [], warnings: [], allRows: [], relevantRows: [] });
  });

  it('samler kontroluoverensstemmelse i én contentbox for fejl og advarsler', () => {
    const setActiveTab = vi.fn();
    const snapshot: EoSnapshot = {
      revision: 'rev-1',
      status: 'error',
      invariants: [
        buildControlMismatchInvariant([
          'Ansættelsesforhold: beregnet=100, tabel=90',
        ]),
      ],
      data: null,
      input: {
        stamdata: baseStamdataValues,
        erstatningsopgoerelse: baseEoValues,
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab,
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
    expect(screen.getByText('Der er konstateret kontroluoverensstemmelser i EO-beregningen.')).toBeInTheDocument();
    const debugTableLink = screen.getByRole('button', { name: 'Debug tabel' });
    expect(debugTableLink).toBeInTheDocument();
    fireEvent.click(debugTableLink);
    expect(setActiveTab).toHaveBeenCalledWith('debug_tabel');
    expect(screen.queryByText('Download-kontroller')).not.toBeInTheDocument();
    expect(screen.queryByText('Systemfejl')).not.toBeInTheDocument();
    expect(screen.queryByText('Beregning blokeret')).not.toBeInTheDocument();
    expect(reportSystemIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'debug:control_mismatch',
        context: 'EOberegningTab',
        revision: 'rev-1',
      })
    );
  });

  // Tidligere test: "viser advarsel når Midlertidig EET-bilag er valgt uden offentlig ydelse af typen Midlertidigt EET".
  // Advarslen er fjernet, fordi koblingen mellem bilag-checkbox og manuelle midlertidigt_eet-rækker ikke
  // længere er meningsfuld: når togglen `midlertidigtEetFraEetSiden` er aktiveret, styres kilden af
  // EET-siden, og når togglen er deaktiveret, er bilaget alligevel disabled (jf. getEoBilagAvailability).

  it('viser brugerens manglende indtastning som navigerbar fejl og ikke som systemfejl', () => {
    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'loenindkomst.af1.regulering.valgtRegulering',
        label: 'Valgt regulering',
        displayValue: 'Fejl (Lønudvikling beregnes ud fra mangler)',
        status: 'error',
        message: 'Lønudvikling beregnes ud fra mangler',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'loenindkomst',
          tabName: 'Lønindkomst',
          sectionTitle: 'Lønindkomst',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    const snapshot: EoSnapshot = {
      revision: 'rev-2',
      status: 'error',
      invariants: [{
        id: 'taf_per_year:missing_loenudvikling',
        passed: false,
        severity: 'error',
        source: 'system' as const,
        message: 'TAF fordelt på år kan ikke genereres, fordi lønudvikling ikke kunne beregnes autoritativt.',
        blocksOutputs: ['taf_per_year_pdf'],
      }],
      data: null,
      input: {
        stamdata: baseStamdataValues,
        erstatningsopgoerelse: baseEoValues,
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
    expect(screen.getByText("Der mangler at blive angivet lønregulering, evt. 'Ingen'")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lønindkomst' })).toBeInTheDocument();
    expect(screen.queryByText('Send fejloplysninger')).not.toBeInTheDocument();
    expect(screen.queryByText('Systemfejl')).not.toBeInTheDocument();
    expect(screen.queryByText('TAF fordelt på år kan ikke genereres, fordi lønudvikling ikke kunne beregnes autoritativt.')).not.toBeInTheDocument();
  });

  it('viser custom fejltekst for manglende SFGG-overenskomst i fejlboksen', () => {
    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'sfgg.overenskomst.af1',
        label: 'Overenskomst (angivet ovenfor)',
        displayValue: 'Ingen overenskomst valgt',
        status: 'error',
        message: 'Ingen overenskomst valgt',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'loenindkomst',
          tabName: 'Lønindkomst',
          sectionTitle: 'Ansættelsesforhold',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: null,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Det er angivet, at SFGG fastsættes efter overenskomst, men ingen overenskomst er valgt')).toBeInTheDocument();
    expect(screen.queryByText('Overenskomst (angivet ovenfor): Ingen overenskomst valgt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ansættelsesforhold' })).toBeInTheDocument();
  });

  it('navigerer SFGG-fejl direkte til ansættelsesforholdet i lønindkomst-fanen', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();

    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'sfgg.overenskomst.af1',
        label: 'Overenskomst (angivet ovenfor)',
        displayValue: 'Ingen overenskomst valgt',
        status: 'error',
        message: 'Ingen overenskomst valgt',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'loenindkomst',
          tabName: 'Lønindkomst',
          sectionTitle: 'Ansættelsesforhold',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    const Wrapper = () => {
      const [activeTab, setActiveTab] = React.useState<'beregning' | 'loenindkomst'>('beregning');
      return (
        <EOberegningTab
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isActive={true}
          eoSnapshot={null}
          stamdataValues={baseStamdataValues}
          eoValues={baseEoValues}
          setEOValues={baseSetEoValues}
        />
      );
    };

    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <Wrapper />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Ansættelsesforhold' }));

    expect(scrollToDebugRowMock).toHaveBeenCalledWith('sfgg.overenskomst.af1');
    expect(scrollToSectionMock).not.toHaveBeenCalled();
  });

  it('viser overlap-fejl uden label-prefiks for beregningsperioden', () => {
    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'taf.beregningsgrundlag.beregningsperiode',
        label: 'Periode til beregning af før-løn',
        displayValue: 'Fejl (Der er overlap mellem beregningsperioden (01-09-2022 - 31-05-2023) og en TAF-periode (01-05-2023 - 22-12-2025))',
        status: 'error',
        message: 'Der er overlap mellem beregningsperioden (01-09-2022 - 31-05-2023) og en TAF-periode (01-05-2023 - 22-12-2025)',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Tabt arbejdsfortjeneste',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: null,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(
      screen.getByText('Der er overlap mellem beregningsperioden (01-09-2022 - 31-05-2023) og en TAF-periode (01-05-2023 - 22-12-2025)')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Periode til beregning af før-løn: Der er overlap mellem beregningsperioden (01-09-2022 - 31-05-2023) og en TAF-periode (01-05-2023 - 22-12-2025)')
    ).not.toBeInTheDocument();
  });

  it('viser TAF-periode-range-fejl med kort brugertekst', () => {
    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'taf.periode.1',
        label: 'Periode (24-05-2023 - 21-12-2025)',
        displayValue: 'Fejl (Dato skal være mellem 24-05-2023 og 22-12-2025)',
        status: 'error',
        message: 'Dato skal være mellem 24-05-2023 og 22-12-2025',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Tabt arbejdsfortjeneste',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: null,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('TAF-perioden skal være mellem 24-05-2023 og 22-12-2025')).toBeInTheDocument();
    expect(screen.queryByText('Periode (24-05-2023 - 21-12-2025): Dato skal være mellem 24-05-2023 og 22-12-2025')).not.toBeInTheDocument();
  });

  it('viser cutoff-fejl uden periode-label i fejlboksen og kun "Fejl" i TAF-oversigten', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.revideretOpgoerelse = 'Ja';
    eoValues.eoNummer = '1';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Ja';
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: '2024-01-01', til: '2025-01-01', loseFeriedage: 0 },
    ];

    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'taf.periode.taf-1',
        label: 'Periode (01-01-2024 - 01-01-2025)',
        displayValue: 'Fejl (Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025))',
        status: 'error',
        message: 'Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025)',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Tabt arbejdsfortjeneste',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [{
        id: 'taf.periode.taf-1',
        label: 'Periode (01-01-2024 - 01-01-2025)',
        displayValue: 'Fejl (Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025))',
        status: 'error',
        message: 'Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025)',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Tabt arbejdsfortjeneste',
        },
      }],
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: null,
      stamdataValues: baseStamdataValues,
      eoValues,
      setEOValues: baseSetEoValues,
    });

    expect(
      screen.getByText('Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025)')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Periode (01-01-2024 - 01-01-2025): Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025)')
    ).not.toBeInTheDocument();
    expect(screen.getByText('TAF-periode')).toBeInTheDocument();
    expect(screen.getByText(/^Fejl$/)).toBeInTheDocument();
    expect(
      screen.queryByText('Fejl (Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-07-2025))')
    ).not.toBeInTheDocument();
  });

  it('viser svie/smerte-range-fejl med korrekt brugertekst og uden systemfejl', () => {
    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'sviesmerte.periode.1',
        label: 'Periode (24-05-2023 - 21-04-2025)',
        displayValue: 'Fejl (Dato skal være mellem 24-05-2023 og 21-04-2024)',
        status: 'error',
        message: 'Dato skal være mellem 24-05-2023 og 21-04-2024',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Svie/smerte godtgørelse',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2023-05-24';
    eoValues.vedroererPeriodeTil = '2025-12-21';
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Ja';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = '2024-04-22';
    eoValues.svieSmerteSatserAar = 2026;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      { id: 'ss-1', fra: '2023-05-24', til: '2025-04-21', tilstand: 'sygemeldt' },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'rev-svie-range',
      stamdataValues: baseStamdataValues,
      eoValues,
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Svie/smerte-perioden skal være mellem 24-05-2023 og 21-04-2024')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Svie/smerte godtgørelse' })).toBeInTheDocument();
    expect(screen.queryByText('Send fejloplysninger')).not.toBeInTheDocument();
    expect(screen.queryByText('Svie/smerte-periode: Dato skal være mellem 24-05-2023 og 21-04-2024')).not.toBeInTheDocument();
  });

  it('viser kun "Fejl" i svie/smerte-oversigten når perioden har fejl', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Ja';
    eoValues.svieSmertePerioder = [
      { id: 'ss-1', fra: '2024-01-01', til: '2025-01-01', tilstand: 'sygemeldt' },
    ];

    collectAllDebugRowsMock.mockReturnValue({
      errors: [],
      warnings: [],
      allRows: [],
      relevantRows: [{
        id: 'sviesmerte.beregnetPeriode',
        label: 'Svie/smerte-periode',
        displayValue: 'Fejl (Dato skal være mellem 24-05-2023 og 21-04-2024)',
        status: 'error',
        message: 'Dato skal være mellem 24-05-2023 og 21-04-2024',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Svie/smerte godtgørelse',
        },
      }],
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: null,
      stamdataValues: baseStamdataValues,
      eoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Svie/smerte-periode')).toBeInTheDocument();
    expect(screen.getByText(/^Fejl$/)).toBeInTheDocument();
    expect(screen.queryByText('Fejl (Dato skal være mellem 24-05-2023 og 21-04-2024)')).not.toBeInTheDocument();
  });

  it('viser svie/smerte sats-år-advarslen med indhold i fejl og advarsler', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Ja';

    collectAllDebugRowsMock.mockReturnValue({
      errors: [],
      warnings: [{
        id: 'sviesmerte.satserAar',
        label: 'Hvilket års svie/smerte satser lægges til grund?',
        displayValue: 'Svie/smerte satsen for 2026 kan anvendes.',
        status: 'warning',
        message: 'Svie/smerte satsen for 2026 kan anvendes.',
        summaryDisplay: 'messageOnly',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'eo_oplysninger',
          tabName: 'EO oplysninger',
          sectionTitle: 'Svie/smerte godtgørelse',
        },
      }],
      allRows: [],
      relevantRows: [],
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: null,
      stamdataValues: baseStamdataValues,
      eoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Svie/smerte satsen for 2026 kan anvendes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Svie/smerte godtgørelse' })).toBeInTheDocument();
  });

  it('viser clampet TAF-periode i beregningsoversigten når snapshotten er autoritativt beregnet', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.tafBeregningsperiodeFra = '2023-01-01';
    eoValues.tafBeregningsperiodeTil = '2023-12-31';
    eoValues.differencekravDato = '2024-07-01';
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        loenudviklingBeregningsgrundlag: 'Ingen',
      }),
    ];
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-07-15', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'rev-clamped-taf',
      stamdataValues: baseStamdataValues,
      eoValues,
    });

    expect(snapshot.data?.canonicalOutput.periodiseringer.tafPerioder).toEqual([
      { fra: '2024-01-01', til: '2024-06-30' },
    ]);

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('TAF-periode')).toBeInTheDocument();
    expect(screen.getByText('01-01-2024 - 30-06-2024')).toBeInTheDocument();
  });

  it('viser TAF afrunding over 1 kr. som systemfejl og logger den til devtools-flowet', () => {
    const snapshot: EoSnapshot = {
      revision: 'rev-3',
      status: 'error',
      invariants: [{
        id: 'taf_per_year:afrunding_over_100',
        passed: false,
        severity: 'error',
        source: 'system' as const,
        message: 'TAF fordelt på år kan ikke afstemmes inden for 1 kr.',
        blocksOutputs: ['taf_per_year_pdf'],
      }],
      data: null,
      input: {
        stamdata: baseStamdataValues,
        erstatningsopgoerelse: baseEoValues,
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
    expect(screen.getByText('TAF fordelt på år kan ikke afstemmes inden for 1 kr.')).toBeInTheDocument();
    expect(screen.queryByText('Send fejloplysninger')).not.toBeInTheDocument();
    expect(reportSystemIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'taf_per_year:afrunding_over_100',
        context: 'EOberegningTab',
        revision: 'rev-3',
      })
    );
  });
});
