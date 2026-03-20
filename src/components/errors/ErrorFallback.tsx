import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportButton from './BugReportButton';

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
}

/**
 * Fallback UI der vises når ErrorBoundary fanger en fejl.
 *
 * Viser brugervenlig fejlbesked med mulighed for:
 * - "Prøv igen" (re-render)
 * - "Genindlæs siden" (hard reload med bekræftelse)
 * - fejlrapport (med error context)
 * - tekniske detaljer (kun stack i DEV)
 */
const ErrorFallback = ({ error, errorInfo, onReset }: ErrorFallbackProps) => {
  const canShowStack = import.meta.env.DEV;
  const [showDetails, setShowDetails] = React.useState(false);
  const [confirmReloadOpen, setConfirmReloadOpen] = React.useState(false);

  const handleToggleDetails = () => {
    setShowDetails((prev) => !prev);
  };

  const handleHardReloadRequest = () => {
    setConfirmReloadOpen(true);
  };

  const handleHardReloadCancel = () => {
    setConfirmReloadOpen(false);
  };

  const handleHardReloadConfirm = () => {
    window.location.reload();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: 3,
        backgroundColor: '#f8f9fa',
      }}
    >
      <Alert
        severity="error"
        sx={{
          maxWidth: 600,
          width: '100%',
          marginBottom: 2,
          borderRadius: '20px',
        }}
      >
        <AlertTitle sx={{ fontSize: '18px', fontWeight: 500 }}>Noget gik galt</AlertTitle>

        <Typography variant="body1" sx={{ marginBottom: 2 }}>
          MINEO stødte på en uventet fejl. Prøv først at genstarte, og hvis det ikke hjælper,
          genindlæs siden.
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 2 }}>
          Hvis problemet fortsætter, kan du rapportere fejlen, så den kan blive rettet.
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginBottom: 2 }}>
          Prøv igen gen-renderer. Genindlæs siden kan slette ikke-gemt arbejde.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={onReset}
            sx={{ borderRadius: '10px' }}
          >
            Prøv igen
          </Button>

          <Button variant="outlined" onClick={handleHardReloadRequest} sx={{ borderRadius: '10px' }}>
            Genindlæs siden
          </Button>

          <BugReportButton
            variant="outlined"
            context={{
              source: 'ErrorFallback',
              error: error ?? undefined,
              errorInfo: errorInfo ?? undefined,
            }}
          />

          {error && (
            <Button variant="text" onClick={handleToggleDetails} sx={{ borderRadius: '10px' }}>
              {showDetails ? 'Skjul' : 'Vis'} tekniske detaljer
            </Button>
          )}
        </Box>

        {showDetails && error && (
          <Box
            sx={{
              marginTop: 2,
              padding: 2,
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            <Typography
              variant="body2"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              }}
            >
              {error.message}
              {canShowStack && error.stack ? `\n\n${error.stack}` : ''}
              {canShowStack && errorInfo?.componentStack ? `\n\n${errorInfo.componentStack}` : ''}
            </Typography>

            {!canShowStack && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginTop: 1 }}>
                Stacktrace er skjult i produktion. Brug fejlrapport-knappen hvis du vil sende tekniske detaljer.
              </Typography>
            )}
          </Box>
        )}
      </Alert>

      <Dialog open={confirmReloadOpen} onClose={handleHardReloadCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Genindlæs siden?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Dette genindlæser siden og kan slette ikke-gemte data. Fortsæt kun hvis du har gemt dit arbejde.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: 2 }}>
          <Button onClick={handleHardReloadCancel} sx={{ borderRadius: '10px' }}>
            Annuller
          </Button>
          <Button onClick={handleHardReloadConfirm} variant="contained" sx={{ borderRadius: '10px' }}>
            Genindlæs
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ErrorFallback;
