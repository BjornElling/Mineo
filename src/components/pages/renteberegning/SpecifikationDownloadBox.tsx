import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import type { ContentBoxComponent } from '../../layout/ContentBoxFrame';
import { getDocumentFormatLabel, type DocumentDownloadFormat } from '../../../document/documentFormat';

interface SpecifikationDownloadBoxProps {
  onDownloadAll: () => Promise<void>;
  errorMessage: string | null;
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
      <Typography className="section-header">Download specifikationer</Typography>
      {errorMessage && (
        <Box className="row--label-right-hover">
          <Typography className="row--text" sx={{ color: 'error.main' }}>
            {errorMessage}
          </Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
      )}
      <Box>
        <Button
          variant="outlined"
          startIcon={isLoading ? <CircularProgress size={14} /> : <Download />}
          disabled={disabled || isLoading}
          onClick={() => { void onDownloadAll(); }}
          sx={{ fontSize: '13px', '& .MuiButton-startIcon svg': { fontSize: '16px' } }}
        >
          Download alle som {formatLabel}
        </Button>
      </Box>
    </ContentBoxComponent>
  );
});

SpecifikationDownloadBox.displayName = 'SpecifikationDownloadBox';

export default SpecifikationDownloadBox;
