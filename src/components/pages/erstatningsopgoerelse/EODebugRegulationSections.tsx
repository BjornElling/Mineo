/**
 * EODebugRegulationSections - render-only komponent til regulering.
 *
 * Viser regulerings-sektioner fra `RegulationDebugSection`-view-modellen:
 * - ingen beregninger, ingen parsing
 * - bruger `{ rawValue, displayValue }` direkte fra view-modellen
 */

import * as React from 'react';
import { Box, Typography } from '@mui/material';
import type { RegulationDebugSection } from '../../../domain/debug/eoDebugRegulationViewModel';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import ContentBox from '../../layout/ContentBox';
import { getRegulationTableColumns } from './regulationTableColumns';
import { renderRegulationTableCellContent } from './regulationTableCellContent';
import { DEBUG_REGULATION_ROW_LABEL_WIDTH as LABEL_WIDTH } from './eoDebugRowRendering';

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
    return null;
  }

  return (
    <Box>
      {sections.map((section) => (
        <ContentBox key={section.id} className="content-box">
          <Typography className="section-header" sx={{ mb: 1 }}>
            {section.header}
          </Typography>
          {(() => {
            const tables = section.tables ?? [];

            return (
              <>
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

                {tables.length > 0 ? (
                  <>
                    {tables.map((table) => (
                      <StandardDisplayTable
                        key={table.id}
                        useSmallFont
                        columns={getRegulationTableColumns(table)}
                        rows={table.rows.map((row, index): StandardDisplayTableRow => ({
                          key: `${table.id}-row-${index}`,
                          cells: row.cells.map((cell) =>
                            typeof cell === 'string'
                              ? renderRegulationTableCellContent(cell)
                              : renderRegulationTableCellContent(cell.displayValue)
                          ),
                        }))}
                        tableSx={{
                          tableLayout: 'fixed',
                          '& .MuiTableCell-root': {
                            whiteSpace: 'normal',
                            overflowWrap: 'break-word',
                          },
                        }}
                      />
                    ))}
                  </>
                ) : null}
              </>
            );
          })()}
        </ContentBox>
      ))}
    </Box>
  );
});

EODebugRegulationSections.displayName = 'EODebugRegulationSections';

export default EODebugRegulationSections;
