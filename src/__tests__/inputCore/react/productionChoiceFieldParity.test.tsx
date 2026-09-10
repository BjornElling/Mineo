// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  serializeFieldAddress,
  type FieldRef,
  type InputCatalog,
} from '../../../inputCore';
import { stamdataSkadestypeField } from '../../../inputCore/catalog/stamdataDescriptors';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ChoiceField,
  GridChoiceCell,
} from '../../../inputCore/react/fields';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from '../../../inputCore/react';
import {
  ActiveEditorRegistry,
  dispatchInput,
  type SlimInputStore,
} from '../../../inputCore/runtime';
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { settleField } from '../../../inputCore/inputReducer';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';
import type { Skadestype } from '../../../schemas/formSchemas/enumSchemas';

// Dette er en produktionstilknyttet parity-test: både feltet og den valgbare mængde kommer fra det udgivne
// descriptor-katalog. Testen må derfor ikke falde tilbage til det håndskrevne testkatalog som facit.
const PRODUCTION_CHOICE_OPTIONS = (() => {
  const options = stamdataSkadestypeField.codec.options;
  if (options === undefined || options.length < 2 || options.some((value) => typeof value !== 'string')) {
    throw new Error('stamdata.skadestype mangler mindst to string-options i produktionsdescriptoren');
  }
  return options as readonly string[];
})();

const SELECTED_VALUE = PRODUCTION_CHOICE_OPTIONS[1]!;
const INVALID_RAW = 'Ikke en gyldig produktionsværdi';
const GRID_CELL: GridCellCoord = { rowId: 'production-choice', colIndex: 0 };

type SurfaceKind = 'form' | 'grid';
type ProductionChoiceField = FieldRef<Skadestype | undefined>;

type ProductionRuntime = Readonly<{
  store: SlimInputStore;
  catalog: InputCatalog;
  binding: InputRuntimeBinding;
}>;

type SurfaceObservation = Readonly<{
  surface: SurfaceKind;
  canonicalAfterCommit: Skadestype | undefined;
  rejectedAfterCommit: string | undefined;
  visibleAfterCommit: string;
  revisionAfterCommit: number;
  revisionAfterNoOp: number;
}>;

const locationFor = (surface: SurfaceKind): EditorLocation => ({
  locationId: `production-choice.${surface}`,
  route: '/stamdata',
  tabKey: null,
});

const createProductionRuntime = (): ProductionRuntime => {
  const catalog = getProductionInputCatalog();
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
  return { store, catalog, binding };
};

const fieldRef = (): ProductionChoiceField => stamdataSkadestypeField.bind();

const canonical = (runtime: ProductionRuntime, field: ProductionChoiceField): Skadestype | undefined =>
  createValidationReader(runtime.store.getState().input, runtime.catalog).readCanonical(field);

const rejectedRaw = (runtime: ProductionRuntime, field: ProductionChoiceField): string | undefined =>
  runtime.store.getState().input.rejectedInputs[serializeFieldAddress(field.address)]?.raw;

const expectCanonicalRejectedXor = (
  runtime: ProductionRuntime,
  field: ProductionChoiceField,
  expectedCanonical: Skadestype | undefined,
  expectedRejected: string | undefined,
): void => {
  const actualCanonical = canonical(runtime, field);
  const actualRejected = rejectedRaw(runtime, field);

  expect(actualCanonical).toBe(expectedCanonical);
  expect(actualRejected).toBe(expectedRejected);
  expect((actualCanonical !== undefined) !== (actualRejected !== undefined)).toBe(true);
};

const renderOptions = (): React.ReactNode => PRODUCTION_CHOICE_OPTIONS.map((value) => (
  <option key={value} value={value}>{value}</option>
));

const gridStateStore: GridCoreStateStore = {
  subscribe: () => () => undefined,
  getFocusedCell: () => null,
  getEditingCell: () => null,
};

const renderGridChoice = (field: ProductionChoiceField, location: EditorLocation): React.ReactElement => (
  <GridCoreProvider value={{
    gridStateStore,
    openEditing: () => undefined,
    closeEditing: () => undefined,
    registerEditor: () => undefined,
    unregisterEditor: () => undefined,
    getEditor: () => null,
    requestFocusPlan: () => undefined,
  }}>
    <GridChoiceCell<string, unknown, Skadestype | undefined>
      gridCell={GRID_CELL}
      cell={{ kind: 'existing', field, location }}
    >
      {renderOptions()}
    </GridChoiceCell>
  </GridCoreProvider>
);

const renderSurface = (
  surface: SurfaceKind,
  runtime: ProductionRuntime,
  field: ProductionChoiceField,
): void => {
  const location = locationFor(surface);
  const node = surface === 'form'
    ? (
      <ChoiceField<string, Skadestype | undefined> field={field} location={location}>
        {renderOptions()}
      </ChoiceField>
    )
    : renderGridChoice(field, location);

  render(<InputRuntimeProvider binding={runtime.binding}>{node}</InputRuntimeProvider>);
};

const choose = async (user: ReturnType<typeof userEvent.setup>, value: string): Promise<void> => {
  const combobox = screen.getByRole('combobox');
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: value }));
};

const exerciseSurface = async (
  surface: SurfaceKind,
  user: ReturnType<typeof userEvent.setup>,
): Promise<SurfaceObservation> => {
  const runtime = createProductionRuntime();
  const field = fieldRef();

  // Start med en reel rejected-tilstand. Det gør den efterfølgende dropdown-commit-test i stand til at
  // bevise, at den samme tilladte værdi både sætter canonical og rydder den gamle rå fejltekst atomisk.
  dispatchInput(runtime.store, runtime.catalog, settleField(field, INVALID_RAW));
  renderSurface(surface, runtime, field);

  expectCanonicalRejectedXor(runtime, field, undefined, INVALID_RAW);

  const beforeCommit = runtime.store.getState().revision;
  await choose(user, SELECTED_VALUE);

  const combobox = screen.getByRole('combobox') as HTMLInputElement;
  expectCanonicalRejectedXor(runtime, field, SELECTED_VALUE as Skadestype, undefined);
  expect(combobox).toHaveValue(SELECTED_VALUE);
  const revisionAfterCommit = runtime.store.getState().revision;
  expect(revisionAfterCommit).toBe(beforeCommit + 1);

  // Det samme valg igen må ikke oprette et nyt history-/revisionspunkt.
  await choose(user, SELECTED_VALUE);
  const revisionAfterNoOp = runtime.store.getState().revision;
  expect(revisionAfterNoOp).toBe(revisionAfterCommit);
  expect(combobox).toHaveValue(SELECTED_VALUE);

  return {
    surface,
    canonicalAfterCommit: canonical(runtime, field),
    rejectedAfterCommit: rejectedRaw(runtime, field),
    visibleAfterCommit: combobox.value,
    revisionAfterCommit,
    revisionAfterNoOp,
  };
};

describe('produktions-choicefelt: form/grid-paritet', () => {
  it('committer samme tilladte værdi ens på form og grid', async () => {
    const user = userEvent.setup();
    const observations: Record<SurfaceKind, SurfaceObservation> = {} as Record<SurfaceKind, SurfaceObservation>;

    for (const surface of ['form', 'grid'] as const) {
      observations[surface] = await exerciseSurface(surface, user);
      cleanup();
    }

    const comparable = (observation: SurfaceObservation) => ({
      canonicalAfterCommit: observation.canonicalAfterCommit,
      rejectedAfterCommit: observation.rejectedAfterCommit,
      visibleAfterCommit: observation.visibleAfterCommit,
      revisionAfterCommit: observation.revisionAfterCommit,
      revisionAfterNoOp: observation.revisionAfterNoOp,
    });
    expect(comparable(observations.grid)).toEqual(comparable(observations.form));
    expect(observations.form).toMatchObject({
      canonicalAfterCommit: SELECTED_VALUE,
      rejectedAfterCommit: undefined,
      visibleAfterCommit: SELECTED_VALUE,
      revisionAfterCommit: 2,
      revisionAfterNoOp: 2,
    });
  });
});
