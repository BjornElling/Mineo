// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../inputCore/runtime/slimInputStore';
import type React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FerieperiodeTable from '../../../components/tables/FerieperiodeTable';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import TafPeriodeTable from '../../../components/tables/TafPeriodeTable';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import {
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

const catalog = getProductionInputCatalog();
const amount = (value: number) => ({ kind: 'number' as const, value });

const hydrate = (eo: ErstatningsopgoerelseValues): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  __hydrateSlimInputStoreForTest(slimInputStore, input);
};

const renderInRuntime = (child: React.ReactNode) => render(
  <MemoryRouter>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          {child}
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const dataRows = (): HTMLElement[] => screen.getAllByRole('row').filter((row) => row.hasAttribute('data-mineo-row-id'));

describe('Greenfield-tabeller i Erstatningsopgørelse', () => {
  afterEach(cleanup);

  it('TAF-tabellen renderer committed rækkefølge og én trailing placeholder', () => {
    const rows = [{ id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), loseFeriedage: 2 }];
    hydrate({ ...createErstatningsopgoerelseInitialValues(), tafPerioder: rows });

    renderInRuntime(
      <TafPeriodeTable committedRows={rows} derivedById={{ 'taf-1': 21 }} derivedColumnHeader="Dage" />
    );

    expect(dataRows()).toHaveLength(2);
    expect(within(dataRows()[0]!).getByDisplayValue('01-01-2024')).toBeInTheDocument();
    expect(within(dataRows()[0]!).getByText('21')).toBeInTheDocument();
  });

  it('ferietabellen renderer committed række og afledt antal dage', () => {
    const rows = [{ id: 'ferie-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-05') }];
    hydrate({ ...createErstatningsopgoerelseInitialValues(), ferieperioder: rows });

    renderInRuntime(
      <FerieperiodeTable kind="taf" committedRows={rows} feriedageById={{ 'ferie-1': 3 }} />
    );

    expect(dataRows()).toHaveLength(2);
    expect(within(dataRows()[0]!).getByDisplayValue('01-02-2024')).toBeInTheDocument();
    expect(within(dataRows()[0]!).getByText('3')).toBeInTheDocument();
  });

  it('offentlige ydelser renderer canonical beløb og afledte kolonner', () => {
    const rows = [{
      id: 'ydelse-1',
      fraDato: toISODateString('2024-03-01'),
      tilDato: toISODateString('2024-03-31'),
      ydelse: amount(3100),
      tillaeg: amount(100),
      ydelsestype: 'dagpenge',
    }];
    hydrate({ ...createErstatningsopgoerelseInitialValues(), offentligeYdelserRows: rows });
    const derived = new Map([['ydelse-1', {
      periodiseringLabel: 'Pr. måned', antalDageDisplay: '31', ydelsePerDagDisplay: '100,00',
    }]]);

    renderInRuntime(
      <OffentligeYdelserTable
        committedRows={rows}
        derivedByRowId={derived}
        disableMidlertidigtEetOption={false}
      />
    );

    expect(dataRows()).toHaveLength(2);
    expect(within(dataRows()[0]!).getByText('Pr. måned')).toBeInTheDocument();
    expect(within(dataRows()[0]!).getByText('31')).toBeInTheDocument();
  });
});
