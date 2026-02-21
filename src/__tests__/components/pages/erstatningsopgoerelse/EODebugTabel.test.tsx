import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { EODebugModel } from '../../../../domain/debug/eoDebugModel';
import { buildEODebugModel } from '../../../../domain/debug/eoDebugModel';
import type { SammentaellingModel } from '../../../../domain/debug/eoDebugSammentaelling';
import { buildEODebugSammentaellingModel } from '../../../../domain/debug/eoDebugSammentaelling';
import { TAF_BEREGNES_SOM } from '../../../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import EODebugTabel from '../../../../components/pages/erstatningsopgoerelse/EODebugTabel';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';

const mockBuildEODebugModel = vi.mocked(buildEODebugModel);
const mockBuildEODebugSammentaellingModel = vi.mocked(buildEODebugSammentaellingModel);

vi.mock('../../../../contexts/useFormPersistence', () => {
  return {
    useFormPersistence: () => ({
      getPersistedData: () => null,
    }),
  };
});

vi.mock('../../../../hooks/useFormFieldErrors', () => {
  return {
    useFormFieldErrorsBySource: () => ({}),
  };
});

vi.mock('../../../../domain/debug/eoDebugModel', () => ({
  buildEODebugModel: vi.fn(),
}));

vi.mock('../../../../domain/debug/eoDebugSammentaelling', async () => {
  const actual = await vi.importActual<typeof import('../../../../domain/debug/eoDebugSammentaelling')>(
    '../../../../domain/debug/eoDebugSammentaelling'
  );
  return {
    ...actual,
    buildEODebugSammentaellingModel: vi.fn(),
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

const makeSammentaelling = (patch: Partial<SammentaellingModel>): SammentaellingModel => {
  const baseControl = {
    beregnetDisplay: '-',
    tabelDisplay: '-',
    beregnetValue: null,
    tabelValue: null,
    loseFeriedage: 0,
    oevrigeFravaersdage: 0,
    warningEligible: false,
  } as const;

  const base: SammentaellingModel = {
    beregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
    beregningsperiode: baseControl,
    taf: baseControl,
    svieSmerteSygedage: baseControl,
    svieSmerteDelvise: baseControl,
    beregningsperiodeIndtaegter: [],
    tafIndtaegter: [],
  };
  return { ...base, ...patch };
};

describe('EODebugTabel', () => {
  it('renders debug tabel headings', () => {
    mockBuildEODebugModel.mockReturnValue(makeModel({}));
    mockBuildEODebugSammentaellingModel.mockReturnValue(makeSammentaelling({}));
    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <EODebugTabel />
        </AppSettingsProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Debug tabel')).toBeInTheDocument();
    expect(screen.getByText('Sammentælling')).toBeInTheDocument();
  });

  it('shows the missing-data alert when no rows can be built', async () => {
    mockBuildEODebugModel.mockReturnValue(makeModel({ rowCount: 0 }));
    mockBuildEODebugSammentaellingModel.mockReturnValue(makeSammentaelling({}));
    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <EODebugTabel />
        </AppSettingsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Kan ikke oprette debug-tabel')).toBeInTheDocument();
  });
});
