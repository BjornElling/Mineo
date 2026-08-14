import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';
import { CONFIRMATION_DIALOG_FOCUS_MARKER } from '../../inputCore/react/modalFocusTransfer';
import { useDialogFocusRestore } from '../../hooks/useDialogFocusRestore';

type ConfirmationDialogProps = {
  open: boolean;
  /** Returnér `false`, hvis handlingen ikke blev gennemført, så brugeren kan prøve igen. */
  onConfirm: () => void | boolean | PromiseLike<void | boolean>;
  onCancel?: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  /**
   * Gør bekræftelsen til en navigation, som browseren kan sende til en installeret PWA-protokolhandler.
   */
  confirmHref?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'error';
  hideCancelButton?: boolean;
  /**
   * Elementet, fokus skal vende tilbage til ved lukning.
   *
   * Nødvendig når dialogen åbnes fra en kontrol, browseren ikke selv fokuserer ved klik: WebKit
   * fokuserer ikke `<button>` på klik, så dialogen har intet `document.activeElement` at huske, og
   * fokus ville lande på sidens første fokusbare element i stedet for dér, brugeren kom fra.
   */
  restoreFocusTo?: React.RefObject<HTMLElement | null>;
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
  confirmHref,
  cancelText = 'Annuller',
  confirmColor = 'primary',
  hideCancelButton = false,
  extraActions,
  restoreFocusTo,
}: ConfirmationDialogProps) => {
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmStartedRef = React.useRef(false);

  // Fokus-restore ved lukning ejes af den fælles hook (jf. `keyboard-navigation.md`
  // §Popup-fokus-restore). Bekræftelsesdialoger tillader fallback til sidens første fokusbare
  // element, fordi en bekræftet handling kan fjerne selve triggeren — fx «Slet ansættelsesforhold»,
  // hvor hele kortet med sletteknappen forsvinder.
  const { restoreFocus } = useDialogFocusRestore({
    open,
    triggerRef: restoreFocusTo,
    allowFirstFocusableFallback: true,
  });

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
      const result = onConfirm();
      if (result !== null && typeof result === 'object' && 'then' in result) {
        // En async kritisk handling kan fejle, mens dialogen stadig er åben. Frigiv kun låsen i
        // den situation; et vellykket resultat overlader lukningen til den kontrollerende side.
        void result.then((outcome) => {
          if (outcome === false) confirmStartedRef.current = false;
        }, () => {
          confirmStartedRef.current = false;
        });
      } else if (result === false) {
        // En synkron handling kan også melde «ikke gennemført» uden at kaste. Ellers bliver en
        // dialog, der med rette står åben efter fejlen, permanent låst efter første klik.
        confirmStartedRef.current = false;
      }
    } catch (error) {
      confirmStartedRef.current = false;
      throw error;
    }
  }, [onConfirm]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      // Transitionen slutter FØR portalen er unmountet. Hooken gendanner allerede på lukningens
      // første frame; dette er det ekstra værn for browsere, der først mister fokus ved unmount.
      onTransitionExited={restoreFocus}
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
          href={confirmHref}
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
