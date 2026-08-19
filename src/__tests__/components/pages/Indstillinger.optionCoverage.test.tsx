// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Indstillinger from '../../../components/pages/Indstillinger';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import {
  APP_SETTINGS_AFSLUTTES_MED_OPTIONS,
  APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS,
  DEFAULT_APP_SETTINGS,
} from '../../../settings/appSettingsSchema';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../../../settings/appSettingsStorage';
import {
  DOCUMENT_DOWNLOAD_FORMAT_OPTIONS,
  getDocumentFormatLabel,
} from '../../../document/documentFormat';
import {
  LOENPERIODE_LABELS,
  SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS,
} from '../../../schemas/formSchemas';

/**
 * Indstillingssidens valg-kontroller: dækker det hul, TYPEN ikke kan dække.
 *
 * Siden havde tidligere fem håndskrevne `is…Option`-typeguards, ét pr. kontrol, hver med kroppen
 * `(OPTIONS as readonly string[]).includes(value)`. De fandtes udelukkende for at reparere en
 * widening, siden selv indførte ved at annotere sine handlere `StyledDropdownChangeEvent<string>`:
 * `StyledDropdown` er generisk, så uden annotationen inferes literal-unionen, og guarden har intet
 * at lave. Guardens `as readonly string[]`-cast kastede netop den type væk, den bagefter påstod at
 * etablere – et run-time-tjek sat i stedet for et compile-time-tjek, der allerede var muligt.
 *
 * TYPENS MÅLTE LOFT er grunden til, at denne fil findes. `TValue` inferes fra `value`-proppen
 * ALENE – ikke fra de rendrede `MenuItem`-børn (MUI typer `value` bredt). Målt i begge retninger:
 * en `value`-prop udvidet til `string` giver TS2322, mens en `MenuItem` med en værdi uden for
 * unionen typechecker GRØNT. Compileren kan altså sikre, at det COMMITTEDE er en gyldig værdi,
 * men ikke at brugeren rent faktisk kan VÆLGE dem alle – eller kun dem.
 *
 * Testen måler derfor det, typen ikke kan se: hver kontrols faktisk rendrede valgmuligheder er
 * PRÆCIS sit schema-univers, i begge retninger. En glemt værdi (brugeren kan ikke vælge en gyldig
 * indstilling) og en overskydende værdi (brugeren kan vælge noget, schemaet afviser) er begge
 * fejl, og ingen af dem ville standse en typecheck.
 */

const renderIndstillinger = async (): Promise<void> => {
  render(
    <BrowserRouter>
      <ThemeProvider theme={createTheme()}>
        <AppSettingsProvider>
          <Indstillinger />
        </AppSettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
  // Vent på den device-lokale standardmappe, så dens asynkrone resolver ikke skriver state efter
  // testens første assertion og dermed havner uden for Testing Librarys act-vindue.
  await screen.findByText('Skrivebord (standard)');
};

beforeEach(() => {
  // Kendt udgangspunkt uden at røre window.localStorage direkte (forbudt af test-setup).
  writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
});

/** Åbner en `StyledDropdown` via dens combobox og returnerer listboxens option-etiketter. */
const openDropdownOptions = async (comboboxIndex: number): Promise<readonly string[]> => {
  const user = userEvent.setup();
  const comboboxes = screen.getAllByRole('combobox');
  const combobox = comboboxes[comboboxIndex];
  if (combobox === undefined) {
    throw new Error(`Ingen combobox på index ${comboboxIndex} (fandt ${comboboxes.length})`);
  }
  await user.click(combobox);
  const listbox = await screen.findByRole('listbox');
  return within(listbox)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
};

describe('Indstillinger – hver valgkontrols valgmuligheder er præcis sit schema-univers', () => {
  it('«Download-format for dokumenter» tilbyder præcis DOCUMENT_DOWNLOAD_FORMAT_OPTIONS', async () => {
    await renderIndstillinger();
    const rendered = await openDropdownOptions(0);
    expect(rendered).toEqual(DOCUMENT_DOWNLOAD_FORMAT_OPTIONS.map(getDocumentFormatLabel));
  });

  it('«Løn på helligdage» tilbyder præcis APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS', async () => {
    await renderIndstillinger();
    const rendered = await openDropdownOptions(1);
    expect(rendered).toEqual([...APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS]);
  });

  it('«Opgørelse afsluttes med» tilbyder præcis APP_SETTINGS_AFSLUTTES_MED_OPTIONS', async () => {
    await renderIndstillinger();
    // Rækkefølgen af comboboxes følger DOM-rækkefølgen: format(0), helligdage(1),
    // overenskomst L(2), overenskomst A(3), afsluttes med(4), udløb-måneder(5).
    const rendered = await openDropdownOptions(4);
    expect(rendered).toEqual([...APP_SETTINGS_AFSLUTTES_MED_OPTIONS]);
  });

  it('«Løn indtastes som» tilbyder præcis lønperiode-enummets etiketter', async () => {
    await renderIndstillinger();
    const expected = LOENPERIODE_LABELS.options.map((option) => option.label);
    for (const label of expected) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    // Modsatte retning: ingen radio i gruppen ud over de forventede.
    const group = screen.getByRole('radio', { name: expected[0] }).closest('[role="radiogroup"]');
    expect(group).not.toBeNull();
    expect(within(group as HTMLElement).getAllByRole('radio')).toHaveLength(expected.length);
  });

  it('«Svie/smerte-sats ved delvis sygemelding» tilbyder præcis satsvalg-enummets etiketter', async () => {
    await renderIndstillinger();
    const expected = SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS.options.map((option) => option.label);
    for (const label of expected) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    const group = screen.getByRole('radio', { name: expected[0] }).closest('[role="radiogroup"]');
    expect(group).not.toBeNull();
    expect(within(group as HTMLElement).getAllByRole('radio')).toHaveLength(expected.length);
  });
});

describe('Indstillinger – et valg committes med sin egen type', () => {
  it('valg i «Opgørelse afsluttes med» skriver den valgte værdi til settings', async () => {
    const user = userEvent.setup();
    await renderIndstillinger();

    const target = APP_SETTINGS_AFSLUTTES_MED_OPTIONS.find(
      (option) => option !== 'Bekræftet godkendt'
    );
    expect(target).toBeDefined();

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[4] as HTMLElement);
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: target as string }));

    expect(screen.getAllByRole('combobox')[4]).toHaveValue(target as string);
  });

  it('valg i «Løn indtastes som» skriver den valgte værdi til settings', async () => {
    const user = userEvent.setup();
    await renderIndstillinger();

    // Default er 'maaned' ⇒ vælg en anden for at måle en faktisk ændring.
    const target = LOENPERIODE_LABELS.options.find((option) => option.value !== 'maaned');
    expect(target).toBeDefined();

    const radio = screen.getByRole('radio', { name: (target as { label: string }).label });
    await user.click(radio);

    expect(radio).toBeChecked();
  });
});
