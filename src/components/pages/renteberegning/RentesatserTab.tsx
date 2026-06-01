import React from 'react';
import { Box, Typography } from '@mui/material';
import { referenceRates, surchargeRates, type RateEntry } from '../../../data/interestRates';
import InterestRatesTable, { type InterestRatesTableRow } from '../../tables/InterestRatesTable';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import ContentBox from '../../layout/ContentBox';

// Satserne lagres som ISO (åååå-mm-dd); tabellen viser dansk dd-mm-åååå til brugeren.
const toDisplayRows = (rates: ReadonlyArray<RateEntry>): InterestRatesTableRow[] =>
  rates.map((rate) => ({ effectiveDate: formatISOToDanish(rate.effectiveDate), ratePct: rate.ratePct }));

const referenceRows = toDisplayRows(referenceRates);
const surchargeRows = toDisplayRows(surchargeRates);

const RentesatserTab = React.memo(() => (
  <Box>
    <ContentBox className="content-box">
      <Typography className="section-header">Referencesats</Typography>
      <Typography className="row--text">
        Nationalbankens udlånsrente pr. 1. januar og 1. juli, jf. rentelovens § 5.
      </Typography>
      <InterestRatesTable rows={referenceRows} />
    </ContentBox>

    <ContentBox className="content-box">
      <Typography className="section-header">Tillægssats</Typography>
      <Typography className="row--text">
        Fast tillægsprocent, der tilskrives udlånsrenten, jf. rentelovens § 5, stk. 2.
      </Typography>
      <InterestRatesTable rows={surchargeRows} dateColumnHeader="Forfaldsdato" rateColumnHeader="Sats" />
    </ContentBox>
  </Box>
));

RentesatserTab.displayName = 'RentesatserTab';

export default RentesatserTab;
