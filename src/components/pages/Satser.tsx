import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../layout/ContentBox';
import SatserAarstalSection from './satser/SatserAarstalSection';
import SatserRateSections from './satser/SatserRateSections';
import { useSatserViewModel } from './satser/useSatserViewModel';

/**
 * Satser: visning af lovbestemte satser for erstatningsberegninger.
 *
 * Siden er sektions-komposition (`page-component-contract.md` §4.4): reader-projektionen, feltbindingen og
 * dokumenthandlet bor i `useSatserViewModel`. Brevhovedet går gennem en typed Stamdata-projektion; rå sektioner
 * forlader aldrig runtimebindingen. Default-satsåret for en frisk sag seedes committed ved bootstrap
 * (`seedSatserNewCase`), ikke som skygge-visning.
 */
const Satser = React.memo(() => {
  const vm = useSatserViewModel();

  return (
    <Box>
      <Typography className="page-title">{vm.pageTitle}</Typography>

      <SatserAarstalSection vm={vm} />

      {/* Rate-sektionerne vises kun for et gyldigt valgt år. Ellers en kort vejledning, så der ikke vises
          satser for et tilfældigt fallback-år. */}
      {vm.satser === null ? (
        <ContentBox className="content-box">
          <Typography className="row--text" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
            Vælg et gyldigt år for at se satserne.
          </Typography>
        </ContentBox>
      ) : (
        <SatserRateSections satser={vm.satser} />
      )}
    </Box>
  );
});

Satser.displayName = 'Satser';

export default Satser;
