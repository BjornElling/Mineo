/**
 * EODebugRegulationSections - Render-only komponent til regulering
 *
 * Phase 4.5 - UI Wire:
 * - Rendere regulation sections fra adapter
 * - Ingen beregninger
 * - Ingen parsing
 * - Bruger { rawValue, displayValue } direkte
 */

import * as React from 'react';
import { Box, Typography } from '@mui/material';
import type { RegulationDebugSection } from '../../../domain/debug/eoDebugRegulationViewModel';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';

const LABEL_WIDTH = '250px';

/**
 * Render regulation sections (summary, timeline, store bededag)
 *
 * VIGTIGT: Denne komponent er render-only
 * - Ingen hooks (undtagen React.memo)
 * - Ingen useMemo
 * - Ingen beregninger
 * - Ingen dato-parsing
 * - Kun visning af displayValue
 */
const EODebugRegulationSections = React.memo<{
  sections: readonly RegulationDebugSection[];
}>(({ sections }) => {
  if (sections.length === 0) {
    return (
      <Typography className="row--text" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
        Ingen reguleringsdata
      </Typography>
    );
  }

  return (
    <Box>
      {sections.map((section) => (
        <Box key={section.id} sx={{ mb: 4 }}>
          <Typography className="row--subheading" sx={{ mb: 1 }}>
            {section.header}
          </Typography>

          {/* Render rows (key-value pairs) */}
          {section.rows.map((row) => (
            <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': LABEL_WIDTH }}>
              <Typography className="row--text">{row.label}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
                <Typography className="row--text">
                  {typeof row.value === 'string' ? row.value : row.value.displayValue}
                </Typography>
              </Box>
            </Box>
          ))}

          {/* Render table (timeline) */}
          {section.table ? (
            <Box sx={{ mt: 2 }}>
              <StandardDisplayTable
                useSmallFont
                columns={section.table.columns.map((header) => ({
                  header,
                  align: 'center' as const,
                  width: 180,
                }))}
                rows={section.table.rows.map((row, index): StandardDisplayTableRow => ({
                  key: `${section.id}-row-${index}`,
                  cells: row.cells.map((cell) =>
                    typeof cell === 'string' ? cell : cell.displayValue
                  ),
                }))}
                containerSx={{ mb: 2 }}
              />
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  );
});

EODebugRegulationSections.displayName = 'EODebugRegulationSections';

export default EODebugRegulationSections;
