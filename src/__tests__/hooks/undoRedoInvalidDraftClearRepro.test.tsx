// @vitest-environment jsdom
//
// REPRO af brugerrapporteret fejl (2026-06-15): skriv ugyldig "12" i et datofelt, blur (klik væk),
// KLIK feltet igen (giver fokus, editor lukket), tryk Delete (rydder) → undo gendanner IKKE den
// ugyldige værdi. Forskellen fra den eksisterende undoRedoInvalidDraftChain-test er at fokus her
// etableres via et RIGTIGT klik (mousedown/click), ikke programmatisk .focus().
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import StyledDateField from '../../components/inputs/StyledDateField';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests } from '../../stores/undoRedoStore';
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
  controls = useUndoRedo(useNavigate());
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

describe('REPRO: klik + Delete + undo af ugyldig dato', () => {
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

  it('ét felt: skriv "12", blur, klik tilbage, Delete, undo → "12" gendannes', async () => {
    const user = userEvent.setup();
    renderHarness();

    // 1) Skriv ugyldig "12" i Skadedato og blur ved at tabbe væk.
    await user.click(skadeInput());
    await user.type(skadeInput(), '12');
    await user.tab();
    expect(drafts()).toEqual({ skadedato: '12' });

    // 2) Klik feltet igen (RIGTIGT klik → fokus, editor lukket) og tryk Delete.
    await user.click(skadeInput());
    await user.keyboard('{Delete}');
    expect(skadeInput()).toHaveValue('');
    expect(drafts()).toEqual({});

    // 3) Undo → den ugyldige "12" SKAL gendannes.
    await act(async () => { controls!.undo(); await flushRaf(); });
    expect(drafts()).toEqual({ skadedato: '12' });
    expect(skadeInput()).toHaveValue('12');
  });

  it('sektion allerede non-null (anden gyldig dato committet) → clear af ugyldig dato kan undo\'es', async () => {
    const user = userEvent.setup();
    renderHarness();

    // Commit en gyldig dato i Fødselsdato → sektionen bliver non-null.
    await user.click(foedselInput());
    await user.type(foedselInput(), '01-01-1990');
    await user.tab();
    expect(formPersistenceStore.getState().sections.stamdata).not.toBeNull();

    // Skriv ugyldig "12" i Skadedato, blur.
    await user.click(skadeInput());
    await user.type(skadeInput(), '12');
    await user.tab();
    expect(drafts()).toEqual({ skadedato: '12' });

    // Klik + Delete (clear af ugyldig dato — sektion-commit er en ægte no-op her).
    await user.click(skadeInput());
    await user.keyboard('{Delete}');
    expect(drafts()).toEqual({});

    // Undo → "12" gendannes.
    await act(async () => { controls!.undo(); await flushRaf(); });
    expect(drafts()).toEqual({ skadedato: '12' });
    expect(skadeInput()).toHaveValue('12');
  });

  it('Backspace i stedet for Delete: samme adfærd', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(skadeInput());
    await user.type(skadeInput(), '12');
    await user.tab();
    await user.click(skadeInput());
    await user.keyboard('{Backspace}');
    expect(drafts()).toEqual({});

    await act(async () => { controls!.undo(); await flushRaf(); });
    expect(drafts()).toEqual({ skadedato: '12' });
  });

  it('redo efter undo gendanner clear (tom)', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(skadeInput());
    await user.type(skadeInput(), '12');
    await user.tab();
    await user.click(skadeInput());
    await user.keyboard('{Delete}');
    await act(async () => { controls!.undo(); await flushRaf(); });
    expect(drafts()).toEqual({ skadedato: '12' });

    await act(async () => { controls!.redo(); await flushRaf(); });
    expect(drafts()).toEqual({});
    expect(skadeInput()).toHaveValue('');
  });
});
