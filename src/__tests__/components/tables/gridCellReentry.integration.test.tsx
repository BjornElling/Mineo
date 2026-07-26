// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider, type InputRuntimeBinding } from '../../../inputCore/react';
import { GridAmountCell, GridChoiceCell } from '../../../inputCore/react/fields';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import { insertRow } from '../../../inputCore/inputReducer';
import { createEvaluationSourceToken, type FieldRef, type InputCatalog } from '../../../inputCore';
import {
  createTestCatalog,
  belobField,
  enhedField,
  rentekravRowsRef,
  makeRow,
  testRowOrigin,
} from '../../inputCore/testCatalog';
import { useGridCoreController } from '../../../components/tables/useGridCoreController';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import {
  handleTableClickCapture,
  handleTableFocusCapture,
  handleTableKeyDownCapture,
  handleTablePointerDownCapture,
} from '../../../components/tables/gridCore/tableKeyboardNavigation';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import type { TillaegstidEnhed } from '../../../schemas/formSchemas/enumSchemas';

// Genetablerer de INTEGRATIONS-invarianter, de fire slettede tabelsuiter dækkede på den gamle celle-vej.
// Adfærden lever nu i `useGridCoreController` + de nye Grid-celler, og var kun dækket af to nav-tests.
//
// Det centrale er BROEN mellem de to redigerings-autoriteter (`useGridCellSurface`):
//   1. grid-core ejer navigation og edit-ÅBNING (to-trins-klik, printbar tast, Enter/Escape i capture-fasen),
//   2. `useCellEditor` ejer draft/commit.
// Et hul i broen ser ud som "cellen kan ikke redigeres igen efter blur" — netop den to-trins-genindtræden, som
// ikke var erstattet efter sletningen.

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  // Navigationens celleopslag (`buildGrid`) filtrerer på `isTableElementVisible`, og jsdom giver alle
  // elementer nul dimensioner. Uden dette ville gridet se tomt ud, og klik-/tast-vejene aldrig nå en celle.
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

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const AMOUNT_CELL: GridCellCoord = { rowId: 'r1', colIndex: 0 };
const CHOICE_CELL: GridCellCoord = { rowId: 'r1', colIndex: 1 };

/** En minimal, men ÆGTE grid: rigtig controller, rigtig capture-keydown, rigtige greenfield-celler. */
let gridController: ReturnType<typeof useGridCoreController>['controller'] | null = null;

const GridHarness: React.FC = () => {
  const { internalTableRef, contextValue, controller } = useGridCoreController();
  gridController = controller;
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
          <tr data-mineo-row-id="r1">
            <td>
              <GridAmountCell
                gridCell={AMOUNT_CELL}
                cell={{ kind: 'existing', field: belobField.bind('r1'), location: { locationId: 'r1:belob' } }}
              />
            </td>
            <td>
              <GridChoiceCell<TillaegstidEnhed, unknown, TillaegstidEnhed>
                gridCell={CHOICE_CELL}
                cell={{ kind: 'existing', field: enhedField.bind('r1'), location: { locationId: 'r1:enhed' } }}
                allowEmpty={false}
                ariaLabel="Enhed"
              >
                <option value="dage">Dage</option>
                <option value="uger">Uger</option>
              </GridChoiceCell>
            </td>
          </tr>
        </tbody>
      </table>
    </GridCoreProvider>
  );
};

const renderGrid = () => {
  dispatchInput(
    store,
    catalog,
    insertRow(rentekravRowsRef(), makeRow('r1', { belob: undefined, enhed: 'dage' })),
    { origin: testRowOrigin() }
  );
  return render(
    <InputRuntimeProvider binding={makeBinding()}>
      <GridHarness />
    </InputRuntimeProvider>
  );
};

const amountInput = () => screen.getByRole('textbox') as HTMLInputElement;

/**
 * Driver cellen gennem den registrerede `GridCellEditorHandle` — PRÆCIS de kald,
 * `tableKeyboardNavigation` foretager i capture-fasen (`tableKeyboardNavigation.ts:331-351`).
 *
 * Bevidst valg: vi går ikke gennem rå `keyDown` på tabellen her, fordi navigationens celleopslag filtrerer på
 * `isTableElementVisible`, og jsdom giver alle elementer nul dimensioner. En keydown-baseret test ville derfor
 * måle jsdom-layout, ikke broen. De rene navigationsgrene er i forvejen dækket af
 * `tableKeyboardNavigation.arrowWrap`/`.lockedSkip`; det, der manglede dækning, er netop BROEN herunder.
 */
const editorHandle = (cell: GridCellCoord) => {
  const handle = gridController?.getEditor(cell);
  if (!handle) throw new Error(`Ingen registreret editor for celle ${JSON.stringify(cell)}`);
  return handle;
};

/** Tast-initieret åbning, som grid-core gør det: `prepareEditFromKey` + `openEditing(cell, 'key')`. */
const openByKey = async (cell: GridCellCoord, key: string): Promise<boolean> => {
  let accepted = false;
  await act(async () => {
    accepted = editorHandle(cell).prepareEditFromKey(key);
    if (accepted) gridController?.openEditing(cell, 'key');
    await Promise.resolve();
  });
  return accepted;
};

describe('grid-celle: to-trins-genindtræden efter commit', () => {
  it('kan redigeres, committes, og redigeres IGEN — cellen bliver ikke "død"', async () => {
    // Regressionsværnet for broen: efter commit lukker grid-core editingen og editoren lukker sin draft.
    // Er de to lifecycles ude af trit, forbliver cellen readOnly, og en ny tast åbner den ikke igen.
    renderGrid();

    expect(await openByKey(AMOUNT_CELL, '1')).toBe(true);
    expect(amountInput().readOnly).toBe(false);

    fireEvent.change(amountInput(), { target: { value: '1000' } });
    await act(async () => {
      editorHandle(AMOUNT_CELL).commitCurrent();
      await Promise.resolve();
    });

    expect(canonical(belobField.bind('r1'))).toMatchObject({ value: 1000 });
    expect(amountInput().readOnly).toBe(true);

    // ANDEN redigering af SAMME celle — det, der gik tabt med de slettede suiter.
    expect(await openByKey(AMOUNT_CELL, '2')).toBe(true);
    expect(amountInput().readOnly).toBe(false);

    fireEvent.change(amountInput(), { target: { value: '2500' } });
    await act(async () => {
      editorHandle(AMOUNT_CELL).commitCurrent();
      await Promise.resolve();
    });

    expect(canonical(belobField.bind('r1'))).toMatchObject({ value: 2500 });
    expect(amountInput().readOnly).toBe(true);
  });

  it('Escape lukker editoren UDEN commit og efterlader cellen redigerbar igen', async () => {
    renderGrid();

    await openByKey(AMOUNT_CELL, '9');
    fireEvent.change(amountInput(), { target: { value: '9999' } });

    await act(async () => {
      editorHandle(AMOUNT_CELL).cancelEdit();
      await Promise.resolve();
    });

    expect(canonical(belobField.bind('r1'))).toBeUndefined();
    expect(amountInput().readOnly).toBe(true);

    // …og cellen kan åbnes igen bagefter (to-trins-genindtræden efter Escape).
    expect(await openByKey(AMOUNT_CELL, '5')).toBe(true);
    expect(amountInput().readOnly).toBe(false);
  });

  it('Delete på en lukket celle rydder og committer straks (§1.3)', async () => {
    renderGrid();

    await openByKey(AMOUNT_CELL, '7');
    fireEvent.change(amountInput(), { target: { value: '750' } });
    await act(async () => {
      editorHandle(AMOUNT_CELL).commitCurrent();
      await Promise.resolve();
    });
    expect(canonical(belobField.bind('r1'))).toMatchObject({ value: 750 });

    await act(async () => {
      editorHandle(AMOUNT_CELL).clearAndCommit();
      await Promise.resolve();
    });

    expect(canonical(belobField.bind('r1'))).toBeUndefined();
  });

  it('en uparsebar indtastning rydder cellen, og cellen kan bruges igen bagefter', async () => {
    // Beløbskernen behandler tekst, der ikke er et beløb, som "ryd feltet" (samme regel som de øvrige
    // beløbsflader). Det væsentlige for broen er, at cellen IKKE låses af en mislykket indtastning: den kan
    // åbnes og udfyldes igen umiddelbart efter.
    renderGrid();

    await openByKey(AMOUNT_CELL, 'a');
    fireEvent.change(amountInput(), { target: { value: 'ikke-et-tal' } });
    await act(async () => {
      editorHandle(AMOUNT_CELL).commitCurrent();
      await Promise.resolve();
    });

    expect(canonical(belobField.bind('r1'))).toBeUndefined();
    expect(amountInput().readOnly).toBe(true);

    // Genindtræden virker umiddelbart efter.
    expect(await openByKey(AMOUNT_CELL, '3')).toBe(true);
    fireEvent.change(amountInput(), { target: { value: '300' } });
    await act(async () => {
      editorHandle(AMOUNT_CELL).commitCurrent();
      await Promise.resolve();
    });

    expect(canonical(belobField.bind('r1'))).toMatchObject({ value: 300 });
  });
});

describe('grid-celle: den faktiske to-trins-KLIK-vej', () => {
  it('klik 1 fokuserer uden at åbne editoren; klik 2 på den fokuserede celle åbner den', async () => {
    // Dette er den brugervendte to-trins-mekanik gennem de RIGTIGE capture-handlere
    // (`handleTablePointerDownCapture` + `handleTableClickCapture`), ikke gennem editor-handlet.
    renderGrid();
    const input = amountInput();

    // Klik 1: cellen var ikke fokuseret → fokuseres, men editoren åbner IKKE.
    await act(async () => {
      fireEvent.focus(input);
      fireEvent.pointerDown(input);
      fireEvent.click(input);
      await Promise.resolve();
    });
    expect(amountInput().readOnly).toBe(true);

    // Klik 2 på den nu fokuserede celle: editoren åbner.
    await act(async () => {
      fireEvent.pointerDown(amountInput());
      fireEvent.click(amountInput());
      await Promise.resolve();
    });
    expect(amountInput().readOnly).toBe(false);

    // …og et commit derfra virker.
    fireEvent.change(amountInput(), { target: { value: '1250' } });
    await act(async () => {
      editorHandle(AMOUNT_CELL).commitCurrent();
      await Promise.resolve();
    });
    expect(canonical(belobField.bind('r1'))).toMatchObject({ value: 1250 });
  });

  it('en printbar tast på en fokuseret celle åbner editoren gennem NAVIGATIONEN', async () => {
    // Samme vej som produktionen: keydown i capture-fasen → prepareEditFromKey → openEditing.
    renderGrid();
    const input = amountInput();

    await act(async () => {
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: '4' });
      await Promise.resolve();
    });

    expect(amountInput().readOnly).toBe(false);
  });
});

describe('grid dropdown-celle', () => {
  it('er registreret som editor i grid-core, så navigationen kan nå den', () => {
    // Dropdown-cellen skal deltage i den samme celleregistrering som tekstcellerne; ellers springer
    // pil-/Tab-navigationen over den.
    renderGrid();
    expect(gridController?.getEditor(CHOICE_CELL)).not.toBeNull();
    expect(editorHandle(CHOICE_CELL).getIsLocked()).toBe(false);
  });

  it('åbner menuen ved klik og committer valget gennem den ene write-grænse', async () => {
    renderGrid();
    expect(canonical(enhedField.bind('r1'))).toBe('dage');

    const combobox = document.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(combobox).not.toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();

    // Åbn menuen via combobox'ens egen klik-kontrakt (`StyledDropdown.tsx:580` — onClick={handleOpen}).
    // Navigationen lader dropdown-celler beholde deres egen tastaturkontrakt
    // (`tableKeyboardNavigation.ts:311-329`), så cellen åbnes ikke gennem grid-core's edit-lifecycle.
    await act(async () => {
      fireEvent.click(combobox);
      await Promise.resolve();
    });
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // Dropdown-cellen committer IMMEDIATE (ingen draft-fase, §1.3) gennem `commitImmediate`.
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'Uger' }));
      await Promise.resolve();
    });

    expect(canonical(enhedField.bind('r1'))).toBe('uger');
  });

  it('commitCurrent er en no-op-success, fordi et valg allerede er committet', async () => {
    // Grid-core kalder `commitCurrent` ved navigation væk fra cellen. En dropdown har aldrig en åben draft,
    // så kaldet skal lykkes uden at ændre noget — ellers ville navigation kunne overskrive et valg.
    renderGrid();

    await act(async () => {
      expect(editorHandle(CHOICE_CELL).commitCurrent()).toBe(true);
      await Promise.resolve();
    });

    expect(canonical(enhedField.bind('r1'))).toBe('dage');
  });

  it('bærer restore-target-attributterne, så undo/redo kan finde cellen igen', () => {
    renderGrid();
    const combobox = document.querySelector('input[role="combobox"]');
    expect(combobox?.getAttribute('data-mineo-editor-location-id')).toBe('r1:enhed');
    expect(combobox?.getAttribute('data-mineo-field-address')).not.toBeNull();
  });
});
