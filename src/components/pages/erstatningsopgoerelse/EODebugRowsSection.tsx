import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { Check, ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import type { DebugRowModel, DebugStatus } from '../../../domain/debug/eoDebugTypes';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import type { EODebugDisplayTable } from '../../../domain/debug/eoDebugPageViewModel';

const LABEL_WIDTH = '320px';

const getStatusIcon = (status: DebugStatus): React.ReactElement => {
  switch (status) {
    case 'error':
      return <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />;
    case 'warning':
      return <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />;
    case 'ok':
      return <Check sx={{ color: 'var(--color-status-success)', fontSize: 20 }} />;
  }
};

const getDisplayValueSx = (displayValue: string) => ({
  whiteSpace: 'pre-line' as const,
  textAlign: displayValue.includes('\n') ? 'right' as const : 'inherit',
});

const EODebugRowsSection = React.memo<{
  title: string;
  rows: readonly DebugRowModel[];
  tables?: readonly EODebugDisplayTable[];
}>(({ title, rows, tables = [] }) => {
  // Render-contract: en sektion med 0 rækker skal være helt skjult.
  // Det gør komponenten sikker som fallback, selv om de primære show/hide-beslutninger
  // normalt træffes højere oppe i EO-debug viewmodellen.
  if (rows.length === 0 && tables.length === 0) {
    return null;
  }

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">{title}</Typography>

      {rows.map((row) => (
        <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
          <Typography className="row--text">{row.label}</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
            <Typography className="row--text" sx={getDisplayValueSx(row.displayValue)}>{row.displayValue}</Typography>
            {getStatusIcon(row.status)}
          </Box>
        </Box>
      ))}

      {tables.map((table) => (
        <Box key={table.id}>
          <Typography className="row--text" sx={{ mt: 2, mb: 0.5 }}>
            {table.title}
          </Typography>
          <StandardDisplayTable
            useSmallFont
            columns={table.columns.map((column) => ({ header: column, align: 'center' as const }))}
            rows={table.rows.map((row): StandardDisplayTableRow => ({
              key: row.id,
              cells: row.cells,
            }))}
          />
        </Box>
      ))}
    </ContentBox>
  );
});

EODebugRowsSection.displayName = 'EODebugRowsSection';

export default EODebugRowsSection;
