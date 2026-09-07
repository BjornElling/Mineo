// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import type React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import StandardLoenTable from '../../../components/tables/StandardLoenTable';
import { aarsloenStandardLoenFieldSet } from '../../../domain/aarsloen/aarsloenStandardLoenFieldSet';
import { createAarsloenInitialValues } from '../../../domain/aarsloen/aarsloenInitialValues';
import { APP_ROUTES } from '../../../config/pageNavigation';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import {
  changeTableInput,
  focusTableElement,
  keyDownTableElement,
  openTableInputEditing,
} from './tableInteractionTestUtils';

// Autofill-suggest på tabeloverfladen (`input-field-behavior-contract.md` §1.5, `keyboard-navigation.md`
// §Enter). Testen måler den observerbare adfærd, kravet handler om: ghosten står i den fokuserede, TOMME
// celle, Enter indsætter præcis den viste tekst gennem den normale settle-vej og beholder fokus i cellen.

const catalog = getProductionInputCatalog();
const iso = (value: string) => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });

const hydrate = (sections: Readonly<{
  erstatningsopgoerelse?: ErstatningsopgoerelseValues | null;
  aarsloen?: Record<string, unknown> | null;
}>): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erhvervsevnetab: null,
      aarsloen: sections.aarsloen ?? null,
      erstatningsopgoerelse: sections.erstatningsopgoerelse ?? null,
    },
    rejectedInputs: {},
  });
  hydrateSlimInputStoreForTest(slimInputStore, input);
};

const renderInRuntime = (child: React.ReactNode) => render(
  <MemoryRouter>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          {child}
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const dataRows = (): HTMLElement[] =>
  screen.getAllByRole('row').filter((row) => row.hasAttribute('data-mineo-row-id'));

const cellInput = (rowIndex: number, label: string): HTMLInputElement => {
  const row = dataRows()[rowIndex];
  if (row === undefined) throw new Error(`Ingen datarække med indeks ${String(rowIndex)}`);
  const input = within(row).getByLabelText(label);
  if (!(input instanceof HTMLInputElement)) throw new Error(`«${label}» er ikke et inputfelt`);
  return input;
};

const undoDepth = (): number => slimInputStore.getState().history.past.length;

const renderYdelser = (rows: readonly OffentligeYdelserRow[]): void => {
  hydrate({
    erstatningsopgoerelse: { ...createErstatningsopgoerelseInitialValues(), offentligeYdelserRows: [...rows] },
  });
  renderInRuntime(
    <>
      {/* Et fokusmål UDEN FOR tabellen, så testen kan måle, at ghosten følger fokus. */}
      <button type="button">uden for tabellen</button>
      <OffentligeYdelserTable
        committedRows={rows}
        derivedByRowId={new Map()}
        disableMidlertidigtEetOption={false}
      />
    </>
  );
};

const MAANEDSRAEKKER: readonly OffentligeYdelserRow[] = [
  {
    id: 'ydelse-1',
    fraDato: iso('2026-01-01'),
    tilDato: iso('2026-01-31'),
    ydelse: amount(3100),
    tillaeg: undefined,
    ydelsestype: 'dagpenge',
  },
  {
    id: 'ydelse-2',
    fraDato: iso('2026-02-01'),
    tilDato: iso('2026-02-28'),
    ydelse: amount(3100),
    tillaeg: undefined,
    ydelsestype: 'dagpenge',
  },
];

describe('Autofill-suggest i Offentlige ydelser-tabellen', () => {
  afterEach(cleanup);

  it('viser ingen ghost, før cellen er fokuseret', () => {
    renderYdelser(MAANEDSRAEKKER);
    // Trailing tom række = indeks 2.
    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', 'dd-mm-åååå');
  });

  it('viser mønstrets næste dato som ghost i den fokuserede, tomme celle', async () => {
    renderYdelser(MAANEDSRAEKKER);
    await focusTableElement(cellInput(2, 'Fra dato'));

    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', '01-03-2026');
    expect(cellInput(2, 'Fra dato')).toHaveValue('');
    // Ghosten er hørbar for en skærmlæser og bærer sin aktiveringstast – og cellen PEGER på teksten,
    // så den ikke er en løsrevet node.
    const description = screen.getByText('Forslag: 01-03-2026. Tryk Enter for at indsætte.');
    expect(cellInput(2, 'Fra dato').getAttribute('aria-describedby')?.split(' '))
      .toContain(description.id);
    expect(screen.getAllByText('ENTER')).toHaveLength(1);
  });

  it('viser ydelsestype-ghost i den første delvist udfyldte række efter to ens valg', async () => {
    renderYdelser([
      ...MAANEDSRAEKKER,
      {
        id: 'ydelse-3',
        fraDato: iso('2026-03-01'),
        tilDato: iso('2026-03-31'),
        ydelse: amount(3100),
        tillaeg: undefined,
        // En eksisterende række bærer historisk den tomme streng, ikke `undefined`.
        ydelsestype: '',
      },
    ]);

    const ydelsestype = cellInput(2, 'Ydelsestype');
    await focusTableElement(ydelsestype);

    expect(ydelsestype).toHaveAttribute('placeholder', 'Dagpenge');
    expect(screen.getByText('Forslag: Dagpenge. Tryk Enter for at indsætte.')).toBeInTheDocument();
  });

  it('lader Enter indsætte den viste tekst og beholde fokus i cellen', async () => {
    renderYdelser(MAANEDSRAEKKER);
    await focusTableElement(cellInput(2, 'Fra dato'));
    await keyDownTableElement(cellInput(2, 'Fra dato'), { key: 'Enter' });

    const accepted = cellInput(2, 'Fra dato');
    expect(accepted).toHaveValue('01-03-2026');
    expect(document.activeElement).toBe(accepted);
    // Værdien er afsluttet, så der er intet forslag tilbage i cellen.
    expect(screen.queryByText(/^Forslag:/)).not.toBeInTheDocument();
  });

  it('farver kr.-enheden som ghosten i et beløbsfelt', async () => {
    renderYdelser(MAANEDSRAEKKER);
    const ydelse = cellInput(2, 'Ydelse');
    await focusTableElement(ydelse);

    expect(ydelse).toHaveAttribute('placeholder', '3.100,00');
    const unit = ydelse.parentElement?.querySelector('.MuiInputAdornment-root');
    expect(unit).not.toBeNull();
    expect(unit).toHaveStyle('color: var(--mineo-color-active-grid-autofill)');
  });

  it('foreslår både dato og beløb hen over et kalenderårsskifte', async () => {
    renderYdelser([
      { ...MAANEDSRAEKKER[0]!, fraDato: iso('2025-11-01'), tilDato: iso('2025-11-30') },
      { ...MAANEDSRAEKKER[1]!, fraDato: iso('2025-12-01'), tilDato: iso('2025-12-31') },
    ]);

    await focusTableElement(cellInput(2, 'Fra dato'));
    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', '01-01-2026');

    // Beløbet standsede tidligere ved årsskiftet. Reglen er væk (udviklerens beslutning 2026-09-07):
    // ghosten er værdien i cellen ovenover, og en tom beløbscelle ved et årsskifte var i praksis en
    // manglende ghost uden nogen forklaring i det, brugeren kunne se.
    await focusTableElement(cellInput(2, 'Ydelse'));
    expect(cellInput(2, 'Ydelse')).toHaveAttribute('placeholder', '3.100,00');
  });

  it('foreslår intet i en celle, hvis nabocelle ovenover er tom', async () => {
    // Synlighedsreglen måles på CELLEN: fra-datoen har en udfyldt celle ovenover og får sin ghost, mens
    // ydelsen ikke har og derfor beholder sin formatplaceholder – i den SAMME række.
    renderYdelser([
      { ...MAANEDSRAEKKER[0]! },
      { ...MAANEDSRAEKKER[1]!, ydelse: undefined },
    ]);
    await focusTableElement(cellInput(2, 'Fra dato'));
    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', '01-03-2026');
    await focusTableElement(cellInput(2, 'Ydelse'));
    expect(cellInput(2, 'Ydelse')).toHaveAttribute('placeholder', '0,00');
  });

  it('lader Enter navigere nedad, når cellen ikke har en ghost', async () => {
    // Én udfyldt række giver intet mønster, og der er derfor intet at acceptere.
    renderYdelser([MAANEDSRAEKKER[0]!]);
    await focusTableElement(cellInput(0, 'Fra dato'));
    await keyDownTableElement(cellInput(0, 'Fra dato'), { key: 'Enter' });

    expect(document.activeElement).toBe(cellInput(1, 'Fra dato'));
  });

  it('rydder Tab-ankeret ved autofill-accept, så næste Enter starter i den accepterede celle', async () => {
    renderYdelser(MAANEDSRAEKKER);
    const acceptedFraDato = cellInput(2, 'Fra dato');
    await focusTableElement(cellInput(1, 'Fra dato'));
    await keyDownTableElement(cellInput(1, 'Fra dato'), { key: 'Tab' });
    await focusTableElement(acceptedFraDato);
    await keyDownTableElement(acceptedFraDato, { key: 'Enter' });

    expect(acceptedFraDato).toHaveValue('01-03-2026');
    expect(document.activeElement).toBe(acceptedFraDato);

    // Ghost-accept har ingen navigation og må heller ikke efterlade Tab-ankeret. Næste almindelige
    // Enter bruger derfor den accepterede celle som udgangspunkt og wrap'er til første række.
    await keyDownTableElement(acceptedFraDato, { key: 'Enter' });
    expect(document.activeElement).toBe(cellInput(0, 'Fra dato'));
  });

  it('fjerner ghosten, når fokus forlader tabellen', async () => {
    renderYdelser(MAANEDSRAEKKER);
    await focusTableElement(cellInput(2, 'Fra dato'));
    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', '01-03-2026');

    // Grid-core'ens logiske fokuscelle blev tidligere ALDRIG ryddet, så ghosten stod tilbage i en
    // tabel, brugeren var gået fra – og i én celle pr. tabel, han havde besøgt.
    await focusTableElement(screen.getByRole('button', { name: 'uden for tabellen' }));
    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', 'dd-mm-åååå');
    expect(screen.queryByText(/^Forslag:/)).not.toBeInTheDocument();
  });

  it('fjerner ghosten, så snart brugeren selv begynder at skrive', async () => {
    renderYdelser(MAANEDSRAEKKER);
    await focusTableElement(cellInput(2, 'Fra dato'));
    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', '01-03-2026');

    await keyDownTableElement(cellInput(2, 'Fra dato'), { key: '0' });
    expect(cellInput(2, 'Fra dato')).toHaveValue('0');
    expect(cellInput(2, 'Fra dato')).toHaveAttribute('placeholder', '');
    expect(screen.queryByText(/^Forslag:/)).not.toBeInTheDocument();
  });

  it('lader Shift+Enter navigere opad uden at indsætte forslaget', async () => {
    renderYdelser(MAANEDSRAEKKER);
    await focusTableElement(cellInput(2, 'Fra dato'));
    await keyDownTableElement(cellInput(2, 'Fra dato'), { key: 'Enter', shiftKey: true });

    expect(cellInput(2, 'Fra dato')).toHaveValue('');
    expect(document.activeElement).toBe(cellInput(1, 'Fra dato'));
  });

  it('koster præcis ét fortryd-trin at acceptere et forslag', async () => {
    renderYdelser(MAANEDSRAEKKER);
    await focusTableElement(cellInput(2, 'Fra dato'));
    const before = undoDepth();

    await keyDownTableElement(cellInput(2, 'Fra dato'), { key: 'Enter' });

    // Accepten opretter rækken OG skriver feltet, men det er ÉN brugerhandling (§1.4).
    expect(cellInput(2, 'Fra dato')).toHaveValue('01-03-2026');
    expect(undoDepth()).toBe(before + 1);
  });

  it('viser, accepterer og afviser uden bivirkning et dropdown-forslag', async () => {
    renderYdelser(MAANEDSRAEKKER);
    const ydelsestype = cellInput(2, 'Ydelsestype');

    await focusTableElement(ydelsestype);
    expect(ydelsestype).toHaveAttribute('placeholder', 'Dagpenge');
    expect(screen.getByText('Forslag: Dagpenge. Tryk Enter for at indsætte.')).toBeInTheDocument();

    // Tab accepterer aldrig et valg – den synlige ghost er fortsat kun et forslag.
    await keyDownTableElement(ydelsestype, { key: 'Tab' });
    expect(ydelsestype).toHaveValue('');

    // Et klik åbner menuen som normalt og vælger heller ikke ghosten stiltiende.
    fireEvent.click(ydelsestype);
    expect(ydelsestype).toHaveAttribute('aria-expanded', 'true');
    expect(ydelsestype).toHaveValue('');
    fireEvent.keyDown(ydelsestype, { key: 'Escape' });
    expect(ydelsestype).toHaveAttribute('aria-expanded', 'false');

    await keyDownTableElement(ydelsestype, { key: 'Enter' });
    expect(ydelsestype).toHaveValue('Dagpenge');
    expect(document.activeElement).toBe(ydelsestype);
  });
});

const MAANED_LOENRAEKKER = [
  { id: 'loen-1', col0_maaned: '11', col1_maaned: '2025', col2: amount(30000) },
  { id: 'loen-2', col0_maaned: '12', col1_maaned: '2025', col2: amount(30000) },
] as const;

const renderLoentabel = (autofillSuggest: boolean): void => {
  const rows = MAANED_LOENRAEKKER.map((row) => ({ ...row }));
  hydrate({
    aarsloen: { ...createAarsloenInitialValues(), loenperiode: 'maaned', tableData: rows },
  });
  renderInRuntime(
    <StandardLoenTable
      fieldSet={aarsloenStandardLoenFieldSet}
      loenperiode="maaned"
      satser={{}}
      locationNav={{ route: APP_ROUTES.aarsloen, tabKey: null }}
      {...(autofillSuggest ? { autofillSuggest: true } : {})}
    />
  );
};

describe('Autofill-suggest i løntabellen', () => {
  afterEach(cleanup);

  it('er slået FRA, når kaldsstedet ikke tilvælger den', async () => {
    renderLoentabel(false);
    await focusTableElement(cellInput(2, 'Måned'));
    expect(cellInput(2, 'Måned')).toHaveAttribute('placeholder', 'mm');
  });

  it('foreslår januar og det nye årstal efter december, når den er tilvalgt', async () => {
    renderLoentabel(true);

    await focusTableElement(cellInput(2, 'Måned'));
    expect(cellInput(2, 'Måned')).toHaveAttribute('placeholder', '1');
    await keyDownTableElement(cellInput(2, 'Måned'), { key: 'Enter' });
    expect(cellInput(2, 'Måned')).toHaveValue('1');

    await focusTableElement(cellInput(2, 'År'));
    expect(cellInput(2, 'År')).toHaveAttribute('placeholder', '2026');
    await keyDownTableElement(cellInput(2, 'År'), { key: 'Enter' });
    expect(cellInput(2, 'År')).toHaveValue('2026');
  });

  it('foreslår måned, år og lønbeløb hen over årsskiftet', async () => {
    renderLoentabel(true);
    // Alle tre celler ovenover er udfyldte, så alle tre har en ghost. Måneden wrapper til januar, og
    // årstallet følger med til 2026 – det er kravet «altid skifte af årstal ved årsskiftet».
    await focusTableElement(cellInput(2, 'Måned'));
    expect(cellInput(2, 'Måned')).toHaveAttribute('placeholder', '1');
    await focusTableElement(cellInput(2, 'År'));
    expect(cellInput(2, 'År')).toHaveAttribute('placeholder', '2026');
    await focusTableElement(cellInput(2, 'Løn'));
    expect(cellInput(2, 'Løn')).toHaveAttribute('placeholder', '30.000,00');
  });
  it('foreslår ikke i en celle, hvis afsluttede værdi brugeren netop har slettet i editoren', async () => {
    // `202` er en canonical, men rød årsværdi (tre cifre). Den er ingen mønsterprøve, så motorens
    // «cellen har allerede en værdi»-værn ser den ikke – og tomhedstesten skal derfor måle den
    // AFSLUTTEDE værdi, ikke draften. Ellers ville «markér alt, slet, Enter» SKRIVE 2026 i stedet for
    // at rydde cellen (`keyboard-navigation.md`: Enter må ikke overskrive uden samtykke).
    const rows = [
      ...MAANED_LOENRAEKKER.map((row) => ({ ...row })),
      { id: 'loen-3', col0_maaned: '3', col1_maaned: '202' },
    ];
    hydrate({ aarsloen: { ...createAarsloenInitialValues(), loenperiode: 'maaned', tableData: rows } });
    renderInRuntime(
      <StandardLoenTable
        fieldSet={aarsloenStandardLoenFieldSet}
        loenperiode="maaned"
        satser={{}}
        locationNav={{ route: APP_ROUTES.aarsloen, tabKey: null }}
        autofillSuggest
      />
    );

    const aarCelle = cellInput(2, 'År');
    expect(aarCelle).toHaveValue('202');
    await openTableInputEditing(aarCelle, '2');
    await changeTableInput(aarCelle, '');
    expect(aarCelle).toHaveAttribute('placeholder', '');
    expect(screen.queryByText(/^Forslag:/)).not.toBeInTheDocument();

    await keyDownTableElement(aarCelle, { key: 'Enter' });
    expect(cellInput(2, 'År')).toHaveValue('');
  });
});
