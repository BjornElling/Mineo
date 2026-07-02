import * as React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import type { EOInspektionDisplayTable } from '../../../domain/eoInspektion/eoInspektionPageViewModel';
import { INSPEKTION_ROW_LABEL_WIDTH, getDisplayValueSx, getStatusIcon } from './eoInspektionRowRendering';

const EOInspektionRowsSection = React.memo<{
  title: string;
  rows: readonly EoRowModel[];
  tables?: readonly EOInspektionDisplayTable[];
}>(({ title, rows, tables = [] }) => {
  // Render-contract: en sektion med 0 rækker skal være helt skjult.
  // Det gør komponenten sikker som fallback, selv om de primære show/hide-beslutninger
  // normalt træffes højere oppe i EO-gennemsyns-/kontrol-viewmodellen.
  if (rows.length === 0 && tables.length === 0) {
    return null;
  }

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">{title}</Typography>

      {rows.map((row) => (
        <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': INSPEKTION_ROW_LABEL_WIDTH }}>
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

EOInspektionRowsSection.displayName = 'EOInspektionRowsSection';

export default EOInspektionRowsSection;
