import * as React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { getHtmlTableStyles, tableColors } from '../../config/tableTheme';
import { GridCoreProvider } from './gridCore/gridCoreContext';
import { handleTableBlurCapture, handleTableDoubleClickCapture, handleTableFocusCapture, handleTableKeyDownCapture, handleTablePointerDownCapture } from './gridCore/tableKeyboardNavigation';
import type { GridSortDirection, GridSortRole } from './gridCore/gridModel';
import { SortIcon } from './SortIcon';
import { assignRef } from '../inputs/table/assignRef';
import { useGridCoreController } from './useGridCoreController';

export type StandardGridTableProps = Readonly<{
  /**
   * Table type 2: egentlig tabel (HTML table + table-inputs).
   *
   * - Central styling via `getHtmlTableStyles`
   * - Intended for Table*Input components (draft onChange, commit onBlur)
   */
  children: React.ReactNode;
  beforeTable?: React.ReactNode;
  tableWidth: CSSProperties['width'];
  tableLayout?: CSSProperties['tableLayout'];
  useSmallFont?: boolean;
  /**
   * Optional max-width wrapper + horizontal scrolling.
   */
  containerSx?: SxProps<Theme>;
  /**
   * Optional table ref for focus coordination.
   */
  tableRef?: React.Ref<HTMLTableElement>;
}>;

export const StandardGridTable = React.memo(
  ({
    children,
    beforeTable,
    tableWidth,
    tableLayout = 'fixed',
    useSmallFont = false,
    containerSx,
    tableRef,
  }: StandardGridTableProps) => {
    const { internalTableRef, contextValue } = useGridCoreController({ tableKind: 'grid' });

    return (
      <Box sx={[{ width: '100%', overflowX: 'auto' }, ...(containerSx === undefined ? [] : Array.isArray(containerSx) ? containerSx : [containerSx])]}>
        {beforeTable}
        <GridCoreProvider value={contextValue}>
          <table
            ref={(node) => {
              internalTableRef.current = node;
              assignRef(tableRef, node);
            }}
            data-mineo-table-navigation="true"
            onKeyDownCapture={handleTableKeyDownCapture}
            onBlurCapture={handleTableBlurCapture}
            onFocusCapture={handleTableFocusCapture}
            onPointerDownCapture={handleTablePointerDownCapture}
            onDoubleClickCapture={handleTableDoubleClickCapture}
            style={{
              ...getHtmlTableStyles(useSmallFont),
              width: tableWidth,
              tableLayout,
            }}
          >
            {children}
          </table>
        </GridCoreProvider>
      </Box>
    );
  }
);

StandardGridTable.displayName = 'StandardGridTable';

export type StandardGridHeaderCellProps = Readonly<{
  children: React.ReactNode;
  onClick?: () => void;
  sortRole?: GridSortRole;
  sortDirection?: GridSortDirection | undefined;
}>;

export const StandardGridHeaderCell = React.memo(({ children, onClick, sortRole = 'none', sortDirection = 'asc' }: StandardGridHeaderCellProps) => {
  return (
    <th
      style={{
        padding: '8px 4px',
        border: 'none',
        borderBottom: `1px solid ${tableColors.border}`,
        fontWeight: 500,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'relative',
        backgroundColor: tableColors.headerBackground,
      }}
      onClick={onClick}
    >
      {children}
      {sortRole !== 'none' ? <SortIcon sortRole={sortRole} sortDirection={sortDirection} /> : null}
    </th>
  );
});

StandardGridHeaderCell.displayName = 'StandardGridHeaderCell';
