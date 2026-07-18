// @vitest-environment jsdom
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  __createSlimInputTestStore,
  dispatchInput,
  ActiveEditorRegistry,
  type SlimInputStore,
} from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useCollectionRows,
  useCellEditor,
  type InputRuntimeBinding,
  type CellSpec,
} from '../../../inputCore/react';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import {
  insertRow,
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
import {
  createTestCatalog,
  belobField,
  tillaegstidField,
  enhedField,
  rentekravRowsRef,
  makeRow,
} from '../testCatalog';
import type { TillaegstidEnhed } from '../../../schemas/formSchemas/enumSchemas';

// Fase 2.5 trin 1 (§2.5/§3.8, §7.1): grid-adapteren (rækkeinfrastruktur + celleeditor) mod syntetiske issue-
// snapshots. Rækkeinfrastrukturen ejer KUN id'er/rækkefølge/add/delete/reorder; celleværdier bor i
// inputaggregaten (ingen konkurrerende værdikopi, §3.8). Placeholder-promotion (§1.11) tester vi eksplicit.

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
  Wrapper.displayName = 'TestGridRuntimeWrapper';
  return Wrapper;
};

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const rejectedRaw = <T,>(field: FieldRef<T>): string | undefined =>
  store.getState().input.rejectedInputs[serializeFieldAddress(field.address)]?.raw;

const belobRef = (rowId: string) => belobField.bind(rowId);

describe('useCollectionRows — §3.8 rækkeinfrastruktur', () => {
  it('lister aktuelle entity-id\'er fra den afsluttede revision', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')));
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r2')));
    const binding = makeBinding();
    const { result } = renderHook(() => useCollectionRows(rentekravRowsRef()), { wrapper: wrapper(binding) });
    expect(result.current.rowIds).toEqual(['r1', 'r2']);
  });

  it('insert/remove/reorder går gennem den ene write-grænse', () => {
    const binding = makeBinding();
    const { result } = renderHook(() => useCollectionRows(rentekravRowsRef()), { wrapper: wrapper(binding) });

    act(() => { result.current.insert(makeRow('a')); });
    act(() => { result.current.insert(makeRow('b')); });
    expect(result.current.rowIds).toEqual(['a', 'b']);

    act(() => { result.current.reorder(['b', 'a']); });
    expect(result.current.rowIds).toEqual(['b', 'a']);

    act(() => { result.current.remove('b'); });
    expect(result.current.rowIds).toEqual(['a']);
  });

  it('row-delete fjerner rækkens rejected descendants atomisk (§3.8)', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')));
    dispatchInput(store, catalog, settleField(belobRef('r1'), 'abc')); // rejected råtekst i cellen
    expect(rejectedRaw(belobRef('r1'))).toBe('abc');

    const binding = makeBinding();
    const { result } = renderHook(() => useCollectionRows(rentekravRowsRef()), { wrapper: wrapper(binding) });
    act(() => { result.current.remove('r1'); });

    expect(result.current.rowIds).toEqual([]);
    // Ingen orphan rejected descendant tilbage.
    expect(store.getState().input.rejectedInputs).toEqual({});
  });
});

const renderCell = <T,>(cell: CellSpec<T, unknown>, binding: InputRuntimeBinding) =>
  renderHook(() => useCellEditor<T>(cell), { wrapper: wrapper(binding) });

describe('useCellEditor — eksisterende-række-celle (§7.1 identisk med formularfelt)', () => {
  it('gyldigt settle skriver cellens canonical værdi', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')));
    const binding = makeBinding();
    const { result } = renderCell<import('../../../schemas/amountExpressionSchema').AmountValue | undefined>(
      { kind: 'existing', field: belobRef('r1'), location: { locationId: 'r1:belob' } },
      binding
    );
    act(() => result.current.open());
    act(() => result.current.changeDraft('1000'));
    act(() => result.current.settle());

    expect(canonical(belobRef('r1'))).toMatchObject({ value: 1000 });
    expect(rejectedRaw(belobRef('r1'))).toBeUndefined();
  });

  it('ugyldigt settle rydder canonical og skriver rejected råtekst (§1.5)', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1', { belob: undefined })));
    const binding = makeBinding();
    const { result } = renderCell(
      { kind: 'existing', field: belobRef('r1'), location: { locationId: 'r1:belob' } },
      binding
    );
    act(() => result.current.open());
    act(() => result.current.changeDraft('abc'));
    act(() => result.current.settle());

    expect(canonical(belobRef('r1'))).toBeUndefined();
    expect(rejectedRaw(belobRef('r1'))).toBe('abc');
  });

  it('viser cellens røde issue fra revisionen uændret under redigering (§1.8)', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')));
    issues = [Object.freeze({
      kind: 'field', code: 'r1.belob.bounds', severity: 'error', field: toAnyFieldRef(belobRef('r1')),
      reason: 'bounds', message: 'beløb uden for interval',
    })];
    const binding = makeBinding();
    const { result } = renderCell(
      { kind: 'existing', field: belobRef('r1'), location: { locationId: 'r1:belob' } },
      binding
    );
    expect(result.current.issue?.code).toBe('r1.belob.bounds');
    act(() => result.current.open());
    act(() => result.current.changeDraft('500'));
    expect(result.current.issue?.code).toBe('r1.belob.bounds'); // uændret under redigering
  });
});

describe('useCellEditor — placeholder-promotion (§1.11)', () => {
  const placeholderCell = (): CellSpec<import('../../../schemas/amountExpressionSchema').AmountValue | undefined, unknown> => ({
    kind: 'placeholder',
    descriptor: belobField,
    collection: rentekravRowsRef(),
    entity: makeRow('new-1'),
    entityId: 'new-1',
    location: { locationId: 'placeholder:belob' },
  });

  it('første ikke-tomme settle promoverer rækken atomisk (opret + skriv i én transaktion)', () => {
    const binding = makeBinding();
    const revBefore = store.getState().revision;
    const { result } = renderCell(placeholderCell(), binding);

    act(() => result.current.open());
    act(() => result.current.changeDraft('2500'));
    act(() => result.current.settle());

    // Præcis én række oprettet OG cellen skrevet — ét history-trin.
    expect(catalog.listEntityIds(store.getState().input.sections, rentekravRowsRef())).toEqual(['new-1']);
    expect(canonical(belobRef('new-1'))).toMatchObject({ value: 2500 });
    expect(store.getState().revision).not.toBe(revBefore);
    expect(store.getState().history.past.length).toBe(1);
  });

  it('første ugyldige settle promoverer rækken med rejected råtekst (§1.11)', () => {
    const binding = makeBinding();
    const { result } = renderCell(placeholderCell(), binding);
    act(() => result.current.open());
    act(() => result.current.changeDraft('abc'));
    act(() => result.current.settle());

    expect(catalog.listEntityIds(store.getState().input.sections, rentekravRowsRef())).toEqual(['new-1']);
    expect(canonical(belobRef('new-1'))).toBeUndefined();
    expect(rejectedRaw(belobRef('new-1'))).toBe('abc');
  });

  it('tomt settle på en placeholder opretter INGEN række (§1.11)', () => {
    const binding = makeBinding();
    const revBefore = store.getState().revision;
    const { result } = renderCell(placeholderCell(), binding);

    act(() => result.current.open());
    act(() => result.current.changeDraft('   '));
    act(() => result.current.settle());

    expect(catalog.listEntityIds(store.getState().input.sections, rentekravRowsRef())).toEqual([]);
    expect(store.getState().revision).toBe(revBefore);
    expect(store.getState().history.past.length).toBe(0);
  });

  it('rent fokus+blur (uden tastning) på en placeholder er no-op', () => {
    const binding = makeBinding();
    const revBefore = store.getState().revision;
    const { result } = renderCell(placeholderCell(), binding);
    act(() => result.current.open());
    act(() => result.current.settle());
    expect(catalog.listEntityIds(store.getState().input.sections, rentekravRowsRef())).toEqual([]);
    expect(store.getState().revision).toBe(revBefore);
  });

  it('et immediate-commit-VALG på en placeholder promoverer rækken atomisk og bevarer valget (§1.11)', () => {
    // Bruger-krav: at vælge enhed på en tom række må ALDRIG tabe valget. Placeholder-immediate-override opretter
    // rækken og skriver valget i én transaktion — enhed nulstilles ikke til rækkefaktorens default.
    const binding = makeBinding();
    const revBefore = store.getState().revision;
    const enhedPlaceholder: CellSpec<TillaegstidEnhed, unknown> = {
      kind: 'placeholder',
      descriptor: enhedField,
      collection: rentekravRowsRef(),
      entity: makeRow('new-enhed'),
      entityId: 'new-enhed',
      location: { locationId: 'placeholder:enhed' },
    };
    const { result } = renderHook(() => useCellEditor<TillaegstidEnhed>(enhedPlaceholder), { wrapper: wrapper(binding) });

    act(() => result.current.commitImmediate('uger'));

    expect(catalog.listEntityIds(store.getState().input.sections, rentekravRowsRef())).toEqual(['new-enhed']);
    expect(canonical(enhedField.bind('new-enhed'))).toBe('uger');
    expect(store.getState().revision).not.toBe(revBefore);
    expect(store.getState().history.past.length).toBe(1);
  });
});

describe('grid-adapter — §7.2 statekæde: række med fejl → slet række → undo → redo', () => {
  it('gendanner/fjerner rækken, fejlende råinput og gates som én tilstand', () => {
    const binding = makeBinding();

    // Promovér en placeholder til en fejlende række.
    const { result: cell } = renderCell({
      kind: 'placeholder',
      descriptor: belobField,
      collection: rentekravRowsRef(),
      entity: makeRow('row-x'),
      entityId: 'row-x',
      location: { locationId: 'placeholder:belob' },
    }, binding);
    act(() => cell.current.open());
    act(() => cell.current.changeDraft('abc'));
    act(() => cell.current.settle());

    expect(rejectedRaw(belobRef('row-x'))).toBe('abc');

    const { result: rows } = renderHook(() => useCollectionRows(rentekravRowsRef()), { wrapper: wrapper(binding) });
    expect(rows.current.rowIds).toEqual(['row-x']);

    // Slet rækken.
    act(() => { rows.current.remove('row-x'); });
    expect(rows.current.rowIds).toEqual([]);
    expect(store.getState().input.rejectedInputs).toEqual({});

    // Undo → rækken OG dens rejected råtekst er tilbage som én tilstand.
    act(() => { binding.history.undo(); });
    expect(rows.current.rowIds).toEqual(['row-x']);
    expect(rejectedRaw(belobRef('row-x'))).toBe('abc');

    // Redo → rækken fjernes igen.
    act(() => { binding.history.redo(); });
    expect(rows.current.rowIds).toEqual([]);
    expect(store.getState().input.rejectedInputs).toEqual({});
  });
});

describe('grid-adapter — irrelevant-felt-oprydning ved styrende valg (§1.9/§3.6)', () => {
  it('promoverer en række og bevarer at tillaegstid er relevant, når enhed ≠ uger', () => {
    // Sanity: enhedField default 'dage' → tillaegstid relevant. Vi verificerer at cellen kan skrives.
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1', { enhed: 'dage' })));
    const binding = makeBinding();
    const { result } = renderCell(
      { kind: 'existing', field: tillaegstidField.bind('r1'), location: { locationId: 'r1:tillaegstid' } },
      binding
    );
    act(() => result.current.open());
    act(() => result.current.changeDraft('5'));
    act(() => result.current.settle());
    expect(canonical(tillaegstidField.bind('r1'))).toBe(5);
  });
});
