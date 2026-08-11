import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';
import { CONFIRMATION_DIALOG_FOCUS_MARKER } from '../../inputCore/react/modalFocusTransfer';

type ConfirmationDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error';
  hideCancelButton?: boolean;
  /**
   * Ekstra actions (fx "Send fejloplysninger").
   *
   * Renderes mellem cancel- og confirm-knappen.
   */
  extraActions?: React.ReactNode;
};

/**
 * Genbrugelig bekræftelsesdialog med ja/nej funktionalitet
 *
 * @param open - Om dialogen er synlig
 * @param onConfirm - Callback når brugeren bekræfter
 * @param onCancel - Callback når brugeren annullerer. Valgfri når dialogen kun har OK-knap.
 * @param title - Dialogens titel
 * @param message - Bekræftelsesbesked
 * @param confirmText - Tekst på bekræft-knap (default: "Ja")
 * @param cancelText - Tekst på annuller-knap (default: "Annuller")
 * @param confirmColor - Farve på bekræft-knap (default: "primary")
 */
const ConfirmationDialog = React.memo(({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Ja',
  cancelText = 'Annuller',
  confirmColor = 'primary',
  hideCancelButton = false,
  extraActions,
}: ConfirmationDialogProps) => {
  const restoreTargetRef = React.useRef<HTMLElement | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmStartedRef = React.useRef(false);
  const wasOpenRef = React.useRef(false);

  // MUI gemmer selv restore-målet, men dets interne reference kan ikke hjælpe, hvis en bekræftet handling
  // fjerner det oprindelige felt fra DOM'en. Gem derfor samme konkrete mål og giv et fokusbart fallback ved
  // transitionens afslutning; ved normal Annuller er MUI's egen restore-adfærd stadig den primære vej.
  React.useLayoutEffect(() => {
    if (open && !wasOpenRef.current) {
      const activeElement = document.activeElement;
      restoreTargetRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    }
    wasOpenRef.current = open;
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    // MUI's native autoFocus kan blive overtrumfet af den omgivende side-/felt-navigation, når dialogen åbnes
    // fra en allerede aktiv editor. Fokusér derfor den første handling på næste frame, efter portalens og
    // focus trap'ens mount-fokus er udført; FocusTrap ejer stadig den efterfølgende Tab-cirkulation.
    const frame = window.requestAnimationFrame(() => {
      (hideCancelButton ? confirmButtonRef.current : cancelButtonRef.current)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, hideCancelButton]);

  React.useEffect(() => {
    if (!open) confirmStartedRef.current = false;
  }, [open]);

  const handleConfirmClick = React.useCallback(() => {
    // En enkelt bekræftelse må kun starte én kritisk handling, også hvis Enter eller et dobbeltklik
    // rammer knappen, mens den asynkrone handling stadig holder dialogen åben.
    if (confirmStartedRef.current) return;
    confirmStartedRef.current = true;
    try {
      onConfirm();
    } catch (error) {
      confirmStartedRef.current = false;
      throw error;
    }
  }, [onConfirm]);

  const restoreFocusAfterClose = React.useCallback(() => {
    if (document.activeElement !== document.body) return;

    const originalTarget = restoreTargetRef.current;
    if (originalTarget?.isConnected) {
      originalTarget.focus({ preventScroll: true });
      return;
    }

    // Hvis en bekræftet handling fjernede feltet, er et eksisterende første fokusbart element den mindst
    // overraskende fallback. Et fokusforsøg på den gamle, detached node ville ellers efterlade fokus på body.
    const fallback = Array.from(document.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]'
    )).find((element) => (
      element.isConnected
      && !element.hidden
      && element.tabIndex >= 0
      && element.closest('[aria-hidden="true"]') === null
    ));
    fallback?.focus({ preventScroll: true });
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      onTransitionExited={restoreFocusAfterClose}
      maxWidth="sm"
      fullWidth
      {...{ [CONFIRMATION_DIALOG_FOCUS_MARKER]: 'true' }}
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '10px',
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ fontSize: '14px' }}>{message}</Box>
      </DialogContent>
      <DialogActions sx={{ padding: 2, gap: 1 }}>
        {!hideCancelButton && (
          <Button
            onClick={onCancel}
            ref={cancelButtonRef}
            variant="outlined"
            sx={{
              borderRadius: '10px',
              '&:hover': {
                backgroundColor: 'var(--color-hover)',
              },
            }}
          >
            {cancelText}
          </Button>
        )}
        {extraActions}
        <Button
          onClick={handleConfirmClick}
          ref={confirmButtonRef}
          variant="contained"
          color={confirmColor}
          sx={{
            borderRadius: '10px',
            '&:hover': {
              filter: 'brightness(0.9)',
            },
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

ConfirmationDialog.displayName = 'ConfirmationDialog';

export default ConfirmationDialog;
