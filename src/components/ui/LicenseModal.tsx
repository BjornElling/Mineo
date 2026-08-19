import React from 'react';
import { Box, Typography, IconButton, useTheme, Unstable_TrapFocus as FocusTrap } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import licenseText from '../../assets/LICENSE.txt?raw';
import { useOverlayBehavior } from '../../hooks/useOverlayBehavior';
import { CONTENT_SCALE_CSS_VARIABLE } from '../../utils/uiScale';

type LicenseModalProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Elementet, fokus skal vende tilbage til ved lukning – knappen der åbnede modalen
   * (jf. `keyboard-navigation.md` §Popup-fokus-restore).
   */
  restoreFocusTo: React.RefObject<HTMLElement | null>;
};

/**
 * Modal til visning af LICENSE-tekst
 *
 * **Tastaturet bliver i vinduet.** Modalen er et håndrullet overlay – den bygger ikke på MUI
 * `Dialog` og arvede derfor heller ikke dens `FocusTrap`. Tab vandrede ud i siden bagved, selv om
 * vinduet dækkede skærmen og erklærede sig `aria-modal="true"`. Fangsten kommer nu fra den SAMME
 * primitiv, MUI `Dialog` selv bruger, frem for en fjerde håndrullet fokusmekanisme
 * (`keyboard-navigation.md` §Popup-fokus-restore: én implementering).
 *
 * Arbejdsdelingen er bevidst: `FocusTrap` ejer Tab-cirkulationen INDE i vinduet, mens
 * `useDialogFocusRestore` ejer, hvor fokus lander EFTER lukningen. De to overlapper ikke.
 *
 * @param {boolean} open - Om modalen er åben
 * @param {function} onClose - Callback når modalen lukkes
 */
const LicenseModal = React.memo(({ open, onClose, restoreFocusTo }: LicenseModalProps) => {
  const theme = useTheme();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const headingId = React.useId();

  // Hele overlay-adfærden ét sted: Escape, browserens/musens tilbage-knap, stak-disciplin ved
  // lag-på-lag, og fokus-restore til «MIT-licensen»-knappen. Modalen havde tidligere sin egen
  // Escape-lytter og kendte slet ikke tilbage-knappen.
  const { overlayRootProps, requestClose } = useOverlayBehavior({
    open,
    onClose: () => onClose(),
    triggerRef: restoreFocusTo,
  });

  // Sæt fokus på close-knap når modal åbnes
  React.useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={() => requestClose('backdrop')}
        data-testid="license-backdrop"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: theme.zIndex.modal,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />

      {/* Modal indhold. `FocusTrap` holder Tab inde i vinduet, så længe det er åbent.
          `disableAutoFocus`: mount-fokus sættes allerede eksplicit på lukkeknappen ovenfor, og to
          konkurrerende mount-fokus ville gøre landingspunktet uforudsigeligt.
          `disableRestoreFocus`: restoren ved lukning ejes af `useDialogFocusRestore` – præcis den
          konkurrerende MUI-vej, som §Popup-fokus-restore forbyder. */}
      <FocusTrap open disableAutoFocus disableRestoreFocus>
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        // Markøren gør vinduet synligt for `Container`s tastaturnavigation, så den giver slip på Tab.
        // Uden den overtager sidens navigation Tab og kører forbi `FocusTrap`s vagtposter – vinduet er
        // en INLINE DOM-efterkommer af containeren og slipper derfor ikke igennem portal-undtagelsen.
        {...overlayRootProps}
        // FocusTrap kræver et fokusérbart barn for at kunne holde fokus, når indholdet i øvrigt
        // kun rummer knapper, der kan forsvinde. -1 holder den ude af Tab-rækkefølgen.
        tabIndex={-1}
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '800px',
          // Vinduet lever inde i arbejdsfladens zoom-rod, så `vh` opløses mod det USKALEREDE
          // vindue og bliver derefter selv skaleret: uden divisionen kunne vinduet kun bruge
          // 60 % af skærmhøjden ved mindste skala i stedet for de 80 %, tallet lover.
          maxHeight: `calc(80vh / var(${CONTENT_SCALE_CSS_VARIABLE}, 1))`,
          backgroundColor: 'var(--color-background-white)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          zIndex: theme.zIndex.modal + 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'clip',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px 32px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          <Typography
            id={headingId}
            variant="h5"
            sx={{
              fontWeight: 500,
              color: 'text.primary',
            }}
          >
            Licensvilkår
          </Typography>
          <IconButton
            ref={closeButtonRef}
            onClick={() => requestClose('close-button')}
            aria-label="Luk"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* License-tekst */}
        <Box
          data-testid="license-scroll-container"
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '32px',
          }}
        >
          <Box
            component="pre"
            sx={{
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'text.primary',
              margin: 0,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              wordBreak: 'normal',
            }}
          >
            {licenseText}
          </Box>
        </Box>
      </Box>
      </FocusTrap>
    </>
  );
});

LicenseModal.displayName = 'LicenseModal';

export default LicenseModal;
