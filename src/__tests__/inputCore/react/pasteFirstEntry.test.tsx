// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider } from '../../../inputCore/react';
import { AmountField, DateField, GridAmountCell } from '../../../inputCore/react/fields';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, createCollectionRef, type InputCatalog, type FieldRef } from '../../../inputCore';
import { insertRow } from '../../../inputCore/inputReducer';
import {
  createAmountFieldCodec,
  createDateFieldCodec,
  createIntegerFieldCodec,
  createOptionalTextFieldCodec,
  createPercentFieldCodec,
  createYearFieldCodec,
} from '../../../inputCore/fieldCodecs';
import { normalizePasteForDraft } from '../../../inputCore/react/pasteSplice';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import {
  createTestCatalog,
  belobField,
  beregningsdatoField,
  makeRow,
  testRowOrigin,
  testLocation,
} from '../testCatalog';

/**
 * BB-439 (§1.2a punkt 8): Tab og Enter afslutter en TASTET indtastning, så en tabulator eller et linjeskift i
 * en indsat tekst afslutter den INDSATTE. `1200<TAB>200` fra to regnearksceller blev før 1.200.200,00, fordi
 * tegnfilteret tavst sprang adskillelsen over. Frie tekstfelter er ikke omfattet.
 */

const TWO_CELLS = [
  ['tabulator', '1200\t200'],
  ['linjeskift', '1200\n200'],
  ['Windows-linjeskift', '1200\r\n200'],
] as const;

const SINGLE_CELL = [
  ['afsluttende linjeskift fra én celle', '1200\r\n'],
  ['indledende linjeskift', '\r\n1200'],
  ['indledende mellemrum og tabulator', ' \t1200'],
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

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const rentekravRef = () => createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });

const paste = (input: HTMLElement, text: string) =>
  fireEvent.paste(input, { clipboardData: { getData: () => text } });

describe('normalizePasteForDraft – første indtastning (BB-439)', () => {
  const amount = createAmountFieldCodec({ allowNegative: false, allowDecimals: true });

  it.each(TWO_CELLS)('beløb: %s mellem to celler giver kun den første', (_name, text) => {
    expect(normalizePasteForDraft(text, amount, '')).toBe('1200');
  });

  it.each(SINGLE_CELL)('beløb: %s giver stadig værdien', (_name, text) => {
    expect(normalizePasteForDraft(text, amount, '')).toBe('1200');
  });

  it('gælder også en splice i en åben draft, så samme paste giver samme tekst (§1.2a punkt 7)', () => {
    expect(normalizePasteForDraft('1\t200', amount, '20')).toBe('1');
  });

  it('gælder dato-, tal-, procent- og årsfelter', () => {
    expect(normalizePasteForDraft('01-02-2026\t15-03-2026', createDateFieldCodec({ twoDigitYearPolicy: 'infer' }), ''))
      .toBe('01-02-2026');
    expect(normalizePasteForDraft('12\n34', createIntegerFieldCodec({ allowNegative: false, maxDigits: 4 }), ''))
      .toBe('12');
    expect(normalizePasteForDraft('12,5\t3', createPercentFieldCodec({ allowNegative: false, allowDecimals: true }), ''))
      .toBe('12,5');
    expect(normalizePasteForDraft('2020\r\n2021', createYearFieldCodec({ minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' }), ''))
      .toBe('2020');
  });

  it('AFGRÆNSNING: fritekst og kommentarfelter er uændrede', () => {
    expect(normalizePasteForDraft('a\tb\nc', createOptionalTextFieldCodec({ maxLength: 64 }), '')).toBe('a b c');
    expect(normalizePasteForDraft('a\nb', createOptionalTextFieldCodec({ maxLength: 64, preservesLineBreaks: true }), ''))
      .toBe('a\nb');
  });
});

describe('AmountField (formular) – indsættelse fra regneark', () => {
  const renderBelob = () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { belob: undefined })), { origin: testRowOrigin() });
    render(
      <InputRuntimeProvider binding={makeBinding(store, catalog)}>
        <AmountField field={belobField.bind('r1')} location={testLocation('paste-first-form')} name="belob" />
      </InputRuntimeProvider>
    );
    return screen.getByRole('textbox') as HTMLInputElement;
  };

  it.each([...TWO_CELLS, ...SINGLE_CELL])('%s committer 1.200,00', (_name, text) => {
    const input = renderBelob();
    paste(input, text);
    expect(canonical(belobField.bind('r1'))).toEqual({ kind: 'number', value: 1200 });
    expect(input).toHaveValue('1.200,00');
  });

  it('en indsættelse med kun adskillelser er et no-op og bevarer værdien (§1.2a punkt 6)', () => {
    const input = renderBelob();
    paste(input, '500');
    paste(input, '\r\n\t');
    expect(canonical(belobField.bind('r1'))).toEqual({ kind: 'number', value: 500 });
  });
});

describe('GridAmountCell (tabel) – indsættelse fra regneark', () => {
  const renderCell = (field: FieldRef<AmountValue | undefined>) => {
    const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 0 };
    const gridStateStore: GridCoreStateStore = {
      subscribe: () => () => undefined,
      getFocusedCell: () => gridCell,
      getEditingCell: () => null,
    };
    render(
      <InputRuntimeProvider binding={makeBinding(store, catalog)}>
        <GridCoreProvider value={{
          gridStateStore,
          openEditing: () => undefined,
          closeEditing: () => undefined,
          registerEditor: () => undefined,
          unregisterEditor: () => undefined,
          getEditor: () => null,
          requestFocusPlan: () => undefined,
        }}>
          <GridAmountCell gridCell={gridCell} cell={{ kind: 'existing', field, location: testLocation('paste-first-grid') }} />
        </GridCoreProvider>
      </InputRuntimeProvider>
    );
    return screen.getByRole('textbox') as HTMLInputElement;
  };

  it.each([...TWO_CELLS, ...SINGLE_CELL])('%s i en lukket celle committer 1200', (_name, text) => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { belob: undefined })), { origin: testRowOrigin() });
    const input = renderCell(belobField.bind('r1'));
    paste(input, text);
    expect(canonical(belobField.bind('r1'))).toEqual({ kind: 'number', value: 1200 });
  });
});

describe('DateField – indsættelse fra regneark', () => {
  it('to datoceller giver kun den første dato', () => {
    render(
      <InputRuntimeProvider binding={makeBinding(store, catalog)}>
        <DateField field={beregningsdatoField.bind()} location={testLocation('paste-first-date')} name="beregningsdato" />
      </InputRuntimeProvider>
    );
    paste(screen.getByRole('textbox'), '01-02-2026\t15-03-2026\r\n');
    expect(canonical(beregningsdatoField.bind())).toBe(toISODateString('2026-02-01'));
  });
});
