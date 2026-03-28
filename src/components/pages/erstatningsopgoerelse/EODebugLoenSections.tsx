/**
 * EODebugLoenSections - Render-only komponent til løn
 *
 * Phase 5.5 - UI Wire:
 * - Rendere løn sections fra adapter
 * - Ingen beregninger
 * - Ingen parsing
 * - Bruger { rawValue, displayValue } direkte
 */

import * as React from 'react';
import { Box, Typography } from '@mui/material';
import type { LoenDebugSection } from '../../../domain/debug/eoDebugLoenViewModel';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';

const EODebugLoenSections = React.memo<{
  sections: readonly LoenDebugSection[];
}>(({ sections }) => {
  if (sections.length === 0) {
    return (
      <Typography className="row--text" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
        Ingen løndata
      </Typography>
    );
  }

  return (
    <Box>
      {sections.map((section) => (
        <Box key={section.id}>
          <Typography className="row--subheading" sx={{ mb: 1 }}>
            {section.header}
          </Typography>

          <StandardDisplayTable
            useSmallFont
            columns={section.table.columns.map((header) => ({
              header,
              align: 'center' as const,
              width: 160,
            }))}
            rows={section.table.rows.map((row): StandardDisplayTableRow => ({
              key: row.id,
              cells: row.cells.map((cell) =>
                typeof cell === 'string' ? cell : cell.displayValue
              ),
            }))}
          />
        </Box>
      ))}
    </Box>
  );
});

EODebugLoenSections.displayName = 'EODebugLoenSections';

export default EODebugLoenSections;
