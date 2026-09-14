// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../inputCore/runtime/slimInputStore';
import { dispatchInput, type SlimInputStore } from '../../inputCore/runtime';
import {
  serializeFieldAddress,
  settleField,
  type InputCatalog,
} from '../../inputCore';
import { createValidationReader } from '../../inputCore/inputReader';
import { aargangField, createTestCatalog } from './testCatalog';

const field = aargangField.bind();
const address = serializeFieldAddress(field.address);

describe('gentaget format-rejected settle – no-op, history og XOR', () => {
  let catalog: InputCatalog;
  let store: SlimInputStore;

  beforeEach(() => {
    sessionStorage.clear();
    catalog = createTestCatalog();
    store = __createSlimInputTestStore();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('opretter ikke et ekstra history-trin og bevarer XOR gennem gentagelse, undo og redo', () => {
    dispatchInput(store, catalog, settleField(field, '2020'), { now: 1 });
    dispatchInput(store, catalog, settleField(field, 'abc'), { now: 2 });

    const afterRejected = store.getState();
    const readRejected = createValidationReader(afterRejected.input, catalog);
    expect(readRejected.readCanonical(field)).toBeUndefined();
    expect(afterRejected.input.rejectedInputs[address]).toEqual({ raw: 'abc', reason: 'format' });
    expect(afterRejected.history.past).toHaveLength(2);

    const repeated = dispatchInput(store, catalog, settleField(field, 'abc'), { now: 3 });

    expect(repeated).toEqual({ changed: false, revision: afterRejected.revision });
    expect(store.getState()).toBe(afterRejected);
    expect(store.getState().history.past).toHaveLength(2);
    expect(store.getState().history.future).toHaveLength(0);
    expect(createValidationReader(store.getState().input, catalog).readCanonical(field)).toBeUndefined();
    expect(store.getState().input.rejectedInputs[address]).toEqual({ raw: 'abc', reason: 'format' });

    const undone = dispatchInput(store, catalog, { kind: 'undo' }, { now: 4 });
    expect(undone.changed).toBe(true);
    expect(createValidationReader(store.getState().input, catalog).readCanonical(field)).toBe(2020);
    expect(store.getState().input.rejectedInputs[address]).toBeUndefined();
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.future).toHaveLength(1);

    const redone = dispatchInput(store, catalog, { kind: 'redo' }, { now: 5 });
    expect(redone.changed).toBe(true);
    expect(createValidationReader(store.getState().input, catalog).readCanonical(field)).toBeUndefined();
    expect(store.getState().input.rejectedInputs[address]).toEqual({ raw: 'abc', reason: 'format' });
    expect(store.getState().history.past).toHaveLength(2);
    expect(store.getState().history.future).toHaveLength(0);
  });
});
