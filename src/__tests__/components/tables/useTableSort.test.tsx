import { act, renderHook } from '@testing-library/react';
import { useTableSort, type TableSortColumn } from '../../../components/tables/useTableSort';

type TestRow = Readonly<{
  id: string;
  value: number;
}>;

describe('useTableSort', () => {
  it('sorterer kun visningen og skriver ikke tilbage via onSortedRowsChange', () => {
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
    });

    expect(result.current.sortedRows.map((row) => row.id)).toEqual(['b', 'a']);
    expect(onSortedRowsChange).not.toHaveBeenCalled();
  });
});
