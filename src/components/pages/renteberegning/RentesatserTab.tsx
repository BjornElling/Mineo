import React from 'react';
import { Box, Typography } from '@mui/material';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import InterestRatesTable from '../../tables/InterestRatesTable';
import ContentBox from '../../layout/ContentBox';

const RentesatserTab = React.memo(() => (
  <Box>
    <ContentBox className="content-box">
      <Typography className="section-header">Referencesats</Typography>
      <Typography className="row--text">
        Nationalbankens udlånsrente pr. 1. januar og 1. juli, jf. rentelovens § 5.
      </Typography>
      <InterestRatesTable rows={referenceRates} />
    </ContentBox>

    <ContentBox className="content-box">
      <Typography className="section-header">Tillægssats</Typography>
      <Typography className="row--text">
        Fast tillægsprocent, der tilskrives udlånsrenten, jf. rentelovens § 5, stk. 2.
      </Typography>
      <InterestRatesTable rows={surchargeRates} dateColumnHeader="Forfaldsdato" rateColumnHeader="Sats" />
    </ContentBox>
  </Box>
));

RentesatserTab.displayName = 'RentesatserTab';

export default RentesatserTab;
