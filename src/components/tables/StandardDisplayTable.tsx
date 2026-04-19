import * as React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getMuiTableStyles } from '../../config/tableTheme';

export type StandardDisplayTableColumn = Readonly<{
  header: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  headerSx?: SxProps<Theme>;
  cellSx?: SxProps<Theme>;
  cellStyle?: React.CSSProperties;
}>;

export type StandardDisplayTableRow = Readonly<{
  key: React.Key;
  cells: readonly React.ReactNode[];
  rowSx?: SxProps<Theme>;
}>;

export type StandardDisplayTableProps = Readonly<{
  columns: readonly StandardDisplayTableColumn[];
  rows: readonly StandardDisplayTableRow[];
  /**
   * Convenience wrapper styling around the table (not global responsive CSS).
   *
   * Width is owned centrally by StandardDisplayTable and is always 100%.
   * Call sites may adjust spacing and other wrapper concerns, but must not
   * attempt to control table width here.
   */
  containerSx?: SxProps<Theme>;
  /**
   * Per-table sx extension. Use sparingly; prefer adjusting columns.
   *
   * Column widths are part of normal use of this table type and may be left
   * automatic or set manually per column. Overall table width is owned
   * centrally and locked to 100%.
   */
  tableSx?: SxProps<Theme>;
  useSmallFont?: boolean;
}>;

/**
 * Table type 1: ren visning.
 *
 * - Uses central table styling (`getMuiTableStyles`)
 * - No inputs, no parsing, no business logic
 * - Overall width is always 100%
 * - Column widths may be automatic or manually specified per column
 */
const StandardDisplayTable = React.memo(
  ({ columns, rows, containerSx, tableSx, useSmallFont = false }: StandardDisplayTableProps) => {
    const tableStyles = getMuiTableStyles(useSmallFont);
    const containerSxParts = containerSx === undefined
      ? []
      : Array.isArray(containerSx)
        ? containerSx
        : [containerSx];
    const tableSxParts = tableSx === undefined
      ? []
      : Array.isArray(tableSx)
        ? tableSx
        : [tableSx];

    return (
      <Box
        sx={[
          ...containerSxParts,
          {
            width: '100%',
            mt: 2,
            mb: 2,
            pt: 1,
            pb: 1,
          },
        ]}
      >
        <Table
          size="small"
          sx={[
            {
              ...tableStyles,
              tableLayout: 'fixed',
              '& .MuiTableCell-root': {
                ...tableStyles['& .MuiTableCell-root'],
                whiteSpace: 'nowrap',
              },
              // View-only tables must not display grid lines between body rows/columns.
              // Keep the header/body separator (defined in `getMuiTableStyles` via `& thead th`).
              // Allow rowSx to override borders if needed (e.g., for section separators).
              '& tbody .MuiTableCell-root': {
                border: 'none',
              },
            },
            ...tableSxParts,
            {
              width: '100%',
            },
          ]}
        >
          <TableHead>
            <TableRow>
              {columns.map((col, idx) => (
                <TableCell
                  key={idx}
                  align={col.align ?? 'center'}
                  sx={{
                    width: col.width,
                    ...col.headerSx,
                  }}
                >
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} sx={row.rowSx}>
                {row.cells.map((cell, idx) => {
                  const col = columns[idx];
                  return (
                    <TableCell key={idx} align={col?.align ?? 'center'} sx={col?.cellSx} style={col?.cellStyle}>
                      {cell}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  }
);

StandardDisplayTable.displayName = 'StandardDisplayTable';

export default StandardDisplayTable;
