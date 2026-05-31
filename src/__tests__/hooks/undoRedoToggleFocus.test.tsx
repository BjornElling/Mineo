// @vitest-environment jsdom
//
// Repro/regression for undo/redo med ikke-tabel immediate-commit-widgets (toggle).
// Fejl B: efter undo lander fokus ikke på den toggle hvis værdi blev fortrudt.
// Fejl A: to felter ændret i samme række — kun ét undo'es.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import StyledToggleSwitch from '../../components/inputs/StyledToggleSwitch';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { aarsloenSchema } from '../../schemas/formSchemas';
import { AARSLOEN_INITIAL_VALUES } from '../../domain/aarsloen/aarsloenInitialValues';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';
import { __resetDraftHistoryRegistryForTests } from '../../utils/draftHistoryRegistry';

type Controls = ReturnType<typeof useUndoRedo>;
let controls: Controls | null = null;

const testTheme = createTheme({
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
    },
  },
});

const TogglePage = () => {
  const form = usePersistedForm(aarsloenSchema, 'aarsloen', AARSLOEN_INITIAL_VALUES);
  const setBool = (field: 'fuldLoenUnderFerie' | 'retTilSjetteFerieuge') => (e: { target: { value: boolean } }) => {
    form.setValues((prev) => ({ ...prev, [field]: e.target.value }), { fieldPath: field });
  };
  return (
    <div data-section-id="aarsloen-section">
      <StyledToggleSwitch
        name="fuldLoenUnderFerie"
        ariaLabel="Fuld løn under ferie"
        checked={Boolean(form.values.fuldLoenUnderFerie)}
        onCommit={setBool('fuldLoenUnderFerie')}
      />
      <StyledToggleSwitch
        name="retTilSjetteFerieuge"
        ariaLabel="Ret til 6. ferieuge"
        checked={Boolean(form.values.retTilSjetteFerieuge)}
        onCommit={setBool('retTilSjetteFerieuge')}
      />
    </div>
  );
};

const Harness = () => {
  controls = useUndoRedo();
  return (
    <Routes>
      <Route path="/aarsloen" element={<TogglePage />} />
    </Routes>
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/aarsloen']}>
      <ThemeProvider theme={testTheme}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <FormPersistenceProvider>
              <Harness />
            </FormPersistenceProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </ThemeProvider>
    </MemoryRouter>
  );

describe('undo/redo for toggles uden for tabeller', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    __resetUndoRedoStoreForTests();
    __resetUndoFocusTrackerForTests();
    __resetDraftHistoryRegistryForTests();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, aarsloen: null },
      meta: { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
    });
    installUndoFocusTracker();
  });

  it('fejl A: to toggles ændret giver to separate undo-frames', () => {
    const { getByLabelText } = renderHarness();
    const t1 = getByLabelText('Fuld løn under ferie') as HTMLInputElement;
    const t2 = getByLabelText('Ret til 6. ferieuge') as HTMLInputElement;

    act(() => {
      t1.focus();
      fireEvent.click(t1);
    });
    act(() => {
      t2.focus();
      fireEvent.click(t2);
    });

    expect(undoRedoStore.getState().past).toHaveLength(2);
    expect(undoRedoStore.getState().past[0].origin.fieldPath).toBe('fuldLoenUnderFerie');
    expect(undoRedoStore.getState().past[1].origin.fieldPath).toBe('retTilSjetteFerieuge');
  });

  it('fejl B (kerne): toggle-commit tagges med toggle, ikke det forrige fokuserede felt', () => {
    // Reproducerer den faktiske fejl: focus-trackeren peger på et tidligere tekstfelt,
    // men toggle-commit'et sender nu et eksplicit fieldPath, så framet tagges korrekt.
    const { getByLabelText } = renderHarness();
    const t1 = getByLabelText('Fuld løn under ferie') as HTMLInputElement;

    // Simuler at focus-trackeren holder et FORRIGE felts identitet.
    const ghost = document.createElement('input');
    ghost.setAttribute('data-mineo-undo-field-path', 'et-tidligere-tekstfelt');
    document.body.appendChild(ghost);
    act(() => {
      ghost.focus();
    });

    // Klik på togglen UDEN at den får fokus først (immediate commit).
    act(() => {
      fireEvent.click(t1);
    });

    expect(undoRedoStore.getState().past.at(-1)?.origin.fieldPath).toBe('fuldLoenUnderFerie');
    document.body.removeChild(ghost);
  });

  it('fejl B: undo flytter fokus til den toggle hvis værdi blev fortrudt', async () => {
    const { getByLabelText } = renderHarness();
    const t1 = getByLabelText('Fuld løn under ferie') as HTMLInputElement;

    act(() => {
      t1.focus();
      fireEvent.click(t1);
    });
    // Flyt fokus væk (som om brugeren tabbede videre).
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    await act(async () => {
      controls!.undo();
      // lad requestAnimationFrame-restore-løkken køre
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    const active = document.activeElement as HTMLElement | null;
    expect(active?.getAttribute('data-mineo-undo-field-path')).toBe('fuldLoenUnderFerie');
  });

  it('markerer toggle ved undo (driver fokus-halo via CSS) og rydder ved blur', async () => {
    // Halo'en tegnes af CSS: .MuiSwitch-switchBase:has(.MuiSwitch-input[data-mineo-undo-focused]).
    // jsdom evaluerer ikke :has()/box-shadow, så vi verificerer markeringen som CSS'en keyer på.
    const { getByLabelText } = renderHarness();
    const t1 = getByLabelText('Fuld løn under ferie') as HTMLInputElement;

    act(() => {
      t1.focus();
      fireEvent.click(t1);
    });
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    await act(async () => {
      controls!.undo();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(t1.hasAttribute('data-mineo-undo-focused')).toBe(true);

    // Når brugeren bevæger sig videre, ryddes markeringen (og dermed halo'en).
    act(() => {
      t1.blur();
    });
    expect(t1.hasAttribute('data-mineo-undo-focused')).toBe(false);
  });
});
