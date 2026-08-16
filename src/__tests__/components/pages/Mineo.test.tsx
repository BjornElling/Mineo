// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Mineo from '../../../components/pages/Mineo';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { LOCAL_STORAGE_KEY, readLocalStorage, writeLocalStorage } from '../../../settings/appSettingsStorage';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';

// Mock LICENSE filen
vi.mock('../../../assets/LICENSE.txt?raw', () => ({
  default: 'MIT License\n\nCopyright (c) 2026 Test\n\nPermission is hereby granted...',
}));

// Mock PWA install utility
const requestPwaInstallMock = vi.fn().mockResolvedValue({
  kind: 'unavailable',
  reason: 'promptUnavailable',
});

vi.mock('../../../utils/pwaInstallPrompt', () => ({
  PWA_OPEN_PROTOCOL_URL: 'web+mineo://open',
  requestPwaInstall: () => requestPwaInstallMock(),
}));

/**
 * Helper til at rendere Mineo-siden med alle nødvendige providers
 */
const renderMineo = () => {
  const theme = createTheme();
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <AppSettingsProvider>
          <Mineo />
        </AppSettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Mineo - License Modal Integration', () => {
  beforeEach(() => {
    writeLocalStorage(LOCAL_STORAGE_KEY, '');
  });

  test('modal er lukket som standard (anti-regression)', () => {
    renderMineo();

    // Modal skal ikke være i DOM'en (ikke bare skjult)
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('klik på "MIT-licensen" åbner modal', async () => {
    const user = userEvent.setup();
    renderMineo();

    // Verificer at modal er lukket (ikke i DOM)
    expect(screen.queryByRole('dialog')).toBeNull();

    // Find og klik på MIT-licensen linket (via role, ikke tekst-match)
    const licenseLink = screen.getByRole('button', { name: /mit-licensen/i });
    await user.click(licenseLink);

    // Modal skal nu være åben (i DOM med dialog role)
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Verificer modal-struktur (ikke indhold)
    expect(within(dialog).getByLabelText(/luk/i)).toBeInTheDocument();
  });

  test('modal kan lukkes med Escape efter åbning', async () => {
    const user = userEvent.setup();
    renderMineo();

    // Åbn modal
    const licenseLink = screen.getByRole('button', { name: /mit-licensen/i });
    await user.click(licenseLink);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Luk med Escape
    await user.keyboard('{Escape}');

    // Modal skal være fjernet fra DOM (ikke bare skjult)
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('modal kan lukkes med close-knap efter åbning', async () => {
    const user = userEvent.setup();
    renderMineo();

    // Åbn modal
    const licenseLink = screen.getByRole('button', { name: /mit-licensen/i });
    await user.click(licenseLink);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Luk med close-knap
    const dialog = screen.getByRole('dialog');
    const closeButton = within(dialog).getByRole('button', { name: /luk/i });
    await user.click(closeButton);

    // Modal skal være fjernet fra DOM
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('modal kan åbnes og lukkes flere gange', async () => {
    const user = userEvent.setup();
    renderMineo();

    const licenseLink = screen.getByRole('button', { name: /mit-licensen/i });

    // Første åbning/lukning
    await user.click(licenseLink);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    // Anden åbning/lukning
    await user.click(licenseLink);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('licens-kontrollen er en KNAP, ikke et link — den udfører en handling', () => {
    renderMineo();

    // Semantikken er load-bearing, ikke kosmetik: kontrollen åbner en dialog og navigerer ikke, så den skal
    // være en knap. Som `<a href="#">` løj den om semantikken OG nulstillede browserens sekventielle
    // fokus-udgangspunkt til dokumentets top, så næste Tab sprang tilbage til startside-togglen længere oppe
    // på siden.
    const licenseLink = screen.getByRole('button', { name: /mit-licensen/i });
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink).toBeVisible();
    // Intet fragment-href må komme tilbage — det er præcis det, der flyttede fokus-origoen.
    expect(licenseLink).not.toHaveAttribute('href');
  });

  test('download-kontrollen er ligeledes en KNAP uden fragment-href', () => {
    renderMineo();

    const installControl = screen.getByRole('button', { name: /download hjælpeprogram/i });
    expect(installControl).toBeVisible();
    expect(installControl).not.toHaveAttribute('href');
  });

  describe('«Download hjælpeprogram» når programmet allerede er installeret', () => {
    beforeEach(() => {
      requestPwaInstallMock.mockReset().mockResolvedValue({
        kind: 'unavailable',
        reason: 'promptUnavailable',
      });
    });

    const clickDownload = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
      await user.click(screen.getByRole('button', { name: /download hjælpeprogram/i }));
    };

    test('på hjemmesiden UDEN installation: ingen popup, den normale installation starter', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'completed', outcome: 'accepted' });
      renderMineo();

      await clickDownload(user);

      // Den oprindelige adfærd må ikke ofres for den nye dialog.
      await waitFor(() => expect(requestPwaInstallMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    test('viser en konkret besked, når browseren ikke kan åbne installationsdialogen', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'unavailable', reason: 'promptUnavailable' });
      renderMineo();

      await clickDownload(user);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Installationsdialogen kunne ikke åbnes')).toBeInTheDocument();
      expect(within(dialog).getByText(/installationsikonet i adresselinjen/i)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Luk' })).toBeVisible();
    });

    test('forklarer, når browseren ikke kan afgøre, om hjælpeprogrammet allerede findes', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'unavailable', reason: 'statusUnknown' });
      renderMineo();

      await clickDownload(user);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Installationsstatus kunne ikke afgøres')).toBeInTheDocument();
      expect(within(dialog).getByText(/åbne det fra computerens appmenu/i)).toBeInTheDocument();
    });

    test('på hjemmesiden MED installation: popup i stedet for installation', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'alreadyInstalled', state: 'installed' });
      renderMineo();

      await clickDownload(user);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/allerede installeret/i)).toBeInTheDocument();
      // Detektion sker gennem samme samlede request-flow, men der startes ingen browserprompt.
      expect(requestPwaInstallMock).toHaveBeenCalledTimes(1);
    });

    test('popup\'en tilbyder åbning via browseren og en tydelig fallback', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'alreadyInstalled', state: 'installed' });
      renderMineo();

      await clickDownload(user);
      const dialog = await screen.findByRole('dialog');

      expect(within(dialog).getByRole('link', { name: 'Åbn program' })).toBeVisible();
      expect(within(dialog).getByRole('link', { name: 'Åbn program' })).toHaveAttribute('href', 'web+mineo://open');
      expect(within(dialog).getByRole('button', { name: 'Annuller' })).toBeVisible();
      expect(within(dialog).getByText(/browseren bede om tilladelse/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/computerens appmenu eller skrivebord/i)).toBeInTheDocument();
      expect(within(dialog).getAllByRole('button')).toHaveLength(1);
    });

    test('«Annuller» lukker popup\'en UDEN at åbne noget', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'alreadyInstalled', state: 'installed' });
      renderMineo();

      await clickDownload(user);
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Annuller' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(requestPwaInstallMock).toHaveBeenCalledTimes(1);
    });

    test('Escape lukker popup\'en uden at åbne noget', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'alreadyInstalled', state: 'installed' });
      renderMineo();

      await clickDownload(user);
      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    test('INDE i PWA\'en: popup\'en siger «allerede åbent» og har kun ÉN knap', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'alreadyInstalled', state: 'running' });
      renderMineo();

      await clickDownload(user);
      const dialog = await screen.findByRole('dialog');

      expect(within(dialog).getByText(/allerede åbent/i)).toBeInTheDocument();
      // Der er intet at åbne, når programmet allerede kører — så intet «Åbn program»-valg.
      expect(within(dialog).getAllByRole('button')).toHaveLength(1);
      expect(within(dialog).getByRole('button', { name: 'Luk' })).toBeVisible();
      expect(within(dialog).queryByRole('button', { name: 'Åbn program' })).toBeNull();
    });

    test('INDE i PWA\'en: «Luk» lukker popup\'en uden at åbne et nyt vindue', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'alreadyInstalled', state: 'running' });
      renderMineo();

      await clickDownload(user);
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Luk' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      // Et nyt vindue her ville åbne en dublet af det vindue, brugeren allerede sidder i.
    });

    test('tilstanden aflæses ved HVERT klik, ikke ved render', async () => {
      const user = userEvent.setup();
      // Brugeren installerer fra adresselinjen MELLEM de to klik. Måltes tilstanden ved render,
      // ville andet klik stadig forsøge en installation af noget, der allerede er installeret.
      requestPwaInstallMock
        .mockResolvedValueOnce({ kind: 'completed', outcome: 'accepted' })
        .mockResolvedValueOnce({ kind: 'alreadyInstalled', state: 'installed' });
      renderMineo();

      await clickDownload(user);
      await waitFor(() => expect(requestPwaInstallMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog')).toBeNull();

      await clickDownload(user);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(requestPwaInstallMock).toHaveBeenCalledTimes(2);
    });

    test('popup\'en kan åbnes igen efter lukning', async () => {
      const user = userEvent.setup();
      requestPwaInstallMock.mockResolvedValue({ kind: 'alreadyInstalled', state: 'installed' });
      renderMineo();

      await clickDownload(user);
      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      await clickDownload(user);
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Mineo-side indhold', () => {
    test('viser side-titel', () => {
      renderMineo();
      expect(screen.getByText('Mineo')).toBeInTheDocument();
    });

    test('viser alle hovedsektioner', () => {
      renderMineo();

      expect(screen.getByText('Programmet')).toBeInTheDocument();
      expect(screen.getByText('Teknisk')).toBeInTheDocument();
      expect(screen.getByText('Persondata')).toBeInTheDocument();
      expect(screen.getByText('Licensvilkår')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('søskendeside-footeren er nederst på siden', () => {
      renderMineo();

      const boxes = Array.from(document.querySelectorAll('.content-box'));
      expect(boxes[boxes.length - 1]).toHaveAttribute('aria-label', 'Søskendesider og kontakt');
      expect(screen.getByRole('link', { name: 'Kontakt bel@fho.dk' })).toHaveAttribute('href', 'mailto:bel@fho.dk');
      expect(screen.getAllByText('minEO.dk').some((element) => element.closest('[aria-current="page"]'))).toBe(true);
      const minProcesrenteLink = screen.getByRole('link', { name: 'minProcesrente.dk' });
      expect(minProcesrenteLink).toHaveAttribute('href', 'https://minprocesrente.dk');
      expect(minProcesrenteLink).toHaveAttribute('target', '_blank');
      expect(minProcesrenteLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(minProcesrenteLink).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('link', { name: 'Kontakt bel@fho.dk' })).not.toHaveAttribute('target');
    });

    test('viser version nummer', () => {
      renderMineo();
      expect(screen.getByText(/Aktuel version:/i)).toBeInTheDocument();
    });

    test('viser GitHub-linket i status-boksen og ikke den gamle kontaktboks', () => {
      renderMineo();

      const versionText = screen.getByText(/Aktuel version:/i);
      const statusBox = versionText.closest('.content-box');

      expect(statusBox).not.toBeNull();
      expect(within(statusBox as HTMLElement).getByRole('link', { name: 'github.com/BjornElling/Mineo' }))
        .toHaveAttribute('href', 'https://github.com/BjornElling/Mineo');
      expect(screen.queryByText('Bjørn Elling')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'mineo.dk' })).not.toBeInTheDocument();
    });

    test('teknisk-boksen viser toggle for standardside', () => {
      renderMineo();

      expect(screen.getByText('Gør stamdata-siden til startside fremover')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    test('toggle gemmes som device-lokal app-setting', async () => {
      const user = userEvent.setup();
      renderMineo();

      const toggle = screen.getByRole('checkbox');
      await user.click(toggle);

      expect(toggle).toBeChecked();

      const raw = readLocalStorage(LOCAL_STORAGE_KEY);
      expect(raw).toBeDefined();
      expect(JSON.parse(raw ?? '{}')).toMatchObject({
        themeMode: DEFAULT_APP_SETTINGS.themeMode,
        defaultStartsideErStamdata: true,
        showContentBoxReportButton: DEFAULT_APP_SETTINGS.showContentBoxReportButton,
        showEOInspektionMenu: DEFAULT_APP_SETTINGS.showEOInspektionMenu,
        fontStyleColorDebug: DEFAULT_APP_SETTINGS.fontStyleColorDebug,
      });
    });
  });
});
