// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider } from '../../../inputCore/react';
import { PercentField, IntegerField, AmountField } from '../../../inputCore/react/fields';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, type InputCatalog } from '../../../inputCore';
import {
  createAmountFieldCodec,
  createIntegerFieldCodec,
  createPercentFieldCodec,
  createStringBackedFieldCodec,
} from '../../../inputCore/fieldCodecs';
import { codecAllowsNegative } from '../../../inputCore/react/fields/signPolicy';
import { productionInputFields, getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { aarsloenTableCol2Field } from '../../../inputCore/catalog/aarsloenDescriptors';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import { createTestCatalog, feriePctField, aargangField, belobField, makeRow, testRowOrigin, testLocation } from '../testCatalog';
import { insertRow } from '../../../inputCore/inputReducer';
import { dispatchInput } from '../../../inputCore/runtime';
import { createCollectionRef } from '../../../inputCore/fieldAddress';

/**
 * Et felts FORTEGNS-politik kommer fra dens descriptor – ét sted, samme svar på alle flader.
 *
 * **Fundet.** Brugeren kunne taste et minustegn som første tegn i et procentfelt, der ikke må være negativt.
 * Årsagen var ikke en manglende `false` på ét callsite: `allowNegative` var erklæret på hvert numerisk codec i
 * produktionskataloget og honoreret af INGENTING. Hver komponent hardkodede sit eget svar, og de var uenige –
 * `GridPercentCell` blokerede minus, `PercentField` tillod det, for de SAMME descriptorer.
 *
 * Testene måler derfor tre lag, fordi en rettelse kun i ét af dem ville efterlade fejlen et andet sted:
 *
 *  1. **codec-laget** – `signPolicy` og `acceptsInitialKey` afspejler den erklærede regel,
 *  2. **katalog-laget** – hvert numerisk produktionsfelt HAR en politik (ellers ville laget 3 måle ingenting),
 *  3. **surface-laget** – den ægte komponent blokerer tastetrykket i en åben editor.
 *
 * Og de pinner den bevidste AFGRÆNSNING: parse/settle er fortsat fortegns-blind (§1.6), så en negativ værdi
 * fra en indlæst `.eo`-fil stadig committes canonical og bærer sit røde bounds-issue frem for at blive
 * lydløst afvist.
 */

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

const renderField = (node: React.ReactNode) => {
  const binding = createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });
  return render(<InputRuntimeProvider binding={binding}>{node}</InputRuntimeProvider>);
};

describe('lag 1 – codecet bærer den erklærede fortegns-politik', () => {
  it('procent: allowNegative:false giver nonNegative og afviser minus som åbningstast', () => {
    const codec = createPercentFieldCodec({ allowNegative: false, allowDecimals: true, minValue: 0, maxValue: 100 });
    expect(codec.signPolicy).toBe('nonNegative');
    expect(codecAllowsNegative(codec)).toBe(false);
    expect(codec.acceptsInitialKey('-')).toBe(false);
    // Kontrasten: cifre og komma åbner stadig editoren, så afvisningen rammer FORTEGNET og ikke alt.
    expect(codec.acceptsInitialKey('5')).toBe(true);
    expect(codec.acceptsInitialKey(',')).toBe(true);
  });

  it('procent: allowNegative:true giver signed og tillader minus', () => {
    // Ankeret. Uden det kunne implementeringen have hardkodet `false` for HELE procentfamilien og bestå.
    const codec = createPercentFieldCodec({ allowNegative: true, allowDecimals: true });
    expect(codec.signPolicy).toBe('signed');
    expect(codec.acceptsInitialKey('-')).toBe(true);
  });

  it('heltal: politikken følger konfigurationen i begge retninger', () => {
    expect(createIntegerFieldCodec({ allowNegative: false, maxDigits: 4 }).acceptsInitialKey('-')).toBe(false);
    expect(createIntegerFieldCodec({ allowNegative: true, maxDigits: 4 }).acceptsInitialKey('-')).toBe(true);
  });

  it('string-backed adapter ARVER det indre codecs politik', () => {
    // Månedscellen (1..12) går gennem denne adapter. Uden viderestillingen ville den miste sin politik og
    // dermed få minus tilbage – netop den slags hul, en adapter let skaber.
    const inner = createIntegerFieldCodec({ allowNegative: false, maxDigits: 2, minValue: 1, maxValue: 12 });
    const adapted = createStringBackedFieldCodec(inner);
    expect(adapted.signPolicy).toBe('nonNegative');
    expect(adapted.acceptsInitialKey('-')).toBe(false);
  });

  it('beløb: minus åbner ikke et tomt ikke-negativt felt som ugyldigt fortegn', () => {
    const codec = createAmountFieldCodec({ allowNegative: false, allowDecimals: true });
    expect(codec.signPolicy).toBe('nonNegative');
    expect(codec.acceptsInitialKey('-')).toBe(false);
  });

  it('AFGRÆNSNING: parse/settle er fortsat fortegns-blind (§1.6)', () => {
    // En negativ værdi fra en indlæst .eo-fil skal committes canonical og bære sit røde bounds-issue – ikke
    // blive afvist som råtekst. Fjernedes denne egenskab, ville data kunne gå tabt ved load.
    const codec = createPercentFieldCodec({ allowNegative: false, allowDecimals: true, minValue: 0, maxValue: 100 });
    expect(codec.parseForSettle('-5')).toEqual({ status: 'valid', value: -5 });
  });
});

describe('lag 2 – hvert numerisk produktionsfelt ERKLÆRER en politik', () => {
  /**
   * Uden dette ben kunne surface-testene være grønne, mens et produktionsfelt manglede sin politik og derfor
   * fail-open'ede til "minus tilladt". Det er samtidig værnet mod et NYT numerisk felt uden politik: laget
   * udleder sin egen liste fra det ægte katalog frem for en hånd-vedligeholdt opremsning.
   */
  const NUMERIC_FAMILIES = new Set(['integer', 'amount', 'percent']);

  it('ingen numerisk descriptor i produktionskataloget mangler signPolicy', () => {
    const missing = productionInputFields
      .filter((field) => NUMERIC_FAMILIES.has(field.codec.family) && field.codec.signPolicy === undefined)
      .map((field) => `${field.id} (${field.codec.family})`);
    expect(missing, 'numeriske felter uden fortegns-politik').toEqual([]);
  });

  it('alle procent-felter i produktionen er ikke-negative', () => {
    const signedPercents = productionInputFields
      .filter((field) => field.codec.family === 'percent' && field.codec.signPolicy !== 'nonNegative')
      .map((field) => field.id);
    expect(signedPercents, 'et procentfelt må ikke kunne være negativt').toEqual([]);
  });

  it('de fortegnede felter er UDELUKKENDE beløbsfelter (ankeret mod "alt er nonNegative")', () => {
    // Var alt `nonNegative`, ville testen ovenfor bestå trivielt. Dette ben beviser, at politikken faktisk
    // VARIERER i produktionen – og at variationen kun findes i beløbsfamilien.
    const signed = productionInputFields
      .filter((field) => NUMERIC_FAMILIES.has(field.codec.family) && field.codec.signPolicy === 'signed');
    expect(signed.length).toBeGreaterThan(0);
    expect([...new Set(signed.map((field) => field.codec.family))]).toEqual(['amount']);
  });
});

describe('lag 3 – den ægte komponent blokerer tastetrykket', () => {
  /**
   * Åbner editoren og returnerer inputtet. Et lukket greenfield-felt er `readOnly`, og dets tegnfilter er
   * ikke tilkoblet – en test, der taster på et LUKKET felt, ville derfor være grøn uanset politikken. Det var
   * netop den fælde, den første reproduktion af dette fund faldt i.
   */
  const openEditor = (): HTMLInputElement => {
    const input = screen.getByRole('textbox') as HTMLInputElement;
    // Et ciffer er en accepteret åbningstast for alle tre familier (§1.3). Vi åbner MED et ciffer frem for
    // med minus, så testen nedenfor måler tegnfilteret i en ÅBEN editor og ikke bare `acceptsInitialKey`
    // (som lag 1 allerede dækker) – de to mekanismer skal begge holde.
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.change(input, { target: { value: '1' } });
    expect(input.readOnly, 'editoren skulle være åben, ellers måler testen ingenting').toBe(false);
    return input;
  };

  /**
   * `fireEvent.keyDown` returnerer `false`, når en handler kaldte `preventDefault()` – altså blokerede.
   *
   * **Caret'en flyttes til 0 først, og det er afgørende.** Tegnfilteret vurderer den RESULTERENDE tekst: et
   * minus efter et ciffer giver `"1-"`, som mønsteret afviser uanset fortegns-politikken. En test, der tastede
   * minus dér, ville derfor være grøn, selv med politikken slået fra – netop den fælde, den første udgave af
   * denne test faldt i, og som en mutationstest af `PercentField` afslørede. Ved caret 0 er resultatet `"-1"`,
   * som ALENE afgøres af politikken.
   */
  const keyWasBlockedAtStart = (input: HTMLInputElement, key: string): boolean => {
    input.setSelectionRange(0, 0);
    return !fireEvent.keyDown(input, { key });
  };

  it('PercentField blokerer minus i et ikke-negativt felt (brugerens symptom)', () => {
    renderField(<PercentField field={feriePctField.bind()} location={testLocation('pct-1')} name="feriePct" />);
    const input = openEditor();

    expect(keyWasBlockedAtStart(input, '-'), 'minus skulle være blokeret').toBe(true);
    // Kontrasten i SAMME felt: et ciffer slipper igennem, så blokeringen rammer fortegnet og ikke tastaturet.
    expect(keyWasBlockedAtStart(input, '5'), 'et ciffer må ikke blokeres').toBe(false);
  });

  it('IntegerField blokerer minus i et ikke-negativt felt', () => {
    renderField(<IntegerField field={aargangField.bind()} location={testLocation('int-1')} name="aargang" />);
    const input = openEditor();

    expect(keyWasBlockedAtStart(input, '-')).toBe(true);
    expect(keyWasBlockedAtStart(input, '5')).toBe(false);
  });

  /**
   * Ankeret på surface-laget: `AmountField` LÆSER politikken frem for at blokere minus generelt.
   *
   * Feltet er et PRODUKTIONSFELT – en af årslønstabellens beløbskolonner, som er de eneste fortegnede felter
   * i kataloget (jf. lag 2). Testkatalogets eget `belobField` er `allowNegative: false` og kunne derfor ikke
   * bære denne case; det opdagede netop denne test, da den blev mutationstestet.
   */
  it('AmountField tillader minus i et FORTEGNET produktionsbeløbsfelt', () => {
    const productionCatalog = getProductionInputCatalog();
    const productionStore = __createSlimInputTestStore();
    const productionRegistry = new ActiveEditorRegistry();
    const tableRef = createCollectionRef({ section: 'aarsloen', path: [], collection: 'tableData' });
    dispatchInput(
      productionStore,
      productionCatalog,
      insertRow(tableRef, createEmptyStandardLoenRow('r1')),
      { origin: testRowOrigin('tableData') }
    );

    const binding = createInputRuntimeBinding(productionStore, productionCatalog, productionRegistry, () => {
      const state = productionStore.getState();
      return createInputEvaluation({
        input: state.input,
        catalog: productionCatalog,
        sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
      });
    });
    render(
      <InputRuntimeProvider binding={binding}>
        <AmountField
          field={aarsloenTableCol2Field.bind('r1')}
          location={testLocation('amt-1')}
          name="col2"
        />
      </InputRuntimeProvider>
    );

    expect(codecAllowsNegative(aarsloenTableCol2Field.codec), 'feltet skal VÆRE fortegnet').toBe(true);
    const input = openEditor();
    expect(keyWasBlockedAtStart(input, '-'), 'et fortegnet beløbsfelt må kunne bruge minus').toBe(false);
  });

  it('AmountField blokerer det UNÆRE minus i et ikke-negativt beløbsfelt', () => {
    // Den anden halvdel af beløbs-afgrænsningen: politikken virker også her, selv om `acceptsInitialKey`
    // bevidst tillader `-` (subtraktion). Tegnfilteret er det, der skelner.
    const rentekravRef = createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });
    dispatchInput(store, catalog, insertRow(rentekravRef, makeRow('r1')), { origin: testRowOrigin() });
    renderField(<AmountField field={belobField.bind('r1')} location={testLocation('amt-2')} name="belob" />);

    expect(codecAllowsNegative(belobField.codec), 'feltet skal være ikke-negativt').toBe(false);
    const input = openEditor();
    expect(keyWasBlockedAtStart(input, '-'), 'unært minus skal blokeres i et ikke-negativt beløbsfelt').toBe(true);
  });
});
