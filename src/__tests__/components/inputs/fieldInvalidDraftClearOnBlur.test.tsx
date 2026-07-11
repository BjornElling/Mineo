// @vitest-environment jsdom
//
// Regression: at rydde (eller redigere) et felt med en ikke-committbar rå draft SKAL committe og
// rydde `invalidDrafts`-entryet — også når den ryddede draft matcher den committede værdi (fx tom).
//
// Den oprindelige fejl: Styled*-felternes blur-commit havde en `unchanged = draft === format(value)`
// kortslutning, der sprang commit'et over når draften matchede den committede værdi. For et felt med
// committed værdi `undefined` og en ugyldig rå draft (committed værdi blev aldrig sat) gav en clear til
// "" `unchanged === true` → commit sprunget over → det persisterede invalidDrafts-entry blev ALDRIG
// ryddet → feltet re-syncede til den gamle ugyldige værdi, og Gem forblev blokeret. Fixet: feltet er
// aldrig "unchanged" mens `committedInvalidDraft` lever.
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StyledDateField from '../../../components/inputs/StyledDateField';
import StyledFractionField from '../../../components/inputs/StyledFractionField';
import StyledYearField from '../../../components/inputs/StyledYearField';
import { usePersistedForm } from '../../../hooks/usePersistedForm';
import { useFormFieldErrorReporter } from '../../../hooks/useFormFieldErrors';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { stamdataSchema, erstatningsopgoerelseSchema } from '../../../schemas/formSchemas';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ISODateString } from '../../../types/branded';

const invalidDraftFor = (field: string): string | undefined =>
  (formPersistenceStore.getState().invalidDrafts.stamdata ?? {})[field];

const eoInvalidDraftFor = (field: string): string | undefined =>
  (formPersistenceStore.getState().invalidDrafts.erstatningsopgoerelse ?? {})[field];

const DatePage = () => {
  const form = usePersistedForm(stamdataSchema, 'stamdata', STAMDATA_INITIAL_VALUES);
  const report = useFormFieldErrorReporter('stamdata', 'skadelidteFodselsdato', {
    severity: 'error',
    source: 'input',
  });
  return (
    <StyledDateField
      name="skadelidteFodselsdato"
      value={form.values.skadelidteFodselsdato}
      onFieldError={report}
      onCommit={(e) =>
        form.setValues((prev) => ({ ...prev, skadelidteFodselsdato: e.target.value as ISODateString | undefined }), {
          fieldPath: 'skadelidteFodselsdato',
        })
      }
    />
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/stamdata']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
            <DatePage />
          </FormPersistenceProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );

describe('felt med ugyldig rå draft — clear/edit rydder invalidDrafts ved blur', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, stamdata: null },
      meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
    });
    formPersistenceStore.getState().clearAllFieldErrors();
  });

  it('rydder det persisterede invalidDrafts-entry når et ugyldigt datofelt tømmes og blur\'es', async () => {
    const user = userEvent.setup();
    renderHarness();

    const input = screen.getByRole('textbox') as HTMLInputElement;

    // 1) Indtast en umulig dato (30-02-1980 findes ikke) → committes ikke, men persisteres som rå draft.
    await user.click(input);
    await user.type(input, '30-02-1980');
    await user.tab();

    expect(input).toHaveValue('30-02-1980');
    expect(invalidDraftFor('skadelidteFodselsdato')).toBe('30-02-1980');

    // 2) Ryd feltet (Delete) og blur — dette er kernen i bug'en: den tomme draft matcher den committede
    //    værdi (undefined → ""), så det gamle commit sprang over og invalidDrafts blev aldrig ryddet.
    await user.click(input);
    await user.keyboard('{Delete}');
    expect(input).toHaveValue('');
    await user.tab();

    // 3) EFTER FIX: invalidDrafts-entryet er ryddet (Gem ville ikke længere blokere), og feltet forbliver tomt.
    expect(invalidDraftFor('skadelidteFodselsdato')).toBeUndefined();
    expect(input).toHaveValue('');
  });

  it('rydder invalidDrafts STRAKS ved immediate-Delete (editor lukket) — uden at vente på blur', async () => {
    // Anden clear-sti: Delete på et fokuseret, IKKE-redigerende felt committer straks (immediate-commit-
    // undtagelsen). Den sti omgår useDraftField-commit-wrapperen og glemte at rydde invalidDrafts → feltet
    // stod tomt mens det stale invalidDrafts-entry overlevede (inkonsistent state der fodrede undo/redo).
    const user = userEvent.setup();
    renderHarness();
    const input = screen.getByRole('textbox') as HTMLInputElement;

    await user.click(input);
    await user.type(input, '30-02-1980');
    await user.tab();
    expect(invalidDraftFor('skadelidteFodselsdato')).toBe('30-02-1980');

    // Enkelt-klik fokuserer (editor lukket), Delete committer/rydder straks.
    await user.click(input);
    await user.keyboard('{Delete}');

    // EFTER FIX: invalidDrafts er ryddet STRAKS — ikke først ved et efterfølgende blur.
    expect(invalidDraftFor('skadelidteFodselsdato')).toBeUndefined();
    expect(input).toHaveValue('');
  });

  it('skriver IKKE til invalidDrafts mens der tastes (no-live-preview) — først ved commit (blur)', async () => {
    // Fase 2-invariant: invalidDrafts er en COMMITTED rå draft, ikke en live-preview. Tastning (onChange)
    // må aldrig røre store'en; kun blur/Enter committer. Uden dette værn kunne en fremtidig refaktor
    // utilsigtet flytte skrivningen til onChange og genintroducere det flygtige parallelle system.
    const user = userEvent.setup();
    renderHarness();

    const input = screen.getByRole('textbox') as HTMLInputElement;

    await user.click(input);
    await user.type(input, '30-02-1980');

    // Midt i tastningen (før blur): råstrengen ER i feltet, men IKKE i den persisterede store.
    expect(input).toHaveValue('30-02-1980');
    expect(invalidDraftFor('skadelidteFodselsdato')).toBeUndefined();

    // Først commit (blur) persisterer den.
    await user.tab();
    expect(invalidDraftFor('skadelidteFodselsdato')).toBe('30-02-1980');
  });

  it('erstatter (ikke gendanner) den gamle ugyldige værdi når feltet rettes til en gyldig dato', async () => {
    const user = userEvent.setup();
    renderHarness();

    const input = screen.getByRole('textbox') as HTMLInputElement;

    await user.click(input);
    await user.type(input, '30-02-1980');
    await user.tab();
    expect(invalidDraftFor('skadelidteFodselsdato')).toBe('30-02-1980');

    // Ret til en gyldig dato → commit lykkes, invalidDrafts ryddes, gammel ugyldig værdi gendannes IKKE.
    await user.click(input);
    await user.keyboard('{Delete}');
    await user.type(input, '01-01-1980');
    await user.tab();

    expect(invalidDraftFor('skadelidteFodselsdato')).toBeUndefined();
    expect(input).toHaveValue('01-01-1980');
  });
});

// Samme konvergente fix (committedInvalidDraft i `unchanged`-guarden) i en anden felttype: brøk-feltet,
// hvor ufuldstændig input som "5/" reelt kan tastes og blive en ikke-committbar rå draft.
const eoInitialValues = createErstatningsopgoerelseInitialValues();

const FractionPage = () => {
  const form = usePersistedForm(erstatningsopgoerelseSchema, 'erstatningsopgoerelse', eoInitialValues);
  const report = useFormFieldErrorReporter('erstatningsopgoerelse', 'forligAnsvarsgradBroek', {
    severity: 'error',
    source: 'input',
  });
  return (
    <StyledFractionField
      name="forligAnsvarsgradBroek"
      value={form.values.forligAnsvarsgradBroek}
      onFieldError={report}
      onCommit={(e) =>
        form.setValues((prev) => ({ ...prev, forligAnsvarsgradBroek: e.target.value }), {
          fieldPath: 'forligAnsvarsgradBroek',
        })
      }
    />
  );
};

describe('brøk-felt med ugyldig rå draft — clear rydder invalidDrafts (samme konvergente fix)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, erstatningsopgoerelse: null },
      meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
    });
    formPersistenceStore.getState().clearAllFieldErrors();
  });

  it('rydder invalidDrafts når en ufuldstændig brøk ("5/") tømmes og blur\'es', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
              <FractionPage />
            </FormPersistenceProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.type(input, '5/');
    await user.tab();
    expect(eoInvalidDraftFor('forligAnsvarsgradBroek')).toBe('5/');

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    expect(input).toHaveValue('');
    await user.tab();

    expect(eoInvalidDraftFor('forligAnsvarsgradBroek')).toBeUndefined();
    expect(input).toHaveValue('');
  });

  it('skjuler den afledte parse-fejl mens brugeren taster en ny værdi (draft ≠ committedInvalidDraft)', async () => {
    // Fase 5, punkt 8: fejlen (rød kant + tooltip, eksponeret via aria-describedby) afledes af
    // invalidDrafts, men vises KUN når draften aktuelt VISER den ugyldige streng. Så snart brugeren
    // begynder at taste en ny værdi, skjules fejlen — erstatter det gamle clearErrorOnDraftChange.
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
              <FractionPage />
            </FormPersistenceProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Commit en ufuldstændig brøk → persisteret invalidDraft + afledt fejl vist (draft === committedInvalidDraft).
    await user.click(input);
    await user.type(input, '5/');
    await user.tab();
    expect(eoInvalidDraftFor('forligAnsvarsgradBroek')).toBe('5/');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();

    // Begynd at taste en ny værdi: draften afviger nu fra den persisterede ugyldige streng → fejlen skjules.
    // (Råstrengen i store'en er uændret — no-live-preview; kun den AFLEDTE visning forsvinder.)
    await user.click(input);
    await user.type(input, '3');
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(eoInvalidDraftFor('forligAnsvarsgradBroek')).toBe('5/');
  });
});

// Den oprindeligt rapporterede regression i denne runde: årstal-feltet ("Hvilket års svie/smerte-satser
// lægges til grund?"). StyledYearField var en yderligere felt-komponent med samme `unchanged`-guard.
const YearPage = () => {
  const form = usePersistedForm(erstatningsopgoerelseSchema, 'erstatningsopgoerelse', eoInitialValues);
  const report = useFormFieldErrorReporter('erstatningsopgoerelse', 'svieSmerteSatserAar', {
    severity: 'error',
    source: 'input',
  });
  return (
    <StyledYearField
      name="svieSmerteSatserAar"
      value={form.values.svieSmerteSatserAar}
      minYear={2000}
      maxYear={2025}
      onFieldError={report}
      onCommit={(e) =>
        form.setValues((prev) => ({ ...prev, svieSmerteSatserAar: e.target.value }), {
          fieldPath: 'svieSmerteSatserAar',
        })
      }
    />
  );
};

describe('årstal-felt med ugyldig rå draft — clear rydder invalidDrafts (rapporteret regression)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, erstatningsopgoerelse: null },
      meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
    });
    formPersistenceStore.getState().clearAllFieldErrors();
  });

  it('rydder invalidDrafts når et ugyldigt årstal ("123") tømmes og blur\'es', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
              <YearPage />
            </FormPersistenceProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.type(input, '123');
    await user.tab();
    expect(eoInvalidDraftFor('svieSmerteSatserAar')).toBe('123');

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    expect(input).toHaveValue('');
    await user.tab();

    expect(eoInvalidDraftFor('svieSmerteSatserAar')).toBeUndefined();
    expect(input).toHaveValue('');
  });
});
