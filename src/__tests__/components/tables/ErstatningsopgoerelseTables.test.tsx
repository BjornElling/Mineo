// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import type React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FerieperiodeTable from '../../../components/tables/FerieperiodeTable';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import TafPeriodeTable from '../../../components/tables/TafPeriodeTable';
import LoenudviklingManuelTable from '../../../components/tables/LoenudviklingManuelTable';
import LoenudviklingManuelProcentsatsTable from '../../../components/tables/LoenudviklingManuelProcentsatsTable';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import {
  createErstatningsopgoerelseInitialValues,
  createDefaultLoenindkomstAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { eoEmploymentManual } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { CollectionRef } from '../../../inputCore/fieldAddress';
import { buildFieldIssueSet, EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { toAnyFieldRef } from '../../../inputCore/fieldDescriptor';

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
  hydrateSlimInputStoreForTest(slimInputStore, input);
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

describe('Erstatningsopgørelses tabeller over den fælles grid-adapter', () => {
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

  it('grupperer de supplerende ydelsestyper efter en divider og sorterer hver gruppe alfabetisk', () => {
    // Stregen og de to gruppers indhold er uændret; det NYE er, at hver gruppe er sorteret
    // alfabetisk indbyrdes efter den viste label. Testen assertes derfor på selve reglen – sorteret
    // efter dansk kollation – og ikke på en håndskrevet labelrækkefølge, som ville skulle rettes hver
    // gang en ydelsestype tilføjes.
    const rows = [{
      id: 'ydelse-1',
      fraDato: undefined,
      tilDato: undefined,
      ydelse: undefined,
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];
    hydrate({ ...createErstatningsopgoerelseInitialValues(), offentligeYdelserRows: rows });

    renderInRuntime(
      <OffentligeYdelserTable
        committedRows={rows}
        derivedByRowId={new Map()}
        disableMidlertidigtEetOption
      />
    );

    fireEvent.click(within(dataRows()[0]!).getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    const children = Array.from(listbox.children);
    const dividerIndex = children.findIndex((child) => child.getAttribute('role') === 'presentation');
    expect(dividerIndex).toBeGreaterThan(0);

    // «Vælg...» er dropdownens tomvalg, ikke en ydelsestype, og indgår derfor ikke i sorteringsreglen.
    const labelsBeforeDivider = children
      .slice(0, dividerIndex)
      .map((option) => option.textContent ?? '')
      .filter((label) => label !== 'Vælg...');
    const labelsAfterDivider = children.slice(dividerIndex + 1).map((option) => option.textContent ?? '');

    // Gruppernes indhold: de supplerende posteringer står under stregen, resten over.
    expect(labelsAfterDivider).toHaveLength(3);
    expect(new Set(labelsAfterDivider)).toEqual(new Set(['Feriepenge', 'Midlertidigt EET', 'Andet']));
    expect(labelsBeforeDivider).not.toHaveLength(0);
    for (const supplerende of ['Feriepenge', 'Midlertidigt EET', 'Andet']) {
      expect(labelsBeforeDivider).not.toContain(supplerende);
    }

    // Selve reglen: hver gruppe er alfabetisk sorteret indbyrdes.
    const danishSorted = (labels: readonly string[]) => [...labels].sort((a, b) => a.localeCompare(b, 'da'));
    expect(labelsBeforeDivider).toEqual(danishSorted(labelsBeforeDivider));
    expect(labelsAfterDivider).toEqual(danishSorted(labelsAfterDivider));

    expect(screen.getByRole('option', { name: 'Midlertidigt EET' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('blokkerer en tredje decimal i offentlige ydelsers beløbscelle', () => {
    const rows = [{
      id: 'ydelse-1',
      fraDato: toISODateString('2024-03-01'),
      tilDato: toISODateString('2024-03-31'),
      ydelse: undefined,
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];
    hydrate({ ...createErstatningsopgoerelseInitialValues(), offentligeYdelserRows: rows });

    renderInRuntime(
      <OffentligeYdelserTable
        committedRows={rows}
        derivedByRowId={new Map()}
        disableMidlertidigtEetOption={false}
      />
    );

    const amountInput = within(dataRows()[0]!).getAllByRole('textbox')[2] as HTMLInputElement;
    fireEvent.keyDown(amountInput, { key: '1' });
    fireEvent.change(amountInput, { target: { value: '1' } });
    amountInput.setSelectionRange(1, 1);
    fireEvent.keyDown(amountInput, { key: ',' });
    fireEvent.change(amountInput, { target: { value: '1,' } });
    amountInput.setSelectionRange(2, 2);
    fireEvent.keyDown(amountInput, { key: '2' });
    fireEvent.change(amountInput, { target: { value: '1,2' } });
    amountInput.setSelectionRange(3, 3);
    fireEvent.keyDown(amountInput, { key: '3' });
    fireEvent.change(amountInput, { target: { value: '1,23' } });
    amountInput.setSelectionRange(4, 4);

    expect(fireEvent.keyDown(amountInput, { key: '4' }), 'tredje decimal skal blokeres').toBe(false);
  });

  it.each([
    ['Manuelt angivet', 'loenudviklingManuelTableData'],
    ['Manuel procentsats', 'loenudviklingManuelProcentsatsTableData'],
  ] as const)('låser første datocelle for %s, selv hvis en ældre state mangler basisrækken', (_, collectionName) => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    hydrate({
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [employment],
    });
    const bindings = eoEmploymentManual;
    const collectionDefinition = collectionName === 'loenudviklingManuelTableData'
      ? bindings.manualCollection
      : bindings.manualPercentCollection;
    const collection = {
      ...collectionDefinition.template,
      path: [{ kind: 'entity' as const, collection: 'loenindkomstAnsaettelsesforhold', entityId: employment.id }],
    } as CollectionRef;
    const shared = {
      bindings,
      collection,
      committedRows: [],
      ruleIssues: EMPTY_FIELD_ISSUE_SET,
      baseDateDisplay: '',
      baseDateErrorMessage: 'Skadedato er ikke udfyldt',
      locationPrefix: `test:${collectionName}`,
      locationNav: { route: '/erstatningsopgoerelse', tabKey: 'loenindkomst' },
    } as const;

    renderInRuntime(
      collectionName === 'loenudviklingManuelTableData'
        ? <LoenudviklingManuelTable {...shared} />
        : <LoenudviklingManuelProcentsatsTable {...shared} />
    );

    const firstDate = within(dataRows()[0]!).getAllByRole('textbox')[0]!;
    expect(firstDate).toHaveAttribute('readonly');
    expect(firstDate).toHaveAttribute('data-mineo-grid-locked', 'true');
    expect(firstDate).toHaveAttribute('aria-describedby');
  });

  it('tillader dansk decimalkomma i manuel procentsats-tabellens redigerbare procentfelt', () => {
    const rows = [
      { id: 'basis', dato: undefined, procent: 0 },
      { id: 'regulering', dato: toISODateString('2024-07-01'), procent: undefined },
    ];
    const employment = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenudviklingManuelProcentsatsTableData: rows,
    };
    hydrate({
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [employment],
    });
    const collection = {
      ...eoEmploymentManual.manualPercentCollection.template,
      path: [{ kind: 'entity' as const, collection: 'loenindkomstAnsaettelsesforhold', entityId: employment.id }],
    } as CollectionRef;

    renderInRuntime(
      <LoenudviklingManuelProcentsatsTable
        bindings={eoEmploymentManual}
        collection={collection}
        committedRows={rows}
        ruleIssues={EMPTY_FIELD_ISSUE_SET}
        baseDateDisplay="01-06-2024"
        baseDateISO={toISODateString('2024-06-01')}
        locationPrefix="test:manuel-procentsats"
        locationNav={{ route: '/erstatningsopgoerelse', tabKey: 'loenindkomst' }}
      />
    );

    const percentInput = within(dataRows()[1]!).getAllByRole('textbox')[1] as HTMLInputElement;
    expect(percentInput).toHaveAttribute('inputmode', 'decimal');
    expect(percentInput).toHaveAttribute('placeholder', '0,00');
    fireEvent.keyDown(percentInput, { key: '1' });
    fireEvent.change(percentInput, { target: { value: '1' } });
    percentInput.setSelectionRange(1, 1);
    expect(fireEvent.keyDown(percentInput, { key: ',' }), 'kommaet må ikke blive blokeret').toBe(true);
    fireEvent.change(percentInput, { target: { value: '1,' } });
    percentInput.setSelectionRange(2, 2);
    expect(fireEvent.keyDown(percentInput, { key: '2' })).toBe(true);
    fireEvent.change(percentInput, { target: { value: '1,2' } });
    percentInput.setSelectionRange(3, 3);
    expect(fireEvent.keyDown(percentInput, { key: '3' })).toBe(true);
    fireEvent.change(percentInput, { target: { value: '1,23' } });
    percentInput.setSelectionRange(4, 4);
    expect(fireEvent.keyDown(percentInput, { key: '4' }), 'tredje decimal skal blokeres').toBe(false);
  });

  it('viser en collection-afledt datoregel som rød fejl på den konkrete manuelle datocelle', () => {
    const rows = [
      { id: 'basis', dato: undefined, procent: 0 },
      { id: 'regulering', dato: toISODateString('2024-06-01'), procent: 2.5 },
    ];
    const employment = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenudviklingManuelProcentsatsTableData: rows,
    };
    hydrate({
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [employment],
    });
    const collection = {
      ...eoEmploymentManual.manualPercentCollection.template,
      path: [{ kind: 'entity' as const, collection: 'loenindkomstAnsaettelsesforhold', entityId: employment.id }],
    } as CollectionRef;
    const dateField = eoEmploymentManual.manualPercentFields.dato.bind(employment.id, 'regulering');
    const ruleIssues = buildFieldIssueSet([{
      kind: 'field',
      code: 'test.manualDate.afterBasis',
      severity: 'error',
      field: toAnyFieldRef(dateField),
      reason: 'rule',
      message: 'Datoen skal være senere end datoen i den låste første række (01-06-2024)',
    }]);

    renderInRuntime(
      <LoenudviklingManuelProcentsatsTable
        bindings={eoEmploymentManual}
        collection={collection}
        committedRows={rows}
        ruleIssues={ruleIssues}
        baseDateDisplay="01-06-2024"
        baseDateISO={toISODateString('2024-06-01')}
        locationPrefix="test:manuel-procentsats-rule"
        locationNav={{ route: '/erstatningsopgoerelse', tabKey: 'loenindkomst' }}
      />
    );

    const dateInput = within(dataRows()[1]!).getAllByRole('textbox')[0]!;
    expect(dateInput).toHaveAttribute('aria-invalid', 'true');
  });
});
