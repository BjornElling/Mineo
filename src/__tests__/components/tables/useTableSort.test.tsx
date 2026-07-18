// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useTableSort, type TableSortColumn } from '../../../components/tables/useTableSort';

type TestRow = Readonly<{
  id: string;
  value: number;
}>;

describe('useTableSort', () => {
  it('kalder onSortedRowsChange med den sorterede rækkefølge når brugeren klikker på en header', () => {
    const rows: readonly TestRow[] = [
      { id: 'a', value: 2 },
      { id: 'b', value: 1 },
    ];
    const onSortedRowsChange = vi.fn();
    const columns: readonly TableSortColumn<TestRow>[] = [
      {
        colId: 'value',
        getSortValue: (row) => row.value,
      },
    ];

    const { result } = renderHook(() =>
      useTableSort({
        rows,
        getRowId: (row) => row.id,
        isRowEmpty: () => false,
        columns,
        onSortedRowsChange,
      })
    );

    act(() => {
      result.current.handleHeaderClick('value');
      // Rækkefølgen skal være persisteret i selve klik-eventet; en effect ville efterlade save/download med den
      // gamle orden indtil næste task.
      expect(onSortedRowsChange).toHaveBeenCalledWith([
        { id: 'b', value: 1 },
        { id: 'a', value: 2 },
      ]);
    });

    expect(result.current.sortedRows.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('kalder ikke onSortedRowsChange ved initial render (ingen bruger-sort)', () => {
    const rows: readonly TestRow[] = [
      { id: 'a', value: 2 },
      { id: 'b', value: 1 },
    ];
    const onSortedRowsChange = vi.fn();
    const columns: readonly TableSortColumn<TestRow>[] = [
      { colId: 'value', getSortValue: (row) => row.value },
    ];

    renderHook(() =>
      useTableSort({
        rows,
        getRowId: (row) => row.id,
        isRowEmpty: () => false,
        columns,
        onSortedRowsChange,
      })
    );

    expect(onSortedRowsChange).not.toHaveBeenCalled();
  });
});
