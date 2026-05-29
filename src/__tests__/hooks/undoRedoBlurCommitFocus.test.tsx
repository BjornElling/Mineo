// @vitest-environment jsdom
//
// Regression for undo/redo-fokus på blur-commit input-felter og radio-knapper.
//
// Den oprindelige fejl: et dato/tekst/beløb-felt committede med et eksplicit fieldPath, men selve
// input-elementet bar ingen matchende `data-mineo-undo-field-path` (manglende `name`-prop), så
// restore ikke kunne finde feltet — værdien blev fortrudt, men fokus landede ikke.
//
// Disse tests verificerer at:
//  1. et blur-commit-felt med `name` får fokus efter undo, og
//  2. en radio-knap markeres med `data-mineo-undo-focused` (driver fokus-halo'en via CSS).
import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import StyledDateField from '../../components/inputs/StyledDateField';
import StyledRadioButton from '../../components/inputs/StyledRadioButton';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore, type HistoryFrameOrigin } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { erstatningsopgoerelseSchema } from '../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';
import { __resetDraftHistoryRegistryForTests } from '../../utils/draftHistoryRegistry';
import { toISODateString } from '../../types/branded';

type Controls = ReturnType<typeof useUndoRedo>;
let controls: Controls | null = null;

const eoInitialValues = createErstatningsopgoerelseInitialValues();

const makeOrigin = (fieldPath: string): HistoryFrameOrigin => ({
  route: '/erstatningsopgoerelse',
  tabKey: null,
  sectionKey: 'erstatningsopgoerelse',
  fieldPath,
  focusToken: null,
});

const EOPage = () => {
  const form = usePersistedForm(erstatningsopgoerelseSchema, 'erstatningsopgoerelse', eoInitialValues);
  return (
    <div data-section-id="eo-section">
      <StyledDateField
        name="forligDato"
        value={form.values.forligDato}
        onCommit={(event) => {
          form.setValues((prev) => ({ ...prev, forligDato: event.target.value }), { fieldPath: 'forligDato' });
        }}
      />
      <StyledRadioButton
        name="svieSmerteDelvisSygemeldingSats"
        value={form.values.svieSmerteDelvisSygemeldingSats}
        row
        options={[
          { value: 'fuld', label: 'Fuld sats' },
          { value: 'halv', label: 'Halv sats' },
        ]}
        onCommit={(event) => {
          const next = event.target.value;
          if (next === 'fuld' || next === 'halv') {
            form.setValues((prev) => ({ ...prev, svieSmerteDelvisSygemeldingSats: next }), {
              fieldPath: 'svieSmerteDelvisSygemeldingSats',
            });
          }
        }}
      />
    </div>
  );
};

const Harness = () => {
  controls = useUndoRedo();
  return (
    <Routes>
      <Route path="/erstatningsopgoerelse" element={<EOPage />} />
    </Routes>
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <FormPersistenceProvider>
            <Harness />
          </FormPersistenceProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );

const flushRestoreLoop = async () => {
  await act(async () => {
    controls!.undo();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
};

describe('undo/redo-fokus for blur-commit-felter og radio', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    __resetUndoRedoStoreForTests();
    __resetUndoFocusTrackerForTests();
    __resetDraftHistoryRegistryForTests();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, erstatningsopgoerelse: null },
      meta: { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
    });
    installUndoFocusTracker();
  });

  it('dato-felt får fokus efter undo (kerne-regression: name matcher fieldPath)', async () => {
    renderHarness();
    const input = document.querySelector('[data-mineo-undo-field-path="forligDato"]') as HTMLInputElement;
    expect(input).toBeInstanceOf(HTMLInputElement);

    // Capture før-tilstanden og commit en ny værdi (som det normale commit-flow gør).
    act(() => {
      undoRedoStore.getState().capture(makeOrigin('forligDato'));
      formPersistenceStore.getState().commitSection(
        'erstatningsopgoerelse',
        { ...eoInitialValues, forligDato: toISODateString('2024-03-15') },
        { schemaFingerprint: PERSISTED_DATA_VERSION }
      );
    });

    await flushRestoreLoop();

    const active = document.activeElement as HTMLElement | null;
    expect(active?.getAttribute('data-mineo-undo-field-path')).toBe('forligDato');
  });

  it('radio markeres med data-mineo-undo-focused efter undo (driver fokus-halo)', async () => {
    renderHarness();

    act(() => {
      undoRedoStore.getState().capture(makeOrigin('svieSmerteDelvisSygemeldingSats'));
      formPersistenceStore.getState().commitSection(
        'erstatningsopgoerelse',
        { ...eoInitialValues, svieSmerteDelvisSygemeldingSats: 'fuld' },
        { schemaFingerprint: PERSISTED_DATA_VERSION }
      );
    });

    await flushRestoreLoop();

    const marked = document.querySelector('input[data-mineo-undo-focused]');
    expect(marked).not.toBeNull();
    expect(marked?.getAttribute('data-mineo-undo-field-path')).toBe('svieSmerteDelvisSygemeldingSats');
  });
});
