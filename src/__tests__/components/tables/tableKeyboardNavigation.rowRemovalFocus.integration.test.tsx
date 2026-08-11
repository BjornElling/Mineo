// @vitest-environment jsdom
import * as React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { GridAmountCell } from '../../../inputCore/react/fields';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { ActiveEditorRegistry, type SlimInputStore, dispatchInput } from '../../../inputCore/runtime';
import { insertRow } from '../../../inputCore/inputReducer';
import { createInputRuntimeBinding, InputRuntimeProvider } from '../../../inputCore/react';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import {
  handleTableClickCapture,
  handleTableFocusCapture,
  handleTableKeyDownCapture,
  handleTablePointerDownCapture,
} from '../../../components/tables/gridCore/tableKeyboardNavigation';
import { useCollectionTable } from '../../../components/tables/useCollectionTable';
import { useGridCoreController } from '../../../components/tables/useGridCoreController';
import {
  belobField,
  createAutoPruningTestCatalog,
  makeRow,
  rentekravRowsRef,
  testRowOrigin,
} from '../../inputCore/testCatalog';
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { createEvaluationSourceToken, type InputCatalog } from '../../../inputCore';
import type { RentekravRow } from '../../../schemas/formSchemas/sections/renteberegningSchemas';

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;
let nextRowId = 0;

const createRowId = (): string => {
  nextRowId += 1;
  return `r${nextRowId}`;
};

beforeEach(() => {
  nextRowId = 0;
  catalog = createAutoPruningTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
    [{ width: 120, height: 24 } as DOMRect] as unknown as DOMRectList
  );

  for (const rowId of ['r1', 'r2', 'r3', 'r4']) {
    dispatchInput(
      store,
      catalog,
      insertRow(rentekravRowsRef(), makeRow(rowId, { belob: { kind: 'number', value: 100 } })),
      { origin: testRowOrigin() }
    );
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

const RowRemovalFocusHarness = ({ committedRows }: Readonly<{ committedRows: readonly RentekravRow[] }>): React.ReactElement => {
  const { internalTableRef, contextValue } = useGridCoreController();
  const table = useCollectionTable<RentekravRow>({
    collection: rentekravRowsRef(),
    committedRows,
    createRowId,
    createEmptyRow: (id) => makeRow(id),
    locationPrefix: 'test.rentekrav',
    locationNav: {
      route: '/renteberegning',
      tabKey: null,
    },
  });
  const renderRows = table.buildRenderRows();

  return (
    <GridCoreProvider value={contextValue}>
      <table
        ref={internalTableRef}
        onFocusCapture={handleTableFocusCapture}
        onPointerDownCapture={handleTablePointerDownCapture}
        onClickCapture={handleTableClickCapture}
        onKeyDownCapture={handleTableKeyDownCapture}
      >
        <tbody>
          {renderRows.map((renderRow) => {
            const rowId = renderRow.rowId;
            return (
              <tr key={rowId} data-mineo-row-id={rowId}>
                <td>
                  <GridAmountCell
                    gridCell={{ rowId, colIndex: 0 }}
                    cell={table.buildCellSpec(renderRow, belobField, 0)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GridCoreProvider>
  );
};

const LiveRowRemovalFocusHarness = (): React.ReactElement => {
  const [, forceRender] = React.useReducer((value: number) => value + 1, 0);
  React.useEffect(() => store.subscribe(forceRender), []);
  const committedRows = store.getState().input.sections.renteberegning?.rentekravRows ?? [];
  return <RowRemovalFocusHarness committedRows={committedRows} />;
};

const renderHarness = () => {
  const binding = createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

  return render(
    <InputRuntimeProvider binding={binding}>
      <LiveRowRemovalFocusHarness />
    </InputRuntimeProvider>
  );
};

const inputForRow = (rowId: string): HTMLInputElement => {
  const input = document.querySelector(`tr[data-mineo-row-id="${rowId}"] input`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Mangler input for ${rowId}`);
  return input;
};

const deleteFocusedRow = async (rowId: string, key: 'Backspace' | 'Delete' = 'Delete'): Promise<void> => {
  const focusedInput = inputForRow(rowId);
  await act(async () => {
    focusedInput.focus();
    fireEvent.keyDown(focusedInput, { key });
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
};

const visibleRowIds = (): readonly string[] =>
  Array.from(document.querySelectorAll('tbody tr')).map((row) => row.getAttribute('data-mineo-row-id') ?? '');

describe('tableKeyboardNavigation: fokus efter automatisk tomrække-sletning', () => {
  it('bevarer samme tabelposition, når en mellemrække bliver tom og fjernes', async () => {
    renderHarness();
    await deleteFocusedRow('r3', 'Backspace');

    expect(document.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(visibleRowIds()).toEqual(['r1', 'r2', 'r4', 'r3']);
    expect(document.activeElement).toBe(inputForRow('r4'));
  });

  it('bevarer første tabelposition, når den første række fjernes', async () => {
    renderHarness();
    await deleteFocusedRow('r1');

    expect(visibleRowIds()).toEqual(['r2', 'r3', 'r4', 'r1']);
    expect(document.activeElement).toBe(inputForRow('r2'));
  });

  it('bevarer sidste tabelposition, når den sidste række fjernes', async () => {
    renderHarness();
    await deleteFocusedRow('r4');

    expect(visibleRowIds()).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(document.activeElement).toBe(inputForRow('r4'));
  });
});
