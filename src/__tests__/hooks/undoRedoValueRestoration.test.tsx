// @vitest-environment jsdom
//
// Værdi-restore for undo/redo på tværs af ALLE immediate-commit input-typer via REEL interaktion
// (klik på toggle, vælg dropdown-punkt, vælg radio) — ikke kun fokus/markering.
//
// De øvrige undo/redo-fokus-suiter (undoRedoToggleFocus, undoRedoBlurCommitFocus, undoRedoEetTableFocus)
// dækker fieldPath-capture, fokus-landing og fokus-halo-markering. Denne suite dækker det
// komplementære: at den COMMITTEDE værdi faktisk fortrydes/gendannes — og at afledte effekter
// (række-visning styret af en toggle, og afledte beregninger) genberegnes korrekt ved undo/redo.
//
// Mekanikken er fælles: undo/redo gendanner det atomiske store-snapshot og bumper
// authoritativeSnapshotEpoch, hvorefter felter/celler resyncer. Disse tests er værn mod, at
// snapshot-restore eller resync stille holder op med at virke for en given input-type.
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import StyledToggleSwitch from '../../components/inputs/StyledToggleSwitch';
import StyledDropdown from '../../components/inputs/StyledDropdown';
import StyledRadioButton from '../../components/inputs/StyledRadioButton';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { aarsloenSchema, erstatningsopgoerelseSchema } from '../../schemas/formSchemas';
import { AARSLOEN_INITIAL_VALUES } from '../../domain/aarsloen/aarsloenInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { LOEN_PAA_HELLIGDAGE, type LoenPaaHelligdage } from '../../types/loen';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';

type Controls = ReturnType<typeof useUndoRedo>;
let controls: Controls | null = null;

const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
});

const isLoenPaaHelligdage = (value: string): value is LoenPaaHelligdage =>
  value === LOEN_PAA_HELLIGDAGE.ALMINDELIG ||
  value === LOEN_PAA_HELLIGDAGE.SH_UDBETALING ||
  value === LOEN_PAA_HELLIGDAGE.INGEN;

const eoInitialValues = createErstatningsopgoerelseInitialValues();

// Aarsloen-side med en toggle (der styrer både en betinget "række" og en afledt visning), samt en
// dropdown. Modellerer det faktiske mønster: alt afledes af committed form-state.
const AarsloenPage = () => {
  const form = usePersistedForm(aarsloenSchema, 'aarsloen', AARSLOEN_INITIAL_VALUES);
  const v = form.values;
  const fuldLoen = Boolean(v.fuldLoenUnderFerie);
  return (
    <div data-section-id="aarsloen-section">
      <StyledToggleSwitch
        name="fuldLoenUnderFerie"
        ariaLabel="Fuld løn under ferie"
        checked={fuldLoen}
        onCommit={(e) =>
          form.setValues((prev) => ({ ...prev, fuldLoenUnderFerie: e.target.value }), {
            fieldPath: 'fuldLoenUnderFerie',
          })
        }
      />
      {/* Toggle-styret "række": vises kun når togglen er slået til. */}
      {fuldLoen ? <div data-testid="ferie-detalje-raekke">Feriedetaljer</div> : null}
      {/* Afledt visning: genberegnes alene af committed (materialiseret) state. */}
      <div data-testid="afledt">{fuldLoen ? 'Fuld løn: JA' : 'Fuld løn: NEJ'}</div>
      <div data-testid="dropdown-val">{String(v.loenPaaHelligdage)}</div>

      <StyledDropdown
        name="loenPaaHelligdage"
        value={v.loenPaaHelligdage}
        allowEmpty={false}
        onChange={(e) => {
          const next = e.target.value;
          if (typeof next === 'string' && isLoenPaaHelligdage(next)) {
            form.setValues((prev) => ({ ...prev, loenPaaHelligdage: next }), {
              fieldPath: 'loenPaaHelligdage',
            });
          }
        }}
      >
        <MenuItem value={LOEN_PAA_HELLIGDAGE.ALMINDELIG}>Almindelig løn</MenuItem>
        <MenuItem value={LOEN_PAA_HELLIGDAGE.SH_UDBETALING}>SH-udbetaling</MenuItem>
        <MenuItem value={LOEN_PAA_HELLIGDAGE.INGEN}>Ingen</MenuItem>
      </StyledDropdown>
    </div>
  );
};

const RadioPage = () => {
  const form = usePersistedForm(erstatningsopgoerelseSchema, 'erstatningsopgoerelse', eoInitialValues);
  return (
    <div data-section-id="eo-section">
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

const makeHarness = (Page: React.ComponentType, route: string) => {
  const Harness = () => {
    controls = useUndoRedo(useNavigate());
    return (
      <Routes>
        <Route path={route} element={<Page />} />
      </Routes>
    );
  };
  return () =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider theme={testTheme}>
          <AppSettingsProvider>
            <RoutePathnameProvider>
              <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
                <Harness />
              </FormPersistenceProvider>
            </RoutePathnameProvider>
          </AppSettingsProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
};

const flushRaf = async (): Promise<void> => {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
};

const doUndo = async (): Promise<void> => {
  await act(async () => {
    controls!.undo();
    await flushRaf();
  });
};

const doRedo = async (): Promise<void> => {
  await act(async () => {
    controls!.redo();
    await flushRaf();
  });
};

// Assertions sker på den RENDEREDE/derivede tilstand (toggle.checked, radio.checked, derivede testid'er)
// — ikke på den rå store-sektion. Det er bevidst: usePersistedForm materialiserer initial-værdier
// in-memory uden at committe dem til storen, så en aldrig-redigeret sektion er rå `null`; undo gendanner
// korrekt det `null`-snapshot, og formularen re-deriverer initial-værdierne. Den materialiserede værdi
// (det UI og beregninger faktisk bruger) er derfor det rigtige assertions-mål, ikke store-repræsentationen.
const resetSection = (section: 'aarsloen' | 'erstatningsopgoerelse'): void => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  // Ryd sessionStorage for ægte test-isolation: FormPersistenceProvider re-hydrerer sektioner fra
  // sessionStorage ved mount, så en tidligere tests persisterede sektion ellers ville lække ind.
  sessionStorage.clear();
  __resetUndoRedoStoreForTests();
  __resetUndoFocusTrackerForTests();
  formPersistenceStore.setState({
    sections: { ...formPersistenceStore.getState().sections, [section]: null },
    meta: { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
  });
  installUndoFocusTracker();
};

describe('undo/redo værdi-restore — toggle switch', () => {
  beforeEach(() => resetSection('aarsloen'));
  afterEach(() => __resetUndoFocusTrackerForTests());

  it('fortryder og gen-udfører den committede boolean-værdi', async () => {
    const renderHarness = makeHarness(AarsloenPage, '/aarsloen');
    renderHarness();
    const toggle = screen.getByLabelText('Fuld løn under ferie') as HTMLInputElement;

    // Udgangspunkt: true (initial). Klik → false (committed).
    expect(toggle.checked).toBe(true);
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: JA');
    act(() => {
      toggle.focus();
      fireEvent.click(toggle);
    });
    expect(toggle.checked).toBe(false);
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: NEJ');

    await doUndo();
    expect((screen.getByLabelText('Fuld løn under ferie') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: JA');

    await doRedo();
    expect((screen.getByLabelText('Fuld løn under ferie') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: NEJ');
  });

  it('skjuler/viser en toggle-styret række og genberegner afledt visning ved undo/redo', async () => {
    const renderHarness = makeHarness(AarsloenPage, '/aarsloen');
    renderHarness();
    const toggle = screen.getByLabelText('Fuld løn under ferie') as HTMLInputElement;

    // Udgangspunkt: togglen er slået til → rækken vises, afledt visning = JA.
    expect(screen.queryByTestId('ferie-detalje-raekke')).toBeInTheDocument();
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: JA');

    // Slå fra → rækken forsvinder, afledt visning = NEJ.
    act(() => {
      toggle.focus();
      fireEvent.click(toggle);
    });
    expect(screen.queryByTestId('ferie-detalje-raekke')).not.toBeInTheDocument();
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: NEJ');

    // Undo → rækken kommer tilbage, afledt visning = JA igen.
    await doUndo();
    expect(screen.queryByTestId('ferie-detalje-raekke')).toBeInTheDocument();
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: JA');

    // Redo → rækken skjules igen.
    await doRedo();
    expect(screen.queryByTestId('ferie-detalje-raekke')).not.toBeInTheDocument();
    expect(screen.getByTestId('afledt')).toHaveTextContent('Fuld løn: NEJ');
  });
});

describe('undo/redo værdi-restore — dropdown', () => {
  beforeEach(() => resetSection('aarsloen'));
  afterEach(() => __resetUndoFocusTrackerForTests());

  it('fortryder og gen-udfører det committede enum-valg', async () => {
    const user = userEvent.setup();
    const renderHarness = makeHarness(AarsloenPage, '/aarsloen');
    renderHarness();

    expect(screen.getByTestId('dropdown-val')).toHaveTextContent(LOEN_PAA_HELLIGDAGE.ALMINDELIG);

    // userEvent håndterer selv act() internt (via dom-testing-librarys async/event-wrappers).
    // At pakke user.click() ind i et yderligere eksplicit act() er et anti-mønster: userEvents
    // asyncWrapper sætter bevidst IS_REACT_ACT_ENVIRONMENT=false under sit async-arbejde, men
    // fordi det her ville køre inde i en ydre act() (actQueue ≠ null), advarer React
    // "not configured to support act(...)" på hver MUI Select-opdatering i det vindue. Kald derfor
    // userEvent direkte og uindpakket.
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.click(screen.getByRole('option', { name: 'Ingen' }));
    expect(screen.getByTestId('dropdown-val')).toHaveTextContent(LOEN_PAA_HELLIGDAGE.INGEN);

    await doUndo();
    expect(screen.getByTestId('dropdown-val')).toHaveTextContent(LOEN_PAA_HELLIGDAGE.ALMINDELIG);

    await doRedo();
    expect(screen.getByTestId('dropdown-val')).toHaveTextContent(LOEN_PAA_HELLIGDAGE.INGEN);
  });
});

describe('undo/redo værdi-restore — radio button', () => {
  beforeEach(() => resetSection('erstatningsopgoerelse'));
  afterEach(() => __resetUndoFocusTrackerForTests());

  it('fortryder og gen-udfører det committede radio-valg', async () => {
    const renderHarness = makeHarness(RadioPage, '/erstatningsopgoerelse');
    renderHarness();

    const radio = (name: 'Fuld sats' | 'Halv sats') =>
      screen.getByRole('radio', { name }) as HTMLInputElement;

    act(() => {
      radio('Fuld sats').focus();
      fireEvent.click(radio('Fuld sats'));
    });
    expect(radio('Fuld sats').checked).toBe(true);

    act(() => {
      radio('Halv sats').focus();
      fireEvent.click(radio('Halv sats'));
    });
    expect(radio('Halv sats').checked).toBe(true);
    expect(radio('Fuld sats').checked).toBe(false);

    // Undo → tilbage til 'fuld'.
    await doUndo();
    expect(radio('Fuld sats').checked).toBe(true);
    expect(radio('Halv sats').checked).toBe(false);

    // Redo → frem til 'halv' igen.
    await doRedo();
    expect(radio('Halv sats').checked).toBe(true);
    expect(radio('Fuld sats').checked).toBe(false);
  });
});
