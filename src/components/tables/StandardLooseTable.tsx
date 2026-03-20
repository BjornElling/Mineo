import * as React from 'react';
import { Table, TableCell, type TableProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getMuiTableStyles, tableColors } from '../../config/tableTheme';
import { GridCoreProvider } from './gridCore/gridCoreContext';
import {
  handleTableBlurCapture,
  handleTableDoubleClickCapture,
  handleTableFocusCapture,
  handleTableKeyDownCapture,
  handleTablePointerDownCapture,
} from './gridCore/tableKeyboardNavigation';
import type { GridSortDirection, GridSortRole } from './gridCore/gridModel';
import { SortIcon } from './SortIcon';
import { useGridCoreController } from './useGridCoreController';

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

const StandardLooseTable = React.memo(({
  useSmallFont = false,
  sx,
  onKeyDownCapture,
  onBlurCapture,
  onPointerDownCapture,
  onFocusCapture,
  onDoubleClickCapture,
  ...props
}: StandardLooseTableProps) => {
  const { internalTableRef, contextValue } = useGridCoreController({ tableKind: 'loose' });

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
    <GridCoreProvider value={contextValue}>
      <Table
        ref={internalTableRef}
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
        onFocusCapture={(e) => {
          handleTableFocusCapture(e);
          onFocusCapture?.(e);
        }}
        onDoubleClickCapture={(e) => {
          handleTableDoubleClickCapture(e);
          onDoubleClickCapture?.(e);
        }}
        sx={mergedSx}
        {...props}
      />
    </GridCoreProvider>
  );
});

StandardLooseTable.displayName = 'StandardLooseTable';

export default StandardLooseTable;

export type StandardLooseHeaderCellProps = Readonly<{
  children: React.ReactNode;
  onClick?: () => void;
  sortRole?: GridSortRole;
  sortDirection?: GridSortDirection | undefined;
  sx?: SxProps<Theme>;
}>;

export const StandardLooseHeaderCell = React.memo(
  ({ children, onClick, sortRole = 'none', sortDirection = 'asc', sx }: StandardLooseHeaderCellProps) => {
    return (
      <TableCell
        onClick={onClick}
        sx={[
          {
            cursor: onClick ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            position: 'relative',
            userSelect: onClick ? 'none' : undefined,
          },
          ...(sx === undefined ? [] : Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {children}
        {sortRole !== 'none' ? <SortIcon sortRole={sortRole} sortDirection={sortDirection} /> : null}
      </TableCell>
    );
  }
);

StandardLooseHeaderCell.displayName = 'StandardLooseHeaderCell';
