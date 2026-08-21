// @vitest-environment jsdom
//
// `varigemen-contract.md` §2.9: alle beløb i varige mén vises i HELE KRONER uden decimaler – på begge
// faner og i dokumentet. Reglen er unik for denne ydelse (brugerbeslutning 2026-08-21, BB-078/BB-079)
// og er derfor ikke dækket af `amount-contract.md` §5's to-decimal-standard.
//
// Testen måler gennem den ÆGTE side og den ægte produktions-runtime, og den er skrevet som et
// FRAVÆRSVÆRN med en modprøve: den påstår både, at ingen beløbsvisning bærer en decimaldel, og at de
// konkrete beløb faktisk står der (ellers ville en tom skærm bestå den første påstand).
//
// Den anden halvdel af §2.9 – at de tre viste linjer stadig går op – måles her på de RENDEREDE
// tekster, ikke på beregningsresultatet: det er netop visningens afrunding, reglen kunne bryde.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import VarigeMen from '../../../../components/pages/VarigeMen';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../../contexts/RoutePathnameProvider';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../inputCore/react';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';
import { hydrateSlimInputStoreForTest } from '../../../../test/actSafeInputStore';
import { varigeMenPrGrad } from '../../../../data/lovbestemteRates';
import type { StamdataValues } from '../../../../schemas/formSchemas/sections/stamdataSchemas';
import type { VarigeMenValues } from '../../../../schemas/formSchemas';
import { toISODateString } from '../../../../types/branded';

const catalog = getProductionInputCatalog();

const hydrate = (varigemen: VarigeMenValues | null, stamdata: StamdataValues | null): void => {
  hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null, varigemen, forsoergertab: null,
      erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  }));
};

/** Fødselsdato 1970 + skadedato 2015 → alder 45 → aldersreduktion 6 %, så alle tre linjer vises. */
const stamdataMedReduktion: StamdataValues = {
  journalnr: 'J-2026-001',
  advokat: 'Test Advokat',
  sagsbehandler: 'Test Sagsbehandler',
  skadelidteFodselsdato: toISODateString('1970-01-01'),
  skadedato: toISODateString('2015-01-01'),
  skadestype: 'Arbejdsulykke',
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/varigemen']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <VarigeMen />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

/** Alle synlige beløbsvisninger på fanen: hver tekst, der bærer enheden «kr.». */
const beloebstekster = (): string[] =>
  screen.getAllByText(/kr\./).map((el) => el.textContent ?? '');

/** «11.035» → 11035. Bruges til at afstemme de tre viste linjer mod hinanden. */
const parseDanskBeloeb = (text: string): number => {
  const match = /(-?\s?[\d.]+) kr\./.exec(text);
  if (!match) throw new Error(`Ingen beløb i «${text}»`);
  return Number(match[1].replace(/[\s.]/g, ''));
};

describe('Varige mén – alle beløb vises i hele kroner (§2.9)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    hydrate(null, null);
  });

  it('Beregning: ingen beløbslinje bærer decimaler, og de tre linjer går op', () => {
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2020-01-01') }, stamdataMedReduktion);
    renderPage();

    // Modprøve: beløbene ER der (ellers ville fraværspåstanden nedenfor bestå på en tom skærm).
    // Sats 2020 = 9.180 → grundbeløb 91.800; alder 45 → 6 % → godtgørelse ceil(86.292) = 86.292.
    const tekster = beloebstekster();
    expect(tekster.length).toBeGreaterThanOrEqual(4);
    expect(tekster.join(' | ')).toContain('9.180 kr.');

    // §2.9: ingen decimaldel nogen steder.
    for (const tekst of tekster) {
      expect(tekst).not.toMatch(/\d,\d/);
    }

    const grundbeloeb = parseDanskBeloeb(screen.getByText(/^91\.800 kr\.$/).textContent ?? '');
    // Reduktionslinjen vises med foranstillet minus; fortegnet ER regnestykkets fratræk.
    const reduktion = parseDanskBeloeb(screen.getByText(/^- [\d.]+ kr\.$/).textContent ?? '');
    const godtgoerelse = parseDanskBeloeb(screen.getByText(/^86\.292 kr\.$/).textContent ?? '');

    expect(grundbeloeb).toBe(91800);
    expect(reduktion).toBe(-5508);
    expect(godtgoerelse).toBe(86292);
    // Den viste regnskabslinje skal gå op – på de VISTE tal, ikke på beregningsresultatet.
    expect(grundbeloeb + reduktion).toBe(godtgoerelse);
  });

  it('Beregning: satsrækken og «á»-formuleringen skriver samme sats på samme form (BB-079)', () => {
    hydrate({ mengrad: 10, beregningsdato: toISODateString('2026-01-01') }, stamdataMedReduktion);
    renderPage();

    // Samme sats, to steder på skærmen: satsrækkens værdi og grundbeløbets label.
    expect(screen.getByText('11.035 kr.')).toBeInTheDocument();
    expect(screen.getByText(/á 11\.035 kr\.$/)).toBeInTheDocument();
  });

  it('Satser-fanen: alle 22 satser vises som hele kroner (BB-078)', async () => {
    const user = userEvent.setup();
    hydrate(null, null);
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Satser' }));

    const tabel = screen.getByRole('table');
    const raekker = within(tabel).getAllByRole('row').slice(1); // uden headeren
    expect(raekker).toHaveLength(Object.keys(varigeMenPrGrad).length);

    for (const raekke of raekker) {
      const satscelle = within(raekke).getAllByRole('cell')[1];
      expect(satscelle.textContent).toMatch(/^[\d.]+ kr\.$/);
      expect(satscelle.textContent).not.toMatch(/\d,\d/);
    }

    // Modprøve på det konkrete tal, så en tom eller nulstillet tabel ikke består.
    expect(within(tabel).getByText('11.035 kr.')).toBeInTheDocument();
  });
});
