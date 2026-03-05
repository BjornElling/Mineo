import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { Check, ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import type { DebugRowModel, DebugStatus } from '../../../domain/debug/eoDebugTypes';

const LABEL_WIDTH = '320px';

const getStatusIcon = (status: DebugStatus): React.ReactElement => {
  switch (status) {
    case 'error':
      return <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />;
    case 'warning':
      return <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />;
    case 'ok':
      return <Check sx={{ color: 'green', fontSize: 20 }} />;
  }
};

const EODebugRowsSection = React.memo<{
  title: string;
  rows: readonly DebugRowModel[];
}>(({ title, rows }) => {
  if (rows.length === 0) {
    return null;
  }

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">{title}</Typography>

      {rows.map((row) => (
        <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
          <Typography className="row--text">{row.label}</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
            <Typography className="row--text">{row.displayValue}</Typography>
            {getStatusIcon(row.status)}
          </Box>
        </Box>
      ))}
    </ContentBox>
  );
});

EODebugRowsSection.displayName = 'EODebugRowsSection';

export default EODebugRowsSection;
