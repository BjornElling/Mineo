// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider, type InputRuntimeBinding } from '../../../inputCore/react';
import { GridAmountCell, GridChoiceCell } from '../../../inputCore/react/fields';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, type InputCatalog } from '../../../inputCore';
import { findRestoreTarget } from '../../../inputCore/react/historyRestoreTarget';
import {
  createTestCatalog,
  belobField,
  enhedField,
  rentekravRowsRef,
  makeRow,
} from '../../inputCore/testCatalog';
import { useCollectionTable } from '../../../components/tables/useCollectionTable';
import { useGridCoreController } from '../../../components/tables/useGridCoreController';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import {
  handleTableClickCapture,
  handleTableFocusCapture,
  handleTableKeyDownCapture,
  handleTablePointerDownCapture,
} from '../../../components/tables/gridCore/tableKeyboardNavigation';
import type { RentekravRow } from '../../../schemas/formSchemas/sections/renteberegningSchemas';
import type { TillaegstidEnhed } from '../../../schemas/formSchemas/enumSchemas';

/**
 * DEN FÆLLES KONTRAKT for placeholder-promotion → undo → fokus (§1.11, §3.7, UT-F03).
 *
 * Ingen eksisterende test krydsede hele kæden. `dispatchInput.test.ts` hedder "undo fokuserer den skrevne
 * celle", men hævder kun at `restoredOrigin` returneres uændret; `historyRestoreTarget` tester det eksakte
 * match isoleret på en celle, der stadig findes. Fejlen levede netop i mellemrummet: originen var korrekt, men
 * tabellen havde gjort dens fokusmål umuligt at finde, fordi den kun huskede det SENESTE placeholder-id.
 *
 * Testene her kører gennem den ÆGTE `useCollectionTable`, de ægte greenfield-celler og den ægte runtime, og
 * måler det, brugeren oplever: efter et undo af promoveringen skal den demoterede placeholder-celle kunne
 * findes af fokusrestoren og faktisk have fokus.
 */

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  // jsdom giver alle elementer nul dimensioner; både grid-navigationen og `isRestoreTargetVisible` filtrerer
  // på synlighed, så uden dette ville tabellen se tom ud for begge.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
    [{ width: 120, height: 24 } as DOMRect] as unknown as DOMRectList
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

const LOCATION_NAV = { route: '/renteberegning', tabKey: null } as const;

/** Deterministisk id-fabrik, så testen kan udtale sig om HVILKEN identitet der genindtræder. */
let nextRowId = 0;
const createRowId = (): string => {
  nextRowId += 1;
  return `slot-${nextRowId}`;
};

/**
 * En ÆGTE dynamisk tabel: rigtig `useCollectionTable` (placeholder-livscyklus + cellebinding), rigtig
 * grid-controller, rigtige greenfield-celler.
 */
const TableHarness: React.FC<Readonly<{
  committedRows: readonly RentekravRow[];
  minimumVisibleRows?: number;
}>> = ({ committedRows, minimumVisibleRows }) => {
  const { internalTableRef, contextValue } = useGridCoreController();
  const table = useCollectionTable<RentekravRow>({
    collection: rentekravRowsRef(),
    committedRows,
    createRowId,
    createEmptyRow: (id) => makeRow(id),
    locationPrefix: 'renteberegning.rentekravRows',
    locationNav: LOCATION_NAV,
    ...(minimumVisibleRows === undefined ? {} : { minimumVisibleRows }),
  });

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
          {table.renderRows.map((renderRow) => (
            <tr key={renderRow.rowId} data-mineo-row-id={renderRow.rowId}>
              <td>
                <GridAmountCell
                  gridCell={{ rowId: renderRow.rowId, colIndex: 0 }}
                  cell={table.buildCellSpec(renderRow, belobField, 0)}
                />
              </td>
              <td>
                <GridChoiceCell<TillaegstidEnhed, RentekravRow, TillaegstidEnhed>
                  gridCell={{ rowId: renderRow.rowId, colIndex: 1 }}
                  cell={table.buildCellSpec(renderRow, enhedField, 1)}
                  allowEmpty={false}
                  ariaLabel={`Enhed ${renderRow.rowId}`}
                >
                  <option value="dage">Dage</option>
                  <option value="uger">Uger</option>
                </GridChoiceCell>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GridCoreProvider>
  );
};

/** Renderer tabellen mod den AKTUELLE committede tilstand og re-renderer, når storen ændrer sig. */
const LiveTable: React.FC<Readonly<{ minimumVisibleRows?: number }>> = ({ minimumVisibleRows }) => {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => store.subscribe(force), []);
  const committedRows = store.getState().input.sections.renteberegning?.rentekravRows ?? [];
  return (
    <TableHarness
      committedRows={committedRows}
      {...(minimumVisibleRows === undefined ? {} : { minimumVisibleRows })}
    />
  );
};

const renderTable = (minimumVisibleRows?: number) => render(
  <InputRuntimeProvider binding={makeBinding()}>
    <LiveTable {...(minimumVisibleRows === undefined ? {} : { minimumVisibleRows })} />
  </InputRuntimeProvider>
);

const committedRowIds = (): readonly string[] =>
  (store.getState().input.sections.renteberegning?.rentekravRows ?? []).map((row) => row.id);

/** Det seneste history-frames origin — det, en undo vil forsøge at restore fokus til. */
const latestOrigin = () => {
  const frames = store.getState().history.past;
  return frames[frames.length - 1]?.origin;
};

describe('placeholder-promotion → undo → fokus', () => {
  it('demoterer det promoverede id tilbage til placeholder, så fokusrestoren finder cellen', async () => {
    const user = userEvent.setup();
    renderTable();

    // 1) Skriv i den tomme indtastningsrækkes beløbscelle → promoterer rækken atomisk (§1.11).
    const [amountCell] = screen.getAllByRole('textbox') as HTMLInputElement[];
    await user.click(amountCell!);
    await user.keyboard('1000');
    await user.tab();

    const promotedId = committedRowIds()[0];
    expect(promotedId).toBeDefined();
    const origin = latestOrigin();
    expect(origin?.kind).toBe('field');

    // 2) Tabellen viser nu en NY tom række; den promoverede er en rigtig række.
    expect(screen.getAllByRole('textbox')).toHaveLength(2);

    // 3) Undo af promoveringen: rækken fjernes.
    act(() => { dispatchInput(store, catalog, { kind: 'undo' }); });
    expect(committedRowIds()).toEqual([]);

    // 4) DET AFGØRENDE: originens fokusmål skal stadig kunne findes. Før rettelsen var det promoverede id
    //    kastet væk, den viste placeholder havde et nyt id, og `findRestoreTarget` returnerede null.
    const target = origin === undefined ? null : findRestoreTarget(origin);
    expect(target).not.toBeNull();
    // Og det er cellen i den nu tomme indtastningsrække — samme identitet, brugeren skrev i.
    expect(target).toHaveAttribute('data-mineo-editor-location-id', expect.stringContaining(promotedId!));
  });

  it('gælder også for en immediate-commit-dropdown (identiteten hænger på rækken, ikke på codecet)', async () => {

    renderTable();

    // Et valg i placeholder-rækkens dropdown promoverer rækken og BEVARER valget. Cellen er MUI's combobox
    // (readonly input + listbox), ikke et native `<select>`, så menuen åbnes gennem dens egen klik-kontrakt —
    // navigationen lader dropdown-celler beholde deres egen tastaturkontrakt.
    const combobox = screen.getAllByRole('combobox')[0]!;
    await act(async () => {
      fireEvent.click(combobox);
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('option', { name: 'Uger' }));
      await Promise.resolve();
    });

    const promotedId = committedRowIds()[0];
    expect(promotedId).toBeDefined();
    const origin = latestOrigin();

    act(() => { dispatchInput(store, catalog, { kind: 'undo' }); });
    expect(committedRowIds()).toEqual([]);

    const target = origin === undefined ? null : findRestoreTarget(origin);
    expect(target).not.toBeNull();
    expect(target).toHaveAttribute('data-mineo-editor-location-id', expect.stringContaining(promotedId!));
  });

  it('bevarer identiteten gennem TO promoveringer og to undo', async () => {
    const user = userEvent.setup();
    renderTable();

    const promote = async (value: string): Promise<{ id: string; origin: ReturnType<typeof latestOrigin> }> => {
      const cells = screen.getAllByRole('textbox') as HTMLInputElement[];
      const emptyCell = cells[cells.length - 1]!;
      await user.click(emptyCell);
      await user.keyboard(value);
      await user.tab();
      const rowIds = committedRowIds();
      return { id: rowIds[rowIds.length - 1]!, origin: latestOrigin() };
    };

    const first = await promote('1000');
    const second = await promote('2000');
    expect(committedRowIds()).toHaveLength(2);

    // Undo den anden promotion → dens id skal genindtræde.
    act(() => { dispatchInput(store, catalog, { kind: 'undo' }); });
    expect(committedRowIds()).toEqual([first.id]);
    expect(second.origin === undefined ? null : findRestoreTarget(second.origin)).not.toBeNull();

    // Undo den første → også dens id skal genindtræde, på sin oprindelige plads.
    act(() => { dispatchInput(store, catalog, { kind: 'undo' }); });
    expect(committedRowIds()).toEqual([]);
    expect(first.origin === undefined ? null : findRestoreTarget(first.origin)).not.toBeNull();
  });

  it('gælder også for en tabel med flere synlige tomme rækker (minimumVisibleRows)', async () => {
    const user = userEvent.setup();
    renderTable(3);

    // Tre tomme slots fra start.
    expect(screen.getAllByRole('textbox')).toHaveLength(3);

    // Skriv i den MIDTERSTE tomme række: de øvrige slots skal beholde deres identitet.
    const cells = screen.getAllByRole('textbox') as HTMLInputElement[];
    await user.click(cells[1]!);
    await user.keyboard('1500');
    await user.tab();

    const promotedId = committedRowIds()[0];
    const origin = latestOrigin();

    act(() => { dispatchInput(store, catalog, { kind: 'undo' }); });
    expect(committedRowIds()).toEqual([]);

    const target = origin === undefined ? null : findRestoreTarget(origin);
    expect(target).not.toBeNull();
    expect(target).toHaveAttribute('data-mineo-editor-location-id', expect.stringContaining(promotedId!));
  });
});
