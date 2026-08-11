// @vitest-environment jsdom
import {
  __createSlimInputTestStore,
  __bumpSlimInputSettingsRevisionForTest,
} from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
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
import { createTestCatalog, aargangField, testLocation } from '../testCatalog';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';

// Den fælles felt-editor (§2.3/§3.5, §7.1) mod syntetiske immutable issue-snapshots.
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
  return { binding, ...renderHook(() => useFieldEditor(field, testLocation(locationId)), { wrapper: wrapper(binding) }) };
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
    act(() => __bumpSlimInputSettingsRevisionForTest(store));

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

// En handlingsknap ved siden af et TEKSTFELT (»Indsæt dags dato«) skal afslutte feltet gennem
// den normale settle-vej. `commitImmediate` er forbeholdt choice/toggle, og reduceren kaster på et tekstfelt —
// derfor er `settleValue` den ene lovlige programmatiske afslutning for et text-control.
describe('useFieldEditor — programmatisk settle af en leveret værdi (§1.3)', () => {
  it('settleValue på et tekstfelt committer canonical og kaster ikke', () => {
    const { result } = renderEditor(field);
    act(() => result.current.settleValue(2024));

    expect(canonical(field)).toBe(2024);
    expect(rejectedRaw(field)).toBeUndefined();
    expect(result.current.displayText).toBe('2024');
  });

  it('commitImmediate på samme tekstfelt afvises af reduceren — settleValue er den lovlige vej', () => {
    const { result } = renderEditor(field);
    expect(() => act(() => result.current.commitImmediate(2024)))
      .toThrow('setImmediateField er kun tilladt for choice/toggle');
    expect(canonical(field)).toBeUndefined();
  });

  it('settleValue giver ÉT history-trin med feltets egen origin', () => {
    const { result } = renderEditor(field);
    const revBefore = store.getState().revision;
    act(() => result.current.settleValue(2024));

    const state = store.getState();
    expect(state.revision).toBe(revBefore + 1);
    const origin = state.history.past.at(-1)?.origin;
    expect(origin?.kind).toBe('field');
    expect(origin).toMatchObject({ editorLocationId: 'loc-1' });
  });

  it('værdien går gennem feltets codec — samme parse som en tastet værdi', () => {
    const { result } = renderEditor(field);
    // Aargang-codecet resolver via `formatForEdit` → `parseForSettle`; en værdi uden for codecets
    // format ville derfor blive rejected råtekst præcis som en tastet værdi (§1.5), ikke skrevet canonical.
    act(() => result.current.settleValue(1999));
    expect(canonical(field)).toBe(1999);

    // Kontrast: tomværdien går gennem clear-grenen og efterlader intet rejected input.
    act(() => result.current.settleValue(undefined as unknown as number));
    expect(canonical(field)).toBeUndefined();
    expect(rejectedRaw(field)).toBeUndefined();
  });

  it('en åben draft ERSTATTES af den leverede værdi, og editoren lukkes', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('2099')); // halvskrevet draft

    act(() => result.current.settleValue(2024));

    expect(result.current.isOpen).toBe(false);
    expect(canonical(field)).toBe(2024); // knappens værdi vinder, ikke draften
    expect(registry.getEditing()).toBeNull();
  });

  it('settleValue på en ÅBEN editor efter en autoritativ replacement settler ikke (§3.5)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('2099'));

    const empty = createEmptySettledInput();
    const loaded = { sections: { ...empty.sections, satser: { aargang: 1950 } }, rejectedInputs: {} };
    act(() => { dispatchInput(store, catalog, { kind: 'replaceCase', input: loaded }); });

    act(() => result.current.settleValue(2024)); // stale → luk uden command
    expect(canonical(field)).toBe(1950);
  });

  it('settleValue virker på et LUKKET felt, brugeren ikke har åbnet', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderEditor(field);
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.settleValue(2024));
    expect(canonical(field)).toBe(2024);
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
      ({ locationId }) => useFieldEditor(field, testLocation(locationId)),
      { initialProps: testLocation('loc-1'), wrapper: wrapper(binding) }
    );

    rerender(testLocation('loc-2'));
    act(() => result.current.open());

    expect(registry.getEditing()?.id).toBe('loc-2');
  });

  it('binder også route og fane igen, når locationId genbruges', () => {
    const binding = makeBinding();
    const firstLocation: EditorLocation = { locationId: 'samme-id', route: '/første', tabKey: 'første-fane' };
    const secondLocation: EditorLocation = { locationId: 'samme-id', route: '/anden', tabKey: 'anden-fane' };
    const { result, rerender } = renderHook(
      ({ location }) => useFieldEditor(field, location),
      { initialProps: { location: firstLocation }, wrapper: wrapper(binding) }
    );

    rerender({ location: secondLocation });
    act(() => result.current.settleValue(2024));

    const origin = store.getState().history.past.at(-1)?.origin;
    expect(origin).toMatchObject({
      editorLocationId: 'samme-id',
      route: '/anden',
      tabKey: 'anden-fane',
    });
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
      () => useFieldEditor(field, testLocation('loc-fejl')),
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
