import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';
import { CONFIRMATION_DIALOG_FOCUS_MARKER } from '../../inputCore/react/modalFocusTransfer';

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
  const restoreTargetRef = React.useRef<HTMLElement | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
  const confirmStartedRef = React.useRef(false);
  const wasOpenRef = React.useRef(false);
  const justClosedRef = React.useRef(false);

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
    justClosedRef.current = !open && wasOpenRef.current;
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

  const restoreFocusAfterClose = React.useCallback(() => {
    // Nettet må ikke kun se efter `body`. WebKit flytter ved Escape fokus til dialogens egen
    // container, som først forsvinder når portalen unmountes; på dette tidspunkt er `activeElement`
    // derfor hverken body eller et blivende element. Et frakoblet eller stadig dialog-ejet element
    // tæller som «fokus er tabt», præcis som body gør. Står fokus derimod på et ægte, blivende
    // element uden for dialogen, har noget andet med rette overtaget det, og nettet holder sig væk.
    const isFocusLost = (): boolean => {
      const activeElement = document.activeElement;
      return activeElement === null
        || activeElement === document.body
        || !activeElement.isConnected
        || activeElement.closest('[role="dialog"], [role="presentation"]') !== null;
    };

    const restoreTarget = (): void => {
      // Den eksplicit udpegede kontrol vinder: den er sand også i browsere, hvor et klik ikke
      // efterlader kontrollen som `activeElement`, og hvor den huskede reference derfor er tom.
      const originalTarget = restoreFocusTo?.current ?? restoreTargetRef.current;
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
    };

    if (!isFocusLost()) return;
    restoreTarget();

    // Transitionen slutter FØR portalen er unmountet, og WebKit nulstiller fokus til body, når den
    // fokuserede dialog-node forsvinder — efter vores genoprettelse. Ét eftersyn på næste frame
    // fanger den rækkefølge; er fokus stadig i behold, gør eftersynet ingenting.
    window.requestAnimationFrame(() => {
      if (isFocusLost()) restoreTarget();
    });
  }, [restoreFocusTo]);

  React.useEffect(() => {
    if (open || !justClosedRef.current) return undefined;
    justClosedRef.current = false;

    // WebKit kan flytte fokus til body allerede ved Escape, før MUI's transition når
    // `onTransitionExited`. Gendan derfor også på lukningens første frame; transition-callbacken
    // ovenfor er fortsat et ekstra værn for browsere, der først mister fokus ved unmount.
    const frame = window.requestAnimationFrame(restoreFocusAfterClose);
    return () => window.cancelAnimationFrame(frame);
  }, [open, restoreFocusAfterClose]);

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
