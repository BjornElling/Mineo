// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import {
  dispatchInput,
  parseCurrentEnvelope,
} from '../../../inputCore/runtime';
import { settleField, insertRow, resetSection } from '../../../inputCore';
import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import {
  createTestCatalog,
  aargangField,
  tillaegstidField,
  makeRow,
  rentekravRowsRef,
  testRowOrigin,
} from '../testCatalog';

const key = getCurrentInputEnvelopeStorageKey();

const storedInput = () => parseCurrentEnvelope(sessionStorage.getItem(key) ?? '');

describe('INPUT-001 – sektionsreset som reversibel runtime-command', () => {
  it('ændrer kun målsektionen og gendanner hele inputtilstanden gennem undo og redo', () => {
    sessionStorage.clear();
    const catalog = createTestCatalog();
    const store = __createSlimInputTestStore();

    const setYear = settleField(aargangField.bind(), '2020');
    const addRow = insertRow(rentekravRowsRef(), makeRow('reset-row'));
    const rejectRowField = settleField(tillaegstidField.bind('reset-row'), 'ikke-et-tal');
    const resetRates = resetSection('satser', { aargang: 2024 });

    dispatchInput(store, catalog, setYear, { now: 1 });
    dispatchInput(store, catalog, addRow, { now: 2, origin: testRowOrigin() });
    dispatchInput(store, catalog, rejectRowField, { now: 3 });
    const beforeReset = store.getState();
    const beforeResetInput = beforeReset.input;

    const reset = dispatchInput(store, catalog, resetRates, { now: 4 });
    const afterReset = store.getState();
    expect(reset).toEqual({ changed: true, revision: beforeReset.revision + 1 });
    expect(afterReset.input.sections.satser).toEqual({ aargang: 2024 });
    expect(afterReset.input.sections.renteberegning).toEqual(beforeResetInput.sections.renteberegning);
    expect(afterReset.input.rejectedInputs).toEqual(beforeResetInput.rejectedInputs);
    expect(afterReset.history.past).toHaveLength(beforeReset.history.past.length + 1);
    expect(storedInput()).toEqual(afterReset.input);

    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 5 });
    const afterUndo = store.getState();
    expect(undo).toEqual({ changed: true, revision: afterReset.revision + 1 });
    expect(afterUndo.input).toEqual(beforeResetInput);
    expect(afterUndo.history.past).toHaveLength(beforeReset.history.past.length);
    expect(afterUndo.history.future).toHaveLength(1);
    expect(storedInput()).toEqual(afterUndo.input);

    const redo = dispatchInput(store, catalog, { kind: 'redo' }, { now: 6 });
    const afterRedo = store.getState();
    expect(redo).toEqual({ changed: true, revision: afterUndo.revision + 1 });
    expect(afterRedo.input).toEqual(afterReset.input);
    expect(afterRedo.history.past).toHaveLength(beforeReset.history.past.length + 1);
    expect(afterRedo.history.future).toHaveLength(0);
    expect(storedInput()).toEqual(afterRedo.input);

    sessionStorage.clear();
  });
});
