// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EOKontrolTabel from '../../../../components/pages/erstatningsopgoerelse/EOKontrolTabel';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import type { EOInspektionModel } from '../../../../domain/eoInspektion/eoInspektionKontrolModel';
import type { EOInspektionSnapshot } from '../../../../domain/eoInspektion/eoInspektionSnapshot';
import type { SammentaellingDisplayTables, SammentaellingModel } from '../../../../domain/eoInspektion/eoInspektionSammentaelling';
import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../../types/branded';
import { EMPTY_FIELD_ISSUE_SET } from '../../../../inputCore/inputIssue';

const makeModel = (patch: Partial<EOInspektionModel>): EOInspektionModel => {
  const base: EOInspektionModel = {
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

const makeSnapshot = (model: EOInspektionModel, revision = 'rev-1'): EOInspektionSnapshot => {
  const emptyTables: SammentaellingDisplayTables = {
    basis: [],
    beregningsperiode: [],
    taf: [],
    sfgg: [],
  };

  return {
    revision,
    model,
    inspektionDays: [],
    sammentaelling: makeSammentaelling({}),
    sammentaellingTables: emptyTables,
    sammentaellingRows: [],
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: createErstatningsopgoerelseInitialValues(),
    fieldErrors: {
      stamdata: EMPTY_FIELD_ISSUE_SET,
      erstatningsopgoerelse: EMPTY_FIELD_ISSUE_SET,
    },
  };
};

const renderComponent = (props: React.ComponentProps<typeof EOKontrolTabel>) => {
  render(
    <MemoryRouter>
      <AppSettingsProvider>
        <EOKontrolTabel {...props} />
      </AppSettingsProvider>
    </MemoryRouter>,
  );
};

describe('EOKontrolTabel', () => {
  it('viser ikke den afventende infoboks før timeouten er udløbet', () => {
    vi.useFakeTimers();

    renderComponent({ isActive: true });

    expect(screen.getByText('Kontroltabel')).toBeInTheDocument();
    expect(screen.queryByText('Kontroltabellen er ikke opdateret endnu')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.queryByText('Kontroltabellen er ikke opdateret endnu')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('viser info når der ikke findes et aktuelt snapshot efter timeouten', () => {
    vi.useFakeTimers();

    renderComponent({ isActive: true });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('Kontroltabel')).toBeInTheDocument();
    expect(screen.getByText('Kontroltabellen er ikke opdateret endnu')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('viser den normale tom-tabel advarsel når snapshot findes men ikke kan bygge rækker', () => {
    const snapshot = makeSnapshot(makeModel({ rowCount: 0, tableFra: toISODateString('2026-01-01'), tableTil: toISODateString('2026-01-31') }));

    renderComponent({
      inspektionSnapshot: snapshot,
    });

    expect(screen.getByText('Sammentælling')).toBeInTheDocument();
    expect(screen.getByText('Kan ikke oprette kontroltabel')).toBeInTheDocument();
  });

});
