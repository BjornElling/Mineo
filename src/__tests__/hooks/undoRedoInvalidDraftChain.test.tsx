// @vitest-environment jsdom
//
// Reproduktion: to felter med ugyldige værdier (Skadedato + Fødselsdato). Skift det ene felts ugyldige
// værdi til en anden ugyldig værdi, undo hele kæden, og redo hele kæden igen. Symptom (rapporteret):
// et redo-trin tømmer BEGGE felter på én kommando — tegn på at undo/redo-kæden (past/future) bliver
// korrumperet af en spuriøs capture eller et forkert snapshot.
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import StyledDateField from '../../components/inputs/StyledDateField';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { stamdataSchema } from '../../schemas/formSchemas';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';
import type { ISODateString } from '../../types/branded';

type Controls = ReturnType<typeof useUndoRedo>;
let controls: Controls | null = null;

const TwoDatePage = () => {
  const form = usePersistedForm(stamdataSchema, 'stamdata', STAMDATA_INITIAL_VALUES);
  const reportSkade = useFormFieldErrorReporter('stamdata', 'skadedato', { severity: 'error', source: 'input' });
  const reportFoedsel = useFormFieldErrorReporter('stamdata', 'skadelidteFodselsdato', { severity: 'error', source: 'input' });
  return (
    <div data-section-id="stamdata-section">
      <StyledDateField
        name="skadedato"
        value={form.values.skadedato}
        onFieldError={reportSkade}
        onCommit={(e) => form.setValues((p) => ({ ...p, skadedato: e.target.value as ISODateString | undefined }), { fieldPath: 'skadedato' })}
      />
      <StyledDateField
        name="skadelidteFodselsdato"
        value={form.values.skadelidteFodselsdato}
        onFieldError={reportFoedsel}
        onCommit={(e) => form.setValues((p) => ({ ...p, skadelidteFodselsdato: e.target.value as ISODateString | undefined }), { fieldPath: 'skadelidteFodselsdato' })}
      />
    </div>
  );
};

const Harness = () => {
  controls = useUndoRedo();
  return (
    <Routes>
      <Route path="/stamdata" element={<TwoDatePage />} />
    </Routes>
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/stamdata']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <FormPersistenceProvider>
            <Harness />
          </FormPersistenceProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );

const flushRaf = async () => {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
};

const drafts = () => formPersistenceStore.getState().invalidDrafts.stamdata ?? {};
const skadeInput = () => screen.getAllByRole('textbox')[0] as HTMLInputElement;
const foedselInput = () => screen.getAllByRole('textbox')[1] as HTMLInputElement;

describe('undo/redo-kæde med to ugyldige felter', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    sessionStorage.clear();
    __resetUndoRedoStoreForTests();
    __resetUndoFocusTrackerForTests();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, stamdata: null },
      meta: { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    installUndoFocusTracker();
    controls = null;
  });

  afterEach(() => __resetUndoFocusTrackerForTests());

  it('redo gendanner samme kæde som undo (intet trin tømmer begge felter på én gang)', async () => {
    const user = userEvent.setup();
    renderHarness();

    // 1) Skadedato → ugyldig "30-02-1980" (findes ikke).
    await user.click(skadeInput());
    await user.type(skadeInput(), '30-02-1980');
    await user.tab();
    // 2) Fødselsdato → ugyldig "31-04-1990" (april har 30 dage).
    await user.click(foedselInput());
    await user.type(foedselInput(), '31-04-1990');
    await user.tab();
    // 3) Skift Skadedato fra "30-02-1980" til en anden ugyldig "30-02-1981" via immediate-Delete-stien:
    //    enkelt-klik fokuserer (editor lukket) → Delete committer/rydder straks → indtast ny ugyldig.
    await user.click(skadeInput());
    await user.keyboard('{Delete}');
    // Konsistens-invariant midt i ændringen: feltet er tomt, og dets invalidDrafts-entry SKAL være ryddet
    // (ellers efterlades en inkonsistent tilstand der korrumperer undo/redo-snapshots).
    expect(skadeInput()).toHaveValue('');
    expect(drafts().skadedato).toBeUndefined();
    await user.type(skadeInput(), '30-02-1981');
    await user.tab();

    expect(drafts()).toEqual({ skadedato: '30-02-1981', skadelidteFodselsdato: '31-04-1990' });

    // Konsistens-værn ved hvert trin: et felts viste værdi skal matche dets invalidDrafts-entry
    // (eller være tomt). Fanger "vist tom men entry tilbage"-inkonsistensen.
    const assertConsistent = () => {
      const d = drafts();
      expect(skadeInput().value).toBe(d.skadedato ?? '');
      expect(foedselInput().value).toBe(d.skadelidteFodselsdato ?? '');
    };

    // Optag den fulde forventede kæde af invalidDrafts-tilstande ved at undo'e helt i bund.
    assertConsistent();
    const undoStates: Record<string, string>[] = [{ ...drafts() }];
    while (undoRedoStore.getState().canUndo()) {
      await act(async () => { controls!.undo(); await flushRaf(); });
      assertConsistent();
      undoStates.push({ ...drafts() });
    }
    // Sidste undo-tilstand skal være tom (begge felter ryddet).
    expect(undoStates.at(-1)).toEqual({});

    // Redo hele vejen op igen og sammenlign trin-for-trin mod den omvendte undo-kæde.
    const redoStates: Record<string, string>[] = [{ ...drafts() }];
    while (undoRedoStore.getState().canRedo()) {
      await act(async () => { controls!.redo(); await flushRaf(); });
      assertConsistent();
      redoStates.push({ ...drafts() });
    }

    // Redo-kæden skal være den eksakte spejling af undo-kæden (ingen tilstand hvor begge felter
    // pludselig tømmes på ét redo-trin midt i kæden).
    const expectedRedo = [...undoStates].reverse();
    expect(redoStates).toEqual(expectedRedo);

    // Slutpunkt: begge felter tilbage til deres ugyldige værdier.
    expect(drafts()).toEqual({ skadedato: '30-02-1981', skadelidteFodselsdato: '31-04-1990' });
  });
});
