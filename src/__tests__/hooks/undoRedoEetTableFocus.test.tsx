// @vitest-environment jsdom
//
// Regression for undo/redo-fokus i EET-tabellen (EetAslAfgoerelserTable).
//
// To fejl, begge symptomer på at restore ikke landede fokus på det rigtige/synlige element:
//  1) Afgørelsestype-dropdown'en fik ingen blå fokus-ring efter undo (loose StyledDropdown fik
//     ikke gridCellKey som undo-identitet → restore kunne ikke finde combobox-triggeren).
//  2) Afgørelsesdato-cellen (kolonne 0) mistede fokus efter undo.
import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import EetAslAfgoerelserTable from '../../components/tables/EetAslAfgoerelserTable';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { erhvervsevnetabSchema, type ErhvervsevnetabValues } from '../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { coerceToISODateString, toISODateString } from '../../types/branded';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';

type Controls = ReturnType<typeof useUndoRedo>;
let controls: Controls | null = null;

const EetTablePage = () => {
  const form = usePersistedForm(erhvervsevnetabSchema, 'erhvervsevnetab', ERHVERVSEVNETAB_INITIAL_VALUES);
  const handleChange = React.useCallback(
    (rows: ErhvervsevnetabValues['aslAfgoerelser'], origin?: { fieldPath?: string }) => {
      return form.setValues((prev) => ({ ...prev, aslAfgoerelser: rows }), origin);
    },
    [form]
  );
  return (
    <div data-section-id="eet-section">
      <EetAslAfgoerelserTable
        tableData={form.values.aslAfgoerelser}
        skadedato={coerceToISODateString(toISODateString('2020-01-01'))}
        skadedatoMin={coerceToISODateString(toISODateString('2020-01-01'))!}
        beregningsdato={coerceToISODateString(toISODateString('2023-01-01'))}
        skadelidteFodselsdato={coerceToISODateString(toISODateString('1980-01-01'))}
        onTableDataChange={handleChange}
      />
    </div>
  );
};

const Harness = () => {
  controls = useUndoRedo(useNavigate());
  return (
    <Routes>
      <Route path="/erhvervsevnetab" element={<EetTablePage />} />
    </Routes>
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/erhvervsevnetab']}>
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

describe('undo/redo-fokus i EET-tabellen', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    __resetUndoRedoStoreForTests();
    __resetUndoFocusTrackerForTests();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, erhvervsevnetab: null },
      meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
    });
    installUndoFocusTracker();
  });

  it('bug 1: dropdown-celler bærer undo-identitet på den fokuserbare combobox-trigger', () => {
    const { container } = renderHarness();
    // De loose dropdowns rendres som combobox-triggers; hver SKAL bære data-mineo-undo-field-path
    // = rowId:colIndex, så restore kan finde og fokusere triggeren (og .Mui-focused tegner ringen).
    // EET-tabellen har to dropdown-kolonner: Afgørelsestype (:3) og FS tilbageholdt EET (:7).
    const fieldPaths = Array.from(container.querySelectorAll('[role="combobox"][data-mineo-undo-field-path]')).map(
      (el) => el.getAttribute('data-mineo-undo-field-path') ?? ''
    );
    expect(fieldPaths.length).toBeGreaterThan(0);
    // Mindst én af hver dropdown-kolonne skal være til stede og korrekt tagget.
    expect(fieldPaths.some((p) => p.endsWith(':3'))).toBe(true);
    expect(fieldPaths.some((p) => p.endsWith(':7'))).toBe(true);
    // Ingen dropdown-trigger må mangle en kolonne-suffiks (dvs. alle har rowId:colIndex-form).
    for (const p of fieldPaths) {
      expect(p).toMatch(/:\d+$/);
    }
  });

  const rowIdOfFirstRow = (container: HTMLElement): string => {
    const first = container.querySelector('[data-mineo-undo-field-path$=":0"]') as HTMLInputElement;
    return first.getAttribute('data-mineo-undo-field-path')!.replace(/:0$/, '');
  };

  // Tabel-cellerne er readOnly indtil grid-editoren åbnes; vi kan derfor ikke drive et ægte
  // commit gennem fireEvent.change i jsdom. I stedet replikerer vi nøjagtigt det reelle commit-flow:
  // capture(origin med rowId:colIndex) FØR hver value-ændring (som commitRowUpdate → setValues gør),
  // og lader så undo/redo + restore-løkken køre mod den ægte renderede tabel.
  const makeOrigin = (fieldPath: string) => ({
    route: '/erhvervsevnetab',
    tabKey: null,
    sectionKey: 'erhvervsevnetab' as const,
    fieldPath,
    focusToken: null,
  });

  it('bug 2 (sekvens): efter at have udfyldt kol 0 og kol 1 og undo\'et begge, lander det sidste undo fokus på kol 0', async () => {
    const { container } = renderHarness();
    const rowId = rowIdOfFirstRow(container);
    const c0 = container.querySelector(`[data-mineo-undo-field-path="${rowId}:0"]`) as HTMLInputElement;

    // Commit 1: kolonne 0 (afgørelsesdato) udfyldes FØRST → bliver det SIDSTE undo.
    act(() => {
      c0.focus();
      undoRedoStore.getState().capture(makeOrigin(`${rowId}:0`));
      formPersistenceStore.getState().commitSection(
        'erhvervsevnetab',
        { ...ERHVERVSEVNETAB_INITIAL_VALUES, aslAfgoerelser: [{ id: rowId, afgoerelsesDato: coerceToISODateString(toISODateString('2024-03-15')), fsTilbageholdtEet: 'Nej' }] },
        {}
      );
    });
    await flushRestoreLoop();

    // Commit 2: kolonne 1 (virkningsdato). Fokus flytter til kol 1 (som ved tab) før commit.
    const c1 = container.querySelector(`[data-mineo-undo-field-path="${rowId}:1"]`) as HTMLInputElement;
    act(() => {
      c1.focus();
      undoRedoStore.getState().capture(makeOrigin(`${rowId}:1`));
      formPersistenceStore.getState().commitSection(
        'erhvervsevnetab',
        {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          aslAfgoerelser: [{ id: rowId, afgoerelsesDato: coerceToISODateString(toISODateString('2024-03-15')), virkningsDato: coerceToISODateString(toISODateString('2024-03-20')), fsTilbageholdtEet: 'Nej' }],
        },
        {}
      );
    });
    await flushRestoreLoop();

    // Undo kolonne 1 → fokus på kol 1.
    await act(async () => {
      controls!.undo();
    });
    await flushRestoreLoop();
    expect((document.activeElement as HTMLElement | null)?.getAttribute('data-mineo-undo-field-path')).toBe(`${rowId}:1`);

    // Undo kolonne 0 → tabellen tømmes. KERNEN: rækken må bevare sin identitet (rowId:0),
    // så fokus lander på kol 0 og ikke falder til <body>.
    await act(async () => {
      controls!.undo();
    });
    await flushRestoreLoop();

    const active = document.activeElement as HTMLElement | null;
    expect(active?.getAttribute('data-mineo-undo-field-path')).toBe(`${rowId}:0`);
    // Tung integrationstest: renderer hele EET-tabellen og kører flere undo/redo + rAF-baserede
    // focus-restore-løkker. Under fuld parallel suite-belastning ligger køretiden nær default-timeout,
    // så vi giver eksplicit headroom for at undgå belastnings-flakiness (ikke en adfærdsændring).
  }, 20000);
});
