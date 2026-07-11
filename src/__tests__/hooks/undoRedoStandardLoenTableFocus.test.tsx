// @vitest-environment jsdom
//
// Regression for undo/redo-fokus i Standard løn-tabellen (StandardLoenTable, Årsløn-siden).
//
// Bug: StandardLoenTable manglede row-id-reconcile ved prop-resync (modsat de øvrige
// grid-tabeller). Når undo reverterer tabellen til en tilstand, hvor normaliseringen regenererer
// rækkernes id'er på den fokuserede position, mistede den redigerede celle sin undo-identitet
// (`data-mineo-undo-field-path = rowId:colIndex`), så fokus faldt til <body> i stedet for at lande
// tilbage på cellen. De reconcilende tabeller (EET, offentlige ydelser, lønudvikling) bevarer id'et
// positionelt og rammer derfor cellen korrekt. Denne test fastholder, at Standard løn nu gør det samme.
import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import StandardLoenTable from '../../components/tables/StandardLoenTable';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { aarsloenSchema, type AarsloenValues, type StandardLoenTableRow } from '../../schemas/formSchemas';
import { AARSLOEN_INITIAL_VALUES } from '../../domain/aarsloen/aarsloenInitialValues';
import { initialRow } from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';

type Controls = ReturnType<typeof useUndoRedo>;
let controls: Controls | null = null;

const StandardLoenPage = () => {
  const form = usePersistedForm(aarsloenSchema, 'aarsloen', AARSLOEN_INITIAL_VALUES);
  const handleChange = React.useCallback(
    (rows: StandardLoenTableRow[], options?: { fieldPath?: string }) => {
      form.setValues((prev) => ({ ...prev, tableData: rows }), options);
    },
    [form]
  );
  return (
    <div data-section-id="aarsloen-section">
      <StandardLoenTable
        loenperiode="maaned"
        satser={{}}
        tableData={form.values.tableData}
        onTableDataChange={handleChange}
      />
    </div>
  );
};

const Harness = () => {
  controls = useUndoRedo(useNavigate());
  return (
    <Routes>
      <Route path="/aarsloen" element={<StandardLoenPage />} />
    </Routes>
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/aarsloen']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
            <Harness />
          </FormPersistenceProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );

const flushRestoreLoop = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
  });
};

const makeOrigin = (fieldPath: string) => ({
  route: '/aarsloen',
  tabKey: null,
  sectionKey: 'aarsloen' as const,
  fieldPath,
  focusToken: null,
});

const rowIdOfFirstRow = (container: HTMLElement): string => {
  const first = container.querySelector('[data-mineo-undo-field-path$=":0"]') as HTMLInputElement;
  return first.getAttribute('data-mineo-undo-field-path')!.replace(/:0$/, '');
};

describe('undo/redo-fokus i Standard løn-tabellen', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    __resetUndoRedoStoreForTests();
    __resetUndoFocusTrackerForTests();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, aarsloen: null },
      meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
    });
    installUndoFocusTracker();
  });

  it('efter udfyldning af kol 0 og undo lander fokus tilbage på kol 0 (ikke <body>)', async () => {
    const { container } = renderHarness();
    const rowId = rowIdOfFirstRow(container);
    const c0 = container.querySelector(`[data-mineo-undo-field-path="${rowId}:0"]`) as HTMLInputElement;

    const committedRows: StandardLoenTableRow[] = [{ ...initialRow, id: rowId, col0_maaned: '3' }];
    const nextValues: AarsloenValues = { ...AARSLOEN_INITIAL_VALUES, tableData: committedRows };

    act(() => {
      c0.focus();
      undoRedoStore.getState().capture(makeOrigin(`${rowId}:0`));
      formPersistenceStore.getState().commitSection('aarsloen', nextValues, {});
    });
    await flushRestoreLoop();

    // Undo → tabellen reverteres. KERNEN: den redigerede celle skal bevare sin identitet (rowId:0),
    // så fokus lander på kol 0 og ikke falder til <body>.
    await act(async () => {
      controls!.undo();
    });
    await flushRestoreLoop();

    const active = document.activeElement as HTMLElement | null;
    expect(active?.getAttribute('data-mineo-undo-field-path')).toBe(`${rowId}:0`);
  }, 20000);
});
