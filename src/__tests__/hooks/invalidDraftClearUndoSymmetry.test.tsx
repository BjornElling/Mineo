// @vitest-environment jsdom
//
// INVARIANT-VÆRN (cross-channel): BEGGE invalidDraft-recovery-kanaler — den almindelige felt-kanal
// (useFormFieldErrorReporter → clearInvalidDraftForField) OG tabel-celle-kanalen
// (useCellInvalidDraftChannel → clearInvalidDraft) — SKAL sende en undoOrigin med, når de rydder en
// committet rå draft. Ellers fanger rydningen ingen undo-frame, og undo springer den over og hopper
// tilbage til FØR det ugyldige input (rapporteret bug: en ryddet ugyldig dato kunne ikke gendannes).
//
// Dette værn fanger klassen bredt: hvis en fremtidig kanal (eller en refaktorering) glemmer undoOrigin
// på clear-stien, fejler dette test. Selv-test-grenen beviser at assertionen faktisk reagerer på en
// manglende frame (vacuous-pass-værn).
import * as React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { useCellInvalidDraftChannel } from '../../hooks/tableInput/useCellInvalidDraftChannel';
import { CellInvalidDraftScopeProvider } from '../../contexts/CellInvalidDraftScopeContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { CELL_TABLE_IDS } from '../../config/cellInvalidDraftScopes';

const pastLen = () => undoRedoStore.getState().past.length;

beforeEach(() => {
  sessionStorage.clear();
  __resetUndoRedoStoreForTests();
  formPersistenceStore.getState().clearAll({ hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION, lastCommittedAt: 1 });
});

type FieldChannel = {
  commit: (raw: string) => void;
  clear: () => void;
};
let fieldChannel: FieldChannel | null = null;

const FieldProbe = () => {
  const reporter = useFormFieldErrorReporter('stamdata', 'skadedato', { severity: 'error', source: 'input' });
  fieldChannel = {
    commit: (raw) => reporter.commitInvalidDraft?.(raw),
    clear: () => reporter.clearInvalidDraft?.(),
  };
  return null;
};

type CellChannel = ReturnType<typeof useCellInvalidDraftChannel>;
let cellChannel: CellChannel | null = null;
const CellProbe = () => {
  cellChannel = useCellInvalidDraftChannel('row1:2');
  return null;
};

describe('invalidDraft clear → undo-frame-capture (cross-channel invariant)', () => {
  it('felt-kanal: commit-invalid fanger en frame, og en efterfølgende clear fanger sin egen frame', () => {
    render(
      <MemoryRouter initialEntries={['/stamdata']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
              <FieldProbe />
            </FormPersistenceProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    act(() => { fieldChannel!.commit('12'); });
    expect(pastLen()).toBe(1);
    act(() => { fieldChannel!.clear(); });
    expect(pastLen()).toBe(2);
  });

  it('celle-kanal: commit-invalid fanger en frame, og en efterfølgende clear fanger sin egen frame', () => {
    render(
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
        <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoOffentligeYdelser}>
          <CellProbe />
        </CellInvalidDraftScopeProvider>
      </FormPersistenceProvider>
    );

    act(() => { cellChannel!.onCommitInvalid!('12'); });
    expect(pastLen()).toBe(1);
    act(() => { cellChannel!.clearInvalidDraft!(); });
    expect(pastLen()).toBe(2);
  });

  it('selv-test: en clear UDEN undoOrigin fanger INGEN frame (beviser at værnet ikke er vacuous)', () => {
    // Emulér den gamle, fejlbehæftede sti: ryd draften via den direkte store-skrivning (ingen
    // undoOrigin) og bekræft at past IKKE vokser. Det var præcis celle-kanalens fejl før rettelsen —
    // og det viser at de to assertions ovenfor (past vokser ved clear) ikke er trivielt opfyldte.
    render(
      <MemoryRouter initialEntries={['/stamdata']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
              <FieldProbe />
            </FormPersistenceProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    act(() => { fieldChannel!.commit('12'); });
    const before = pastLen();
    act(() => { formPersistenceStore.getState().setInvalidDraft('stamdata', 'skadedato', null); });
    expect(pastLen()).toBe(before); // ingen frame fanget → værnets assertions ovenfor er ikke-trivielle
  });
});
