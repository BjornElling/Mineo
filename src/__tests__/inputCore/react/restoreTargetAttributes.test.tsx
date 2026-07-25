// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  __createSlimInputTestStore,
  dispatchInput,
  ActiveEditorRegistry,
  type SlimInputStore,
} from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from '../../../inputCore/react';
import {
  IntegerField,
  ChoiceField,
  RadioField,
  GridAmountCell,
  GridChoiceCell,
} from '../../../inputCore/react/fields';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createCollectionRef,
  serializeFieldAddress,
  type InputCatalog,
} from '../../../inputCore';
import { insertRow } from '../../../inputCore/inputReducer';
import { createTestCatalog, aargangField, enhedField, belobField, makeRow } from '../testCatalog';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import StyledCheckbox from '../../../components/inputs/StyledCheckbox';
import { buildRestoreTargetAttributes } from '../../../inputCore/react/historyRestoreTarget';
import type { TillaegstidEnhed } from '../../../schemas/formSchemas/enumSchemas';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';

// WI-003: hver greenfield-kommitterende feltfamilie skal bære undo/redo-restore-target-attributterne
// (`data-mineo-field-address` + `data-mineo-editor-location-id`) på sit FOKUSERBARE element, så restoren
// lokaliserer PRÆCIST den editorlokation, ændringen kom fra (ikke via `name`). Her verificeres selve rendering:
// attributterne når frem til DOM'en for form-felt, gridcelle, dropdown, radio, toggle og checkbox.

const FIELD_ADDR_ATTR = 'data-mineo-field-address';
const EDITOR_LOC_ATTR = 'data-mineo-editor-location-id';

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
});
afterEach(() => sessionStorage.clear());

const rentekravRef = () => createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
      settings: {},
    });
  });

const renderField = (node: React.ReactNode) =>
  render(<InputRuntimeProvider binding={makeBinding()}>{node}</InputRuntimeProvider>);

// Find det ene element, der bærer BEGGE restore-attributter, og hævd deres værdier.
const expectRestoreAttrs = (element: Element, serializedAddress: string, locationId: string): void => {
  expect(element.getAttribute(FIELD_ADDR_ATTR)).toBe(serializedAddress);
  expect(element.getAttribute(EDITOR_LOC_ATTR)).toBe(locationId);
};

describe('Greenfield restore-target-attributter på det fokuserbare element (§3.7)', () => {
  it('form-tekstfelt (IntegerField)', () => {
    renderField(<IntegerField field={aargangField.bind()} location={{ locationId: 'loc-int' }} name="aargang" />);
    expectRestoreAttrs(screen.getByRole('textbox'), serializeFieldAddress(aargangField.bind().address), 'loc-int');
  });

  it('form-dropdown (ChoiceField)', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { enhed: 'dage' })));
    renderField(
      <ChoiceField
        field={enhedField.bind('r1')}
        location={{ locationId: 'loc-choice' }}
        allowEmpty={false}
        name="enhed"
      >
        <option value="dage">Dage</option>
        <option value="uger">Uger</option>
      </ChoiceField>
    );
    const combobox = document.querySelector('input[role="combobox"]');
    expect(combobox).not.toBeNull();
    expectRestoreAttrs(combobox!, serializeFieldAddress(enhedField.bind('r1').address), 'loc-choice');
  });

  it('radio (RadioField) — den valgte radio bærer attributterne', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { enhed: 'uger' })));
    renderField(
      <RadioField<TillaegstidEnhed>
        field={enhedField.bind('r1')}
        location={{ locationId: 'loc-radio' }}
        options={[{ value: 'dage', label: 'Dage' }, { value: 'uger', label: 'Uger' }]}
        name="enhed"
      />
    );
    const selected = screen.getByRole('radio', { name: 'Uger' });
    expectRestoreAttrs(selected, serializeFieldAddress(enhedField.bind('r1').address), 'loc-radio');
  });

  it('grid tekstcelle (GridAmountCell)', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')));
    const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 0 };
    const gridStateStore: GridCoreStateStore = {
      subscribe: () => () => undefined,
      getFocusedCell: () => gridCell,
      getEditingCell: () => gridCell,
    };
    render(
      <InputRuntimeProvider binding={makeBinding()}>
        <GridCoreProvider value={{
          gridStateStore,
          openEditing: () => undefined,
          closeEditing: () => undefined,
          registerEditor: () => undefined,
          unregisterEditor: () => undefined,
          getEditor: () => null,
          requestFocusPlan: () => undefined,
        }}>
          <GridAmountCell
            gridCell={gridCell}
            cell={{ kind: 'existing', field: belobField.bind('r1'), location: { locationId: 'loc-gridcell' } }}
          />
        </GridCoreProvider>
      </InputRuntimeProvider>
    );
    expectRestoreAttrs(screen.getByRole('textbox'), serializeFieldAddress(belobField.bind('r1').address), 'loc-gridcell');
  });

  it('grid dropdown-celle (GridChoiceCell)', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { enhed: 'dage' })));
    const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 1 };
    const gridStateStore: GridCoreStateStore = {
      subscribe: () => () => undefined,
      getFocusedCell: () => gridCell,
      getEditingCell: () => gridCell,
    };
    render(
      <InputRuntimeProvider binding={makeBinding()}>
        <GridCoreProvider value={{
          gridStateStore,
          openEditing: () => undefined,
          closeEditing: () => undefined,
          registerEditor: () => undefined,
          unregisterEditor: () => undefined,
          getEditor: () => null,
          requestFocusPlan: () => undefined,
        }}>
          <GridChoiceCell<TillaegstidEnhed, unknown, TillaegstidEnhed>
            gridCell={gridCell}
            cell={{ kind: 'existing', field: enhedField.bind('r1'), location: { locationId: 'loc-gridchoice' } }}
            allowEmpty={false}
            ariaLabel="Enhed"
          >
            <option value="dage">Dage</option>
            <option value="uger">Uger</option>
          </GridChoiceCell>
        </GridCoreProvider>
      </InputRuntimeProvider>
    );
    const combobox = document.querySelector('input[role="combobox"]');
    expect(combobox).not.toBeNull();
    expectRestoreAttrs(combobox!, serializeFieldAddress(enhedField.bind('r1').address), 'loc-gridchoice');
  });

  // Toggle + checkbox: verificér på komponentniveau, at prop'en spredes på det fokuserbare input-slot. (De
  // greenfield-wrappere, der leverer prop'en, dækkes strukturelt af arkitektur-guarden.)
  it('toggle (StyledToggleSwitch) spreder restoreTargetAttributes på input-slottet', () => {
    const attrs = buildRestoreTargetAttributes('serialized-addr', 'loc-toggle');
    render(<StyledToggleSwitch checked={false} onCommit={() => true} ariaLabel="tog" restoreTargetAttributes={attrs} />);
    expectRestoreAttrs(screen.getByRole('checkbox'), 'serialized-addr', 'loc-toggle');
  });

  it('checkbox (StyledCheckbox) spreder restoreTargetAttributes på input-slottet', () => {
    const attrs = buildRestoreTargetAttributes('serialized-addr', 'loc-checkbox');
    render(<StyledCheckbox checked={false} onCommit={() => true} label="cb" restoreTargetAttributes={attrs} />);
    expectRestoreAttrs(screen.getByRole('checkbox'), 'serialized-addr', 'loc-checkbox');
  });
});
