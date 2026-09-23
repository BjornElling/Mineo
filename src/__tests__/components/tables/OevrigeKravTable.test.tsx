// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OevrigeKravTable from '../../../components/tables/OevrigeKravTable';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { eoOevrigeKravBeloebField, eoOevrigeKravDatoField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
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

// Tabellen vises kun ved kravvalget «Ja»; ellers er cellerne skjulte og dermed ikke udfyldt (BB-228).
const eoWith = (rows: OevrigeKravRow[]): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  kravPaaOevrigeErstatningskrav: 'Ja',
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
  hydrateSlimInputStoreForTest(slimInputStore, input);
};

const renderTable = (
  committedRows: OevrigeKravRow[],
  periode?: { fra: ReturnType<typeof toISODateString>; til: ReturnType<typeof toISODateString> },
) => render(
  <MemoryRouter>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <OevrigeKravTable committedRows={committedRows} {...(periode === undefined ? {} : { periode })} />
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
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
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

  it('giver en dato uden for opgørelsens periode en gul, ikke-blokerende ring (BB-235)', () => {
    const rows: OevrigeKravRow[] = [
      { id: 'ok-1', dato: toISODateString('2022-05-01'), udgiftTil: 'Medicin', beloeb: asAmount(1500) },
      { id: 'ok-2', dato: toISODateString('2023-02-01'), udgiftTil: 'Transport', beloeb: asAmount(100) },
    ];
    hydrate(rows);
    renderTable(rows, { fra: toISODateString('2022-03-01'), til: toISODateString('2022-12-31') });

    const bodyRows = screen.getAllByRole('row').filter((row) => row.hasAttribute('data-mineo-row-id'));
    const indenfor = within(bodyRows[0]).getByDisplayValue('01-05-2022');
    const udenfor = within(bodyRows[1]).getByDisplayValue('01-02-2023');
    const beskrivelse = (input: HTMLElement) => document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent;

    expect(indenfor.getAttribute('aria-describedby')).toBeNull();
    expect(beskrivelse(udenfor)).toBe('Datoen ligger uden for opgørelsens periode (01-03-2022 - 31-12-2022)');
    expect(udenfor).toHaveAttribute('aria-invalid', 'false');
  });

  it('håndhæver tekstcodecets længdegrænse på den direkte grid-overflade', () => {
    hydrate([]);
    renderTable([]);

    expect(screen.getByRole('textbox', { name: 'Udgift til' })).toHaveAttribute('maxlength', '60');
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

  it('et beløb på 0 kr. er rødt med sin egen tooltip-tekst (BB-232)', () => {
    const reader = buildReader(
      eoWith([{ id: 'ok-1', dato: toISODateString('2022-05-01'), udgiftTil: 'Medicin', beloeb: asAmount(0) }]),
      stamdata
    );
    const read = reader.read(eoOevrigeKravBeloebField.bind('ok-1'));
    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.reason).toBe('rule');
    expect(read.issue.message).toBe('Beløbet skal være større end 0 kr.');
  });

  it('en skjult celle er ikke udfyldt og bliver ikke rød (BB-228)', () => {
    const reader = buildReader(
      { ...eoWith([{ id: 'ok-1', dato: toISODateString('2021-01-01'), udgiftTil: 'Medicin', beloeb: asAmount(0) }]), kravPaaOevrigeErstatningskrav: 'Skjul' },
      stamdata
    );
    expect(reader.read(eoOevrigeKravDatoField.bind('ok-1'))).toEqual({ status: 'usable', value: undefined });
    expect(reader.read(eoOevrigeKravBeloebField.bind('ok-1'))).toEqual({ status: 'usable', value: undefined });
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
