// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import LicenseModal from '../../../components/ui/LicenseModal';

// Mock LICENSE filen
vi.mock('../../../assets/LICENSE.txt?raw', () => ({
  default: 'MIT License\n\nCopyright (c) 2026 Test\n\nPermission is hereby granted...',
}));

/**
 * Helper til at rendere LicenseModal med MUI theme.
 *
 * Triggeren («MIT-licensen»-knappen) rendereres med, fordi den er modalens fokus-restore-mål
 * (jf. `keyboard-navigation.md` §Popup-fokus-restore) – uden den kan lukkeadfærden ikke måles.
 */
const renderLicenseModal = (props: { open: boolean; onClose: () => void }) => {
  const theme = createTheme({
    components: {
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true,
        },
      },
    },
  });
  const Harness = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    return (
      <ThemeProvider theme={theme}>
        <button type="button" ref={triggerRef}>MIT-licensen</button>
        <LicenseModal open={open} onClose={onClose} restoreFocusTo={triggerRef} />
      </ThemeProvider>
    );
  };
  return render(<Harness {...props} />);
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

    /**
     * Tab-FANGSTEN måles bevidst IKKE her, men i `e2e/overlay-behaviour.spec.ts`.
     *
     * En tidligere jsdom-test her påstod at måle den og var grøn – mens fokus i den rigtige browser
     * vandrede ud af vinduet ved hvert eneste Tab. JSDOM implementerer ikke browserens
     * tab-traversering, så testen kunne kun bekræfte, at `FocusTrap` var MONTERET; den kunne ikke se,
     * at sidens egen navigation overtog tasten og kørte forbi trap'ens vagtposter. En test, der ikke
     * kan observere den mekanisme, den påstår at måle, er værre end ingen test.
     */

    test('fokus vender tilbage til MIT-licensen-knappen ved lukning', async () => {
      // Kontraktkrav (§Popup-fokus-restore): fokus må ikke efterlades på den forsvindende
      // X-knap og falde til body – brugeren skal kunne fortsætte fra knappen, de åbnede med.
      const user = userEvent.setup();
      const theme = createTheme();
      const Harness = () => {
        const [open, setOpen] = React.useState(false);
        const triggerRef = React.useRef<HTMLButtonElement>(null);
        return (
          <ThemeProvider theme={theme}>
            <button type="button" ref={triggerRef} onClick={() => setOpen(true)}>
              MIT-licensen
            </button>
            <LicenseModal open={open} onClose={() => setOpen(false)} restoreFocusTo={triggerRef} />
          </ThemeProvider>
        );
      };
      render(<Harness />);

      const trigger = screen.getByRole('button', { name: 'MIT-licensen' });
      await user.click(trigger);

      const closeButton = screen.getByRole('button', { name: /luk/i });
      await waitFor(() => expect(closeButton).toHaveFocus());

      await user.click(closeButton);

      await waitFor(() => expect(trigger).toHaveFocus());
    });
  });

  describe('Indhold', () => {
    test('viser license-tekst i pre-element', () => {
      const onClose = vi.fn();
      const { container } = renderLicenseModal({ open: true, onClose });

      // Test outcome: pre-element eksisterer og indeholder tekst med linjeskift
      const preElement = container.querySelector('pre');
      expect(preElement).toBeInTheDocument();

      // Verificer at indholdet har linjeskift (1:1 formatering bevaret)
      if (preElement) {
        expect(preElement.textContent).toContain('\n');
        expect(preElement.textContent).toBeTruthy();
      }
    });

    test('ombryder licensteksten og isolerer nødvendig lav-højde-scroll til tekstcontaineren', () => {
      const onClose = vi.fn();
      const { container } = renderLicenseModal({ open: true, onClose });

      const scrollContainer = screen.getByTestId('license-scroll-container');
      const preElement = container.querySelector('pre');

      expect(scrollContainer).toHaveStyle({ overflowY: 'auto', overflowX: 'hidden' });
      expect(preElement).toHaveStyle({ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
    });
  });
});
