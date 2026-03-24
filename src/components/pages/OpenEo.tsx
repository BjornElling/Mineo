import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { retryPendingPwaFileOpenRequest } from '../../utils/pwaLaunchQueue';

const OpenEo = React.memo(() => {
  const [showFallbackContent, setShowFallbackContent] = React.useState(false);
  const [retryMessage, setRetryMessage] = React.useState<string | null>(null);
  const [isRetrying, setIsRetrying] = React.useState(false);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowFallbackContent(true);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!showFallbackContent) {
    return <Box sx={{ padding: 4 }} aria-hidden="true" />;
  }

  const handleRetryClick = async () => {
    setRetryMessage(null);
    setIsRetrying(true);
    try {
      const triggered = await retryPendingPwaFileOpenRequest();
      if (!triggered) {
        setRetryMessage('Kunne ikke finde den fil, der skulle indlæses. Prøv at åbne .eo-filen igen.');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Box sx={{ padding: 4 }}>
      <Typography variant="h5" sx={{ marginBottom: 2 }}>
        Indlæsning af fil blev afbrudt
      </Typography>
      <Typography variant="body2">
        Programmet har fået en opdatering og kunne derfor ikke gennemføre indlæsningen af filen.
      </Typography>
      <Typography variant="body2" sx={{ marginTop: 1 }}>
        Tryk her for at færdiggøre indlæsningen.
      </Typography>
      <Box sx={{ marginTop: 3, display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={() => { void handleRetryClick(); }} disabled={isRetrying}>
          Færdiggør indlæsningen
        </Button>
      </Box>
      {retryMessage ? (
        <Typography variant="body2" sx={{ marginTop: 2 }}>
          {retryMessage}
        </Typography>
      ) : null}
    </Box>
  );
});

OpenEo.displayName = 'OpenEo';

export default OpenEo;
