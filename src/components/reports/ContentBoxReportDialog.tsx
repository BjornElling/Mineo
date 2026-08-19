import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from '@mui/material';
import TransientTextInput from '../inputs/transient/TransientTextInput';
import { getTodayCopenhagenISO } from '../../utils/dateUtils';
import { asciiSlug } from '../../utils/asciiSlug';
import { useOverlayBehavior } from '../../hooks/useOverlayBehavior';
import {
  type ContentBoxIdentity,
  openBugReportEmail,
  prepareContentBoxReport,
} from '../../utils/bugReport';
import { downloadBlob } from '../../utils/fileHelpers';
import { CONTENT_SCALE_ROOT_SELECTOR } from '../../utils/uiScale';

/**
 * Rapportbeskedens maksimale længde – samme loft som programmets øvrige kommentarfelter.
 *
 * Feltet var helt ubegrænset, fordi `TransientTextInput` tabte `maxLength` i sin flerlinjede gren OG
 * ingen kaldte proppen. Beskeden ender i en mailtekst, så en indsat side tekst ville gøre den ubrugelig.
 */
const CONTENT_BOX_REPORT_MAX_LENGTH = 512;

type ContentBoxReportDialogProps = {
  open: boolean;
  onClose: () => void;
  identity: ContentBoxIdentity;
  contentBoxRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Rapportér-knappen, fokus skal vende tilbage til ved lukning (jf. `keyboard-navigation.md`
   * §Popup-fokus-restore). Knappen er bevidst uden for tab-rækkefølgen (`tabIndex={-1}`), men
   * skal alligevel kunne modtage fokus programmatisk, så en musebruger ikke mister sin plads.
   */
  restoreFocusTo: React.RefObject<HTMLElement | null>;
};

const buildScreenshotFilename = (identity: ContentBoxIdentity): string => {
  const parts = [
    identity.pageTitle,
    identity.sectionTitle,
    identity.boxIndex ? `box-${identity.boxIndex}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    // Sidetitler er danske brugervendte tekster, så translitterationen i `asciiSlug`
    // er nødvendig: den tidligere lokale kopi spiste `ø`/`æ`/`å` som separator, så
    // «Årsløn» blev `rsl-n` i filnavnet.
    .map((part) => asciiSlug(part))
    .filter(Boolean);

  const base = parts.length > 0 ? parts.join('_') : 'contentbox';
  const date = getTodayCopenhagenISO();
  return `Mineo-skærmprint-${base}-${date}.png`;
};

const ContentBoxReportDialog = React.memo(({
  open,
  onClose,
  identity,
  contentBoxRef,
  restoreFocusTo,
}: ContentBoxReportDialogProps) => {
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Den fælles overlay-adfærd (Escape ejes af MUI's `onClose`; hooken tilføjer tilbage-knappen,
  // stak-disciplinen og fokus-restoren). Placeret EFTER `isSending`, som lukkevejen læser.
  const { overlayRootProps, requestClose } = useOverlayBehavior({
    open,
    // Under afsendelse må dialogen ikke kunne lukkes – heller ikke med tilbage-knappen.
    onClose: () => {
      if (isSending) return false;
      onClose();
      return true;
    },
    triggerRef: restoreFocusTo,
    disableEscape: true,
  });

  React.useEffect(() => {
    if (!open) {
      setMessage('');
      setIsSending(false);
      setIsDownloading(false);
    }
  }, [open]);

  const handleSnackbarClose = React.useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const handleSend = React.useCallback(async () => {
    if (isSending) return;
    setIsSending(true);

    try {
      const prepared = await prepareContentBoxReport({
        identity,
        message,
      });
      openBugReportEmail(prepared);
      setSnackbar({
        open: true,
        message: 'Email-klient åbnet. Rapporten er klar til afsendelse.',
        severity: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Kunne ikke forberede rapport:', error);
      setSnackbar({
        open: true,
        message: 'Kunne ikke åbne rapport-email.',
        severity: 'error',
      });
    } finally {
      setIsSending(false);
    }
  }, [identity, isSending, message, onClose]);

  const handleDownloadScreenshot = React.useCallback(async () => {
    if (isDownloading) return;
    const element = contentBoxRef.current;
    if (!element) {
      setSnackbar({
        open: true,
        message: 'Kunne ikke finde den valgte indholdsboks.',
        severity: 'error',
      });
      return;
    }

    setIsDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const scaleRoot = element.closest(CONTENT_SCALE_ROOT_SELECTOR);
      const previousZoom = scaleRoot instanceof HTMLElement
        ? scaleRoot.style.getPropertyValue('zoom')
        : null;
      let canvas: HTMLCanvasElement;

      try {
        if (scaleRoot instanceof HTMLElement) {
          // html2canvas læser CSS-zoom som almindelig layout-størrelse og kan derfor smelte labels
          // sammen i outputtet. Neutralisér kun den lokale content-root mens capture kører – ikke
          // shellen eller portal-overlayet – og gendan altid den aktive skala bagefter.
          scaleRoot.style.setProperty('zoom', '1');
          void scaleRoot.offsetWidth;
        }

        canvas = await html2canvas(element, {
          // Eksport bruger bevidst hvid baggrund for deling/print uafhængigt af aktivt theme.
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });
      } finally {
        if (scaleRoot instanceof HTMLElement) {
          if (previousZoom === '') {
            scaleRoot.style.removeProperty('zoom');
          } else {
            scaleRoot.style.setProperty('zoom', previousZoom);
          }
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Kunne ikke oprette PNG.');
      }

      // Den kanoniske download-vej. Her lå tidligere en egen kopi, der frigav object-URL'en
      // synkront lige efter `click()` – en race, hvor browseren kan nå at miste filen tavst.
      downloadBlob(blob, buildScreenshotFilename(identity));

      setSnackbar({
        open: true,
        message: 'Skærmprint downloadet.',
        severity: 'success',
      });
    } catch (error) {
      console.error('Kunne ikke lave skærmprint:', error);
      setSnackbar({
        open: true,
        message: 'Kunne ikke downloade skærmprint.',
        severity: 'error',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [contentBoxRef, identity, isDownloading]);

  return (
    <>
      <Dialog
        open={open}
        onClose={isSending ? undefined : (_event, reason) => {
          requestClose(reason === 'backdropClick' ? 'backdrop' : 'escape');
        }}
        maxWidth="md"
        fullWidth
        // MUI genopretter ellers SELV fokus ved unmount – til det element, der var aktivt ved
        // åbningen – og den kører sidst, så den overskriver `useDialogFocusRestore` ovenfor uden at
        // noget fejler. To restore-veje, hvor kun den ene kender kontraktens målprioritet
        // (`keyboard-navigation.md` §Popup-fokus-restore). Se `ConfirmationDialog` for samme værn.
        disableRestoreFocus
        {...overlayRootProps}
      >
        <DialogTitle>Rapporter fejl eller forbedringsønske</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ marginBottom: 2 }}>
            Beskriv problemet eller ønsket så præcist som muligt. Rapporten indsættes i en email, der
            er klar til afsendelse.
          </Typography>

          <Box sx={{ marginBottom: 2 }}>
            <Typography variant="subtitle2" sx={{ marginBottom: 1 }}>
              Identifikation
            </Typography>
            <Box sx={{ padding: 2, borderRadius: '10px', border: '1px solid var(--color-border)' }}>
              <Typography variant="body2">Sti: {identity.routePath}</Typography>
              {identity.pageTitle && <Typography variant="body2">Side: {identity.pageTitle}</Typography>}
              {identity.sectionTitle && <Typography variant="body2">Sektion: {identity.sectionTitle}</Typography>}
              {identity.boxIndex && identity.boxCount && (
                <Typography variant="body2">
                  ContentBox: {identity.boxIndex} af {identity.boxCount}
                </Typography>
              )}
              {identity.contentBoxId && <Typography variant="body2">ContentBox ID: {identity.contentBoxId}</Typography>}
            </Box>
          </Box>

          <Box sx={{ marginBottom: 2 }}>
            <Typography variant="subtitle2" sx={{ marginBottom: 1 }}>
              Fejl eller forbedringsønske
            </Typography>
            <Box sx={{ width: '100%' }}>
              <TransientTextInput
                value={message}
                onChange={setMessage}
                aria-label="Fejl eller forbedringsønske"
                multiline
                rows={4}
                fullWidth
                width="100%"
                maxLength={CONTENT_BOX_REPORT_MAX_LENGTH}
                placeholder="Beskriv problemet eller ønsket her..."
              />
            </Box>
          </Box>

          <Box sx={{ marginBottom: 2 }}>
            <Typography variant="subtitle2" sx={{ marginBottom: 1 }}>
              Skærmprint
            </Typography>
            <Typography variant="body2" sx={{ marginBottom: 1 }}>
              Du kan downloade et skærmprint og vedhæfte det til mailen.
            </Typography>
            <Button
              variant="outlined"
              onClick={handleDownloadScreenshot}
              disabled={isDownloading}
              sx={{ borderRadius: '10px' }}
            >
              {isDownloading ? (
                <>
                  <CircularProgress size={16} sx={{ marginRight: 1 }} />
                  Genererer...
                </>
              ) : (
                'Download skærmprint'
              )}
            </Button>
          </Box>

          <Alert severity="warning" sx={{ borderRadius: '10px' }}>
            Rapporten kan indeholde persondata eller sagsoplysninger. Gennemgå indholdet i din email
            før du sender.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ padding: 2 }}>
          <Button onClick={onClose} disabled={isSending} sx={{ borderRadius: '10px' }}>
            Annuller
          </Button>
          <Button
            onClick={handleSend}
            variant="contained"
            disabled={isSending}
            sx={{ borderRadius: '10px' }}
          >
            {isSending ? (
              <>
                <CircularProgress size={16} sx={{ marginRight: 1 }} />
                Forbereder...
              </>
            ) : (
              'Indsæt i mail'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%', borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
});

ContentBoxReportDialog.displayName = 'ContentBoxReportDialog';

export default ContentBoxReportDialog;
