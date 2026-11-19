// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  dispatchInput,
  ActiveEditorRegistry,
  type SlimInputStore,
} from '../../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from '../../../../inputCore/react';
import ToggleField from '../../../../inputCore/react/fields/ToggleField';
import { createInputEvaluation, createValidationReader } from '../../../../inputCore/inputReader';
import {
  settleField,
  buildFieldIssueSet,
  bindFieldIssueSnapshot,
  createEvaluationSourceToken,
  type InputCatalog,
  type FieldIssueSnapshot,
} from '../../../../inputCore';
import { createTestCatalog, omregningField, testLocation } from '../../testCatalog';

// Betinget kontakt (page-component-contract.md §10.5, BB-422): en kontakt, hvis forudsætning mangler, vises
// inaktiv og slået FRA – ellers lover den en side, dokumentet ikke har. Den afsluttede værdi bevares imens.

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

const buildIssues = (): FieldIssueSnapshot => {
  const state = store.getState();
  return bindFieldIssueSnapshot(
    buildFieldIssueSet([]),
    createEvaluationSourceToken(state.revision, state.settingsRevision)
  );
};

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(
    store,
    catalog,
    registry,
    () => {
      const state = store.getState();
      return createInputEvaluation({
        input: state.input,
        catalog,
        sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
      });
    },
    buildIssues
  );

const field = omregningField.bind();

const canonical = (): boolean =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const renderToggle = (unavailableReason: string | null) => (
  <InputRuntimeProvider binding={makeBinding()}>
    <ToggleField
      field={field}
      location={testLocation('loc-1')}
      ariaLabel="Medtag udvidet specifikation"
      unavailableReason={unavailableReason}
    />
  </InputRuntimeProvider>
);

const toggle = (): HTMLInputElement =>
  screen.getByRole('checkbox', { name: 'Medtag udvidet specifikation' });

describe('ToggleField – unavailableReason (§10.5 betinget kontakt)', () => {
  it('viser en inaktiv kontakt slået fra, selv om den afsluttede værdi er til, og bevarer værdien', () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    const revisionBefore = store.getState().revision;

    render(renderToggle('Bilaget «Løbende ydelser» er fravalgt'));

    expect(toggle()).toBeDisabled();
    expect(toggle().checked).toBe(false);
    expect(canonical()).toBe(true);
    expect(store.getState().revision).toBe(revisionBefore);
  });

  it('viser den bevarede værdi igen, når forudsætningen bliver opfyldt', () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    const view = render(renderToggle('Bilaget «Løbende ydelser» er fravalgt'));
    expect(toggle().checked).toBe(false);

    view.rerender(renderToggle(null));

    expect(toggle()).toBeEnabled();
    expect(toggle().checked).toBe(true);
  });
});
