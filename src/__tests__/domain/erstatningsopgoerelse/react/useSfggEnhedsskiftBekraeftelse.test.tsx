// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from '../../../../inputCore/react';
import { ChoiceField, ToggleField } from '../../../../inputCore/react/fields';
import { createInputEvaluation, createValidationReader } from '../../../../inputCore/inputReader';
import { createEvaluationSourceToken, type InputCatalog } from '../../../../inputCore';
import { insertRow } from '../../../../inputCore/inputReducer';
import { buildFieldHistoryOrigin } from '../../../../inputCore/editor/fieldEditorEngine';
import ConfirmationDialog from '../../../../components/ui/ConfirmationDialog';
import {
  SFGG_ENHEDSSKIFT_CONFIRM_TEXT,
  SFGG_ENHEDSSKIFT_DIALOG_TITLE,
  useSfggEnhedsskiftBekraeftelse,
} from '../../../../domain/erstatningsopgoerelse/react/useSfggEnhedsskiftBekraeftelse';
import { medAnsaettelsesforholdValg } from '../../../../domain/erstatningsopgoerelse/sfggFravaersdageEnhedsskift';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';
import { toISODateString } from '../../../../types/branded';
import {
  createTestCatalog,
  enhedField,
  makeRow,
  omregningField,
  rentekravRowsRef,
  testLocation,
  testRowOrigin,
} from '../../../inputCore/testCatalog';

// Et valg, der skifter fraværsdagenes enhed, committes først efter bekræftelse – med præcis den dispatch,
// feltet selv ville have sendt. Feltadapterne er de ægte (`ChoiceField`/`ToggleField`); sagen, bekræftelsen
// sammenligner, er en EO-sag med 7 fraværsdage på Firma A, hvor testens «skiftende» værdi slår «Løn på
// helligdage» over i «Ingen».

let catalog: InputCatalog;
let store: SlimInputStore;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
});
afterEach(() => sessionStorage.clear());

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, new ActiveEditorRegistry(), () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

const foer: ErstatningsopgoerelseValues = {
  ...structuredClone(createErstatningsopgoerelseInitialValues()),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: toISODateString('2023-01-01'),
  tafBeregningsperiodeTil: toISODateString('2023-12-31'),
  loenindkomstAnsaettelsesforhold: [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'a',
    navnPaaArbejdssted: 'Firma A',
    loenperiode: 'maaned',
    loenPaaHelligdage: 'Almindelig løn',
    fuldLoenUnderFerie: 'Ja',
    indtaegtsoplysningerTableData: [{
      id: 'row-1', col0_maaned: '1', col1_maaned: '2023', col0_uge: '', col1_uge: '',
      col0_dag: undefined, col1_dag: undefined, col2: { kind: 'number', value: 30000 },
      col3: undefined, col4: undefined, col5: undefined,
    }],
  }],
  sfggAnsaettelsesforhold: [{
    ansaettelsesforholdId: 'a',
    sfggBeregningskilde: 'Ferieloven',
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: 7,
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  }],
};
const skiftet = medAnsaettelsesforholdValg(foer, 'a', { loenPaaHelligdage: 'Ingen' });

const enhedLocation = testLocation('loc-enhed');
const omregningLocation = testLocation('loc-omregning');

const Harness = () => {
  const bekraeftelse = useSfggEnhedsskiftBekraeftelse(foer);
  const enhedRef = enhedField.bind('r1');
  return (
    <>
      <ChoiceField
        field={enhedRef}
        location={enhedLocation}
        name="enhed"
        immediateCommitOverride={bekraeftelse.choiceOverride({
          field: enhedRef,
          location: enhedLocation,
          // «uger» skifter enheden; «måneder» gør ikke.
          efter: (value) => (value === 'uger' ? skiftet : foer),
        })}
      >
        <option value="dage">Dage</option>
        <option value="uger">Uger</option>
        <option value="maaneder">Måneder</option>
      </ChoiceField>
      <ToggleField
        field={omregningField.bind()}
        location={omregningLocation}
        name="omregning"
        ariaLabel="Omregning"
        commit={bekraeftelse.toggleOverride({
          field: omregningField.bind(),
          location: omregningLocation,
          efter: (value) => (value ? skiftet : foer),
        })}
      />
      <ConfirmationDialog
        {...bekraeftelse.dialogProps}
        title={SFGG_ENHEDSSKIFT_DIALOG_TITLE}
        confirmText={SFGG_ENHEDSSKIFT_CONFIRM_TEXT}
        cancelText="Annuller"
      />
    </>
  );
};

const renderHarness = () => {
  dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1', { enhed: 'dage' })), { origin: testRowOrigin() });
  render(
    <InputRuntimeProvider binding={makeBinding()}>
      <Harness />
    </InputRuntimeProvider>
  );
  return screen.getByRole('combobox');
};

const reader = () => createValidationReader(store.getState().input, catalog);
const historyDepth = () => store.getState().history.past.length;
const latestOrigin = () => store.getState().history.past.at(-1)?.origin;
const BESKED = 'Fraværsdagene uden løn (7 på Firma A) tælles herefter som arbejdsdage. Kontrollér antallet.';

describe('useSfggEnhedsskiftBekraeftelse', () => {
  it('dropdown: Annuller beholder det gamle valg og skriver intet', async () => {
    const combobox = renderHarness();
    await act(async () => combobox.focus());
    const depth = historyDepth();

    fireEvent.keyDown(combobox, { key: 'u' });

    expect(await screen.findByText(BESKED)).toBeInTheDocument();
    expect(reader().readCanonical(enhedField.bind('r1'))).toBe('dage');
    fireEvent.click(screen.getByRole('button', { name: 'Annuller' }));

    await waitFor(() => expect(screen.queryByText(BESKED)).not.toBeInTheDocument());
    expect(reader().readCanonical(enhedField.bind('r1'))).toBe('dage');
    expect(historyDepth()).toBe(depth);
  });

  it('dropdown: bekræftelsen committer valget som ét almindeligt felt-undo-trin', async () => {
    const combobox = renderHarness();
    await act(async () => combobox.focus());
    const depth = historyDepth();

    fireEvent.keyDown(combobox, { key: 'u' });
    fireEvent.click(await screen.findByRole('button', { name: SFGG_ENHEDSSKIFT_CONFIRM_TEXT }));

    expect(reader().readCanonical(enhedField.bind('r1'))).toBe('uger');
    expect(historyDepth()).toBe(depth + 1);
    // Samme origin som feltets egen immediate-commit – undo/redo navigerer og refokuserer derfor ens.
    expect(latestOrigin()).toEqual(buildFieldHistoryOrigin(enhedLocation, enhedField.bind('r1')));
  });

  it('dropdown: et valg uden enhedsskift committes straks uden spørgsmål', async () => {
    const combobox = renderHarness();
    await act(async () => combobox.focus());

    fireEvent.keyDown(combobox, { key: 'm' });

    expect(reader().readCanonical(enhedField.bind('r1'))).toBe('maaneder');
    expect(screen.queryByText(BESKED)).not.toBeInTheDocument();
  });

  it('toggle: Annuller lader kontakten stå; bekræftelsen slår den til', async () => {
    renderHarness();
    const toggle = screen.getByRole('checkbox', { name: 'Omregning' });

    fireEvent.click(toggle);
    expect(await screen.findByText(BESKED)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuller' }));
    await waitFor(() => expect(screen.queryByText(BESKED)).not.toBeInTheDocument());
    // Sektionen findes ikke endnu: intet er skrevet.
    expect(reader().readCanonical(omregningField.bind())).toBeFalsy();
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    fireEvent.click(await screen.findByRole('button', { name: SFGG_ENHEDSSKIFT_CONFIRM_TEXT }));
    expect(reader().readCanonical(omregningField.bind())).toBe(true);
    expect(latestOrigin()).toEqual(buildFieldHistoryOrigin(omregningLocation, omregningField.bind()));
  });
});
