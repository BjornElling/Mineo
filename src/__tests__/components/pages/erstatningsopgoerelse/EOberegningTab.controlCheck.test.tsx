import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import type { EODebugSnapshot } from '../../../../domain/debug/eoDebugSnapshot';
import type { SammentaellingControl, SammentaellingDisplayRow, SammentaellingModel } from '../../../../domain/debug/eoDebugSammentaelling';
import { getSammentaellingControlStatus } from '../../../../domain/debug/eoDebugSammentaelling';
import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EODebugModel } from '../../../../domain/debug/eoDebugModel';
import { buildControlMismatchReport } from '../../../../domain/debug/eoDebugMismatchReport';

const mockBuildControlMismatchReport = vi.mocked(buildControlMismatchReport);

vi.mock('../../../../hooks/usePersistedSection', () => ({
  usePersistedSection: () => null,
}));

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
}));

vi.mock('../../../../domain/erstatningsopgoerelse/eoDebugRowAggregator', () => ({
  collectAllDebugRows: () => ({ errors: [], warnings: [], allRows: [], relevantRows: [] }),
}));

vi.mock('../../../../calculation/useErstatningsopgoerelseAggregation', () => ({
  useErstatningsopgoerelseAggregation: () => null,
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: vi.fn(),
}));

vi.mock('../../../../domain/debug/eoDebugMismatchReport', async () => {
  const actual = await vi.importActual<typeof import('../../../../domain/debug/eoDebugMismatchReport')>(
    '../../../../domain/debug/eoDebugMismatchReport'
  );
  return {
    ...actual,
    buildControlMismatchReport: vi.fn(),
  };
});

const makeModel = (patch: Partial<EODebugModel>): EODebugModel => {
  const base: EODebugModel = {
    sources: [],
    combinedMinFra: undefined,
    combinedMaxTil: undefined,
    tableFra: undefined,
    tableTil: undefined,
    summaryTableFra: undefined,
    summaryTableTil: undefined,
    rowCount: 0,
    getRowKey: (rowIndex) => String(rowIndex),
    getCell: () => '',
    columns: [],
    rows: [],
    tableWidthPx: 1200,
    integrityIssues: [],
    tableData: {
      dates: [],
      isWorkdayByIndex: [],
      ssStatusByIndex: [],
      tafColumnIds: [],
    },
    columnRawValues: new Map(),
  };
  return { ...base, ...patch };
};

const makeControl = (patch: Partial<SammentaellingControl>): SammentaellingControl => ({
  beregnetDisplay: '-',
  tabelDisplay: '-',
  beregnetValue: null,
  tabelValue: null,
  loseFeriedage: 0,
  oevrigeFravaersdage: 0,
  warningEligible: false,
  ...patch,
});

const makeSnapshot = (rows: SammentaellingDisplayRow[], revision = 'rev-1'): EODebugSnapshot => {
  const baseControl = makeControl({});
  const sammentaelling: SammentaellingModel = {
    beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    beregningsperiode: baseControl,
    taf: baseControl,
    svieSmerteSygedage: baseControl,
    svieSmerteDelvise: baseControl,
    beregningsperiodeIndtaegter: [],
    tafIndtaegter: [],
  };

  const hasControlErrors = rows.some((row) => getSammentaellingControlStatus(row.control) === 'error');

  return {
    revision,
    createdAt: '2026-02-01T00:00:00.000Z',
    model: makeModel({}),
    sammentaelling,
    sammentaellingRows: rows,
    hasControlErrors,
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: ERSTATNINGSOPGOERELSE_INITIAL_VALUES,
    fieldErrors: {
      stamdata: {},
      erstatningsopgoerelse: {},
    },
  };
};

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

describe('EOberegningTab kontroltjek', () => {
  beforeEach(() => {
    mockBuildControlMismatchReport.mockReset();
  });

  it('åbner popup én gang ved fane-entry', () => {
    const mismatchRow: SammentaellingDisplayRow = {
      key: 'row-1',
      label: 'Ansættelsesforhold',
      control: makeControl({
        beregnetDisplay: '100',
        tabelDisplay: '90',
        beregnetValue: 100,
        tabelValue: 90,
      }),
    };
    const snapshot = makeSnapshot([mismatchRow]);
    mockBuildControlMismatchReport.mockReturnValue({
      version: 'v1',
      createdAt: snapshot.createdAt,
      mismatches: [
        { key: mismatchRow.key, label: mismatchRow.label, beregnet: '100', tabel: '90' },
      ],
      sammentaelling: snapshot.sammentaelling,
      context: {
        skadesdato: snapshot.stamdataValues.skadesdato,
        skadestype: snapshot.stamdataValues.skadestype,
        beregningsperiodeFra: snapshot.eoValues.periodeTilBeregningFra,
        beregningsperiodeTil: snapshot.eoValues.periodeTilBeregningTil,
        vedroererPeriodeFra: snapshot.eoValues.vedroererPeriodeFra,
        vedroererPeriodeTil: snapshot.eoValues.vedroererPeriodeTil,
      },
      fieldErrors: snapshot.fieldErrors,
    });

    const { rerender } = renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: false,
      debugSnapshot: snapshot,
      currentDebugRevision: snapshot.revision,
    });

    rerender(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <EOberegningTab
              activeTab="beregning"
              setActiveTab={vi.fn()}
              isActive={true}
              debugSnapshot={snapshot}
              currentDebugRevision={snapshot.revision}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Uoverensstemmelse i kontrolberegning')).toBeInTheDocument();
    expect(mockBuildControlMismatchReport).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <EOberegningTab
              activeTab="beregning"
              setActiveTab={vi.fn()}
              isActive={true}
              debugSnapshot={snapshot}
              currentDebugRevision={snapshot.revision}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    expect(mockBuildControlMismatchReport).toHaveBeenCalledTimes(1);
  });

  it('åbner ikke popup ved kun advarsel', () => {
    const warningRow: SammentaellingDisplayRow = {
      key: 'row-1',
      label: 'Arbejdsdage',
      control: makeControl({
        beregnetDisplay: '8',
        tabelDisplay: '10',
        beregnetValue: 8,
        tabelValue: 10,
        loseFeriedage: 1,
        oevrigeFravaersdage: 1,
        warningEligible: true,
      }),
    };
    const snapshot = makeSnapshot([warningRow]);
    mockBuildControlMismatchReport.mockReturnValue({
      version: 'v1',
      createdAt: snapshot.createdAt,
      mismatches: [],
      sammentaelling: snapshot.sammentaelling,
      context: {
        skadesdato: snapshot.stamdataValues.skadesdato,
        skadestype: snapshot.stamdataValues.skadestype,
        beregningsperiodeFra: snapshot.eoValues.periodeTilBeregningFra,
        beregningsperiodeTil: snapshot.eoValues.periodeTilBeregningTil,
        vedroererPeriodeFra: snapshot.eoValues.vedroererPeriodeFra,
        vedroererPeriodeTil: snapshot.eoValues.vedroererPeriodeTil,
      },
      fieldErrors: snapshot.fieldErrors,
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      debugSnapshot: snapshot,
      currentDebugRevision: snapshot.revision,
    });

    expect(screen.queryByText('Uoverensstemmelse i kontrolberegning')).not.toBeInTheDocument();
  });

  it('viser kun error-rækker og ikke warnings i dialogen', () => {
    const errorRow: SammentaellingDisplayRow = {
      key: 'row-error',
      label: 'Ansættelsesforhold',
      control: makeControl({
        beregnetDisplay: '100,00',
        tabelDisplay: '90,00',
        beregnetValue: 100,
        tabelValue: 90,
      }),
    };
    const warningRow: SammentaellingDisplayRow = {
      key: 'row-warning',
      label: 'Arbejdsdage',
      control: makeControl({
        beregnetDisplay: '8',
        tabelDisplay: '10',
        beregnetValue: 8,
        tabelValue: 10,
        loseFeriedage: 1,
        oevrigeFravaersdage: 1,
        warningEligible: true,
      }),
    };

    const snapshot = makeSnapshot([errorRow, warningRow], 'rev-3');
    mockBuildControlMismatchReport.mockReturnValue({
      version: 'v1',
      createdAt: snapshot.createdAt,
      mismatches: [
        { key: errorRow.key, label: errorRow.label, beregnet: errorRow.control.beregnetDisplay, tabel: errorRow.control.tabelDisplay },
      ],
      sammentaelling: snapshot.sammentaelling,
      context: {
        skadesdato: snapshot.stamdataValues.skadesdato,
        skadestype: snapshot.stamdataValues.skadestype,
        beregningsperiodeFra: snapshot.eoValues.periodeTilBeregningFra,
        beregningsperiodeTil: snapshot.eoValues.periodeTilBeregningTil,
        vedroererPeriodeFra: snapshot.eoValues.vedroererPeriodeFra,
        vedroererPeriodeTil: snapshot.eoValues.vedroererPeriodeTil,
      },
      fieldErrors: snapshot.fieldErrors,
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      debugSnapshot: snapshot,
      currentDebugRevision: snapshot.revision,
    });

    expect(screen.getByText('Ansættelsesforhold: Beregnet 100,00 · Tabel 90,00')).toBeInTheDocument();
    expect(screen.queryByText('Arbejdsdage: Beregnet 8 · Tabel 10')).not.toBeInTheDocument();
  });

  it('viser mismatch-rækker med korrekt label og værdier', () => {
    const rowA: SammentaellingDisplayRow = {
      key: 'row-a',
      label: 'Ansættelsesforhold',
      control: makeControl({
        beregnetDisplay: '100,00',
        tabelDisplay: '90,00',
        beregnetValue: 100,
        tabelValue: 90,
      }),
    };
    const rowB: SammentaellingDisplayRow = {
      key: 'row-b',
      label: 'Flextilskud',
      control: makeControl({
        beregnetDisplay: '500,00',
        tabelDisplay: '0,00',
        beregnetValue: 500,
        tabelValue: 0,
      }),
    };
    const snapshot = makeSnapshot([rowA, rowB], 'rev-2');

    mockBuildControlMismatchReport.mockReturnValue({
      version: 'v1',
      createdAt: snapshot.createdAt,
      mismatches: [
        { key: rowA.key, label: rowA.label, beregnet: rowA.control.beregnetDisplay, tabel: rowA.control.tabelDisplay },
        { key: rowB.key, label: rowB.label, beregnet: rowB.control.beregnetDisplay, tabel: rowB.control.tabelDisplay },
      ],
      sammentaelling: snapshot.sammentaelling,
      context: {
        skadesdato: snapshot.stamdataValues.skadesdato,
        skadestype: snapshot.stamdataValues.skadestype,
        beregningsperiodeFra: snapshot.eoValues.periodeTilBeregningFra,
        beregningsperiodeTil: snapshot.eoValues.periodeTilBeregningTil,
        vedroererPeriodeFra: snapshot.eoValues.vedroererPeriodeFra,
        vedroererPeriodeTil: snapshot.eoValues.vedroererPeriodeTil,
      },
      fieldErrors: snapshot.fieldErrors,
    });

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      debugSnapshot: snapshot,
      currentDebugRevision: snapshot.revision,
    });

    expect(screen.getByText('Ansættelsesforhold: Beregnet 100,00 · Tabel 90,00')).toBeInTheDocument();
    expect(screen.getByText('Flextilskud: Beregnet 500,00 · Tabel 0,00')).toBeInTheDocument();
  });
});
