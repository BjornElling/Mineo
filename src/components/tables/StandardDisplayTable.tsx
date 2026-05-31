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
   * Convenience-wrapper-styling omkring tabellen (ikke global responsiv CSS).
   *
   * Bredden ejes centralt af StandardDisplayTable og er altid 100%.
   * Call sites kan justere spacing og andre wrapper-anliggender, men må ikke
   * forsøge at styre tabel-bredden her.
   */
  containerSx?: SxProps<Theme>;
  /**
   * sx-udvidelse pr. tabel. Brug sparsomt; foretræk at justere kolonner.
   *
   * Kolonnebredder er en del af normal brug af denne tabeltype og kan efterlades
   * automatiske eller sættes manuelt pr. kolonne. Den samlede tabel-bredde ejes
   * centralt og er låst til 100%.
   */
  tableSx?: SxProps<Theme>;
  useSmallFont?: boolean;
}>;

/**
 * Tabeltype 1: ren visning.
 *
 * - Bruger central tabel-styling (`getMuiTableStyles`)
 * - Ingen inputs, ingen parsing, ingen forretningslogik
 * - Den samlede bredde er altid 100%
 * - Kolonnebredder kan være automatiske eller angives manuelt pr. kolonne
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
              // View-only-tabeller må ikke vise grid-linjer mellem body-rækker/-kolonner.
              // Behold header-/body-separatoren (defineret i `getMuiTableStyles` via `& thead th`).
              // Tillad rowSx at overskrive kanter ved behov (fx til sektions-separatorer).
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
