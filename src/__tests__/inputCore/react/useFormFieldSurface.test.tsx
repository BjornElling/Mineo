// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useFormFieldSurface,
  type InputRuntimeBinding,
} from '../../../inputCore/react';
import { filterIntegerKeyDown } from '../../../components/inputs/inputKeyFilters';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import {
  settleField,
  serializeFieldAddress,
  buildFieldIssueSet,
  bindFieldIssueSnapshot,
  toAnyFieldRef,
  createEvaluationSourceToken,
  type InputCatalog,
  type FieldRef,
  type FieldIssue,
  type FieldIssueSnapshot,
} from '../../../inputCore';
import { createTestCatalog, aargangField, testLocation } from '../testCatalog';

// UI-mekanik-laget (§2.4/§3.5, §7.1) mod syntetiske issue-snapshots. Surface-hooken oversætter kun
// DOM-events → editor-controller; den parser/persisterer/holder ingen fejlstate.

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

const renderSurface = <T,>(
  field: FieldRef<T>,
  locationId = 'loc-1',
  config?: Parameters<typeof useFormFieldSurface<T>>[2]
) => {
  const binding = makeBinding();
  return {
    binding,
    ...renderHook(() => useFormFieldSurface(field, testLocation(locationId), config), { wrapper: wrapper(binding) }),
  };
};

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const rejectedRaw = <T,>(field: FieldRef<T>): string | undefined =>
  store.getState().input.rejectedInputs[serializeFieldAddress(field.address)]?.raw;

const field = aargangField.bind();

// Minimale syntetiske DOM-events.
const keyEvent = (key: string): React.KeyboardEvent<HTMLInputElement> => {
  const e = {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => {},
    stopPropagation: () => {},
  };
  return e as unknown as React.KeyboardEvent<HTMLInputElement>;
};

const keyEventAt = (
  key: string,
  input: HTMLInputElement,
  callbacks: Readonly<{ onPrevent?: () => void; onStop?: () => void }> = {}
): React.KeyboardEvent<HTMLInputElement> => ({
  key,
  currentTarget: input,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  nativeEvent: { isComposing: false },
  preventDefault: () => callbacks.onPrevent?.(),
  stopPropagation: () => callbacks.onStop?.(),
}) as unknown as React.KeyboardEvent<HTMLInputElement>;

const focusEvent = (): React.FocusEvent<HTMLInputElement> =>
  ({}) as unknown as React.FocusEvent<HTMLInputElement>;

const pasteEvent = (raw: string): React.ClipboardEvent<HTMLInputElement> => ({
  clipboardData: { getData: () => raw },
  preventDefault: () => undefined,
  stopPropagation: () => undefined,
}) as unknown as React.ClipboardEvent<HTMLInputElement>;

describe('useFormFieldSurface — §7.1 aktivering + settle', () => {
  it('lukket felt er readOnly og viser canonical fra revisionen', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderSurface(field);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.readOnly).toBe(true);
    expect(result.current.displayText).toBe('2020');
  });

  it('tast-initieret åbning seeder editoren med første tegn (§1.3)', () => {
    const { result } = renderSurface(field);
    act(() => result.current.onKeyDown(keyEvent('5')));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.readOnly).toBe(false);
    expect(result.current.displayText).toBe('5');
  });

  it('en ikke-accepteret tast åbner ikke editoren', () => {
    const { result } = renderSurface(field);
    // aargang-codec (heltal) accepterer ikke bogstaver som første tegn.
    act(() => result.current.onKeyDown(keyEvent('a')));
    expect(result.current.isOpen).toBe(false);
  });

  it('Enter i åben editor settler præcis én gang (§1.3)', () => {
    const { result } = renderSurface(field);
    act(() => result.current.onKeyDown(keyEvent('2')));
    act(() => result.current.onDraftChange('2021'));
    act(() => result.current.onKeyDown(keyEvent('Enter')));
    expect(result.current.isOpen).toBe(false);
    expect(canonical(field)).toBe(2021);
  });

  it('blur settler den åbne draft (§1.3)', () => {
    const { result } = renderSurface(field);
    act(() => result.current.onKeyDown(keyEvent('2')));
    act(() => result.current.onDraftChange('2022'));
    act(() => result.current.onBlur(focusEvent()));
    expect(result.current.isOpen).toBe(false);
    expect(canonical(field)).toBe(2022);
  });

  it('Escape lukker uden command; efterfølgende blur settler ikke (§1.3)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderSurface(field);
    const revBefore = store.getState().revision;
    act(() => result.current.onKeyDown(keyEvent('9')));
    act(() => result.current.onDraftChange('2099'));
    act(() => result.current.onKeyDown(keyEvent('Escape')));
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.onBlur(focusEvent()));
    expect(canonical(field)).toBe(2020);
    expect(store.getState().revision).toBe(revBefore);
  });

  it('Escape og blur i samme task kan ikke committe den annullerede draft', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderSurface(field);
    const revBefore = store.getState().revision;
    act(() => result.current.onKeyDown(keyEvent('9')));
    act(() => result.current.onDraftChange('2099'));

    act(() => {
      result.current.onKeyDown(keyEvent('Escape'));
      result.current.onBlur(focusEvent());
    });

    expect(canonical(field)).toBe(2020);
    expect(store.getState().revision).toBe(revBefore);
  });

  it('ugyldigt settle rydder canonical og skriver rejected råtekst (§1.5)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderSurface(field);
    act(() => result.current.onKeyDown(keyEvent('9')));
    act(() => result.current.onDraftChange('9x9')); // ikke-parsebart format → rejected råtekst
    act(() => result.current.onBlur(focusEvent()));
    expect(canonical(field)).toBeUndefined();
    expect(rejectedRaw(field)).toBe('9x9');
  });

  it('Backspace/Delete på et lukket felt rydder og committer straks (§1.3)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    const { result } = renderSurface(field);
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.onKeyDown(keyEvent('Backspace')));
    expect(canonical(field)).toBeUndefined();
    expect(result.current.isOpen).toBe(false); // åbner ikke editoren
  });

  it('Backspace på et tomt lukket felt er no-op (ingen ny revision)', () => {
    const { result } = renderSurface(field);
    const revBefore = store.getState().revision;
    act(() => result.current.onKeyDown(keyEvent('Delete')));
    expect(store.getState().revision).toBe(revBefore);
  });

  it('paste i et lukket felt committer straks uden at efterlade en åben draft', () => {
    const { result } = renderSurface(field);
    act(() => result.current.onPaste(pasteEvent('2024')));
    expect(canonical(field)).toBe(2024);
    expect(result.current.isOpen).toBe(false);
    expect(registry.getEditing()).toBeNull();
  });
});

describe('useFormFieldSurface — issue-visning (§1.2/§1.8)', () => {
  it('viser feltets aktive issue fra snapshottet', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    issues = [Object.freeze({
      kind: 'field', code: 'x.bounds', severity: 'error', field: toAnyFieldRef(field),
      reason: 'bounds', message: 'uden for interval',
    })];
    const { result } = renderSurface(field);
    expect(result.current.issue?.code).toBe('x.bounds');
    expect(result.current.issue?.message).toBe('uden for interval');
  });

  it('issuet forbliver uændret under redigering af draften (§1.2)', () => {
    dispatchInput(store, catalog, settleField(field, '2020'));
    issues = [Object.freeze({
      kind: 'field', code: 'x.bounds', severity: 'error', field: toAnyFieldRef(field),
      reason: 'bounds', message: 'uden for interval',
    })];
    const { result } = renderSurface(field);
    act(() => result.current.onKeyDown(keyEvent('2')));
    act(() => result.current.onDraftChange('2021'));
    expect(result.current.issue?.code).toBe('x.bounds'); // uændret mens der redigeres
  });

  it('bevarer tegn- og cifferfilteret, når en rød feltfejl er aktiv', () => {
    issues = [Object.freeze({
      kind: 'field', code: 'x.bounds', severity: 'error', field: toAnyFieldRef(field),
      reason: 'bounds', message: 'uden for interval',
    })];
    const { result } = renderSurface(field, 'loc-filter', {
      keyFilter: (event) => filterIntegerKeyDown(event, { maxDigits: 3 }),
    });
    act(() => result.current.onKeyDown(keyEvent('1')));
    act(() => result.current.onDraftChange('111'));

    const input = document.createElement('input');
    input.value = '111';
    input.setSelectionRange(3, 3);
    let prevented = false;
    let stopped = false;
    act(() => result.current.onKeyDown(keyEventAt('1', input, {
      onPrevent: () => { prevented = true; },
      onStop: () => { stopped = true; },
    })));

    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });
});

describe('useFormFieldSurface — registrering', () => {
  it('registrerer editoren mens den er åben og afmelder ved settle', () => {
    const { result } = renderSurface(field);
    expect(registry.getEditing()).toBeNull();
    act(() => result.current.onKeyDown(keyEvent('2')));
    expect(registry.getEditing()?.id).toBe('loc-1');
    act(() => result.current.onBlur(focusEvent()));
    expect(registry.getEditing()).toBeNull();
  });
});
