// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EOKontrolTabel from '../../../../components/pages/erstatningsopgoerelse/EOKontrolTabel';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import type { EOInspektionModel } from '../../../../domain/eoInspektion/eoInspektionKontrolModel';
import type { EOInspektionSnapshot } from '../../../../domain/eoInspektion/eoInspektionSnapshot';
import type { SammentaellingDisplayTables, SammentaellingModel } from '../../../../domain/eoInspektion/eoInspektionSammentaelling';
import {
  beregnetVaerdi,
  buildSammentaellingControl,
} from '../../../../domain/erstatningsopgoerelse/control/eoControlMismatch';
import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
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
  // Kontrolrækker kan ikke skrives i hånden; brandet tvinger dem gennem produktionskonstruktøren.
  const baseControl = buildSammentaellingControl({
    beregnet: beregnetVaerdi(null, '-'),
    tabel: { value: null, display: '-' },
  });

  const base: SammentaellingModel = {
    beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    tafBranchAvailable: true,
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
    expect(screen.queryByText('Kontroltabellen kan ikke vises, fordi beregningen er stoppet')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.queryByText('Kontroltabellen kan ikke vises, fordi beregningen er stoppet')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('viser info når der ikke findes et aktuelt snapshot efter timeouten', () => {
    vi.useFakeTimers();

    renderComponent({ isActive: true });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('Kontroltabel')).toBeInTheDocument();
    expect(screen.getByText('Kontroltabellen kan ikke vises, fordi beregningen er stoppet')).toBeInTheDocument();
    expect(screen.getByText('Se «Fejl og advarsler» under Beregning.')).toBeInTheDocument();
    // Uden kontrolgrundlag er der intet at tælle sammen (BB-389).
    expect(screen.queryByText('Sammentælling')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('forklarer tom-tilstanden med de kilder, tabellen faktisk dannes af (BB-380)', () => {
    const snapshot = makeSnapshot(makeModel({ rowCount: 0 }));

    renderComponent({
      inspektionSnapshot: snapshot,
    });

    expect(screen.getByText('Sammentælling')).toBeInTheDocument();
    const forklaring = screen.getByText(/Kontroltabellen dannes af sagens perioder/);
    expect(forklaring).toHaveTextContent(
      'Udfyld mindst én af: «Vedrører perioden», beregningsperioden, en TAF- eller svie/smerte-periode, lønindkomst eller offentlige ydelser.'
    );
    expect(forklaring).not.toHaveTextContent('Skadedato');
    // Forklaringen står over sammentællingen, ved den grå knap – ikke nederst.
    expect(forklaring.compareDocumentPosition(screen.getByText('Sammentælling')) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('viser intet mærke for en række uden tal og udelader tomme grupper (BB-386)', () => {
    const tom = buildSammentaellingControl({ beregnet: beregnetVaerdi(null, '-'), tabel: { value: null, display: '-' } });
    const ok = buildSammentaellingControl({ beregnet: beregnetVaerdi(5, '5'), tabel: { value: 5, display: '5' } });
    const snapshot: EOInspektionSnapshot = {
      ...makeSnapshot(makeModel({ rowCount: 0 })),
      sammentaellingTables: {
        basis: [
          { key: 'tom', label: 'Svie/smerte, sygedage', control: tom },
          { key: 'ok', label: 'Arbejdsdage i TAF-periode', control: ok },
        ],
        beregningsperiode: [],
        taf: [],
        sfgg: [{ key: 'sfgg', label: 'Sygeferiegodtgørelse', control: tom }],
      },
    };

    renderComponent({ inspektionSnapshot: snapshot });

    expect(screen.getAllByTestId('CheckIcon')).toHaveLength(1);
    expect(screen.queryByTestId('ErrorOutlinedIcon')).not.toBeInTheDocument();
    expect(screen.queryByText('Beregningsperiode')).not.toBeInTheDocument();
    expect(screen.queryByText('TAF-periode')).not.toBeInTheDocument();
    expect(screen.getAllByText('Enhed')).toHaveLength(2);
  });

  it('bruger oversigtens nye betegnelser (BB-387)', () => {
    renderComponent({ inspektionSnapshot: makeSnapshot(makeModel({ rowCount: 0 })) });

    expect(screen.getByText('Sagens første og sidste dato')).toBeInTheDocument();
    expect(screen.getByText('Tabellen viser (hele måneder)')).toBeInTheDocument();
    expect(screen.queryByText('Tabelperiode (definerende)')).not.toBeInTheDocument();
  });

});
