import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../inputs/DocumentOutcomeMessage';
import YearField from '../../../inputCore/react/fields/YearField';
import type { useSatserViewModel } from './useSatserViewModel';

/**
 * Årstal-sektionen: satsårets felt og specifikations-downloaden.
 *
 * Satsårets min/maxYear-bounds er en canonical bounds-feltvalidator → rødt issue; feltet får derfor kun sin
 * `field` + `location`, ingen `minYear`/`maxYear`/`onFieldError`.
 */
const SatserAarstalSection = React.memo((
  { vm }: { vm: ReturnType<typeof useSatserViewModel> }
) => (
  <ContentBox className="content-box">
    <Typography className="section-header">Årstal</Typography>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Vis satser for år:</Typography>
      <Box className="row--label-right-hover__content">
        <YearField name="aargang" field={vm.aargangField} location={vm.aargangLocation} width={80} />
      </Box>
    </Box>

    <Box className="row--label-right-hover">
      <Typography className="row--text">Download specifikation:</Typography>
      <Box className="row--label-right-hover__content">
        <DocumentDownloadButton
          onClick={() => void vm.download.download(undefined)}
          disabled={!vm.download.canDownload}
          disabledReason={vm.download.disabledReason}
        />
      </Box>
    </Box>

    {/*
      Gate-årsagen findes her KUN i knappens tooltip, så beskeden læses direkte fra `errorMessage`
      (ikke gennem `visibleDocumentFailureMessage`) — ellers ville en gate-blokering være usynlig.
    */}
    <DocumentOutcomeMessage message={vm.download.errorMessage} />
  </ContentBox>
));

SatserAarstalSection.displayName = 'SatserAarstalSection';

export default SatserAarstalSection;
