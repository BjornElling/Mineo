import React from 'react';
import { Typography } from '@mui/material';
import VarigeMenSatserTable from '../../tables/VarigeMenSatserTable';
import ContentBox from '../../layout/ContentBox';

const SatserTab = React.memo(() => {
  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Satser</Typography>
      <Typography className="row--text">Jf. erstatningsansvarslovens § 4 og arbejdsskadesikringslovens § 18.</Typography>

      <VarigeMenSatserTable />
    </ContentBox>
  );
});

SatserTab.displayName = 'SatserTab';

export default SatserTab;

