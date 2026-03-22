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
import ContentBox from '../../layout/ContentBox';
import { getRegulationTableColumns } from './regulationTableColumns';
import { renderRegulationTableCellContent } from './regulationTableCellContent';

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
                  <Box sx={{ mt: 2 }}>
                    {tables.map((table, tableIndex) => (
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
                        containerSx={{ mb: tableIndex === tables.length - 1 ? 2 : 4, width: '100%' }}
                        tableSx={{
                          width: '100%',
                          tableLayout: 'fixed',
                          '& .MuiTableCell-root': {
                            whiteSpace: 'normal',
                            overflowWrap: 'break-word',
                          },
                        }}
                      />
                    ))}
                  </Box>
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
