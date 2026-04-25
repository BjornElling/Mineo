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
import StyledTextField, {
  type StyledTextFieldDraftChangeEvent,
  type StyledTextFieldValueCommitEvent,
} from '../inputs/StyledTextField';
import { getTodayLocalISO } from '../../utils/dateUtils';
import {
  type ContentBoxIdentity,
  openBugReportEmail,
  prepareContentBoxReport,
} from '../../utils/bugReport';

type ContentBoxReportDialogProps = {
  open: boolean;
  onClose: () => void;
  identity: ContentBoxIdentity;
  contentBoxRef: React.RefObject<HTMLDivElement | null>;
};

const sanitizeFilenamePart = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const buildScreenshotFilename = (identity: ContentBoxIdentity): string => {
  const parts = [
    identity.pageTitle,
    identity.sectionTitle,
    identity.boxIndex ? `box-${identity.boxIndex}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .map(sanitizeFilenamePart)
    .filter(Boolean);

  const base = parts.length > 0 ? parts.join('_') : 'contentbox';
  const date = getTodayLocalISO();
  return `Mineo-skærmprint-${base}-${date}.png`;
};

const ContentBoxReportDialog = React.memo(({
  open,
  onClose,
  identity,
  contentBoxRef,
}: ContentBoxReportDialogProps) => {
  const [message, setMessage] = React.useState('');
  const draftMessageRef = React.useRef('');
  const hasDraftRef = React.useRef(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  React.useEffect(() => {
    if (!open) {
      setMessage('');
      draftMessageRef.current = '';
      hasDraftRef.current = false;
      setIsSending(false);
      setIsDownloading(false);
    }
  }, [open]);

  const handleDraftChange = React.useCallback((event: StyledTextFieldDraftChangeEvent) => {
    draftMessageRef.current = event.target.value;
    hasDraftRef.current = true;
  }, []);

  const handleCommit = React.useCallback((event: StyledTextFieldValueCommitEvent) => {
    setMessage(event.target.value);
    draftMessageRef.current = event.target.value;
    hasDraftRef.current = false;
  }, []);

  const handleSnackbarClose = React.useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const resolveEffectiveMessage = React.useCallback(() => {
    return hasDraftRef.current ? draftMessageRef.current : message;
  }, [message]);

  const handleSend = React.useCallback(async () => {
    if (isSending) return;
    setIsSending(true);

    const effectiveMessage = resolveEffectiveMessage();
    setMessage(effectiveMessage);
    draftMessageRef.current = effectiveMessage;
    hasDraftRef.current = false;

    try {
      const prepared = await prepareContentBoxReport({
        identity,
        message: effectiveMessage,
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
  }, [identity, isSending, onClose, resolveEffectiveMessage]);

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
      const canvas = await html2canvas(element, {
        // Eksport bruger bevidst hvid baggrund for deling/print uafhængigt af aktivt theme.
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Kunne ikke oprette PNG.');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildScreenshotFilename(identity);
      a.click();
      URL.revokeObjectURL(url);

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
      <Dialog open={open} onClose={isSending ? undefined : onClose} maxWidth="md" fullWidth>
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
              <StyledTextField
                value={message}
                onDraftChange={handleDraftChange}
                onCommit={handleCommit}
                multiline
                rows={4}
                fullWidth
                width="100%"
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
