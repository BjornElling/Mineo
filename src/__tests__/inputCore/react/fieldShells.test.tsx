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
  testRowOrigin, testLocation } from '../testCatalog';
import type { TillaegstidEnhed } from '../../../schemas/formSchemas/enumSchemas';
import { FIELD_ISSUE_GENERIC_TOOLTIP } from '../../../inputCore/inputIssue';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';

// Feltskallerne (§2.4/§3.5). De numeriske presets er tynde over den allerede-testede
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

describe('numeriske feltpresets', () => {
  it('IntegerField viser committed heltalsværdi', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'));
    renderField(<IntegerField field={aargangField.bind()} location={testLocation('int-1')} name="aargang" />);
    expect(screen.getByRole('textbox')).toHaveValue('2020');
  });

  it('PercentField viser "%"-adornment', () => {
    // aargang er et number|undefined-felt; procent-skallen accepterer samme værditype (adornment-smoke).
    renderField(<PercentField field={aargangField.bind()} location={testLocation('pct-1')} name="pct" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('AmountField viser "kr."-adornment', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')), { origin: testRowOrigin() });
    renderField(<AmountField field={belobField.bind('r1')} location={testLocation('amt-1')} name="belob" />);
    expect(screen.getByText('kr.')).toBeInTheDocument();
  });
});

// ── Ciffergrænsen er WIRED til de faktiske felter (§2.2) ──
//
// Disse tests findes, fordi `inputKeyFilters.amount.test.ts` kalder filteret DIREKTE og derfor ikke kan
// se, om de virkelige komponenter faktisk sender grænsen med. Målt: en mutation, der satte
// `maxIntegerDigits: 99` i `charLengthPolicy`, lod alle 775 øvrige inputtests være grønne. Formular og
// grid prøves hver for sig — det var netop en form/grid-uenighed, der lod den 3. decimal passere i en
// formular, men ikke i en celle.

/**
 * Åbner editoren, sætter draften til `seed` og spørger om `key` ville blive BLOKERET af feltets eget
 * tegnfilter. Vi måler `keyDown`'s returværdi (falsk = `preventDefault` blev kaldt) frem for at
 * inspicere `input.value` bagefter: elementet er kontrolleret af draft-state, så en `change`, der
 * efterligner browserens indsættelse, ville måle vores egen testkode i stedet for filteret.
 *
 * Editoren SKAL være åben først. På et lukket felt kalder `useFormFieldSurface.onKeyDown` selv
 * `preventDefault` for enhver tast, codec'en accepterer som første tegn (tast-initieret åbning, §1.3) —
 * en tidligere version af denne helper målte derfor editor-åbningen og ikke ciffergrænsen.
 */
const isKeyBlockedByField = (input: HTMLInputElement, seed: string, key: string): boolean => {
  // Felterne rendres med `singleStageClick`, så mousedown+click åbner editoren i ét trin.
  fireEvent.mouseDown(input);
  fireEvent.click(input);
  // Sanity: uden en åben editor måler resten af helperen den forkerte mekanisme.
  expect(input.readOnly).toBe(false);
  fireEvent.change(input, { target: { value: seed } });
  input.setSelectionRange(seed.length, seed.length);
  return !fireEvent.keyDown(input, { key });
};

describe('beløbsfelters ciffergrænse er koblet til komponenterne', () => {
  // Testkatalogets `belobField` har `maxValue: 1_000_000`. Cifrene måles derfor med et talled i et
  // UDTRYK: `filterAmountExpressionKeyDown` vurderer kun ciffer-LÆNGDEN pr. talled, mens en talværdi-
  // grænse hører til feltvalidatoren på den committede værdi (§1.6). Uden det ville testen måle
  // feltets maksimum i stedet for ciffergrænsen — to konkurrerende mekanismer.

  it('AmountField (formular) blokerer det 8. heltalsciffer i et talled', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')), { origin: testRowOrigin() });
    renderField(<AmountField field={belobField.bind('r1')} location={testLocation('amt-1')} name="belob" singleStageClick />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(isKeyBlockedByField(input, '0+9999999', '9')).toBe(true);
  });

  it('AmountField (formular) tillader det 7. heltalsciffer i et talled', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')), { origin: testRowOrigin() });
    renderField(<AmountField field={belobField.bind('r1')} location={testLocation('amt-2')} name="belob" singleStageClick />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Kontrolgruppe: uden denne ville en mutation, der blokerede ALT, se ud som en bestået grænse.
    expect(isKeyBlockedByField(input, '0+999999', '9')).toBe(false);
  });

  it('AmountField (formular) blokerer den 3. decimal', () => {
    // Formularen sendte tidligere INTET decimalloft, mens grid-cellen sendte 2 — samme felt-familie,
    // to adfærd. Denne test er den, der ville være blevet rød dengang.
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')), { origin: testRowOrigin() });
    renderField(<AmountField field={belobField.bind('r1')} location={testLocation('amt-3')} name="belob" singleStageClick />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(isKeyBlockedByField(input, '12,34', '5')).toBe(true);
    // Kontrolgruppe: den 2. decimal skal fortsat kunne tastes.
    expect(isKeyBlockedByField(input, '12,3', '4')).toBe(false);
  });
});

describe('flerlinjet tekstfelt', () => {
  it('behandler Enter som tekst og settler først ved blur', () => {
    renderField(
      <MultilineTextField
        field={kommentarerField.bind()}
        location={testLocation('kommentarer-1')}
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

describe('immediate-commit control (radio)', () => {
  it('RadioField committer det valgte som setImmediateField', () => {
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1', { enhed: 'dage' })), { origin: testRowOrigin() });
    renderField(
      <RadioField<TillaegstidEnhed>
        field={enhedField.bind('r1')}
        location={testLocation('radio-1')}
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

describe('grid-felt', () => {
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
            cell={{ kind: 'existing', field: belobField.bind('r1'), location: testLocation('r1:belob') }}
          />
        </GridCoreProvider>
      </InputRuntimeProvider>
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    // De TO tekster er forskellige for et `format`-issue (brugerkrav 2026-07-30): a11y-teksten er den fulde
    // besked med citeret feltnavn, mens tooltippet er den generiske. Begge assertes, så en fremtidig ændring
    // ikke kan lade den ene overtage den anden.
    expect(screen.getByText("Der er udfyldt en ugyldig værdi i feltet 'Beløb'")).toBeInTheDocument();
    expect(screen.getByLabelText(FIELD_ISSUE_GENERIC_TOOLTIP)).toBeInTheDocument();
  });

  it('lukket grid-paste med kun ugyldige tegn er no-op og sletter ikke canonical input', () => {
    const rowId = 'r1';
    const gridCell: GridCellCoord = { rowId, colIndex: 0 };
    const originalAmount = { kind: 'number' as const, value: 100 };
    dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow(rowId, { belob: originalAmount })), {
      origin: testRowOrigin(),
    });

    const binding = makeBinding();
    const gridStateStore: GridCoreStateStore = {
      subscribe: () => () => undefined,
      getFocusedCell: () => gridCell,
      getEditingCell: () => null,
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
            cell={{ kind: 'existing', field: belobField.bind(rowId), location: testLocation('r1:belob') }}
          />
        </GridCoreProvider>
      </InputRuntimeProvider>
    );

    const input = screen.getByRole('textbox');
    fireEvent.paste(input, { clipboardData: { getData: () => 'abc' } });

    expect(canonical(belobField.bind(rowId))).toEqual(originalAmount);
  });
});
