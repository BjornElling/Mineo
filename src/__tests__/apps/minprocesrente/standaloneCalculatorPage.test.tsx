// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';
import Renteberegning from '../../../components/pages/Renteberegning';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { MemoryRouter } from 'react-router-dom';
import {
  ProductionInputRuntimeProvider,
  bootstrapProductionInputRuntime,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';

vi.mock('../../../hooks/usePersistedActiveTab', () => ({
  usePersistedActiveTab: () => ({ activeTab: 'calculation', setActiveTab: vi.fn() }),
}));

// Standalone MinProcesrentes egne brugerfund. Fanen `RenteberegningTab` er DELT med Mineo, så hvert
// fund måles fra begge sider, hvor de to flader bevidst skal svare forskelligt.

const renderStandalone = () => {
  const { binding } = bootstrapProductionInputRuntime();
  return render(<MinProcesrenteApp inputRuntimeBinding={binding} />);
};

const renderMineo = () => render(
  <MemoryRouter initialEntries={['/renteberegning']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <Renteberegning />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

describe('MinProcesrente – «Slet alle indtastninger»-bekræftelsen (BB-044)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('nævner ikke .eo-filer i standalone, som hverken har Gem, Hent eller filformat', async () => {
    const user = userEvent.setup();
    renderStandalone();

    // Knappen er kun aktiv med afsluttet input; dialogen åbnes derfor gennem en udfyldt beregningsdato.
    const beregningsdato = screen.getByRole('textbox', { name: /beregningsdato/i });
    await user.tripleClick(beregningsdato);
    await user.keyboard('01-01-2024{Enter}');

    const clearAll = await screen.findByRole('button', { name: 'Slet alle indtastninger' });
    await waitFor(() => expect(clearAll).toBeEnabled());
    await user.click(clearAll);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Dette sletter alle de værdier, du har indtastet.');
    expect(dialog).toHaveTextContent('Du kan fortryde med Ctrl+Z.');
    // Beroligelsen skabte den bekymring, den skulle fjerne: en offentlig besøgende har aldrig set en
    // .eo-fil og kunne kun forstå sætningen som, at han måske havde filer, der kunne tage skade.
    expect(dialog).not.toHaveTextContent('.eo-filer');
  });

  it('beholder .eo-sætningen i Mineo, hvor filerne findes', async () => {
    const user = userEvent.setup();
    renderMineo();

    const beregningsdato = screen.getByRole('textbox', { name: /beregningsdato/i });
    await user.tripleClick(beregningsdato);
    await user.keyboard('01-01-2024{Enter}');

    const clearAll = await screen.findByRole('button', { name: 'Slet alle indtastninger' });
    await waitFor(() => expect(clearAll).toBeEnabled());
    await user.click(clearAll);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Indholdet i gemte .eo-filer ændres ikke.');
  });
});

// BB-045/BB-046: opstillingen skiftede på VINDUETS bredde, mens den bredde-rettelse, der hører til
// telefonopstillingen, kun gjaldt berøringsenheder. En zoomende bruger på en almindelig computer fik
// derfor telefonens tre kolonner med desktopbredden – og mistede samtidig tillægstid, enhed og den
// afledte rentedato, mens renten fortsat blev regnet med tillægstiden.
//
// Brugerbeslutning 2026-08-19: visningen låses til enhedstypen og skifter aldrig med vinduet.

const createMediaQueryList = (matches: boolean, media: string): MediaQueryList => ({
  matches,
  media,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

const configureDevice = (options: Readonly<{
  touch: boolean;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
}>): void => {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: options.touch ? 5 : 0 });
  Object.defineProperty(window.screen, 'width', { configurable: true, value: options.screenWidth });
  Object.defineProperty(window.screen, 'height', { configurable: true, value: options.screenHeight });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: options.viewportWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  window.matchMedia = vi.fn((query: string) => createMediaQueryList(
    options.touch && (query === '(pointer: coarse)' || query === '(hover: none)'),
    query
  ));
};

/** Kolonnerne findes KUN i desktopopstillingen; de er derfor dens signatur. */
const hasDesktopColumns = (): boolean =>
  screen.queryAllByText('Evt. tillægstid').length > 0 && screen.queryAllByText('Rentedato').length > 0;

describe('MinProcesrente – opstillingen følger enheden, ikke vinduet (BB-045/BB-046)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('giver desktopopstilling i et SMALT musevindue – vinduets bredde afgør ikke', () => {
    // Præcis fundet: 599 px bredt vindue, ingen berøring. Før faldt fladen i telefonopstillingen.
    configureDevice({ touch: false, screenWidth: 1366, screenHeight: 768, viewportWidth: 599 });
    renderStandalone();

    expect(hasDesktopColumns()).toBe(true);
  });

  it('giver desktopopstilling på en berøringsfølsom bærbar med stor skærm', () => {
    // Brugerens valg: skærmens fysiske størrelse afgør. En touch-laptop er en desktop.
    configureDevice({ touch: true, screenWidth: 1920, screenHeight: 1080, viewportWidth: 1920 });
    renderStandalone();

    expect(hasDesktopColumns()).toBe(true);
  });

  it('giver mobilopstilling på en telefon – også i vandret orientering med bredt viewport', () => {
    // Kortsiden er orienteringsstabil, så en roteret telefon bliver ikke en desktop.
    configureDevice({ touch: true, screenWidth: 915, screenHeight: 412, viewportWidth: 915 });
    renderStandalone();

    expect(hasDesktopColumns()).toBe(false);
  });
});

describe('«Slet alle indtastninger» i tastaturrækkefølgen (BB-047)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('bærer fokusmarkøren, så knappen er i Tab-ringen som sin nabo', () => {
    renderMineo();

    // Uden markøren var knappen ikke fokusérbar, mens «Download samlet oversigt» – tegnet ens, i samme
    // rækkeform lige over – var det. Markøren er samtidig forudsætningen for, at Enter aktiverer knappen.
    expect(screen.getByRole('button', { name: 'Slet alle indtastninger' }))
      .toHaveAttribute('data-mineo-focusable-button', 'true');
    expect(screen.getByRole('button', { name: 'Download samlet oversigt' }))
      .toHaveAttribute('data-mineo-focusable-button', 'true');
  });
});
