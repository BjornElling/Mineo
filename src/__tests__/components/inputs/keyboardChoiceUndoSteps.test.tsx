// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from '../../../inputCore/react';
import { ChoiceField, RadioField } from '../../../inputCore/react/fields';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createCollectionRef,
  type InputCatalog,
} from '../../../inputCore';
import { insertRow } from '../../../inputCore/inputReducer';
import {
  createTestCatalog,
  enhedField,
  makeRow,
  testRowOrigin,
  testLocation,
} from '../../inputCore/testCatalog';

// BRUGERBESLUTNING 2026-08-15 (`input-field-behavior-contract.md` §2.6 og §2.7):
//
//   «Hvert tastetryk, der ændrer valget, er sin egen handling i undo/redo.»
//
// Reglen gælder BEGGE tastaturbetjente valg-kontroller – dropdownens bogstav-cykling og radiogruppens
// pil-/mellemrums-valg. Hvert tryk sætter en ny, fuldgyldig værdi på feltet, og hver af dem skal kunne
// fortrydes for sig. Det er IKKE en manglende sammenlægning af undo-trin, og det må ikke senere rejses
// som en potentiel fejl.
//
// Testen findes for at gøre beslutningen målbar frem for kun beskrevet: uden den kunne en fremtidig
// «forbedring», der slog trinene sammen, glide igennem uden at noget blev rødt. Begge kontroller måles i
// SAMME fil, fordi de deler én regel – ikke to regler, der tilfældigvis ligner hinanden.

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

const rentekravRef = () =>
  createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

const undoDepth = (): number => store.getState().history.past.length;

const canonicalEnhed = (): string =>
  createValidationReader(store.getState().input, catalog).readCanonical(enhedField.bind('r1'));

/**
 * Enhed-feltet har tre valgmuligheder, hvoraf INGEN deler forbogstav – derfor bruges tre forskellige
 * bogstaver til at efterligne den cykling, `Arbejdssituation` giver med ét gentaget bogstav. Det, reglen
 * handler om, er antallet af TASTEDREVNE ÆNDRINGER, ikke hvilket bogstav der udløste dem.
 */
const renderEnhedDropdown = () => {
  dispatchInput(
    store,
    catalog,
    insertRow(rentekravRef(), makeRow('r1', { enhed: 'dage' })),
    { origin: testRowOrigin() }
  );
  render(
    <InputRuntimeProvider binding={makeBinding()}>
      <ChoiceField
        field={enhedField.bind('r1')}
        location={testLocation('loc-enhed')}
        name="enhed"
      >
        <option value="dage">Dage</option>
        <option value="uger">Uger</option>
        <option value="maaneder">Måneder</option>
      </ChoiceField>
    </InputRuntimeProvider>
  );
  return screen.getByRole('combobox');
};

describe('dropdown: hvert tastedrevet valg er sit eget undo-trin (§2.6, brugerbeslutning)', () => {
  it('to bogstavtryk i en LUKKET dropdown giver to fortryd-trin', () => {
    const combobox = renderEnhedDropdown();
    act(() => combobox.focus());
    const before = undoDepth();

    fireEvent.keyDown(combobox, { key: 'u' });
    expect(canonicalEnhed()).toBe('uger');
    expect(undoDepth()).toBe(before + 1);

    fireEvent.keyDown(combobox, { key: 'm' });
    expect(canonicalEnhed()).toBe('maaneder');
    expect(
      undoDepth(),
      'hvert tastedrevet valg skal være sit eget undo-trin – trinene må IKKE lægges sammen',
    ).toBe(before + 2);
  });

  it('et tryk, der ikke ændrer valget, giver intet trin (det er ændringen der tæller)', () => {
    const combobox = renderEnhedDropdown();
    act(() => combobox.focus());

    fireEvent.keyDown(combobox, { key: 'u' });
    const afterFirst = undoDepth();

    // Samme bogstav igen: 'Uger' er den eneste mulighed på U, så valget er uændret.
    fireEvent.keyDown(combobox, { key: 'u' });

    expect(canonicalEnhed()).toBe('uger');
    expect(undoDepth()).toBe(afterFirst);
  });

  it('bogstavtryk i en ÅBEN menu flytter kun markeringen og committer intet', () => {
    const combobox = renderEnhedDropdown();
    fireEvent.click(combobox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const before = undoDepth();

    fireEvent.keyDown(combobox, { key: 'm' });

    expect(canonicalEnhed()).toBe('dage');
    expect(undoDepth()).toBe(before);
  });

  it('kontrollen kan FEJLE: uden et tastedrevet valg stiger dybden ikke af sig selv', () => {
    // Uden denne kontrast kunne testene ovenfor bestå af, at dybden voksede ved enhver render.
    const combobox = renderEnhedDropdown();
    act(() => combobox.focus());
    const before = undoDepth();
    fireEvent.keyDown(combobox, { key: 'z' });
    expect(undoDepth()).toBe(before);
  });
});

/**
 * Radiogruppens ben af samme regel.
 *
 * Måles på mellemrumstasten, fordi den er den ENE tastevej, der virker på en fokuseret radio uden et
 * omgivende `Container` (browserens egen radio-semantik → `change` → `onCommit`). Enter og piletasterne
 * ender i præcis samme commit: `useContainerKeyboardNavigation` oversætter dem til et `click()` på den
 * valgte radio, og den vej er dækket af `Container.test.tsx` («Enter på radiobutton …», «pil+wrap i
 * radiogruppe»). Antallet af history-trin afgøres derfor det samme sted, uanset hvilken tast der brugtes.
 */
const renderEnhedRadio = () => {
  dispatchInput(
    store,
    catalog,
    insertRow(rentekravRef(), makeRow('r1', { enhed: 'dage' })),
    { origin: testRowOrigin() }
  );
  render(
    <InputRuntimeProvider binding={makeBinding()}>
      <RadioField
        field={enhedField.bind('r1')}
        location={testLocation('loc-enhed-radio')}
        name="enhed-radio"
        options={[
          { value: 'dage', label: 'Dage' },
          { value: 'uger', label: 'Uger' },
          { value: 'maaneder', label: 'Måneder' },
        ]}
      />
    </InputRuntimeProvider>
  );
};

describe('radiogruppe: hvert tastedrevet valg er sit eget undo-trin (§2.7, brugerbeslutning)', () => {
  it('to tastedrevne valg giver to fortryd-trin', async () => {
    const user = userEvent.setup();
    renderEnhedRadio();
    const before = undoDepth();

    act(() => screen.getByRole('radio', { name: 'Uger' }).focus());
    await user.keyboard(' ');
    expect(canonicalEnhed()).toBe('uger');
    expect(undoDepth()).toBe(before + 1);

    act(() => screen.getByRole('radio', { name: 'Måneder' }).focus());
    await user.keyboard(' ');
    expect(canonicalEnhed()).toBe('maaneder');
    expect(
      undoDepth(),
      'hvert tastedrevet radiovalg skal være sit eget undo-trin – trinene må IKKE lægges sammen',
    ).toBe(before + 2);
  });

  it('et tryk på den ALLEREDE valgte option giver intet trin (det er ændringen der tæller)', async () => {
    const user = userEvent.setup();
    renderEnhedRadio();

    act(() => screen.getByRole('radio', { name: 'Uger' }).focus());
    await user.keyboard(' ');
    const afterFirst = undoDepth();

    await user.keyboard(' ');

    expect(canonicalEnhed()).toBe('uger');
    expect(undoDepth()).toBe(afterFirst);
  });

  it('kontrollen kan FEJLE: uden et tastedrevet valg stiger dybden ikke af sig selv', () => {
    // Samme kontrast som for dropdownen: dybden må ikke vokse ved ren render eller fokus.
    renderEnhedRadio();
    const before = undoDepth();
    act(() => screen.getByRole('radio', { name: 'Måneder' }).focus());
    expect(undoDepth()).toBe(before);
  });
});
