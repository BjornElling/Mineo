// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider } from '../../../inputCore/react';
import { AmountField, GridAmountCell } from '../../../inputCore/react/fields';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, createCollectionRef, type InputCatalog, type FieldRef } from '../../../inputCore';
import { insertRow } from '../../../inputCore/inputReducer';
import { createAmountFieldCodec, createOptionalTextFieldCodec } from '../../../inputCore/fieldCodecs';
import { normalizePasteForDraft } from '../../../inputCore/react/pasteSplice';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { aarsloenTableCol2Field } from '../../../inputCore/catalog/aarsloenDescriptors';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type {
  GridCellCoord,
  GridCellEditorHandle,
  GridCoreStateStore,
} from '../../../components/tables/gridCore/gridCoreTypes';
import { createTestCatalog, belobField, makeRow, testRowOrigin, testLocation } from '../testCatalog';
import { codecAllowsNegative } from '../../../inputCore/react/fields/signPolicy';

/**
 * Typografiske minustegn i beløbsfelter.
 *
 * Kender tegnfilteret kun ASCII-minus, indsættes `10−1` (U+2212) og `10–1` (U+2013) som `101,00`, fordi
 * tegnet springes over og cifrene smelter sammen, og i et fortegnet felt bliver `−1200` positivt. Derfor
 * normaliseres tegnet til '-' FØR tegnfilteret – i paste, tastning og første tegn, på både formularfelt
 * og tabelcelle – så det derefter følger præcis samme regler som '-' (inkl. §8.2's spring over et unært
 * minus i et felt uden negative værdier).
 */

const TYPOGRAPHIC_MINUSES = [
  ['U+2212 minus', '−'],
  ['U+2013 tankestreg', '–'],
] as const;

let catalog: InputCatalog;
let store: SlimInputStore;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
});

afterEach(() => sessionStorage.clear());

const makeBinding = (bindingStore: SlimInputStore, bindingCatalog: InputCatalog) =>
  createInputRuntimeBinding(bindingStore, bindingCatalog, new ActiveEditorRegistry(), () => {
    const state = bindingStore.getState();
    return createInputEvaluation({
      input: state.input,
      catalog: bindingCatalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

const canonicalIn = <T,>(bindingStore: SlimInputStore, bindingCatalog: InputCatalog, field: FieldRef<T>): T =>
  createValidationReader(bindingStore.getState().input, bindingCatalog).readCanonical(field);

const rentekravRef = () => createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });

/** Produktionskatalogets årslønstabel – «Løn»-kolonnen er et FORTEGNET beløbsfelt. */
const setupSignedProductionRow = () => {
  const productionCatalog = getProductionInputCatalog();
  const productionStore = __createSlimInputTestStore();
  const tableRef = createCollectionRef({ section: 'aarsloen', path: [], collection: 'tableData' });
  dispatchInput(
    productionStore,
    productionCatalog,
    insertRow(tableRef, createEmptyStandardLoenRow('r1')),
    { origin: testRowOrigin('tableData') }
  );
  expect(codecAllowsNegative(aarsloenTableCol2Field.codec), 'feltet skal VÆRE fortegnet').toBe(true);
  return { productionCatalog, productionStore, field: aarsloenTableCol2Field.bind('r1') };
};

const paste = (input: HTMLElement, text: string) =>
  fireEvent.paste(input, { clipboardData: { getData: () => text } });

/** Grid-core-navigationens tast-initierede åbning, kaldt som navigationen kalder den. */
const prepareEdit = (handle: GridCellEditorHandle | undefined, key: string): boolean => {
  if (handle === undefined) throw new Error('cellen registrerede ingen editor-handle');
  let opened = false;
  act(() => { opened = handle.prepareEditFromKey(key); });
  return opened;
};

describe('normalizePasteForDraft – typografisk minus bliver ASCII før tegnfilteret', () => {
  const nonNegative = createAmountFieldCodec({ allowNegative: false, allowDecimals: true });
  const signed = createAmountFieldCodec({ allowNegative: true, allowDecimals: true });

  it.each(TYPOGRAPHIC_MINUSES)('%s: 10x1 bevarer subtraktionen i stedet for at smelte til 101', (_name, minus) => {
    expect(normalizePasteForDraft(`10${minus}1`, nonNegative, '')).toBe('10-1');
    expect(normalizePasteForDraft(`1200${minus}200`, nonNegative, '')).toBe('1200-200');
  });

  it.each(TYPOGRAPHIC_MINUSES)('%s: unært minus bevares i et fortegnet felt', (_name, minus) => {
    expect(normalizePasteForDraft(`${minus}1200`, signed, '')).toBe('-1200');
  });

  it.each(TYPOGRAPHIC_MINUSES)('%s: unært minus springes over i et ikke-negativt felt – som ASCII-minus (§8.2)', (_name, minus) => {
    // Kontrasten: reglen for ASCII-minus er uændret, og det typografiske tegn følger den.
    expect(normalizePasteForDraft('-1200', nonNegative, '')).toBe('1200');
    expect(normalizePasteForDraft(`${minus}1200`, nonNegative, '')).toBe('1200');
  });

  it('normaliserer også i en åben draft, hvor familiens paste-filter ikke kører', () => {
    expect(normalizePasteForDraft('−1', nonNegative, '10')).toBe('-1');
  });

  it('AFGRÆNSNING: fritekst bevarer en tankestreg som indhold', () => {
    const text = createOptionalTextFieldCodec({ maxLength: 64 });
    expect(normalizePasteForDraft('2019–2020', text, '')).toBe('2019–2020');
  });
});

describe('AmountField (formular) – paste og tastning', () => {
  const renderBelob = () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { belob: undefined })), { origin: testRowOrigin() });
    render(
      <InputRuntimeProvider binding={makeBinding(store, catalog)}>
        <AmountField field={belobField.bind('r1')} location={testLocation('minus-form')} name="belob" />
      </InputRuntimeProvider>
    );
    return screen.getByRole('textbox') as HTMLInputElement;
  };

  it.each(TYPOGRAPHIC_MINUSES)('%s: indsat 10x1 bliver 9,00', (_name, minus) => {
    const input = renderBelob();
    paste(input, `10${minus}1`);
    expect(canonicalIn(store, catalog, belobField.bind('r1'))).toMatchObject({ value: 9 });
    expect(input).toHaveValue('9,00');
  });

  it.each(TYPOGRAPHIC_MINUSES)('%s: indsat 1200x200 bliver 1.000,00 (ikke 1.200.200,00)', (_name, minus) => {
    const input = renderBelob();
    paste(input, `1200${minus}200`);
    expect(canonicalIn(store, catalog, belobField.bind('r1'))).toMatchObject({ value: 1000 });
    expect(input).toHaveValue('1.000,00');
  });

  it('tastet U+2212 i en åben editor bliver ASCII-minus i draften og regnes som subtraktion', () => {
    const input = renderBelob();
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.change(input, { target: { value: '10' } });
    expect(input.readOnly, 'editoren skal være åben').toBe(false);
    input.setSelectionRange(2, 2);
    // Keydown-filteret ser det UOVERSATTE tegn og må ikke blokere det.
    expect(fireEvent.keyDown(input, { key: '−' }), 'tegnet må ikke blokeres').toBe(true);
    fireEvent.change(input, { target: { value: '10−1' } });
    expect(input).toHaveValue('10-1');
    fireEvent.blur(input);
    expect(canonicalIn(store, catalog, belobField.bind('r1'))).toMatchObject({ value: 9 });
  });

  it('tastet unært U+2212 afvises i et ikke-negativt felt – som ASCII-minus', () => {
    const input = renderBelob();
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '−1' } });
    expect(input).toHaveValue('1');
  });

  it.each(TYPOGRAPHIC_MINUSES)('%s: indsat x1200 bliver negativt i et fortegnet felt («Løn»)', (_name, minus) => {
    const { productionCatalog, productionStore, field } = setupSignedProductionRow();
    render(
      <InputRuntimeProvider binding={makeBinding(productionStore, productionCatalog)}>
        <AmountField field={field} location={testLocation('minus-signed-form')} name="col2" />
      </InputRuntimeProvider>
    );
    paste(screen.getByRole('textbox'), `${minus}1200`);
    expect(canonicalIn(productionStore, productionCatalog, field)).toMatchObject({ value: -1200 });
  });

  it('U+2212 som FØRSTE tast åbner et fortegnet felt med ASCII-minus', () => {
    const { productionCatalog, productionStore, field } = setupSignedProductionRow();
    render(
      <InputRuntimeProvider binding={makeBinding(productionStore, productionCatalog)}>
        <AmountField field={field} location={testLocation('minus-signed-first-key')} name="col2" />
      </InputRuntimeProvider>
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.keyDown(input, { key: '−' });
    expect(input.readOnly, 'editoren skal være åbnet af tasten').toBe(false);
    expect(input).toHaveValue('-');
  });
});

describe('GridAmountCell (tabel) – samme feltmotor', () => {
  const renderCell = (
    bindingStore: SlimInputStore,
    bindingCatalog: InputCatalog,
    field: FieldRef<import('../../../schemas/amountExpressionSchema').AmountValue | undefined>,
    editing: boolean,
    onRegister?: (handle: GridCellEditorHandle) => void,
  ) => {
    const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 0 };
    const gridStateStore: GridCoreStateStore = {
      subscribe: () => () => undefined,
      getFocusedCell: () => gridCell,
      getEditingCell: () => (editing ? gridCell : null),
    };
    render(
      <InputRuntimeProvider binding={makeBinding(bindingStore, bindingCatalog)}>
        <GridCoreProvider value={{
          gridStateStore,
          openEditing: () => undefined,
          closeEditing: () => undefined,
          registerEditor: (_cell, handle) => onRegister?.(handle),
          unregisterEditor: () => undefined,
          getEditor: () => null,
          requestFocusPlan: () => undefined,
        }}>
          <GridAmountCell gridCell={gridCell} cell={{ kind: 'existing', field, location: testLocation('minus-grid') }} />
        </GridCoreProvider>
      </InputRuntimeProvider>
    );
    return screen.getByRole('textbox') as HTMLInputElement;
  };

  it.each(TYPOGRAPHIC_MINUSES)('%s: indsat 10x1 i en lukket celle bliver 9', (_name, minus) => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { belob: undefined })), { origin: testRowOrigin() });
    const input = renderCell(store, catalog, belobField.bind('r1'), false);
    paste(input, `10${minus}1`);
    expect(canonicalIn(store, catalog, belobField.bind('r1'))).toMatchObject({ value: 9 });
  });

  it.each(TYPOGRAPHIC_MINUSES)('%s: indsat x1200 bliver negativt i en fortegnet celle', (_name, minus) => {
    const { productionCatalog, productionStore, field } = setupSignedProductionRow();
    const input = renderCell(productionStore, productionCatalog, field, false);
    paste(input, `${minus}1200`);
    expect(canonicalIn(productionStore, productionCatalog, field)).toMatchObject({ value: -1200 });
  });

  it('tastet U+2212 i en åben celle bliver ASCII-minus i draften', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { belob: undefined })), { origin: testRowOrigin() });
    let handle: GridCellEditorHandle | undefined;
    const input = renderCell(store, catalog, belobField.bind('r1'), true, (h) => { handle = h; });
    expect(prepareEdit(handle, '1')).toBe(true);
    fireEvent.change(input, { target: { value: '10' } });
    input.setSelectionRange(2, 2);
    expect(fireEvent.keyDown(input, { key: '−' }), 'tegnet må ikke blokeres').toBe(true);
    fireEvent.change(input, { target: { value: '10−1' } });
    expect(input).toHaveValue('10-1');
  });

  it('U+2212 som første tast åbner en fortegnet celle med ASCII-minus', () => {
    const { productionCatalog, productionStore, field } = setupSignedProductionRow();
    let handle: GridCellEditorHandle | undefined;
    const input = renderCell(productionStore, productionCatalog, field, true, (h) => { handle = h; });
    expect(prepareEdit(handle, '−')).toBe(true);
    expect(input).toHaveValue('-');
  });
});
