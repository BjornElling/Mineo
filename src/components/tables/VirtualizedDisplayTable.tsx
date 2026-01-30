import * as React from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getHtmlTableStyles, htmlTableHeaderStyles, tableColors } from '../../config/tableTheme';

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

export type VirtualizedDisplayTableProps = Readonly<{
  columns: readonly VirtualizedDisplayTableColumn[];
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
    const scrollHostOffsetTopRef = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);

    const [scrollTop, setScrollTop] = React.useState(0);
    const [viewportHeight, setViewportHeight] = React.useState(height);

    const totalHeight = rowCount * rowHeight;

    const computeScrollHostOffset = React.useCallback(() => {
      const tableEl = tableRef.current;
      if (!tableEl) return;

      const hostEl = scrollHostRef.current;
      if (hostEl) {
        const hostRect = hostEl.getBoundingClientRect();
        const tableRect = tableEl.getBoundingClientRect();
        scrollHostOffsetTopRef.current = tableRect.top - hostRect.top + hostEl.scrollTop;
        setViewportHeight(hostEl.clientHeight);
        return;
      }

      // Fallback: window scrolling
      scrollHostOffsetTopRef.current = tableEl.getBoundingClientRect().top + window.scrollY;
      setViewportHeight(window.innerHeight);
    }, []);

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

        const hostEl = scrollHostRef.current;
        if (hostEl) {
          const relative = Math.max(0, hostEl.scrollTop - scrollHostOffsetTopRef.current);
          setScrollTop(relative);
          setViewportHeight(hostEl.clientHeight);
          return;
        }

        const relative = Math.max(0, window.scrollY - scrollHostOffsetTopRef.current);
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
      computeScrollHostOffset();
      scheduleScrollUpdate();

      const hostEl = scrollHostRef.current;
      const onResize = () => {
        computeScrollHostOffset();
        scheduleScrollUpdate();
      };

      if (hostEl) {
        hostEl.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        return () => {
          hostEl.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onResize);
        };
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
      };
    }, [computeScrollHostOffset, height, onScroll, scheduleScrollUpdate, scrollMode]);

    React.useEffect(() => {
      return () => {
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, []);

    React.useEffect(() => {
      computeScrollHostOffset();
      scheduleScrollUpdate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowCount, columns.length, rowHeight, scrollMode]);

    const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = React.useMemo(() => {
      const maxIndex = Math.max(0, rowCount - 1);
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
      const end = Math.min(maxIndex, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
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

    const stickyHeaderStyle = React.useMemo<React.CSSProperties>(
      () =>
        stickyHeader
          ? {
              position: 'sticky',
              top: stickyHeaderTop,
              zIndex: 4,
            }
          : {},
      [stickyHeader, stickyHeaderTop]
    );

    const headerSeparatorBackground = React.useMemo<React.CSSProperties>(
      () => ({
        // `border-collapse: collapse` can prevent borders from painting reliably on sticky headers.
        // Paint the separator line as a background to guarantee it shows both in normal and sticky states.
        backgroundImage: `linear-gradient(to bottom, transparent calc(100% - 2px), ${tableColors.border} 0)`,
      }),
      []
    );

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
            <thead>
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={col.id ?? idx}
                    data-mineo-column-id={col.id}
                    style={{
                      ...htmlTableHeaderStyles,
                      ...cellBaseStyle,
                      ...stickyHeaderStyle,
                      width: col.width,
                      textAlign: 'center',
                      verticalAlign: 'bottom',
                      whiteSpace: 'pre-line',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      ...headerSeparatorBackground,
                      borderLeft: col.borderLeft ? `2px solid ${tableColors.border}` : undefined,
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {topSpacerHeight > 0 ? (
                <tr style={{ height: topSpacerHeight }}>
                  <td style={{ padding: 0, border: 'none' }} colSpan={columns.length} />
                </tr>
              ) : null}

              {Array.from({ length: Math.max(0, endIndex - startIndex + 1) }, (_, offset) => {
                const rowIndex = startIndex + offset;
                const isEven = rowIndex % 2 === 1;
                const backgroundColor = isEven ? tableColors.oddRowBackground : tableColors.evenRowBackground;
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
                          borderLeft: col.borderLeft ? `2px solid ${tableColors.border}` : undefined,
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
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.id ?? idx}
                  data-mineo-column-id={col.id}
                  style={{
                    ...htmlTableHeaderStyles,
                    ...cellBaseStyle,
                    ...stickyHeaderStyle,
                    width: col.width,
                    textAlign: 'center',
                    verticalAlign: 'bottom',
                    whiteSpace: 'pre-line',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    ...headerSeparatorBackground,
                    borderLeft: col.borderLeft ? `2px solid ${tableColors.border}` : undefined,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>

        <Box
          ref={scrollRef}
          onScroll={onScroll}
          sx={{
            width: 'fit-content',
            height,
            overflowY: 'auto',
            overflowX: 'visible',
            borderLeft: `1px solid ${tableColors.border}`,
            borderRight: `1px solid ${tableColors.border}`,
            borderBottom: `1px solid ${tableColors.border}`,
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
                const backgroundColor = isEven ? tableColors.oddRowBackground : tableColors.evenRowBackground;
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
                          borderLeft: col.borderLeft ? `2px solid ${tableColors.border}` : undefined,
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
