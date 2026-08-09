// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider, type InputRuntimeBinding } from '../../../inputCore/react';
import { ChoiceField, GridChoiceCell, GridAmountCell } from '../../../inputCore/react/fields';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import { insertRow } from '../../../inputCore/inputReducer';
import { createEvaluationSourceToken, type FieldRef, type InputCatalog } from '../../../inputCore';
import {
  createTestCatalog,
  belobField,
  enhedField,
  rentekravRowsRef,
  makeRow,
  testRowOrigin, testLocation } from '../../inputCore/testCatalog';
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

// En dropdown i en tabel skal åbne sin menu på Enter — ikke flytte cellefokus én række ned.
//
// Det kontraktkryds, ingen test dækkede, er "LUKKET popup-kontrol + tabellens capture-handler + Enter".
// Grid'et fritog tidligere kun dropdowns, der bar en PRIVAT markør-attribut fra en slettet komponent
// (`data-mineo-table-dropdown`); ingen produktionskontrol satte den, så alle celle-dropdowns fik Enter
// kapret af grid-navigationen. Klassifikationen ligger nu i `popupWidgetSemantics` og måler kontrollens
// ARIA-semantik, som BEGGE flader (Container og grid) deler.
//
// Testen kører derfor samme popup-kontrakt mod BEGGE surfaces — form-varianten (`ChoiceField`) og
// celle-varianten (`GridChoiceCell`) — så semantikken ikke igen kan divergere mellem dem.

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  // Navigationens celleopslag (`buildGrid`) filtrerer på `isTableElementVisible`, og jsdom giver alle
  // elementer nul dimensioner. Uden dette ville gridet se tomt ud, og Enter aldrig nå en nav-gren.
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

const ROW_IDS = ['r1', 'r2'] as const;
const choiceCell = (rowId: string): GridCellCoord => ({ rowId, colIndex: 1 });

let gridController: ReturnType<typeof useGridCoreController>['controller'] | null = null;

/** To rækker: den anden findes, så en kapret Enter KAN flytte fokus og altså er observerbar. */
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
          {ROW_IDS.map((rowId) => (
            <tr key={rowId} data-mineo-row-id={rowId}>
              <td>
                <GridAmountCell
                  gridCell={{ rowId, colIndex: 0 }}
                  cell={{ kind: 'existing', field: belobField.bind(rowId), location: testLocation(`${rowId}:belob`) }}
                />
              </td>
              <td>
                <GridChoiceCell<TillaegstidEnhed, unknown, TillaegstidEnhed>
                  gridCell={choiceCell(rowId)}
                  cell={{ kind: 'existing', field: enhedField.bind(rowId), location: testLocation(`${rowId}:enhed`) }}
                  allowEmpty={false}
                  ariaLabel={`Enhed ${rowId}`}
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

const renderGrid = () => {
  for (const rowId of ROW_IDS) {
    dispatchInput(
      store,
      catalog,
      insertRow(rentekravRowsRef(), makeRow(rowId, { belob: undefined, enhed: 'dage' })),
      { origin: testRowOrigin() }
    );
  }
  return render(
    <InputRuntimeProvider binding={makeBinding()}>
      <GridHarness />
    </InputRuntimeProvider>
  );
};

/**
 * Comboboxen i rækken `rowId` — dropdownens fokuserbare trigger.
 *
 * Slås op på `aria-label` med en DOM-query frem for `getByRole`: når menuen er åben, sætter MUI's Popover
 * `aria-hidden` på resten af siden, så triggeren ikke længere er tilgængelig VIA ROLLE. Elementet er det
 * samme (React remounter det ikke), og det er netop dens fokus-tilstand under åben menu, vi måler.
 */
const comboboxFor = (rowId: string): HTMLInputElement => {
  const el = document.querySelector(`input[role="combobox"][aria-label="Enhed ${rowId}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`Ingen combobox for række ${rowId}`);
  return el;
};

/**
 * Sender en keydown og returnerer, om GRID'ET forbrugte tasten (`preventDefault`). Det er det direkte
 * observerbare udfald af klassifikationen: forbruger grid'et tasten, nåede kontrollen den aldrig.
 */
const pressKey = async (element: HTMLElement, key: string, init: Partial<KeyboardEventInit> = {}): Promise<boolean> => {
  let consumedByGrid = false;
  await act(async () => {
    consumedByGrid = !fireEvent.keyDown(element, { key, ...init });
    await Promise.resolve();
  });
  return consumedByGrid;
};

const focusElement = async (element: HTMLElement) => {
  await act(async () => {
    element.focus();
    fireEvent.focus(element);
    await Promise.resolve();
  });
};

describe('popup-kontrakt: LUKKET dropdown ejer selv sin aktiveringstast', () => {
  it('Enter på en tabel-dropdown ÅBNER menuen og flytter ikke cellefokus', async () => {
    renderGrid();
    const combobox = comboboxFor('r1');
    await focusElement(combobox);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(combobox.getAttribute('aria-expanded')).toBe('false');

    await pressKey(combobox, 'Enter');

    // Menuen er åben…
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(comboboxFor('r1').getAttribute('aria-expanded')).toBe('true');
    // …og fokus blev IKKE flyttet til rækken nedenfor (den kaprede grid-navigation).
    expect(document.activeElement).toBe(comboboxFor('r1'));
  });

  it('Shift+Enter opfører sig ens: menuen åbner, fokus bliver i cellen', async () => {
    renderGrid();
    const combobox = comboboxFor('r2');
    await focusElement(combobox);

    await pressKey(combobox, 'Enter', { shiftKey: true });

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(document.activeElement).toBe(comboboxFor('r2'));
  });

  it('en ÅBEN dropdown vælger på Enter uden at grid-navigationen blander sig', async () => {
    renderGrid();
    const combobox = comboboxFor('r1');
    await focusElement(combobox);
    expect(canonical(enhedField.bind('r1'))).toBe('dage');

    await pressKey(combobox, 'Enter');
    await screen.findByRole('listbox');

    // Fremhæv næste option og vælg den — dropdownens egen åbne-kontrakt.
    await pressKey(comboboxFor('r1'), 'ArrowDown');
    await pressKey(comboboxFor('r1'), 'Enter');

    expect(canonical(enhedField.bind('r1'))).toBe('uger');
    expect(screen.queryByRole('listbox')).toBeNull();
    // Fokus er tilbage/blevet på kontrollen, ikke flyttet en række ned af grid'et.
    expect(document.activeElement).toBe(comboboxFor('r1'));
  });

  it('en printbar tast NÅR kontrollens typeahead og vælger, uden en celle-editor', async () => {
    // Popup-grenen returnerer FØR grid'ets printbare gren, så tasten når dropdownens egen typeahead.
    // Målt på UDFALDET ('u' → "Uger" committes) frem for kun på at ingen editor åbnede.
    //
    // ÆRLIG AFGRÆNSNING: dette ben skelner IKKE den nye klassifikation fra den gamle. Dropdownens
    // `prepareEditFromKey` returnerer også false, så grid'ets printbare gren ville alligevel frigive
    // tasten uden `preventDefault`. Popup-grenen er dermed defense-in-depth her — testen pinner
    // invarianten (typeahead virker i en celle), ikke rettelsens mekanisme.
    renderGrid();
    const combobox = comboboxFor('r1');
    await focusElement(combobox);
    expect(canonical(enhedField.bind('r1'))).toBe('dage');

    await pressKey(combobox, 'u');

    expect(canonical(enhedField.bind('r1'))).toBe('uger');
    expect(gridController?.getEditingCell()).toBeNull();
    expect(combobox.readOnly).toBe(true);
  });

  it('pointer-vejen fører ingen to-trins-redigeringsbogføring for dropdownen', async () => {
    // Samme klassifikation som Enter-grenen: en dropdown må ikke behandles
    // forskelligt afhængigt af eventtype. Et klik åbner menuen; grid'et åbner ingen celle-editor.
    renderGrid();
    const combobox = comboboxFor('r1');

    await act(async () => {
      fireEvent.focus(combobox);
      fireEvent.pointerDown(combobox);
      fireEvent.click(combobox);
      await Promise.resolve();
    });

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(gridController?.getEditingCell()).toBeNull();
  });

  it('Delete forbliver grid-ejet og følger allowEmpty-reglen uden at åbne menuen', async () => {
    // Delete er bevidst IKKE frigivet til kontrollen: grid-kontrakten (`gridUxSpec.dropdownContract`)
    // giver grid'et ryd-tasten, mens `allowEmpty` afgør, om der ryddes. Her er valget påkrævet
    // (`allowEmpty={false}`), så `clearAndCommit` er en no-op — men grid'et forbruger tasten,
    // og menuen må ikke åbne. Dette ben er derfor uændret af popup-klassifikationen; det pinner
    // afgrænsningen af, hvad frigivelsen omfatter.
    renderGrid();
    const combobox = comboboxFor('r1');
    await focusElement(combobox);

    expect(await pressKey(combobox, 'Delete')).toBe(true);
    expect(canonical(enhedField.bind('r1'))).toBe('dage');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('samme kontrakt gælder form-varianten, så surfaces ikke divergerer', async () => {
    // `ChoiceField` (form) og `GridChoiceCell` (celle) renderer den SAMME `StyledDropdown`. Uden en
    // fælles klassifikation var det netop celle-varianten, der mistede Enter.
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1', { enhed: 'dage' })), {
      origin: testRowOrigin(),
    });
    render(
      <InputRuntimeProvider binding={makeBinding()}>
        <ChoiceField
          field={enhedField.bind('r1')}
          location={testLocation('form:enhed')}
          name="enhed"
          allowEmpty={false}
        >
          <option value="dage">Dage</option>
          <option value="uger">Uger</option>
        </ChoiceField>
      </InputRuntimeProvider>
    );

    const combobox = screen.getByRole('combobox') as HTMLInputElement;
    await focusElement(combobox);
    await pressKey(combobox, 'Enter');

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });
});
