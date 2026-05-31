import * as React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { getHtmlTableStyles } from '../../config/tableTheme';
import { GridCoreProvider } from './gridCore/gridCoreContext';
import { handleTableBlurCapture, handleTableClickCapture, handleTableDoubleClickCapture, handleTableFocusCapture, handleTableKeyDownCapture, handleTablePointerDownCapture } from './gridCore/tableKeyboardNavigation';
import type { GridSortDirection, GridSortRole } from './gridCore/gridModel';
import { SortIcon } from './SortIcon';
import { assignRef } from '../inputs/table/assignRef';
import { useGridCoreController } from './useGridCoreController';

const BASE_CONTAINER_SX: SxProps<Theme> = {
  width: '100%',
  overflowX: 'auto',
};

export type StandardGridTableProps = Readonly<{
  /**
   * Tabeltype 2: egentlig tabel (HTML table + table-inputs).
   *
   * - Central styling via `getHtmlTableStyles`
   * - Beregnet til Table*Input-komponenter (draft onChange, commit onBlur)
   */
  children: React.ReactNode;
  beforeTable?: React.ReactNode;
  tableWidth: CSSProperties['width'];
  tableLayout?: CSSProperties['tableLayout'];
  useSmallFont?: boolean;
  /**
   * Valgfri max-width-wrapper + horisontal scrolling.
   */
  containerSx?: SxProps<Theme>;
  /**
   * Valgfri table-ref til fokus-koordinering.
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
    const mergedContainerSx = React.useMemo<SxProps<Theme>>(
      () => [
        BASE_CONTAINER_SX,
        ...(containerSx === undefined ? [] : Array.isArray(containerSx) ? containerSx : [containerSx]),
      ],
      [containerSx]
    );

    return (
      <Box sx={mergedContainerSx}>
        {beforeTable}
        <GridCoreProvider value={contextValue}>
          <Box
            sx={{
              display: 'block',
              width: 'fit-content',
              border: '1px solid var(--color-table-border)',
              borderRadius: '16px',
              overflow: 'hidden',
              '& tbody tr:last-of-type td:first-of-type .MuiInputBase-root': {
                borderBottomLeftRadius: '16px',
              },
              '& tbody tr:last-of-type td:last-of-type .MuiInputBase-root': {
                borderBottomRightRadius: '16px',
              },
            }}
          >
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
              onClickCapture={handleTableClickCapture}
              onDoubleClickCapture={handleTableDoubleClickCapture}
              style={{
                ...getHtmlTableStyles(useSmallFont),
                width: tableWidth,
                tableLayout,
                border: 'none',
                borderRadius: 0,
                overflow: 'visible',
              }}
            >
              {children}
            </table>
          </Box>
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
        borderBottom: '1px solid var(--color-table-border)',
        fontWeight: 500,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'relative',
        backgroundColor: 'var(--color-table-header-bg)',
      }}
      onClick={onClick}
    >
      {children}
      {sortRole !== 'none' ? <SortIcon sortRole={sortRole} sortDirection={sortDirection} /> : null}
    </th>
  );
});

StandardGridHeaderCell.displayName = 'StandardGridHeaderCell';
