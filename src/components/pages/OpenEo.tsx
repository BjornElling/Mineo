import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const OpenEo = React.memo(() => {
  const navigate = useNavigate();
  const [showFallbackContent, setShowFallbackContent] = React.useState(false);

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

  return (
    <Box sx={{ padding: 4 }}>
      <Typography variant="h5" sx={{ marginBottom: 2 }}>
        Åbner fil…
      </Typography>
      <Typography variant="body2">
        Hvis du kom hertil ved at dobbeltklikke en `.eo`-fil, indlæses den i Mineo nu.
      </Typography>
      <Typography variant="body2" sx={{ marginTop: 1 }}>
        Hvis der ikke sker noget, kræver det typisk at Mineo er installeret som PWA i Chrome/Edge.
      </Typography>
      <Typography variant="body2" sx={{ marginTop: 1 }}>
        Du kan altid indlæse manuelt via menuen: <strong>Hent</strong>.
      </Typography>
      <Box sx={{ marginTop: 3, display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={() => navigate('/stamdata', { replace: true })}>
          Gå til program
        </Button>
      </Box>
    </Box>
  );
});

OpenEo.displayName = 'OpenEo';

export default OpenEo;
