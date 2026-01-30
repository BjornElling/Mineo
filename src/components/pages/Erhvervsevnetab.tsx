import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../layout/ContentBox';

/**
 * Erhvervsevnetab-komponent til beregning af erhvervsevnetabserstatning
 */
const Erhvervsevnetab = React.memo(() => {
  return (
    <Box>
      {/* Side-header */}
      <Typography className="page-title">Erhvervsevnetab</Typography>

      {/* Placeholder-indhold */}
      <ContentBox className="content-box">
        <Typography className="section-header">Beregning af erhvervsevnetabserstatning</Typography>

        <Typography className="row--text">
          Kommer...
        </Typography>
      </ContentBox>
    </Box>
  );
});

Erhvervsevnetab.displayName = 'Erhvervsevnetab';

export default Erhvervsevnetab;
