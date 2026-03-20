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
  TextField,
  Typography,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import {
  copyBugReport,
  downloadBugReport,
  openBugReportEmail,
  prepareBugReport,
} from '../../utils/bugReport';
import type { BugReportExtraSection, PreparedBugReport } from '../../utils/bugReport';

interface BugReportButtonProps {
  variant?: 'text' | 'outlined' | 'contained';
  fullWidth?: boolean;
  label?: string;
  context?: {
    source?: string;
    error?: Error;
    errorInfo?: React.ErrorInfo;
  };
  getExtraSections?: () => BugReportExtraSection[];
}

/**
 * Knap til at rapportere fejl via email.
 *
 * Viser altid et preview-step, så brugeren eksplicit kan acceptere indholdet før:
 * - clipboard
 * - email (mailto:)
 * - download
 */
const BugReportButton = ({
  variant = 'outlined',
  fullWidth = false,
  label = 'Rapportér fejl',
  context,
  getExtraSections,
}: BugReportButtonProps) => {
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isPreparing, setIsPreparing] = React.useState(false);
  const [prepared, setPrepared] = React.useState<PreparedBugReport | null>(null);
  const actionTakenRef = React.useRef(false);

  const handleBugReport = React.useCallback(async () => {
    setDialogOpen(true);
    setIsPreparing(true);
    setPrepared(null);
    actionTakenRef.current = false;

    try {
      const preparedReport = await prepareBugReport({
        context: {
          source: context?.source ?? 'BugReportButton',
          errorName: context?.error?.name,
          errorMessage: context?.error?.message,
          errorStack: context?.error?.stack,
          componentStack: context?.errorInfo?.componentStack ?? undefined,
        },
        extraSections: getExtraSections?.(),
      });
      setPrepared(preparedReport);
    } catch (error) {
      console.error('Fejl ved generering af bug report:', error);
      setSnackbar({
        open: true,
        message: 'Kunne ikke generere fejlrapport.',
        severity: 'error',
      });
      setDialogOpen(false);
    } finally {
      setIsPreparing(false);
    }
  }, [context?.error?.message, context?.error?.name, context?.error?.stack, context?.errorInfo?.componentStack, context?.source, getExtraSections]);

  const handleCopyToClipboard = React.useCallback(async () => {
    if (!prepared) return;
    try {
      await copyBugReport(prepared);
      actionTakenRef.current = true;
      setSnackbar({
        open: true,
        message: 'Rapporten er kopieret til clipboard.',
        severity: 'success',
      });
    } catch (error) {
      console.error('Kunne ikke kopiere til clipboard:', error);
      setSnackbar({
        open: true,
        message: 'Kunne ikke kopiere rapporten til clipboard.',
        severity: 'error',
      });
    }
  }, [prepared]);

  const handleOpenEmail = React.useCallback(() => {
    if (!prepared) return;
    actionTakenRef.current = true;
    openBugReportEmail(prepared);
    setSnackbar({
      open: true,
      message: 'Email-klient åbnet.',
      severity: 'success',
    });
  }, [prepared]);

  const handleDownload = React.useCallback(async () => {
    if (!prepared) return;
    try {
      await downloadBugReport(prepared);
      actionTakenRef.current = true;
      setSnackbar({
        open: true,
        message: 'Rapport downloadet.',
        severity: 'success',
      });
    } catch (error) {
      console.error('Fejl ved download:', error);
      setSnackbar({
        open: true,
        message: 'Kunne ikke downloade rapporten.',
        severity: 'error',
      });
    }
  }, [prepared]);

  const handleSnackbarClose = React.useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const handleDialogClose = React.useCallback(() => {
    if (isPreparing) return;
    if (prepared && !actionTakenRef.current && import.meta.env.DEV) {
      console.info('Bug report preview aborted', {
        source: context?.source ?? 'BugReportButton',
      });
    }
    setDialogOpen(false);
  }, [context?.source, isPreparing, prepared]);

  return (
    <>
      <Button
        variant={variant}
        startIcon={<BugReportIcon />}
        onClick={handleBugReport}
        fullWidth={fullWidth}
        sx={{ borderRadius: '10px' }}
      >
        {label}
      </Button>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>Fejlrapport (gennemgå før du sender)</DialogTitle>
        <DialogContent>
          {isPreparing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, paddingY: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Genererer rapport…</Typography>
            </Box>
          )}

          {!isPreparing && prepared && (
            <>
              <Alert severity="warning" sx={{ borderRadius: '10px', marginBottom: 2 }}>
                Rapporten kan indeholde persondata eller sagsoplysninger. Gennemgå indholdet før du
                kopierer, sender eller downloader.
              </Alert>

              {prepared.email.bodyWasTrimmed && (
                <Typography variant="body2" sx={{ marginBottom: 2 }}>
                  Bemærk: Email-teksten er trimmet pga. mailto-længdebegrænsninger. Download
                  rapporten for fuldt indhold.
                </Typography>
              )}

              <TextField
                value={prepared.report}
                fullWidth
                multiline
                minRows={14}
                inputProps={{ readOnly: true }}
                sx={{ fontFamily: 'monospace' }}
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ padding: 2 }}>
          <Button onClick={handleDialogClose} sx={{ borderRadius: '10px' }}>
            Luk
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            onClick={handleCopyToClipboard}
            disabled={!prepared || isPreparing}
            sx={{ borderRadius: '10px' }}
          >
            Kopier til clipboard
          </Button>
          <Button
            onClick={handleOpenEmail}
            variant="outlined"
            disabled={!prepared || isPreparing}
            sx={{ borderRadius: '10px' }}
          >
            Åbn email
          </Button>
          <Button
            onClick={handleDownload}
            variant="outlined"
            disabled={!prepared || isPreparing}
            sx={{ borderRadius: '10px' }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: '10px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default BugReportButton;
