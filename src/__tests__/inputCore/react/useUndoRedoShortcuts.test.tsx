// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useUndoRedoShortcuts,
  type InputRuntimeBinding,
} from '../../../inputCore/react';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, settleField, type InputCatalog } from '../../../inputCore';
import { createTestCatalog, aargangField } from '../testCatalog';
import type { HistoryOrigin } from '../../../inputCore/inputHistory';

// Shell-kontrakten for undo/redo-fokusrestore. Hooken kalder `onRestore` med det gendannede frames origin
// EFTER en gennemført undo/redo – og ALDRIG for en no-op restore. Kører mod den ægte runtime-binding + coordinator
// (samme som produktionen), driver Ctrl+Z på window, og observerer callbacket. MainLayout leverer i produktionen
// et `onRestore`, der navigerer + fokuserer; her verificeres selve kontrakten mod hooken.

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

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

const Harness = ({ onRestore }: { onRestore: (o: HistoryOrigin) => void }) => {
  useUndoRedoShortcuts({ onRestore });
  return null;
};

const origin = (): HistoryOrigin => ({
  kind: 'field' as const,
  field: aargangField.bind().address,
  editorLocationId: 'satser:aargang',
  route: '/satser',
  tabKey: null,
});

const pressUndo = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  });
};

describe('useUndoRedoShortcuts – onRestore-kontrakt (§3.7)', () => {
  it('kalder onRestore med det gendannede frames origin efter en gennemført undo', async () => {
    // To ændringer MED origin, så past-stakken bærer et frame med origin at gendanne.
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1, origin: origin() });
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2021'), { now: 2, origin: origin() });

    const onRestore = vi.fn();
    render(<InputRuntimeProvider binding={makeBinding()}><Harness onRestore={onRestore} /></InputRuntimeProvider>);

    pressUndo();

    await waitFor(() => expect(onRestore).toHaveBeenCalledTimes(1));
    expect(onRestore).toHaveBeenCalledWith(origin());
  });

  it('kalder IKKE onRestore ved en no-op undo (tom history)', async () => {
    const onRestore = vi.fn();
    render(<InputRuntimeProvider binding={makeBinding()}><Harness onRestore={onRestore} /></InputRuntimeProvider>);

    pressUndo();

    // Giv den asynkrone prepare→dispatch en chance for at køre, og hævd så at intet callback faldt.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('kalder IKKE onRestore, når det gendannede frame ingen origin bar', async () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2021'), { now: 2 });

    const onRestore = vi.fn();
    render(<InputRuntimeProvider binding={makeBinding()}><Harness onRestore={onRestore} /></InputRuntimeProvider>);

    pressUndo();

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(onRestore).not.toHaveBeenCalled();
    // Undo skete faktisk (kontrol): current er nu 2020 igen.
    expect(store.getState().revision).toBe(3);
  });
});
