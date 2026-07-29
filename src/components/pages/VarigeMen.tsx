import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import MenberegningTab from './varigemen/MenberegningTab';
import SatserTab from './varigemen/SatserTab';
import { VARIGE_MEN_TAB_KEYS, useVarigeMenViewModel } from './varigemen/useVarigeMenViewModel';

// Siden er ren fane-komposition (`page-component-contract.md` §4.4): faneorkestreringen bor i
// `useVarigeMenViewModel`. Siden ejer ingen input-state — `MenberegningTab` læser/skriver selv gennem inputCore.

const VarigeMen = React.memo(() => {
  const { activeTab, setActiveTab, tabItems } = useVarigeMenViewModel();

  return (
    <Box>
      <Typography className="page-title">Varige mén</Typography>

      <PageTabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === VARIGE_MEN_TAB_KEYS.SATSER ? <SatserTab /> : <MenberegningTab />}
    </Box>
  );
});

VarigeMen.displayName = 'VarigeMen';

export default VarigeMen;
