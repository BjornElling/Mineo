import React from 'react';
import { Box, Typography } from '@mui/material';
import PageTabs from '../layout/PageTabs';
import ContentBox from '../layout/ContentBox';
import RenteberegningTab from './renteberegning/RenteberegningTab';
import RentesatserTab from './renteberegning/RentesatserTab';
import {
  RENTEBEREGNING_TAB_KEYS,
  useRenteberegningViewModel,
} from './renteberegning/useRenteberegningViewModel';

// Siden er ren fane-komposition (`page-component-contract.md` §4.4): dokumenthandles, satser og
// faneorkestrering bor i `useRenteberegningViewModel`.

const Renteberegning = React.memo(() => {
  const vm = useRenteberegningViewModel();

  return (
    <Box>
      <Typography className="page-title">Renteberegning</Typography>

      <PageTabs items={vm.tabItems} value={vm.activeTab} onChange={vm.setActiveTab} />

      {vm.activeTab === RENTEBEREGNING_TAB_KEYS.RATES ? (
        <RentesatserTab />
      ) : (
        <RenteberegningTab
          renteDownload={vm.renteDownload}
          referenceRates={vm.referenceRates}
          surchargeRates={vm.surchargeRates}
          ContentBoxComponent={ContentBox}
          renteOversigtDownload={vm.renteOversigtDownload}
          showOversigtBox
          documentDownloadFormat={vm.documentDownloadFormat}
          hasEoFiles
        />
      )}
    </Box>
  );
});

Renteberegning.displayName = 'Renteberegning';

export default Renteberegning;
