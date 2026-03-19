import * as React from 'react';
import { Box } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import type { CSSProperties } from 'react';
import { getHtmlTableStyles, tableColors } from '../../config/tableTheme';
import { GridCoreProvider } from './gridCore/gridCoreContext';
import { handleTableBlurCapture, handleTableDoubleClickCapture, handleTableFocusCapture, handleTableKeyDownCapture, handleTablePointerDownCapture } from './gridCore/tableKeyboardNavigation';
import type { GridSortDirection, GridSortRole } from './gridCore/gridModel';
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
  containerSx?: Record<string, unknown>;
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
      <Box sx={{ width: '100%', overflowX: 'auto', ...(containerSx ?? {}) }}>
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
  sortDirection?: GridSortDirection;
}>;

export const StandardGridHeaderCell = React.memo(({ children, onClick, sortRole = 'none', sortDirection = 'asc' }: StandardGridHeaderCellProps) => {
  const showIcon = sortRole !== 'none';
  const Icon = sortDirection === 'desc' ? KeyboardArrowDownIcon : KeyboardArrowUpIcon;
  const iconColor = sortRole === 'primary' ? '#1976d2' : 'rgba(0, 0, 0, 0.45)';
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
      {showIcon ? (
        <Icon
          sx={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            fontSize: '14px',
            color: iconColor,
          }}
        />
      ) : null}
    </th>
  );
});

StandardGridHeaderCell.displayName = 'StandardGridHeaderCell';
