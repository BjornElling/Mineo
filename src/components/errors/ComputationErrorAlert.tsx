import React from 'react';
import { Alert, AlertTitle, Button, Box, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { getUserMessage } from '../../utils/errorMessages';

interface ComputationErrorAlertProps {
  error: Error;
  context?: string;
  onRetry?: () => void;
  showDetails?: boolean;
}

/**
 * Alert komponent til visning af beregningsfejl
 *
 * Viser brugervenlig fejlbesked på dansk.
 * Mulighed for at vise tekniske detaljer (collapse).
 * Valgfri "Prøv igen" knap.
 *
 * Eksempel:
 * ```tsx
 * {isErr(periodeResult) && (
 *   <ComputationErrorAlert
 *     error={periodeResult.error}
 *     context="Periode-beregning"
 *     onRetry={handleRetry}
 *   />
 * )}
 * ```
 */
const ComputationErrorAlert = ({
  error,
  context,
  onRetry,
  showDetails = false,
}: ComputationErrorAlertProps) => {
  const [detailsVisible, setDetailsVisible] = React.useState(false);

  const handleToggleDetails = () => {
    setDetailsVisible(!detailsVisible);
  };

  const canShowStack = import.meta.env.DEV;
  let userMessage = 'Der opstod en ukendt fejl.';
  try {
    userMessage = getUserMessage(error);
  } catch {
    // Fejl-UI må aldrig crashe pga. fejlagtig mapping
  }

  return (
    <Alert
      severity="error"
      icon={<ErrorOutlineIcon />}
      sx={{
        borderRadius: '10px',
        marginTop: 2,
        marginBottom: 2,
      }}
    >
      <AlertTitle sx={{ fontWeight: 500 }}>
        {context ? `Fejl i ${context}` : 'Beregningsfejl'}
      </AlertTitle>

      <Typography variant="body2" sx={{ marginBottom: 1 }}>
        {userMessage}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, marginTop: 2 }}>
        {onRetry && (
          <Button variant="outlined" size="small" onClick={onRetry} sx={{ borderRadius: '10px' }}>
            Prøv igen
          </Button>
        )}

        {showDetails && (
          <Button
            variant="text"
            size="small"
            onClick={handleToggleDetails}
            sx={{ borderRadius: '10px' }}
          >
            {detailsVisible ? 'Skjul' : 'Vis'}{' '}
            {canShowStack ? 'tekniske detaljer' : 'teknisk besked (stack skjult i produktion)'}
          </Button>
        )}
      </Box>

      {detailsVisible && (
        <Box
          sx={{
            marginTop: 2,
            padding: 2,
            backgroundColor: 'var(--color-surface-raised)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
          }}
        >
          <Typography
            variant="body2"
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '11px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {error.message}
            {canShowStack && error.stack ? `\n\n${error.stack}` : ''}
          </Typography>

          {!canShowStack && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', marginTop: 1 }}>
              Stacktrace er skjult i produktion. Brug fejlrapport-knappen hvis du vil sende tekniske detaljer.
            </Typography>
          )}
        </Box>
      )}
    </Alert>
  );
};

export default ComputationErrorAlert;
