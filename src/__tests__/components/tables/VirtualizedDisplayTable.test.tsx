// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import VirtualizedDisplayTable from '../../../components/tables/VirtualizedDisplayTable';

describe('VirtualizedDisplayTable', () => {
  const waitForRaf = async () => {
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });
  };

  const createRect = (top: number): DOMRect =>
    ({
      x: 0,
      y: top,
      width: 1000,
      height: 100,
      top,
      left: 0,
      right: 1000,
      bottom: top + 100,
      toJSON: () => ({}),
    }) as DOMRect;

  it('exposes stable column IDs as data attributes when provided', () => {
    render(
      <VirtualizedDisplayTable
        columns={[
          { id: 'col:a', header: 'A', width: 80, align: 'left' },
          { id: 'col:b', header: 'B', width: 80, align: 'left' },
        ]}
        rowCount={1}
        rowHeight={28}
        height={28}
        stickyHeader
        scrollMode="ancestor"
        getRowKey={() => 'row0'}
        renderCell={(rowIndex, columnIndex) => `${rowIndex}-${columnIndex}`}
      />
    );

    const headerA = screen.getByText('A').closest('th');
    const headerB = screen.getByText('B').closest('th');
    expect(headerA).not.toBeNull();
    expect(headerB).not.toBeNull();
    expect(headerA).toHaveAttribute('data-mineo-column-id', 'col:a');
    expect(headerB).toHaveAttribute('data-mineo-column-id', 'col:b');
    expect(headerA).toHaveStyle({ position: 'sticky' });
    expect(headerB).toHaveStyle({ position: 'sticky' });
    expect(headerA).toHaveStyle({ backgroundImage: expect.stringContaining('linear-gradient') });
    expect(headerB).toHaveStyle({ backgroundImage: expect.stringContaining('linear-gradient') });

    const table = headerA?.closest('table');
    expect(table).not.toBeNull();
    expect(table).toHaveStyle({ overflow: 'visible' });

    const cell00 = screen.getByText('0-0').closest('td');
    const cell01 = screen.getByText('0-1').closest('td');
    expect(cell00).not.toBeNull();
    expect(cell01).not.toBeNull();
    expect(cell00).toHaveAttribute('data-mineo-column-id', 'col:a');
    expect(cell01).toHaveAttribute('data-mineo-column-id', 'col:b');
  });

  it('renders the last row when ancestor scroll position is beyond table range', async () => {
    const { container } = render(
      <div data-testid="host" data-mineo-scroll-container="true">
        <VirtualizedDisplayTable
          columns={[{ id: 'col:a', header: 'A', width: 80, align: 'left' }]}
          rowCount={100}
          rowHeight={10}
          height={0}
          scrollMode="ancestor"
          getRowKey={(rowIndex) => `row-${rowIndex}`}
          renderCell={(rowIndex, columnIndex) => `${rowIndex}-${columnIndex}`}
        />
      </div>
    );

    const host = screen.getByTestId('host') as HTMLDivElement;
    Object.defineProperty(host, 'clientHeight', { value: 120, configurable: true });
    Object.defineProperty(host, 'scrollTop', { value: 10000, writable: true, configurable: true });

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    if (!table) throw new Error('Expected table to exist');

    const hostRectSpy = vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(createRect(0));
    const tableRectSpy = vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(createRect(-10000));

    fireEvent.scroll(host);
    await waitForRaf();

    expect(screen.getByText('99-0')).toBeInTheDocument();

    hostRectSpy.mockRestore();
    tableRectSpy.mockRestore();
  });

  it('renders no body rows when rowCount is zero', () => {
    const { container } = render(
      <VirtualizedDisplayTable
        columns={[{ id: 'col:a', header: 'A', width: 80, align: 'left' }]}
        rowCount={0}
        rowHeight={28}
        height={100}
        getRowKey={() => 'unused'}
        renderCell={() => 'unused'}
      />
    );

    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(0);
  });

  it('renders multiple header rows with colSpan groups', () => {
    render(
      <VirtualizedDisplayTable
        columns={[
          { id: 'col:a', header: 'A', width: 80, align: 'left' },
          { id: 'col:b', header: 'B', width: 80, align: 'left' },
          { id: 'col:c', header: 'C', width: 80, align: 'left' },
        ]}
        headerRows={[
          {
            key: 'groups',
            stickyHeight: 32,
            cells: [
              { key: 'blank', content: '', colSpan: 1, width: 80 },
              { key: 'group-1', content: 'Ansættelsessted 1', colSpan: 2, width: 160 },
            ],
          },
          {
            key: 'labels',
            stickyHeight: 44,
            cells: [
              { key: 'a', content: 'A', columnId: 'col:a', width: 80 },
              { key: 'b', content: 'B', columnId: 'col:b', width: 80 },
              { key: 'c', content: 'C', columnId: 'col:c', width: 80 },
            ],
          },
        ]}
        rowCount={1}
        rowHeight={28}
        height={28}
        getRowKey={() => 'row0'}
        renderCell={(rowIndex, columnIndex) => `${rowIndex}-${columnIndex}`}
      />
    );

    const groupedHeader = screen.getByText('Ansættelsessted 1').closest('th');
    expect(groupedHeader).not.toBeNull();
    expect(groupedHeader).toHaveAttribute('colspan', '2');
    expect(screen.getByText('A').closest('th')).toHaveAttribute('data-mineo-column-id', 'col:a');
    expect(screen.getByText('B').closest('th')).toHaveAttribute('data-mineo-column-id', 'col:b');
    expect(screen.getByText('C').closest('th')).toHaveAttribute('data-mineo-column-id', 'col:c');
  });
});
