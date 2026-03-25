import { render, screen, within } from '@testing-library/react';
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
vi.mock('../../../utils/pwaInstallPrompt', () => ({
  requestPwaInstall: vi.fn().mockResolvedValue(undefined),
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
    const licenseLink = screen.getByRole('link', { name: /mit-licensen/i });
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
    const licenseLink = screen.getByRole('link', { name: /mit-licensen/i });
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
    const licenseLink = screen.getByRole('link', { name: /mit-licensen/i });
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

    const licenseLink = screen.getByRole('link', { name: /mit-licensen/i });

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

  test('license-link er klikbart element', () => {
    renderMineo();

    // Test semantik (role) i stedet for implementation detail (href)
    const licenseLink = screen.getByRole('link', { name: /mit-licensen/i });
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink).toBeVisible();
  });

  describe('Mineo-side indhold', () => {
    test('viser side-titel', () => {
      renderMineo();
      expect(screen.getByText('MinEO')).toBeInTheDocument();
    });

    test('viser alle hovedsektioner', () => {
      renderMineo();

      expect(screen.getByText('Programmet')).toBeInTheDocument();
      expect(screen.getByText('Teknisk')).toBeInTheDocument();
      expect(screen.getByText('Persondata')).toBeInTheDocument();
      expect(screen.getByText('Licensvilkår')).toBeInTheDocument();
      expect(screen.getByText('Kontakt')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('kontakt er nederste sektion på siden', () => {
      renderMineo();

      const headings = screen.getAllByText(/^(Programmet|Teknisk|Persondata|Licensvilkår|Status|Kontakt)$/);
      expect(headings[headings.length - 1]).toHaveTextContent('Kontakt');
    });

    test('viser version nummer', () => {
      renderMineo();
      expect(screen.getByText(/Aktuel version:/i)).toBeInTheDocument();
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
        defaultStartsideErStamdata: true,
        showContentBoxReportButton: DEFAULT_APP_SETTINGS.showContentBoxReportButton,
        showEODebugMenu: DEFAULT_APP_SETTINGS.showEODebugMenu,
        fontStyleColorDebug: DEFAULT_APP_SETTINGS.fontStyleColorDebug,
      });
    });
  });
});
