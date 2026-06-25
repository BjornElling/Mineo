import * as React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import { isSfggComputedTotalRowId, isSfggPostTableRowId } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { DEBUG_ROW_LABEL_WIDTH, getDisplayValueSx, getStatusIcon } from './eoDebugRowRendering';

type GroupedRowsSection = Readonly<{
  id: string;
  title: string;
  rows: readonly EoRowModel[];
  tables?: readonly Readonly<{
    id: string;
    title: string;
    columns: readonly string[];
    rows: readonly Readonly<{
      id: string;
      cells: readonly string[];
    }>[];
  }>[];
}>;

const renderDebugRow = (row: EoRowModel) => (
  <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': DEBUG_ROW_LABEL_WIDTH }}>
    <Typography className="row--text">{row.label}</Typography>
    <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
      <Typography
        className={`row--text${isSfggComputedTotalRowId(row.id) ? ' text-bold' : ''}`}
        sx={getDisplayValueSx(row.displayValue)}
      >
        {row.displayValue}
      </Typography>
      {getStatusIcon(row.status)}
    </Box>
  </Box>
);

const EODebugGroupedRowsSection = React.memo<{
  title: string;
  sections: readonly GroupedRowsSection[];
}>(({ title, sections }) => {
  // Behold en sektion når den har rækker ELLER tabeller — samme gating som EODebugRowsSection,
  // så sektioner der kun består af tabeller (uden rækker) ikke fejlagtigt skjules.
  const visibleSections = sections.filter(
    (section) => section.rows.length > 0 || (section.tables?.length ?? 0) > 0
  );
  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">{title}</Typography>

      {visibleSections.map((section) => (
        <React.Fragment key={section.id}>
          {(() => {
            const sfggPostTableRows = section.rows.filter((row) => isSfggPostTableRowId(row.id));

            return (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--subheading-underlined" sx={{ pl: 2 }}>
                    {section.title}
                  </Typography>
                  <Box className="row--label-right-hover__content" />
                </Box>

                {section.rows.filter((row) => !isSfggPostTableRowId(row.id)).map(renderDebugRow)}

                {(section.tables ?? []).map((table) => (
                  <React.Fragment key={table.id}>
                    <StandardDisplayTable
                      useSmallFont
                      columns={table.columns.map((header) => ({
                        header,
                        align: header === 'Fra-dato' || header === 'Til-dato' ? 'center' as const : 'right' as const,
                      }))}
                      rows={table.rows.map((row): StandardDisplayTableRow => ({
                        key: row.id,
                        cells: row.cells.map((cell, index) => {
                          const isTotalRow = row.cells[0] === 'I alt';
                          const isLastCell = index === row.cells.length - 1;
                          return isTotalRow && isLastCell
                            ? <Box key={`${row.id}-${index}`} component="span" sx={{ fontWeight: 700 }}>{cell}</Box>
                            : cell;
                        }),
                      }))}
                      tableSx={{
                        tableLayout: 'fixed',
                      }}
                    />
                  </React.Fragment>
                ))}

                {sfggPostTableRows.map(renderDebugRow)}
              </>
            );
          })()}
        </React.Fragment>
      ))}
    </ContentBox>
  );
});

EODebugGroupedRowsSection.displayName = 'EODebugGroupedRowsSection';

export default EODebugGroupedRowsSection;
