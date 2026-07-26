// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider, type InputRuntimeBinding } from '../../../inputCore/react';
import {
  IntegerField,
  PercentField,
  AmountField,
  RadioField,
  GridAmountCell,
  MultilineTextField,
} from '../../../inputCore/react/fields';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createCollectionRef,
  settleField,
  type InputCatalog,
  type FieldRef,
} from '../../../inputCore';
import { insertRow } from '../../../inputCore/inputReducer';
import {
  createTestCatalog,
  aargangField,
  kommentarerField,
  enhedField,
  belobField,
  makeRow,
  testRowOrigin,
} from '../testCatalog';
import type { TillaegstidEnhed } from '../../../schemas/formSchemas/enumSchemas';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';

// Fase 2.4 (§2.4/§3.5): de nye Greenfield-feltskaller. De numeriske presets er tynde over den allerede-testede
// `useFormFieldSurface`; her verificeres kun, at de mounter korrekt (adornment/committed visning). Radio er en ny
// immediate-commit-control og testes for at committe det valgte via `setImmediateField`.

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
    }
  );

const renderField = (node: React.ReactNode) => {
  const binding = makeBinding();
  return render(<InputRuntimeProvider binding={binding}>{node}</InputRuntimeProvider>);
};

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

describe('Greenfield numeriske presets', () => {
  it('IntegerField viser committed heltalsværdi', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'));
    renderField(<IntegerField field={aargangField.bind()} location={{ locationId: 'int-1' }} name="aargang" />);
    expect(screen.getByRole('textbox')).toHaveValue('2020');
  });

  it('PercentField viser "%"-adornment', () => {
    // aargang er et number|undefined-felt; procent-skallen accepterer samme værditype (adornment-smoke).
    renderField(<PercentField field={aargangField.bind()} location={{ locationId: 'pct-1' }} name="pct" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('AmountField viser "kr."-adornment', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')), { origin: testRowOrigin() });
    renderField(<AmountField field={belobField.bind('r1')} location={{ locationId: 'amt-1' }} name="belob" />);
    expect(screen.getByText('kr.')).toBeInTheDocument();
  });
});

describe('Greenfield flerlinjet tekstfelt', () => {
  it('behandler Enter som tekst og settler først ved blur', () => {
    renderField(
      <MultilineTextField
        field={kommentarerField.bind()}
        location={{ locationId: 'kommentarer-1' }}
        name="kommentarer"
        singleStageClick
      />
    );
    const textarea = screen.getByRole('textbox');

    fireEvent.mouseDown(textarea);
    fireEvent.click(textarea);
    fireEvent.change(textarea, { target: { value: 'Første linje' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(canonical(kommentarerField.bind())).toBeUndefined();

    fireEvent.change(textarea, { target: { value: 'Første linje\nAnden linje' } });
    fireEvent.blur(textarea);
    expect(canonical(kommentarerField.bind())).toBe('Første linje\nAnden linje');
  });
});

describe('Greenfield immediate-commit control (radio)', () => {
  it('RadioField committer det valgte som setImmediateField', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { enhed: 'dage' })), { origin: testRowOrigin() });
    renderField(
      <RadioField<TillaegstidEnhed>
        field={enhedField.bind('r1')}
        location={{ locationId: 'radio-1' }}
        options={[
          { value: 'dage', label: 'Dage' },
          { value: 'uger', label: 'Uger' },
          { value: 'maaneder', label: 'Måneder' },
        ]}
        name="enhed"
      />
    );

    act(() => {
      fireEvent.click(screen.getByRole('radio', { name: 'Uger' }));
    });

    expect(canonical(enhedField.bind('r1'))).toBe('uger');
  });
});

describe('Greenfield grid-felt', () => {
  it('bevarer den røde feltmarkering, mens grid-cellen er åben', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')), { origin: testRowOrigin() });
    dispatchInput(store, catalog, settleField(belobField.bind('r1'), 'ugyldig'));
    const binding = makeBinding();
    const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 0 };
    const gridStateStore: GridCoreStateStore = {
      subscribe: () => () => undefined,
      getFocusedCell: () => gridCell,
      getEditingCell: () => gridCell,
    };

    render(
      <InputRuntimeProvider binding={binding}>
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
            cell={{ kind: 'existing', field: belobField.bind('r1'), location: { locationId: 'r1:belob' } }}
          />
        </GridCoreProvider>
      </InputRuntimeProvider>
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Der er udfyldt en ugyldig værdi i feltet Beløb')).toBeInTheDocument();
  });
});
