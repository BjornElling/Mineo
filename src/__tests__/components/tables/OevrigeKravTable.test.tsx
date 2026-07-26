// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OevrigeKravTable from '../../../components/tables/OevrigeKravTable';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import { slimInputStore, __testInputWriteAuthority } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { eoOevrigeKravDatoField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, OevrigeKravRow, StamdataValues } from '../../../schemas/formSchemas';

// Greenfield Øvrige krav-tabel (§2.5 trin 9): render-røgtest gennem den ægte produktions-runtime + en ren
// validator-test af den nye descriptor-dato-bounds (§1.6, byte-identisk med legacy `OevrigeKravSection`s minDate/max).

const catalog = getProductionInputCatalog();
const asAmount = (value: number) => ({ kind: 'number' as const, value });

const stamdata: StamdataValues = {
  journalnr: 'J', advokat: 'A', sagsbehandler: 'S', skadelidte: 'T',
  skadestype: 'Arbejdsulykke', skadedato: toISODateString('2022-03-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const eoWith = (rows: OevrigeKravRow[]): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  oevrigeKravPerioder: rows,
});

const hydrate = (rows: OevrigeKravRow[]): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eoWith(rows), erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  slimInputStore.getState().hydrate(input, __testInputWriteAuthority());
};

const renderTable = (committedRows: OevrigeKravRow[]) => render(
  <MemoryRouter>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <OevrigeKravTable committedRows={committedRows} />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const buildReader = (eo: ErstatningsopgoerelseValues, stam: StamdataValues | null) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: stam, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken, settings: DEFAULT_APP_SETTINGS }).reader;
};

describe('OevrigeKravTable', () => {
  it('renderer de committede rækker + en trailing placeholder-række', () => {
    const rows: OevrigeKravRow[] = [
      { id: 'ok-1', dato: toISODateString('2022-05-01'), udgiftTil: 'Medicin', beloeb: asAmount(1500) },
    ];
    hydrate(rows);
    renderTable(rows);

    // Committed række + 1 placeholder = 2 body-rækker.
    const bodyRows = screen.getAllByRole('row').filter((row) => row.hasAttribute('data-mineo-row-id'));
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]).getByDisplayValue('Medicin')).toBeInTheDocument();
  });

  it('descriptor-dato-bounds: en dato før skadedato (min) skjules af readeren og rejser en rød feltfejl (§1.6)', () => {
    // 2021 er før skadedato 2022-03-01 (arbejdsulykke → min = skadedato) → out-of-bounds.
    const reader = buildReader(
      eoWith([{ id: 'ok-1', dato: toISODateString('2021-01-01'), udgiftTil: 'For tidlig', beloeb: asAmount(100) }]),
      stamdata
    );
    const read = reader.read(eoOevrigeKravDatoField.bind('ok-1'));
    expect(read.status).toBe('error');
  });

  it('descriptor-dato-bounds: en dato inden for interval committes uden fejl', () => {
    const reader = buildReader(
      eoWith([{ id: 'ok-1', dato: toISODateString('2022-05-01'), udgiftTil: 'OK', beloeb: asAmount(100) }]),
      stamdata
    );
    const read = reader.read(eoOevrigeKravDatoField.bind('ok-1'));
    expect(read.status).toBe('usable');
  });
});
