import React from 'react';
import { Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { ContentBoxComponent } from '../../layout/ContentBoxFrame';
import { DOWNLOAD_DISABLED_TOOLTIP, getDocumentFormatLabel, type DocumentDownloadFormat } from '../../../document/documentFormat';
import { PageMessageRow } from '../../layout/PageMessageBox';
import type { PageMessage } from '../../layout/pageMessage';

interface SpecifikationDownloadBoxProps {
  onDownloadAll: () => Promise<void>;
  /** `PageMessage`, ikke `string | null`: fejllinjen kan da ikke vises uden indhold. */
  errorMessage: PageMessage;
  isLoading: boolean;
  disabled?: boolean;
  ContentBoxComponent: ContentBoxComponent;
  documentDownloadFormat: DocumentDownloadFormat;
}

const SpecifikationDownloadBox = React.memo(({
  onDownloadAll,
  errorMessage,
  isLoading,
  disabled = false,
  ContentBoxComponent,
  documentDownloadFormat,
}: SpecifikationDownloadBoxProps) => {
  const formatLabel = getDocumentFormatLabel(documentDownloadFormat);

  return (
    <ContentBoxComponent className="content-box">
      <Typography className="section-header">Specifikationer</Typography>
      <PageMessageRow message={errorMessage} rightCellHasContentClass />
      <Box>
        <Tooltip title={disabled && !isLoading ? DOWNLOAD_DISABLED_TOOLTIP : ''}>
          <span>
            <Button
              variant="outlined"
              startIcon={isLoading ? <CircularProgress size={14} /> : <Download />}
              disabled={disabled || isLoading}
              onClick={() => { void onDownloadAll(); }}
              sx={{ fontSize: '13px', '& .MuiButton-startIcon svg': { fontSize: '16px' } }}
            >
              Download som {formatLabel}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </ContentBoxComponent>
  );
});

SpecifikationDownloadBox.displayName = 'SpecifikationDownloadBox';

export default SpecifikationDownloadBox;
