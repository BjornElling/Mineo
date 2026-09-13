// @vitest-environment jsdom
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import {
  __createSlimInputTestStore,
} from '../../../inputCore/runtime/slimInputStore';
import { dispatchInput, type SlimInputStore } from '../../../inputCore/runtime';
import {
  createEmptySettledInput,
  clearField,
  replaceCase,
  serializeFieldAddress,
  type HistoryOrigin,
  type InputCatalog,
  type SettledInput,
} from '../../../inputCore';
import { createValidationReader } from '../../../inputCore/inputReader';
import {
  belobField,
  createTestCatalog,
  makeRow,
  tillaegstidField,
} from '../testCatalog';

type ReferenceSnapshot = Readonly<{
  tillaegstid: number | undefined;
  rejectedRaw: string | undefined;
  belob: AmountValue | undefined;
}>;

type ReferenceFrame = Readonly<{ snapshot: ReferenceSnapshot }>;

type ReferenceState = Readonly<{
  current: ReferenceSnapshot;
  past: readonly ReferenceFrame[];
  future: readonly ReferenceFrame[];
  revision: number;
}>;

const TARGET_ROW_ID = 'r1';
const REJECTED_RAW = 'ikke-et-tal';
const NEIGHBOR_AMOUNT: AmountValue = { kind: 'number', value: 125 };

const emptyInput = createEmptySettledInput();
const targetField = tillaegstidField.bind(TARGET_ROW_ID);
const neighborField = belobField.bind(TARGET_ROW_ID);
const targetAddress = serializeFieldAddress(targetField.address);

const clearOrigin: HistoryOrigin = Object.freeze({
  kind: 'field',
  field: targetField.address,
  editorLocationId: 'test:immediate-clear',
  route: '/renteberegning',
  tabKey: null,
});

const baselineInput: SettledInput = {
  sections: {
    ...emptyInput.sections,
    renteberegning: {
      beregningsdato: undefined,
      kommentarer: undefined,
      rentekravRows: [makeRow(TARGET_ROW_ID, { belob: NEIGHBOR_AMOUNT })],
    },
  },
  rejectedInputs: {
    [targetAddress]: { raw: REJECTED_RAW, reason: 'format' },
  },
};

const referenceStart = (revision: number): ReferenceState => ({
  current: {
    tillaegstid: undefined,
    rejectedRaw: REJECTED_RAW,
    belob: NEIGHBOR_AMOUNT,
  },
  past: [],
  future: [],
  revision,
});

const referenceClear = (state: ReferenceState): ReferenceState => ({
  current: { ...state.current, rejectedRaw: undefined },
  past: [...state.past, { snapshot: state.current }],
  future: [],
  revision: state.revision + 1,
});

const referenceUndo = (state: ReferenceState): ReferenceState => {
  const target = state.past.at(-1);
  if (target === undefined) throw new Error('Referencekontrollen manglede et undo-frame');
  return {
    current: target.snapshot,
    past: state.past.slice(0, -1),
    future: [{ snapshot: state.current }, ...state.future],
    revision: state.revision + 1,
  };
};

const referenceRedo = (state: ReferenceState): ReferenceState => {
  const target = state.future[0];
  if (target === undefined) throw new Error('Referencekontrollen manglede et redo-frame');
  return {
    current: target.snapshot,
    past: [...state.past, { snapshot: state.current }],
    future: state.future.slice(1),
    revision: state.revision + 1,
  };
};

const actualSnapshot = (store: SlimInputStore, catalog: InputCatalog): ReferenceSnapshot => ({
  tillaegstid: createValidationReader(store.getState().input, catalog).readCanonical(targetField),
  rejectedRaw: store.getState().input.rejectedInputs[targetAddress]?.raw,
  belob: createValidationReader(store.getState().input, catalog).readCanonical(neighborField),
});

const expectMatchesReference = (
  store: SlimInputStore,
  catalog: InputCatalog,
  reference: ReferenceState,
): void => {
  expect(actualSnapshot(store, catalog)).toEqual(reference.current);
  expect(store.getState().revision).toBe(reference.revision);
  expect(store.getState().history.past).toHaveLength(reference.past.length);
  expect(store.getState().history.future).toHaveLength(reference.future.length);
};

describe('runtime immediate clear – uafhængig history-reference (§1.3/§3.6/§7.2)', () => {
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

  it('rydder rejected input som ét trin og gendanner det ordret gennem undo og redo', () => {
    // Autoritativ setup gør runtime-revisionen og history tomme før brugerforløbet begynder.
    dispatchInput(store, catalog, replaceCase(baselineInput), { now: 1 });
    let reference = referenceStart(store.getState().revision);
    expectMatchesReference(store, catalog, reference);

    const beforeClear = store.getState();
    const clear = dispatchInput(store, catalog, clearField(targetField), { now: 2, origin: clearOrigin });
    reference = referenceClear(reference);

    expect(clear).toEqual({ changed: true, revision: reference.revision });
    expect(store.getState().history.past.at(-1)?.origin).toEqual(clearOrigin);
    expect(store.getState().input.sections.renteberegning?.rentekravRows).toEqual(
      beforeClear.input.sections.renteberegning?.rentekravRows,
    );
    expectMatchesReference(store, catalog, reference);

    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 });
    reference = referenceUndo(reference);

    expect(undo).toEqual({
      changed: true,
      revision: reference.revision,
      restoredOrigin: clearOrigin,
    });
    expectMatchesReference(store, catalog, reference);

    const redo = dispatchInput(store, catalog, { kind: 'redo' }, { now: 4 });
    reference = referenceRedo(reference);

    expect(redo).toEqual({
      changed: true,
      revision: reference.revision,
      restoredOrigin: clearOrigin,
    });
    expectMatchesReference(store, catalog, reference);
  });
});
