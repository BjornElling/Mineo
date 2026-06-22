// @vitest-environment jsdom
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { FormPersistenceContext } from '../../../contexts/FormPersistenceContext.internal';
import type { FormPersistenceContextValue } from '../../../contexts/FormPersistenceContext.shared';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../../config/cellInvalidDraftScopes';

import TableAmountInput from '../../../components/inputs/table/TableAmountInput';
import TableDateInput from '../../../components/inputs/table/TableDateInput';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';
import TablePercentInput from '../../../components/inputs/table/TablePercentInput';
import TableTextInput from '../../../components/inputs/table/TableTextInput';
import TableWeekInput from '../../../components/inputs/table/TableWeekInput';
import TableYearInput from '../../../components/inputs/table/TableYearInput';

// Mock-context hvis invalidDraft-skrivninger rammer den rigtige store-singleton, så
// useInvalidDraftForFieldSelector (reaktiv læsning) ser dem — uden sessionStorage/atomisk-vej.
const makeStoreBackedCtx = (): FormPersistenceContextValue =>
  ({
    getPersistedData: vi.fn(() => null),
    persistData: vi.fn(() => true),
    clearPageData: vi.fn(),
    clearAllData: vi.fn(),
    hasAnyData: vi.fn(() => false),
    getFieldErrors: vi.fn(() => ({})),
    getFieldErrorsBySource: vi.fn(() => ({}) as never),
    getFieldError: vi.fn(() => undefined),
    setFieldError: vi.fn(),
    clearFieldErrors: vi.fn(),
    clearAllFieldErrors: vi.fn(),
    commitInvalidDraft: vi.fn((pageKey, fieldPath, rawDraft) => {
      formPersistenceStore.getState().setInvalidDraft(pageKey, fieldPath, rawDraft);
      return true;
    }),
    clearInvalidDraft: vi.fn((pageKey, fieldPath) => {
      formPersistenceStore.getState().setInvalidDraft(pageKey, fieldPath, null);
      return true;
    }),
    // Den reaktive læsning sker via useInvalidDraftForFieldSelector (store-singleton), så disse
    // imperative context-getters bruges ikke af kanalen; simple stubs er nok.
    getInvalidDraft: vi.fn(() => undefined),
    getInvalidDraftsForSection: vi.fn(() => ({})),
    reconcileInvalidDrafts: vi.fn(() => true),
    getSectionRevision: vi.fn(() => 0),
    getFieldErrorRevision: vi.fn(() => 0),
    replaceAllPersistedData: vi.fn(),
    lastNotice: null,
    lastNoticeEpoch: 0,
  }) satisfies FormPersistenceContextValue;

const gridCell: GridCellCoord = { rowId: 'row1', colIndex: 2 };

const createMutableStore = (state: { editingCell: GridCellCoord | null }): GridCoreStateStore => ({
  subscribe: () => () => undefined,
  getFocusedCell: () => state.editingCell,
  getEditingCell: () => state.editingCell,
});

const renderBoundAmountCell = (
  ctx: FormPersistenceContextValue,
  state: { editingCell: GridCellCoord | null },
  onBlur?: (value: unknown) => void
) => {
  const store = createMutableStore(state);
  return (
    <FormPersistenceContext.Provider value={ctx}>
      <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoOffentligeYdelser}>
        <GridCoreProvider
          value={{
            gridStateStore: store,
            openEditing: vi.fn(),
            closeEditing: vi.fn(),
            registerEditor: vi.fn(),
            unregisterEditor: vi.fn(),
            getEditor: vi.fn().mockReturnValue(null),
            requestFocusPlan: vi.fn(),
          }}
        >
          <TableAmountInput gridCell={gridCell} value={undefined} onBlur={(e) => onBlur?.(e.target.value)} />
        </GridCoreProvider>
      </CellInvalidDraftScopeProvider>
    </FormPersistenceContext.Provider>
  );
};

const resetStore = () => {
  formPersistenceStore.getState().clearAll({
    hydrated: true,
    schemaFingerprint: PERSISTED_DATA_VERSION,
    lastCommittedAt: 1,
  });
};

describe('tabelcelle invalidDrafts-kanal (bundet)', () => {
  const expectedFieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:2');

  beforeEach(() => {
    resetStore();
  });

  it('persisterer en ikke-committbar rå draft til invalidDrafts ved fejlende commit (committed værdi urørt)', () => {
    const ctx = makeStoreBackedCtx();
    const onBlur = vi.fn();
    const state = { editingCell: gridCell as GridCellCoord | null };
    render(renderBoundAmountCell(ctx, state, onBlur));

    const input = screen.getByRole('textbox');
    act(() => {
      fireEvent.change(input, { target: { value: '1+' } });
    });
    act(() => {
      fireEvent.blur(input);
    });

    expect(formPersistenceStore.getState().invalidDrafts.erstatningsopgoerelse[expectedFieldPath]).toBe('1+');
    // Ingen committet domæneværdi (commit afvist).
    expect(onBlur).not.toHaveBeenCalled();
  });

  it('viser den persisterede ugyldige draft + fejl fra render 1 ved remount (intet blink, gl. symptom 3)', () => {
    const ctx = makeStoreBackedCtx();
    // Forudsæt en allerede persisteret ugyldig draft (som efter F5/navigation).
    act(() => {
      formPersistenceStore.getState().setInvalidDraft('erstatningsopgoerelse', expectedFieldPath, '1+');
    });

    const state = { editingCell: null as GridCellCoord | null };
    render(renderBoundAmountCell(ctx, state));

    const input = screen.getByRole('textbox');
    // Råstrengen vises straks (ikke tom/committed), og fejlen er afledt fra render 1.
    expect(input).toHaveValue('1+');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('rydder invalidDrafts-entryet ved et efterfølgende gyldigt commit', () => {
    const ctx = makeStoreBackedCtx();
    act(() => {
      formPersistenceStore.getState().setInvalidDraft('erstatningsopgoerelse', expectedFieldPath, '1+');
    });

    const state = { editingCell: gridCell as GridCellCoord | null };
    render(renderBoundAmountCell(ctx, state));

    const input = screen.getByRole('textbox');
    act(() => {
      fireEvent.change(input, { target: { value: '1234' } });
    });
    act(() => {
      fireEvent.blur(input);
    });

    expect(formPersistenceStore.getState().invalidDrafts.erstatningsopgoerelse[expectedFieldPath]).toBeUndefined();
  });
});

describe('data-mineo-field-path completeness guard', () => {
  beforeEach(() => {
    resetStore();
  });

  const ctx = makeStoreBackedCtx();
  const state = { editingCell: null as GridCellCoord | null };
  const renderInScope = (node: React.ReactNode) =>
    render(
      <FormPersistenceContext.Provider value={ctx}>
        <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoOffentligeYdelser}>
          <GridCoreProvider
            value={{
              gridStateStore: createMutableStore(state),
              openEditing: vi.fn(),
              closeEditing: vi.fn(),
              registerEditor: vi.fn(),
              unregisterEditor: vi.fn(),
              getEditor: vi.fn().mockReturnValue(null),
              requestFocusPlan: vi.fn(),
            }}
          >
            {node}
          </GridCoreProvider>
        </CellInvalidDraftScopeProvider>
      </FormPersistenceContext.Provider>
    );

  const expected = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:2');

  const cases: Array<{ name: string; node: React.ReactNode }> = [
    { name: 'TableAmountInput', node: <TableAmountInput gridCell={gridCell} value={undefined} /> },
    { name: 'TableDateInput', node: <TableDateInput gridCell={gridCell} value={undefined} /> },
    { name: 'TableIntegerInput', node: <TableIntegerInput gridCell={gridCell} value={undefined} /> },
    { name: 'TablePercentInput', node: <TablePercentInput gridCell={gridCell} value={undefined} /> },
    { name: 'TableTextInput', node: <TableTextInput gridCell={gridCell} value={undefined} /> },
    { name: 'TableWeekInput', node: <TableWeekInput gridCell={gridCell} value={undefined} /> },
    { name: 'TableYearInput', node: <TableYearInput gridCell={gridCell} value={undefined} /> },
  ];

  for (const { name, node } of cases) {
    it(`${name} bærer data-mineo-field-path = den fuldt kvalificerede fieldPath når bundet`, () => {
      const { unmount } = renderInScope(node);
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('data-mineo-field-path')).toBe(expected);
      unmount();
    });
  }

  it('vacuous-pass-værn: uden scope/provider bærer cellen INTET data-mineo-field-path', () => {
    // Beviser at attributten er betinget af binding — ellers ville completeness-testen passere tomt.
    render(
      <GridCoreProvider
        value={{
          gridStateStore: createMutableStore(state),
          openEditing: vi.fn(),
          closeEditing: vi.fn(),
          registerEditor: vi.fn(),
          unregisterEditor: vi.fn(),
          getEditor: vi.fn().mockReturnValue(null),
          requestFocusPlan: vi.fn(),
        }}
      >
        <TableAmountInput gridCell={gridCell} value={undefined} />
      </GridCoreProvider>
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('data-mineo-field-path')).toBeNull();
  });
});
