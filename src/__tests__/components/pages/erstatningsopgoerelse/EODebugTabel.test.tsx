import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EODebugTabel from '../../../../components/pages/erstatningsopgoerelse/EODebugTabel';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import type { EODebugModel } from '../../../../domain/debug/eoDebugModel';
import type { EODebugSnapshot } from '../../../../domain/debug/eoDebugSnapshot';
import type { SammentaellingDisplayTables, SammentaellingModel } from '../../../../domain/debug/eoDebugSammentaelling';
import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../../types/branded';

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
      weekdayIndexByRow: [],
      isSognehelligdagByIndex: [],
      isWorkdayByIndex: [],
      ssStatusByIndex: [],
      svieSmerteByIndex: [],
      tafDayStatusByIndex: [],
      tafColumnIds: [],
      tafFlagsByIndex: [],
    },
    columnRawValues: new Map(),
  };
  return { ...base, ...patch };
};

const makeSammentaelling = (patch: Partial<SammentaellingModel>): SammentaellingModel => {
  const baseControl = {
    beregnetDisplay: '-',
    tabelDisplay: '-',
    beregnetValue: null,
    tabelValue: null,
    loseFeriedage: 0,
    oevrigeFravaersdage: 0,
  } as const;

  const base: SammentaellingModel = {
    beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    beregningsperiode: baseControl,
    taf: baseControl,
    svieSmerteSygedage: baseControl,
    svieSmerteDelvise: baseControl,
    sfgg: baseControl,
    beregningsperiodeIndtaegter: [],
    tafIndtaegter: [],
  };
  return { ...base, ...patch };
};

const makeSnapshot = (model: EODebugModel, revision = 'rev-1'): EODebugSnapshot => {
  const emptyTables: SammentaellingDisplayTables = {
    basis: [],
    beregningsperiode: [],
    taf: [],
    sfgg: [],
  };

  return {
    revision,
    model,
    debugDays: [],
    sammentaelling: makeSammentaelling({}),
    sammentaellingTables: emptyTables,
    sammentaellingRows: [],
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: createErstatningsopgoerelseInitialValues(),
    fieldErrors: {
      stamdata: {},
      erstatningsopgoerelse: {},
    },
  };
};

const renderComponent = (props: React.ComponentProps<typeof EODebugTabel>) => {
  render(
    <MemoryRouter>
      <AppSettingsProvider>
        <EODebugTabel {...props} />
      </AppSettingsProvider>
    </MemoryRouter>,
  );
};

describe('EODebugTabel', () => {
  it('viser ikke den afventende infoboks før timeouten er udløbet', () => {
    vi.useFakeTimers();

    renderComponent({ isActive: true });

    expect(screen.getByText('Debug tabel')).toBeInTheDocument();
    expect(screen.queryByText('Debug-tabellen er ikke opdateret endnu')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.queryByText('Debug-tabellen er ikke opdateret endnu')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('viser info når der ikke findes et aktuelt snapshot efter timeouten', () => {
    vi.useFakeTimers();

    renderComponent({ isActive: true });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('Debug tabel')).toBeInTheDocument();
    expect(screen.getByText('Debug-tabellen er ikke opdateret endnu')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('viser den normale tom-tabel advarsel når snapshot findes men ikke kan bygge rækker', () => {
    const snapshot = makeSnapshot(makeModel({ rowCount: 0, tableFra: toISODateString('2026-01-01'), tableTil: toISODateString('2026-01-31') }));

    renderComponent({
      debugSnapshot: snapshot,
    });

    expect(screen.getByText('Sammentælling')).toBeInTheDocument();
    expect(screen.getByText('Kan ikke oprette debug-tabel')).toBeInTheDocument();
  });

});
