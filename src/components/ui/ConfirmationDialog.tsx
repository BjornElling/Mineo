import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';
import { CONFIRMATION_DIALOG_FOCUS_MARKER } from '../../inputCore/react/modalFocusTransfer';
import { useOverlayBehavior } from '../../hooks/useOverlayBehavior';

type ConfirmationDialogProps = {
  open: boolean;
  /** Skifter, når samme åbne dialog går videre til en ny, selvstændig bekræftelse. */
  confirmationKey?: string;
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
  confirmationKey,
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

  // Den fælles overlay-adfærd. MUI `Dialog` bidrager med fokusfangst, Escape og backdrop-klik;
  // hooken tilføjer resten af det fælles regelsæt — tilbage-knappen, stak-disciplinen og
  // fokus-restoren (som fortsat er `useDialogFocusRestore` indeni).
  //
  // `disableEscape`: MUI ejer allerede Escape gennem sin `onClose`. To lyttere ville lukke to lag
  // på ét tryk, når en dialog ligger oven på en anden — netop det, stakken findes for at forhindre.
  //
  // Bekræftelsesdialoger tillader fallback til sidens første fokusbare element, fordi en bekræftet
  // handling kan fjerne selve triggeren — fx «Slet ansættelsesforhold», hvor hele kortet med
  // sletteknappen forsvinder.
  const { overlayRootProps, requestClose, restoreFocus } = useOverlayBehavior({
    open,
    // `onCancel` er valgfri (en dialog kan have OK som eneste knap). Et ubetinget kald ville kaste
    // ved Escape/backdrop på netop den variant.
    onClose: () => { onCancel?.(); },
    triggerRef: restoreFocusTo,
    allowFirstFocusableFallback: true,
    disableEscape: true,
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
    // Én åben dialog kan repræsentere flere sekventielle beslutninger (load: preflight → overskrivning).
    // Den første afsluttede callback må ikke holde den næste, selvstændige bekræftelse låst.
    if (confirmationKey !== undefined) confirmStartedRef.current = false;
  }, [confirmationKey, open]);

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
      // MUI leverer selv Escape og backdrop-klik hertil. Begge routes gennem `requestClose`, så
      // ALLE lukkeveje — også dem MUI ejer — rydder overlayets historik-trin op. Ellers ville et
      // Escape efterlade et dødt trin, og næste tilbage-tryk ville ikke gøre det, brugeren forventer.
      onClose={(_event, reason) => {
        requestClose(reason === 'backdropClick' ? 'backdrop' : 'escape');
      }}
      // Transitionen slutter FØR portalen er unmountet. Hooken gendanner allerede på lukningens
      // første frame; dette er det ekstra værn for browsere, der først mister fokus ved unmount.
      onTransitionExited={restoreFocus}
      maxWidth="sm"
      fullWidth
      // MUI genopretter som standard selv fokus ved unmount — til det element, der var aktivt da
      // dialogen åbnede. Det er en KONKURRERENDE restore-vej, og den vinder, fordi den kører sidst:
      // vores egen genoprettelse lykkedes (knappen fik fokus), hvorefter MUI flyttede det tilbage til
      // feltet. Restoren ejes af `useDialogFocusRestore`, som følger kontraktens målprioritet
      // (`keyboard-navigation.md` §Popup-fokus-restore) — MUI's gæt gør ikke. Bekræftet i chrome-desktop
      // med `Slet alt`, hvor fokus endte på `Fødselsdato` i stedet for på menuknappen.
      disableRestoreFocus
      {...{ [CONFIRMATION_DIALOG_FOCUS_MARKER]: 'true' }}
      // Overlay-markøren: `Container` giver slip på Tab, så længe et overlay er åbent. En portaleret
      // dialog slap i forvejen igennem på DOM-indeslutningen, men markøren gør reglen éns for begge
      // monteringsformer i stedet for at afhænge af, hvor komponenten tilfældigvis ligger.
      {...overlayRootProps}
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
            // Gennem `requestClose`, så annulleringen rydder historik-trinnet som de øvrige lukkeveje.
            onClick={() => requestClose('close-button')}
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
