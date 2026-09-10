// @vitest-environment jsdom
/**
 * Uafhængig kontrol af inputkernens enkleste state-maskine.
 *
 * Reference-modellen bruger kun den kontraktlige betydning af en settle-, undo- og redo-handling:
 * en ny værdi gemmer den forrige, undo flytter den aktuelle værdi til fremtiden, og en ny gren efter
 * undo rydder fremtiden. Den genbruger ikke produktionens reducer, history-helper eller no-op-sammenligning.
 * Dermed kan en fælles fejl i implementering og test-fixture ikke alene få denne kontrol grøn.
 */
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { dispatchInput } from '../../../inputCore/runtime';
import { settleField } from '../../../inputCore';
import type { InputCatalog, SettledInput } from '../../../inputCore';
import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import {
  aargangField,
  createTestCatalog,
} from '../testCatalog';

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

const referenceSettle = (state: ReferenceState, next: number): Readonly<{
  state: ReferenceState;
  changed: boolean;
}> => state.current === next
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

const referenceUndo = (state: ReferenceState): Readonly<{
  state: ReferenceState;
  changed: boolean;
}> => {
  const target = state.past.at(-1);
  if (target === undefined && state.past.length === 0) return { state, changed: false };
  return {
    state: {
      current: target,
      past: state.past.slice(0, -1),
      future: [state.current, ...state.future],
      revision: state.revision + 1,
    },
    changed: true,
  };
};

const referenceRedo = (state: ReferenceState): Readonly<{
  state: ReferenceState;
  changed: boolean;
}> => {
  const target = state.future[0];
  if (target === undefined && state.future.length === 0) return { state, changed: false };
  return {
    state: {
      current: target,
      past: [...state.past, state.current],
      future: state.future.slice(1),
      revision: state.revision + 1,
    },
    changed: true,
  };
};

let catalog: InputCatalog;
let store: ReturnType<typeof __createSlimInputTestStore>;
const storageKey = getCurrentInputEnvelopeStorageKey();

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
});

afterEach(() => {
  sessionStorage.clear();
});

const readAargang = (input: SettledInput): number | undefined => input.sections.satser?.aargang;

const expectMatchesReference = (reference: ReferenceState): void => {
  const actual = store.getState();
  expect(readAargang(actual.input)).toBe(reference.current);
  expect(actual.history.past).toHaveLength(reference.past.length);
  expect(actual.history.future).toHaveLength(reference.future.length);
  expect(actual.revision).toBe(reference.revision);
};

describe('inputkernen – uafhængig referencekontrol (§3.6/§3.7)', () => {
  it('følger referenceforløbet for settle, no-op, undo, redo og ny gren', () => {
    let reference = initialReferenceState();

    const settle = (value: number, now: number): void => {
      const expected = referenceSettle(reference, value);
      const result = dispatchInput(store, catalog, settleField(aargangField.bind(), String(value)), { now });
      expect(result.changed).toBe(expected.changed);
      reference = expected.state;
      expectMatchesReference(reference);
    };

    settle(2020, 1);
    settle(2021, 2);

    const beforeNoOp = store.getState();
    const storageBeforeNoOp = sessionStorage.getItem(storageKey);
    settle(2021, 3);
    expect(store.getState()).toBe(beforeNoOp);
    expect(sessionStorage.getItem(storageKey)).toBe(storageBeforeNoOp);

    const expectedUndo = referenceUndo(reference);
    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 4 });
    expect(undo.changed).toBe(expectedUndo.changed);
    reference = expectedUndo.state;
    expectMatchesReference(reference);

    const expectedSecondUndo = referenceUndo(reference);
    const secondUndo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 5 });
    expect(secondUndo.changed).toBe(expectedSecondUndo.changed);
    reference = expectedSecondUndo.state;
    expectMatchesReference(reference);

    const expectedRedo = referenceRedo(reference);
    const redo = dispatchInput(store, catalog, { kind: 'redo' }, { now: 6 });
    expect(redo.changed).toBe(expectedRedo.changed);
    reference = expectedRedo.state;
    expectMatchesReference(reference);

    settle(2022, 7);
    expect(reference.future).toHaveLength(0);
  });
});
