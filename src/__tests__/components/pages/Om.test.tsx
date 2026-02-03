import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Om from '../../../components/pages/Om';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';

// Mock LICENSE filen
vi.mock('../../../assets/LICENSE.txt?raw', () => ({
  default: 'MIT License\n\nCopyright (c) 2026 Test\n\nPermission is hereby granted...',
}));

// Mock PWA install utility
vi.mock('../../../utils/pwaInstallPrompt', () => ({
  requestPwaInstall: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Helper til at rendere Om-siden med alle nødvendige providers
 */
const renderOm = () => {
  const theme = createTheme();
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <AppSettingsProvider>
          <Om />
        </AppSettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Om - License Modal Integration', () => {
  test('modal er lukket som standard (anti-regression)', () => {
    renderOm();

    // Modal skal ikke være i DOM'en (ikke bare skjult)
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('klik på "MIT-licensen" åbner modal', async () => {
    const user = userEvent.setup();
    renderOm();

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
    renderOm();

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
    renderOm();

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
    renderOm();

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
    renderOm();

    // Test semantik (role) i stedet for implementation detail (href)
    const licenseLink = screen.getByRole('link', { name: /mit-licensen/i });
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink).toBeVisible();
  });

  describe('Om-side indhold', () => {
    test('viser side-titel', () => {
      renderOm();
      expect(screen.getByText('Om MINEO')).toBeInTheDocument();
    });

    test('viser alle hovedsektioner', () => {
      renderOm();

      expect(screen.getByText('Programmet')).toBeInTheDocument();
      expect(screen.getByText('Teknisk')).toBeInTheDocument();
      expect(screen.getByText('Persondata')).toBeInTheDocument();
      expect(screen.getByText('Licensvilkår')).toBeInTheDocument();
      expect(screen.getByText('Kontakt')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('viser version nummer', () => {
      renderOm();
      expect(screen.getByText(/Aktuel version:/i)).toBeInTheDocument();
    });
  });
});
