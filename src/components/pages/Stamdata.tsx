import React from 'react';
import { Box, Typography } from '@mui/material';

import { StamdataVmProvider } from './stamdata/stamdataContext';
import { useStamdataViewModel } from './stamdata/useStamdataViewModel';
import StamdataSagsinfoSection from './stamdata/StamdataSagsinfoSection';
import StamdataSkadelidteSection from './stamdata/StamdataSkadelidteSection';

// Siden er ren sektions-komposition (`page-component-contract.md` §4.4): afledt state og feltbindinger bor i
// `useStamdataViewModel`, og hver ContentBox er sin egen sektion-komponent.

const Stamdata = React.memo(() => {
  const vm = useStamdataViewModel();

  return (
    <StamdataVmProvider value={vm}>
      <Box>
        <Typography className="page-title">Stamdata</Typography>

        <Box sx={{ position: 'relative' }}>
          <Box>
            <StamdataSagsinfoSection />
            <StamdataSkadelidteSection />
          </Box>
        </Box>
      </Box>
    </StamdataVmProvider>
  );
});

Stamdata.displayName = 'Stamdata';

export default Stamdata;
