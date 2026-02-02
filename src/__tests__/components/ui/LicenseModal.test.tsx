import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import LicenseModal from '../../../components/ui/LicenseModal';

// Mock LICENSE filen
vi.mock('../../../../LICENSE?raw', () => ({
  default: 'MIT License\n\nCopyright (c) 2026 Test\n\nPermission is hereby granted...',
}));

/**
 * Helper til at rendere LicenseModal med MUI theme
 */
const renderLicenseModal = (props: { open: boolean; onClose: () => void }) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      <LicenseModal {...props} />
    </ThemeProvider>
  );
};

describe('LicenseModal', () => {
  describe('Visning', () => {
    test('renderes ikke når open=false', () => {
      const onClose = vi.fn();
      renderLicenseModal({ open: false, onClose });

      // Modal skal ikke være i DOM'en (anti-regression: sikrer ikke "skjult men mounted")
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByText('Licensvilkår')).toBeNull();
    });

    test('renderes når open=true', () => {
      const onClose = vi.fn();
      renderLicenseModal({ open: true, onClose });

      // Modal skal være synlig - test strukturen, ikke indholdet
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Licensvilkår')).toBeInTheDocument();
      expect(screen.getByLabelText(/luk/i)).toBeInTheDocument();
    });

    test('har korrekte aria-attributter', () => {
      const onClose = vi.fn();
      renderLicenseModal({ open: true, onClose });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');

      const heading = screen.getByText('Licensvilkår');
      expect(heading).toHaveAttribute('id');
      expect(dialog.getAttribute('aria-labelledby')).toBe(heading.getAttribute('id'));
    });
  });

  describe('Lukning', () => {
    test('lukker ved klik på backdrop', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderLicenseModal({ open: true, onClose });

      // Find backdrop via stabilt test-signal (ikke DOM-struktur)
      const backdrop = screen.getByTestId('license-backdrop');
      expect(backdrop).toBeInTheDocument();

      // Klik på backdrop
      await user.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('lukker ved klik på close-knap', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderLicenseModal({ open: true, onClose });

      const closeButton = screen.getByRole('button', { name: /luk/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('lukker ved Escape-tryk', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderLicenseModal({ open: true, onClose });

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('Escape IKKE aktiv når modal er lukket (anti-regression)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderLicenseModal({ open: false, onClose });

      // Verificer at modal ikke er i DOM
      expect(screen.queryByRole('dialog')).toBeNull();

      // Tryk Escape - skal IKKE kalde onClose
      await user.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();
    });

    test('Escape-listener aktiv når modal er åben', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderLicenseModal({ open: true, onClose });

      // Verificer at modal er i DOM
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Tryk Escape - skal kalde onClose
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fokus-håndtering', () => {
    test('close-knap får fokus ved åbning', async () => {
      const onClose = vi.fn();
      renderLicenseModal({ open: true, onClose });

      const closeButton = screen.getByRole('button', { name: /luk/i });

      // Brug waitFor i stedet for setTimeout for deterministisk timing
      await waitFor(() => {
        expect(closeButton).toHaveFocus();
      });
    });
  });

  describe('Indhold', () => {
    test('viser license-tekst i pre-element', () => {
      const onClose = vi.fn();
      const { container } = renderLicenseModal({ open: true, onClose });

      // Test outcome: pre-element eksisterer og indeholder tekst med linjeskift
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const preElement = container.querySelector('pre');
      expect(preElement).toBeInTheDocument();

      // Verificer at indholdet har linjeskift (1:1 formatering bevaret)
      if (preElement) {
        expect(preElement.textContent).toContain('\n');
        expect(preElement.textContent).toBeTruthy();
      }
    });
  });
});
