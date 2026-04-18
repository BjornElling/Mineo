import * as React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getHtmlTableStyles, htmlTableHeaderStyles } from '../../config/tableTheme';

export type VirtualizedDisplayTableColumn = Readonly<{
  /**
   * Stable identifier for the column (optional).
   *
   * When provided, it is used for React keys and is exposed as `data-mineo-column-id`
   * on both header and body cells for diagnostics/debugging.
   */
  id?: string;
  header: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width: number;
  /**
   * Visual group separator (vertical line) before this column.
   */
  borderLeft?: boolean;
}>;

export type VirtualizedDisplayTableHeaderCell = Readonly<{
  key?: React.Key;
  content: React.ReactNode;
  columnId?: string;
  colSpan?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  borderLeft?: boolean;
}>;

export type VirtualizedDisplayTableHeaderRow = Readonly<{
  key?: React.Key;
  cells: readonly VirtualizedDisplayTableHeaderCell[];
  stickyHeight?: number;
}>;

export type VirtualizedDisplayTableProps = Readonly<{
  columns: readonly VirtualizedDisplayTableColumn[];
  headerRows?: readonly VirtualizedDisplayTableHeaderRow[];
  rowCount: number;
  rowHeight: number;
  height: number;
  overscan?: number;
  /**
   * When enabled, the table header row stays visible at the top of the nearest scroll container.
   *
   * Intended for very large tables where users must always see the column headings.
   */
  stickyHeader?: boolean;
  /**
   * Sticky offset from the top of the scroll container (pixels).
   */
  stickyHeaderTop?: number;
  /**
   * Scroll strategy:
   * - 'self' (default): the table renders inside its own vertical scroll container.
   * - 'ancestor': the table does not create its own scroll container; virtualization follows the nearest
   *   ancestor marked with `data-mineo-scroll-container="true"` (fallback: window).
   */
  scrollMode?: 'self' | 'ancestor';
  getRowKey: (rowIndex: number) => React.Key;
  renderCell: (rowIndex: number, columnIndex: number) => React.ReactNode;
  containerSx?: SxProps<Theme>;
  useSmallFont?: boolean;
}>;

const VirtualizedDisplayTable = React.memo(
  ({
    columns,
    headerRows,
    rowCount,
    rowHeight,
    height,
    overscan = 8,
    stickyHeader = false,
    stickyHeaderTop = 0,
    scrollMode = 'self',
    getRowKey,
    renderCell,
    containerSx,
    useSmallFont = false,
  }: VirtualizedDisplayTableProps) => {
    const scrollRef = React.useRef<HTMLDivElement | null>(null);
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const scrollHostRef = React.useRef<HTMLElement | null>(null);
    const rafRef = React.useRef<number | null>(null);

    const [scrollTop, setScrollTop] = React.useState(0);
    const [viewportHeight, setViewportHeight] = React.useState(height);

    const totalHeight = rowCount * rowHeight;

    const scheduleScrollUpdate = React.useCallback(() => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;

        if (scrollMode === 'self') {
          const el = scrollRef.current;
          if (!el) return;
          setScrollTop(el.scrollTop);
          setViewportHeight(height);
          return;
        }

        const tableEl = tableRef.current;
        if (!tableEl) return;

        const hostEl = scrollHostRef.current;
        if (hostEl) {
          const hostRect = hostEl.getBoundingClientRect();
          const tableRect = tableEl.getBoundingClientRect();
          const relative = Math.max(0, hostRect.top - tableRect.top);
          setScrollTop(relative);
          setViewportHeight(hostEl.clientHeight);
          return;
        }

        const tableRect = tableEl.getBoundingClientRect();
        const relative = Math.max(0, -tableRect.top);
        setScrollTop(relative);
        setViewportHeight(window.innerHeight);
      });
    }, [height, scrollMode]);

    const onScroll = React.useCallback(() => {
      scheduleScrollUpdate();
    }, [scheduleScrollUpdate]);

    React.useEffect(() => {
      if (scrollMode === 'self') {
        setViewportHeight(height);
        return;
      }

      const tableEl = tableRef.current;
      if (!tableEl) return;

      scrollHostRef.current = (tableEl.closest('[data-mineo-scroll-container="true"]') as HTMLElement | null) ?? null;
      scheduleScrollUpdate();

      const hostEl = scrollHostRef.current;
      const onResize = () => scheduleScrollUpdate();

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          scheduleScrollUpdate();
        });
        resizeObserver.observe(tableEl);
        if (hostEl) resizeObserver.observe(hostEl);
      }

      if (hostEl) {
        hostEl.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        return () => {
          hostEl.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onResize);
          resizeObserver?.disconnect();
        };
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        resizeObserver?.disconnect();
      };
    }, [height, onScroll, scheduleScrollUpdate, scrollMode]);

    React.useEffect(() => {
      return () => {
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, []);

    React.useEffect(() => {
      scheduleScrollUpdate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowCount, columns.length, rowHeight, scrollMode]);

    const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = React.useMemo(() => {
      if (rowCount <= 0) {
        return { startIndex: 0, endIndex: -1, topSpacerHeight: 0, bottomSpacerHeight: 0 };
      }

      const maxIndex = rowCount - 1;
      const startUnclamped = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
      const start = Math.min(maxIndex, startUnclamped);
      const endUnclamped = Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan;
      const end = Math.min(maxIndex, Math.max(start, endUnclamped));
      const top = start * rowHeight;
      const bottom = Math.max(0, totalHeight - (end + 1) * rowHeight);
      return { startIndex: start, endIndex: end, topSpacerHeight: top, bottomSpacerHeight: bottom };
    }, [overscan, rowCount, rowHeight, scrollTop, totalHeight, viewportHeight]);

    const tableStyle = React.useMemo(() => getHtmlTableStyles(useSmallFont), [useSmallFont]);
    const cellBaseStyle = React.useMemo<React.CSSProperties>(
      () => ({
        padding: '4px 8px',
        border: 'none',
        whiteSpace: 'nowrap',
        height: rowHeight,
        lineHeight: `${rowHeight - 8}px`,
        fontVariantNumeric: 'tabular-nums',
        verticalAlign: 'middle',
      }),
      [rowHeight]
    );

    const headerCellBaseStyle = React.useMemo<React.CSSProperties>(
      () => ({
        padding: '6px 8px',
        border: 'none',
        fontVariantNumeric: 'tabular-nums',
      }),
      []
    );

    const headerSeparatorBackground = React.useMemo<React.CSSProperties>(
      () => ({
        // `border-collapse: collapse` can prevent borders from painting reliably on sticky headers.
        // Paint the separator line as a background to guarantee it shows both in normal and sticky states.
        backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 2px), var(--color-table-border) 0)',
      }),
      []
    );

    const resolvedHeaderRows = React.useMemo<readonly VirtualizedDisplayTableHeaderRow[]>(
      () => headerRows ?? [{
        key: 'default',
        cells: columns.map((column, index) => ({
          key: column.id ?? index,
          content: column.header,
          columnId: column.id,
          width: column.width,
          align: 'center',
          borderLeft: column.borderLeft,
        })),
      }],
      [columns, headerRows]
    );

    const renderHeader = React.useCallback(() => (
      <thead>
        {resolvedHeaderRows.map((row, rowIndex) => (
          <tr key={row.key ?? rowIndex}>
            {row.cells.map((cell, cellIndex) => (
              <th
                key={cell.key ?? cellIndex}
                data-mineo-column-id={cell.columnId}
                colSpan={cell.colSpan ?? 1}
                style={{
                  ...htmlTableHeaderStyles,
                  ...headerCellBaseStyle,
                  ...(stickyHeader
                    ? {
                        position: 'sticky',
                        top: stickyHeaderTop + resolvedHeaderRows
                          .slice(0, rowIndex)
                          .reduce((sum, currentRow) => sum + (currentRow.stickyHeight ?? 36), 0),
                        zIndex: 4 + (resolvedHeaderRows.length - rowIndex),
                        backgroundColor: 'var(--color-table-header-bg)',
                        backgroundImage: 'none',
                      }
                    : {}),
                  width: cell.width,
                  height: row.stickyHeight,
                  minHeight: row.stickyHeight,
                  boxSizing: 'border-box',
                  textAlign: cell.align ?? 'center',
                  verticalAlign: 'bottom',
                  whiteSpace: 'pre-line',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  borderBottom: rowIndex === resolvedHeaderRows.length - 1
                    ? htmlTableHeaderStyles.borderBottom
                    : 'none',
                  ...(rowIndex === resolvedHeaderRows.length - 1 ? headerSeparatorBackground : {}),
                  borderLeft: cell.borderLeft ? '2px solid var(--color-table-border)' : undefined,
                }}
              >
                {cell.content}
              </th>
            ))}
          </tr>
        ))}
      </thead>
    ), [headerCellBaseStyle, headerSeparatorBackground, resolvedHeaderRows, stickyHeader, stickyHeaderTop]);

    if (scrollMode === 'ancestor') {
      return (
        <Box sx={{ width: 'fit-content', ...containerSx }}>
          <table
            ref={tableRef}
            style={{
              ...tableStyle,
              // Sticky headers don't work reliably when the table itself establishes an overflow clipping context.
              // Keep overflow visible so the sticky header can stick to the scroll container (window/Container).
              overflow: stickyHeader ? 'visible' : tableStyle.overflow,
              width: 'fit-content',
              tableLayout: 'fixed',
            }}
          >
            {renderHeader()}

            <tbody>
              {topSpacerHeight > 0 ? (
                <tr style={{ height: topSpacerHeight }}>
                  <td style={{ padding: 0, border: 'none' }} colSpan={columns.length} />
                </tr>
              ) : null}

              {Array.from({ length: Math.max(0, endIndex - startIndex + 1) }, (_, offset) => {
                const rowIndex = startIndex + offset;
                const isEven = rowIndex % 2 === 1;
                const backgroundColor = isEven ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)';
                return (
                  <tr key={getRowKey(rowIndex)} style={{ height: rowHeight, backgroundColor }}>
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.id ?? colIdx}
                        data-mineo-column-id={col.id}
                        style={{
                          ...cellBaseStyle,
                          width: col.width,
                          textAlign: col.align ?? 'center',
                          borderLeft: col.borderLeft ? '2px solid var(--color-table-border)' : undefined,
                        }}
                      >
                        {renderCell(rowIndex, colIdx)}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {bottomSpacerHeight > 0 ? (
                <tr style={{ height: bottomSpacerHeight }}>
                  <td style={{ padding: 0, border: 'none' }} colSpan={columns.length} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </Box>
      );
    }

    return (
      <Box sx={{ width: 'fit-content', ...containerSx }}>
        <table style={{ ...tableStyle, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, width: 'fit-content', tableLayout: 'fixed' }}>
          {renderHeader()}
        </table>

        <Box
          ref={scrollRef}
          onScroll={onScroll}
          sx={{
            width: 'fit-content',
            height,
            overflowY: 'auto',
            overflowX: 'visible',
            borderLeft: '1px solid var(--color-table-border)',
            borderRight: '1px solid var(--color-table-border)',
            borderBottom: '1px solid var(--color-table-border)',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px',
          }}
        >
          <table style={{ ...tableStyle, border: 'none', borderRadius: 0, width: 'fit-content', tableLayout: 'fixed' }}>
            <tbody>
              {topSpacerHeight > 0 ? (
                <tr style={{ height: topSpacerHeight }}>
                  <td style={{ padding: 0, border: 'none' }} colSpan={columns.length} />
                </tr>
              ) : null}

              {Array.from({ length: Math.max(0, endIndex - startIndex + 1) }, (_, offset) => {
                const rowIndex = startIndex + offset;
                const isEven = rowIndex % 2 === 1;
                const backgroundColor = isEven ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)';
                return (
                  <tr key={getRowKey(rowIndex)} style={{ height: rowHeight, backgroundColor }}>
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.id ?? colIdx}
                        data-mineo-column-id={col.id}
                        style={{
                          ...cellBaseStyle,
                          width: col.width,
                          textAlign: col.align ?? 'center',
                          borderLeft: col.borderLeft ? '2px solid var(--color-table-border)' : undefined,
                        }}
                      >
                        {renderCell(rowIndex, colIdx)}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {bottomSpacerHeight > 0 ? (
                <tr style={{ height: bottomSpacerHeight }}>
                  <td style={{ padding: 0, border: 'none' }} colSpan={columns.length} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  }
);

VirtualizedDisplayTable.displayName = 'VirtualizedDisplayTable';

export default VirtualizedDisplayTable;
