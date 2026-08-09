// @vitest-environment jsdom
//
// Hydrering af en session med en åben draft: DRAFT-benet.
//
// Planens punkt 10 kræver "F5 med gyldigt og fejlende afsluttet input samt ÅBEN DRAFT". De to første
// dækkes i `runtime/dispatchInput.test.ts`; dette er det tredje.
//
// Den strukturelle halvdel (envelopen har ingen draft-kanal) ligger i samme runtime-fil. Den er
// nødvendig, men ikke tilstrækkelig: den beviser, at der ikke FINDES et sted at gemme en draft, men
// ikke at en RIGTIG åben draft undlader at nå derhen. Reviewet påpegede korrekt, at den tidligere
// version af den test aldrig åbnede en editor og derfor påstod mere, end den bar.
//
// Her åbnes en faktisk editor, draften ændres UDEN settle, og en frisk runtime hydreres fra den ægte
// sessionStorage-envelope. Invarianten (§1.2, §10-kriterium 4): den åbne draft er ikke en fjerde
// inputkanal — efter reload findes kun det senest AFSLUTTEDE input.
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';

import {
  dispatchInput,
  initializeInputRuntime,
  ActiveEditorRegistry,
  type SlimInputStore,
} from '../../../inputCore/runtime';
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
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
  createEvaluationSourceToken,
  type InputCatalog,
  type FieldRef,
} from '../../../inputCore';
import { createTestCatalog, aargangField, testLocation } from '../testCatalog';

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
    () => {
      const state = store.getState();
      return bindFieldIssueSnapshot(
        buildFieldIssueSet([]),
        createEvaluationSourceToken(state.revision, state.settingsRevision)
      );
    }
  );

const renderEditor = <T,>(field: FieldRef<T>) => {
  const binding = makeBinding();
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    <InputRuntimeProvider binding={binding}>{children}</InputRuntimeProvider>;
  Wrapper.displayName = 'TestInputRuntimeWrapper';
  return renderHook(() => useFieldEditor(field, testLocation('loc-1')), { wrapper: Wrapper });
};

const field = aargangField.bind();

const canonicalIn = (target: SlimInputStore): unknown =>
  createValidationReader(target.getState().input, catalog).readCanonical(field);

describe('åben draft persisteres ikke over en reload (§1.2)', () => {
  it('en ændret, IKKE-settlet draft findes ikke efter hydration — kun afsluttet input genopstår', () => {
    // Afsluttet udgangspunkt: 2020.
    dispatchInput(store, catalog, settleField(field, '2020'), { now: 1 });
    const revisionEfterSettle = store.getState().revision;

    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('9999'));

    // Draften er åben og synlig i editoren, men afsluttet input og revision er urørt (§1.2).
    expect(result.current.isOpen).toBe(true);
    expect(result.current.displayText).toBe('9999');
    expect(canonicalIn(store)).toBe(2020);
    expect(store.getState().revision).toBe(revisionEfterSettle);

    // "F5": en frisk runtime hydrerer fra den ægte sessionStorage-envelope.
    const reloaded = __createSlimInputTestStore();
    expect(initializeInputRuntime(reloaded, catalog).notice).toBeNull();

    // Kun det afsluttede input genopstår. Draftens `9999` findes hverken canonical eller som rejected.
    expect(canonicalIn(reloaded)).toBe(2020);
    expect(reloaded.getState().input.rejectedInputs[serializeFieldAddress(field.address)]).toBeUndefined();
    expect(JSON.stringify(reloaded.getState().input)).not.toContain('9999');
  });

  it('en FEJLENDE, ikke-settlet draft persisteres heller ikke som rejected råtekst', () => {
    // Uden dette tilfælde kunne en fremtidig "gem draften, så brugeren ikke mister den"-mekanik
    // smugle rå tekst ind ad rejected-kanalen, hvor den ville blokere `.eo` (§3.9) uden et settle.
    dispatchInput(store, catalog, settleField(field, '2020'), { now: 1 });

    const { result } = renderEditor(field);
    act(() => result.current.open());
    act(() => result.current.changeDraft('ikke-et-årstal'));
    expect(result.current.isOpen).toBe(true);

    const reloaded = __createSlimInputTestStore();
    expect(initializeInputRuntime(reloaded, catalog).notice).toBeNull();

    expect(canonicalIn(reloaded)).toBe(2020);
    expect(reloaded.getState().input.rejectedInputs).toEqual({});
    expect(JSON.stringify(reloaded.getState().input)).not.toContain('ikke-et-årstal');
  });
});
