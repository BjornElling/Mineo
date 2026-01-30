import * as React from 'react';
import { Table, type TableProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getMuiTableStyles, tableColors } from '../../config/tableTheme';
import { handleTableBlurCapture, handleTableKeyDownCapture, handleTablePointerDownCapture } from './tableKeyboardNavigation';

export type StandardLooseTableProps = Omit<TableProps, 'sx'> & Readonly<{
  /**
   * Table type 3: løs tabel.
   *
   * - Still uses central table styling
   * - Typically contains Styled-* inputs in cells
   */
  useSmallFont?: boolean;
  sx?: SxProps<Theme>;
}>;

const StandardLooseTable = React.memo(({ useSmallFont = false, sx, onKeyDownCapture, onBlurCapture, onPointerDownCapture, ...props }: StandardLooseTableProps) => {
  const tableStyles = getMuiTableStyles(useSmallFont);
  const mergedSx: SxProps<Theme> = [
    tableStyles,
    ...(sx === undefined ? [] : Array.isArray(sx) ? sx : [sx]),
    {
      // Overskriftsrækken skal bruge samme lysegrå som den alternerende baggrund.
      // Lægges sidst så table-level `sx` ikke kan "overskrive den væk" ved at
      // definere `& thead th` (typisk kun for alignment).
      '& thead th': {
        backgroundColor: tableColors.oddRowBackground,
      },
      // Loose tables must not display grid lines between body rows/columns.
      // Keep the header/body separator (defined in `getMuiTableStyles` via `& thead th`).
      '& tbody .MuiTableCell-root': {
        borderBottom: 'none !important',
      },
    },
  ];
  return (
    <Table
      size="small"
      data-mineo-table-navigation="true"
      onKeyDownCapture={(e) => {
        handleTableKeyDownCapture(e);
        onKeyDownCapture?.(e);
      }}
      onBlurCapture={(e) => {
        handleTableBlurCapture(e);
        onBlurCapture?.(e);
      }}
      onPointerDownCapture={(e) => {
        handleTablePointerDownCapture(e);
        onPointerDownCapture?.(e);
      }}
      sx={mergedSx}
      {...props}
    />
  );
});

StandardLooseTable.displayName = 'StandardLooseTable';

export default StandardLooseTable;
