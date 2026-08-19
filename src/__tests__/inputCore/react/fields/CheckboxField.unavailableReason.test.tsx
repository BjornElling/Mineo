// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import CheckboxField from '../../../../inputCore/react/fields/CheckboxField';
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

// Betinget afkrydsningsfelt (page-component-contract.md §10.5): et valg, hvis forudsætning mangler,
// SKJULES ikke – det vises inaktivt og umarkeret med årsagen i tooltippet, og den afsluttede værdi
// bevares uændret imens.

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

const renderCheckbox = (unavailableReason: string | null) =>
  render(
    <InputRuntimeProvider binding={makeBinding()}>
      <CheckboxField
        field={field}
        location={testLocation('loc-1')}
        label="Mer-erstatning forhøjet folkepension"
        unavailableReason={unavailableReason}
      />
    </InputRuntimeProvider>
  );

const checkbox = (): HTMLInputElement =>
  screen.getByRole('checkbox', { name: 'Mer-erstatning forhøjet folkepension' });

describe('CheckboxField – unavailableReason (§10.5 betinget afkrydsningsfelt)', () => {
  it('viser feltet inaktivt og umarkeret, når forudsætningen mangler', () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    renderCheckbox('Der sker ingen forhøjelse i perioden');

    expect(checkbox()).toBeDisabled();
    expect(checkbox().checked).toBe(false);
  });

  it('skjuler ikke feltet – labelen bliver stående, så valget stadig kan ses', () => {
    renderCheckbox('Der sker ingen forhøjelse i perioden');
    expect(screen.getByText('Mer-erstatning forhøjet folkepension')).toBeInTheDocument();
  });

  it('bevarer den afsluttede værdi uændret, mens feltet er inaktivt', () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    const revisionBefore = store.getState().revision;

    renderCheckbox('Der sker ingen forhøjelse i perioden');

    // Den viste umarkering er ren visning: hverken canonical værdi eller revision må ændres af,
    // at fladen inaktiverer feltet. Ellers ville et bilagsvalg gå tabt ved en midlertidig
    // beregningstilstand og ikke komme igen, når forudsætningen er opfyldt.
    expect(canonical()).toBe(true);
    expect(store.getState().revision).toBe(revisionBefore);
  });

  it('committer ikke ved klik på et inaktivt felt', async () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    renderCheckbox('Der sker ingen forhøjelse i perioden');

    // `user-event` afviser selv at klikke på et felt uden pointer-events – netop den tilstand er
    // beviset for, at feltet ikke kan aktiveres. Afvisningen hævdes derfor eksplicit, hvorefter et
    // rå klik forbi pointer-værnet bekræfter, at heller ikke DET committer noget.
    await expect(userEvent.click(checkbox())).rejects.toThrow(/pointer-events: none/);

    checkbox().click();

    expect(canonical()).toBe(true);
    expect(checkbox().checked).toBe(false);
  });

  it('committer ikke på Enter/Space, når feltet er inaktivt', async () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    renderCheckbox('Der sker ingen forhøjelse i perioden');

    checkbox().focus();
    await userEvent.keyboard('[Space]');
    await userEvent.keyboard('[Enter]');

    expect(canonical()).toBe(true);
    expect(checkbox().checked).toBe(false);
  });

  it('viser årsagen som tooltip ved hover – den eneste visningskanal', async () => {
    renderCheckbox('Der sker ingen forhøjelse i perioden');

    // Årsagen må ikke stå som tekstknude i fladen, før brugeren hoverer.
    expect(screen.queryByText('Der sker ingen forhøjelse i perioden')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('Mer-erstatning forhøjet folkepension'));

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Der sker ingen forhøjelse i perioden');
    });
  });

  it('genopretter den afsluttede værdi, når forudsætningen bliver opfyldt igen', () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    const view = renderCheckbox('Der sker ingen forhøjelse i perioden');

    expect(checkbox()).not.toBeChecked();

    view.rerender(
      <InputRuntimeProvider binding={makeBinding()}>
        <CheckboxField
          field={field}
          location={testLocation('loc-1')}
          label="Mer-erstatning forhøjet folkepension"
          unavailableReason={null}
        />
      </InputRuntimeProvider>
    );

    expect(checkbox()).toBeChecked();
    expect(canonical()).toBe(true);
  });

  it('er aktivt og viser den afsluttede værdi, når valget er muligt', () => {
    dispatchInput(store, catalog, settleField(field, 'true'));
    renderCheckbox(null);

    expect(checkbox()).toBeEnabled();
    expect(checkbox().checked).toBe(true);
  });

  it('bærer intet tooltip, når valget er muligt', async () => {
    renderCheckbox(null);
    await userEvent.hover(screen.getByText('Mer-erstatning forhøjet folkepension'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
