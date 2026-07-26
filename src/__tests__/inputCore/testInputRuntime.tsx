// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider, type InputRuntimeBinding } from '../../inputCore/react';
import { createInputEvaluation } from '../../inputCore/inputReader';
import { createEvaluationSourceToken, settleField, type InputCatalog, type FieldRef } from '../../inputCore';
import { createTestCatalog } from './testCatalog';

// Delt test-harness for greenfield-feltmontering. Samler den binding-opsætning, som ellers blev kopieret ind i
// hver testfil (store + katalog + registry + evaluering + provider). Ét sted, så en ændring i bindingens
// konstruktion ikke skal efterrettes i n testfiler.

export type TestInputRuntime = Readonly<{
  store: SlimInputStore;
  catalog: InputCatalog;
  registry: ActiveEditorRegistry;
  binding: InputRuntimeBinding;
}>;

export const createTestInputRuntime = (): TestInputRuntime => {
  const catalog = createTestCatalog();
  const store = __createSlimInputTestStore();
  const registry = new ActiveEditorRegistry();
  const binding = createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });
  return { store, catalog, registry, binding };
};

/** Renderer `node` under en frisk greenfield-runtime-binding. Returnerer også runtime, så testen kan settle felter. */
export const renderWithTestInputRuntime = (
  node: React.ReactNode
): ReturnType<typeof render> & Readonly<{ runtime: TestInputRuntime }> => {
  const runtime = createTestInputRuntime();
  const result = render(<InputRuntimeProvider binding={runtime.binding}>{node}</InputRuntimeProvider>);
  return Object.assign(result, { runtime });
};

/** Settler en feltværdi gennem den ene write-grænse, så den fremgår som committed visning. */
export const settleTestField = <T,>(runtime: TestInputRuntime, field: FieldRef<T>, raw: string): void => {
  dispatchInput(runtime.store, runtime.catalog, settleField(field, raw));
};
