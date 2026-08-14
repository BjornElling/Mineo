import React from 'react';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import licenseText from '../../assets/LICENSE.txt?raw';
import { useDialogFocusRestore } from '../../hooks/useDialogFocusRestore';

type LicenseModalProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Elementet, fokus skal vende tilbage til ved lukning — knappen der åbnede modalen
   * (jf. `keyboard-navigation.md` §Popup-fokus-restore).
   */
  restoreFocusTo: React.RefObject<HTMLElement | null>;
};

/**
 * Modal til visning af LICENSE-tekst
 *
 * @param {boolean} open - Om modalen er åben
 * @param {function} onClose - Callback når modalen lukkes
 */
const LicenseModal = React.memo(({ open, onClose, restoreFocusTo }: LicenseModalProps) => {
  const theme = useTheme();
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const headingId = React.useId();

  // Fokus tilbage til «MIT-licensen»-knappen ved lukning (jf. `keyboard-navigation.md`
  // §Popup-fokus-restore). Uden den blev fokus efterladt på modalens forsvindende X-knap og
  // faldt til `body`, så tastaturbrugeren måtte tabbe forfra gennem hele siden.
  useDialogFocusRestore({ open, triggerRef: restoreFocusTo });

  // Luk modal ved Escape-tryk (kun når modal er åben)
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

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
        onClick={onClose}
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

      {/* Modal indhold */}
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
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
            onClick={onClose}
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
    </>
  );
});

LicenseModal.displayName = 'LicenseModal';

export default LicenseModal;
