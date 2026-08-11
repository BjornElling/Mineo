import React from 'react';
import { Box, Typography } from '@mui/material';
import type { DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../inputs/DocumentOutcomeMessage';
import ContentBox from '../../layout/ContentBox';

type Props = Readonly<{
  download: DocumentDownloadHandle<void>;
}>;

/**
 * Dokumentaffordancen skal stadig være synlig på en blokeret revision. En skjult
 * knap gør en dokumentblokering til tavs adfærd og bryder kontrakten om, at
 * download er synligt disabled med forklaring i tooltippen.
 */
const EetDocumentDownloadBox = ({ download }: Props) => (
  <ContentBox className="content-box">
    <Typography className="section-header">Beregning</Typography>
    <Box className="row--label-right-hover">
      <Typography className="row--text">Download specifikation</Typography>
      <Box className="row--label-right-hover__content">
        <DocumentDownloadButton
          onClick={() => void download.download(undefined)}
          disabled={!download.canDownload}
          disabledReason={download.disabledReason}
        />
      </Box>
    </Box>
    <DocumentOutcomeMessage message={download.errorMessage} />
  </ContentBox>
);

EetDocumentDownloadBox.displayName = 'EetDocumentDownloadBox';

export default EetDocumentDownloadBox;
