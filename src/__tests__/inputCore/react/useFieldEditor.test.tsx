// @vitest-environment jsdom
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  __createSlimInputTestStore,
  dispatchInput,
  ActiveEditorRegistry,
  CriticalActionCoordinator,
  type SlimInputStore,
} from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useFieldEditor,
  type InputRuntimeBinding,
} from '../../../inputCore/react';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import {
  settleField,
  serializeFieldAddress,
  buildFieldIssueSet,
  bindFieldIssueSnapshot,
  toAnyFieldRef,
  createEvaluationSourceToken,
  createEmptySettledInput,
  type InputCatalog,
  type FieldRef,
  type FieldIssue,
  type FieldIssueSnapshot,
} from '../../../inputCore';
import { createTestCatalog, aargangField } from '../testCatalog';

// Fase 2.3 (§2.3/§3.5, §7.1): den fælles felt-editor mod syntetiske immutable issue-snapshots (§2.3-verifikation).
// Adapteren parser/persisterer/holder ingen fejlstate — den driver kun state-machinen + engine + runner.

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;
let issues: FieldIssue[];

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  issues = [];
});

afterEach(() => sessionStorage.clear());

const buildIssues = (): FieldIssueSnapshot => {
  const state = store.getState();
  return bindFieldIssueSnapshot(
    buildFieldIssueSet(issues),
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
        settings: {},
      });
    },
    buildIssues
  );

const wrapper = (binding: InputRuntimeBinding) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    <InputRuntimeProvider binding={binding}>{children}</InputRuntimeProvider>;
  Wrapper.displayName = 'TestInputRuntimeWrapper';
  return Wrapper;
};

const renderEditor = <T,>(field: FieldRef<T>, locationId = 'loc-1') => {
  const binding = makeBinding();
  return { binding, ...renderHook(() => useFieldEditor(field, { locationId }), { wrapper: wrapper(binding) }) };
};

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const rejectedRaw = <T,>(field: FieldRef<T>): string | undefined =>
  store.getState().input.rejectedInputs[serializeFieldAddress(field.address)]?.raw;

const field = aargangField.bind();

describe('useFieldEditor — §7.1 feltkontrakt (form-surface)', () => {
  it('viser lukket canonical værdi fra revisionen', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.displayText).toBe('2020');
    expect(result.current.value).toBe(2020);
  });

  it('åben draft ændrer intet afsluttet (§1.2)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    const revBefore = store.getState().revision;

    act(() => result.current.open());
    act(() => result.current.changeDraft('9999'));

    expect(result.current.displayText).toBe('9999');
    expect(canonical(field)).toBe(2020); // afsluttet uændret
    expect(store.getState().revision).toBe(revBefore); // ingen ny revision
  });

  it('gyldigt settle skriver ny canonical og lukker', () => {
    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('2021'));
    act(() => result.current.settle());

    expect(result.current.isOpen).toBe(false);
    expect(canonical(field)).toBe(2021);
    expect(rejectedRaw(field)).toBeUndefined();
  });

  it('ugyldigt settle rydder canonical og skriver rejected råtekst (§1.5)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('9x9')); // ikke-parsebart format → rejected råtekst
    act(() => result.current.settle());

    expect(canonical(field)).toBeUndefined(); // gammel 2020 er væk
    expect(rejectedRaw(field)).toBe('9x9');
  });

  it('tomt settle går gennem clear', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('   '));
    act(() => result.current.settle());

    expect(canonical(field)).toBeUndefined();
    expect(rejectedRaw(field)).toBeUndefined();
  });

  it('Escape lukker uden command; efterfølgende settle er no-op (§1.3)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    const revBefore = store.getState().revision;
    act(() => result.current.open());
    act(() => result.current.changeDraft('2099'));
    act(() => result.current.cancel());
    act(() => result.current.settle()); // blur efter Escape må ikke committe

    expect(result.current.displayText).toBe('2020');
    expect(canonical(field)).toBe(2020);
    expect(store.getState().revision).toBe(revBefore);
  });

  it('Escape efterfulgt af blur i samme task kan ikke settle den annullerede draft', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    const revBefore = store.getState().revision;
    act(() => result.current.open());
    act(() => result.current.changeDraft('2099'));

    // Browseren kan levere blur, før React har nået et nyt render efter Escape.
    act(() => {
      result.current.cancel();
      result.current.settle();
    });

    expect(canonical(field)).toBe(2020);
    expect(store.getState().revision).toBe(revBefore);
  });

  it('viser eksisterende rødt issue uændret under redigering (§1.2/§1.8)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    issues = [Object.freeze({
      kind: 'field', code: 'x.bounds', severity: 'error', field: toAnyFieldRef(field),
      reason: 'bounds', message: 'uden for interval',
    })];
    const { result } = renderEditor(field);
    expect(result.current.issue?.code).toBe('x.bounds');

    act(() => result.current.open());
    act(() => result.current.changeDraft('2021'));
    expect(result.current.issue?.code).toBe('x.bounds'); // uændret under redigering
  });

  it('genlæser feltissues ved en ren settingsrevision', () => {
    const { result } = renderEditor(field);
    expect(result.current.issue).toBeUndefined();

    issues = [Object.freeze({
      kind: 'field', code: 'settings.bounds', severity: 'error', field: toAnyFieldRef(field),
      reason: 'bounds', message: 'settings ændrede grænsen',
    })];
    act(() => store.bumpSettingsRevision());

    expect(result.current.issue?.code).toBe('settings.bounds');
  });

  it('no-op settle uden ændring giver ingen ny revision', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const revBefore = store.getState().revision;
    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.settle()); // draft = "2020" (formatForEdit), uændret

    expect(store.getState().revision).toBe(revBefore);
  });

  it('clearImmediate rydder et lukket ikke-tomt felt straks (§1.3)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    act(() => result.current.clearImmediate());
    expect(canonical(field)).toBeUndefined();
  });

  it('clearImmediate på et tomt felt er no-op (ingen overflødig revision)', () => {
    const { result } = renderEditor(field);
    const revBefore = store.getState().revision;
    act(() => result.current.clearImmediate());
    expect(store.getState().revision).toBe(revBefore);
  });
});

describe('useFieldEditor — registrering + kritisk handling', () => {
  it('registrerer editoren, mens den er åben, og afmelder ved luk', () => {
    const { result } = renderEditor(field);
    expect(registry.getEditing()).toBeNull();

    act(() => result.current.open());
    expect(registry.getEditing()?.id).toBe('loc-1');

    act(() => result.current.settle());
    expect(registry.getEditing()).toBeNull();
  });

  it('binder en genbrugt lukket hook-instans til den nye editorlokation', () => {
    const binding = makeBinding();
    const { result, rerender } = renderHook(
      ({ locationId }) => useFieldEditor(field, { locationId }),
      { initialProps: { locationId: 'loc-1' }, wrapper: wrapper(binding) }
    );

    rerender({ locationId: 'loc-2' });
    act(() => result.current.open());

    expect(registry.getEditing()?.id).toBe('loc-2');
  });

  it('bevarer åben draft og registrering, hvis dispatch fejler', () => {
    const base = makeBinding();
    const binding: InputRuntimeBinding = Object.freeze({
      ...base,
      edit: Object.freeze({
        ...base.edit,
        dispatch: () => {
          throw new Error('storagefejl');
        },
      }),
    });
    const { result } = renderHook(
      () => useFieldEditor(field, { locationId: 'loc-fejl' }),
      { wrapper: wrapper(binding) }
    );
    act(() => result.current.open());
    act(() => result.current.changeDraft('2022'));

    expect(() => act(() => result.current.settle())).toThrow('storagefejl');
    expect(result.current.isOpen).toBe(true);
    expect(result.current.displayText).toBe('2022');
    expect(registry.getEditing()?.id).toBe('loc-fejl');
  });

  it('coordinatorens settle finaliserer den åbne editor og lander transaktionen', async () => {
    const { result } = renderEditor(field);
    const coordinator = new CriticalActionCoordinator(store, registry);
    act(() => result.current.open());
    act(() => result.current.changeDraft('2022'));

    await act(async () => {
      const r = await coordinator.prepare('save');
      expect(r.status).toBe('committed');
    });

    expect(canonical(field)).toBe(2022);
    expect(result.current.isOpen).toBe(false);
  });

  it('en autoritativ replacement på en nyere revision settler ikke draften (§3.5)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('2099'));

    // Simulér en autoritativ replacement (load), der hæver revisionen, mens editoren er åben.
    const empty = createEmptySettledInput();
    const loaded = { sections: { ...empty.sections, satser: { aargang: 1950 } }, rejectedInputs: {} };
    act(() => { dispatchInput(store, catalog, { kind: 'replaceCase', input: loaded }); });

    act(() => result.current.settle()); // stale → cancel, ingen dispatch af "2099"
    expect(canonical(field)).toBe(1950);
    expect(rejectedRaw(field)).toBeUndefined();
  });
});
