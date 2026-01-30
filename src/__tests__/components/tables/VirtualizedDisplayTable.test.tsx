import { render, screen } from '@testing-library/react';
import VirtualizedDisplayTable from '../../../components/tables/VirtualizedDisplayTable';

describe('VirtualizedDisplayTable', () => {
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
});
