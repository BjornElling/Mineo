// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { dispatchInput } from '../../../inputCore/runtime';
import { settleField, type InputCatalog, type SettledInput } from '../../../inputCore';
import { createValidationReader } from '../../../inputCore/inputReader';
import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import { aargangField, createTestCatalog } from '../testCatalog';

type ReferenceState = Readonly<{
  current: number | undefined;
  past: readonly (number | undefined)[];
  future: readonly (number | undefined)[];
  revision: number;
}>;

const initialReferenceState = (): ReferenceState => ({
  current: undefined,
  past: [],
  future: [],
  revision: 0,
});

const referenceSettle = (
  state: ReferenceState,
  next: number,
): Readonly<{ state: ReferenceState; changed: boolean }> => state.current === next
  ? { state, changed: false }
  : {
      state: {
        current: next,
        past: [...state.past, state.current],
        future: [],
        revision: state.revision + 1,
      },
      changed: true,
    };

const referenceUndo = (
  state: ReferenceState,
): Readonly<{ state: ReferenceState; changed: boolean }> => {
  if (state.past.length === 0) return { state, changed: false };
  return {
    state: {
      current: state.past.at(-1),
      past: state.past.slice(0, -1),
      future: [state.current, ...state.future],
      revision: state.revision + 1,
    },
    changed: true,
  };
};

const referenceRedo = (
  state: ReferenceState,
): Readonly<{ state: ReferenceState; changed: boolean }> => {
  if (state.future.length === 0) return { state, changed: false };
  return {
    state: {
      current: state.future[0],
      past: [...state.past, state.current],
      future: state.future.slice(1),
      revision: state.revision + 1,
    },
    changed: true,
  };
};

let catalog: InputCatalog;
let store: ReturnType<typeof __createSlimInputTestStore>;
const field = aargangField.bind();
const storageKey = getCurrentInputEnvelopeStorageKey();

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
});

afterEach(() => {
  sessionStorage.clear();
});

const readAargang = (input: SettledInput): number | undefined =>
  createValidationReader(input, catalog).readCanonical(field);

const expectMatchesReference = (reference: ReferenceState): void => {
  const actual = store.getState();
  expect(readAargang(actual.input)).toBe(reference.current);
  expect(actual.history.past).toHaveLength(reference.past.length);
  expect(actual.history.future).toHaveLength(reference.future.length);
  expect(actual.revision).toBe(reference.revision);
};

describe('INPUT-001 – canonical settle-no-op efter undo', () => {
  it('bevarer redo-fremtiden, revisionen og sessionen ved gentaget aktuel værdi', () => {
    let reference = initialReferenceState();

    const first = referenceSettle(reference, 2020);
    const firstResult = dispatchInput(store, catalog, settleField(field, '2020'), { now: 1 });
    expect(firstResult.changed).toBe(first.changed);
    reference = first.state;

    const second = referenceSettle(reference, 2021);
    const secondResult = dispatchInput(store, catalog, settleField(field, '2021'), { now: 2 });
    expect(secondResult.changed).toBe(second.changed);
    reference = second.state;

    const expectedUndo = referenceUndo(reference);
    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 });
    expect(undo).toEqual({ changed: expectedUndo.changed, revision: expectedUndo.state.revision });
    reference = expectedUndo.state;
    expectMatchesReference(reference);

    const beforeNoOp = store.getState();
    const storageBeforeNoOp = sessionStorage.getItem(storageKey);
    const expectedNoOp = referenceSettle(reference, 2020);
    const noOp = dispatchInput(store, catalog, settleField(field, '2020'), { now: 4 });

    expect(noOp).toEqual({ changed: expectedNoOp.changed, revision: expectedNoOp.state.revision });
    reference = expectedNoOp.state;
    expect(store.getState()).toBe(beforeNoOp);
    expect(sessionStorage.getItem(storageKey)).toBe(storageBeforeNoOp);
    expectMatchesReference(reference);

    const expectedRedo = referenceRedo(reference);
    const redo = dispatchInput(store, catalog, { kind: 'redo' }, { now: 5 });
    expect(redo).toEqual({ changed: expectedRedo.changed, revision: expectedRedo.state.revision });
    reference = expectedRedo.state;
    expectMatchesReference(reference);
    expect(readAargang(store.getState().input)).toBe(2021);
  });
});
