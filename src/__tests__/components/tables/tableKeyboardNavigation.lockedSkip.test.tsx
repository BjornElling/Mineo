import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StandardGridTable } from '../../../components/tables/StandardGridTable';
import { useGridCoreApi } from '../../../components/tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCore/gridCoreTypes';

/**
 * En skrivebeskyttet (låst) celle der — som LoenudviklingManuel-basisrækken — er tab-fokuserbar
 * (readOnly, men IKKE tabindex=-1) og registrerer en låst editor-handle hos GridCore.
 */
const LockedCell = ({ rowId, colIndex, testId }: { rowId: string; colIndex: number; testId: string }) => {
  const grid = useGridCoreApi();
  const ref = React.useRef<HTMLInputElement | null>(null);
  const gridCell = React.useMemo<GridCellCoord>(() => ({ rowId, colIndex }), [rowId, colIndex]);
  const handle = React.useMemo<GridCellEditorHandle>(
    () => ({
      getElement: () => ref.current,
      getIsLocked: () => true,
      commitCurrent: () => true,
      clearAndCommit: () => undefined,
      cancelEdit: () => undefined,
      prepareEditFromKey: () => false,
      selectAll: () => undefined,
    }),
    []
  );
  React.useEffect(() => {
    grid.registerEditor(gridCell, handle);
    return () => grid.unregisterEditor(gridCell);
  }, [grid, gridCell, handle]);
  return <input data-testid={testId} ref={ref} readOnly />;
};

const Harness = () => (
  <StandardGridTable tableWidth={undefined}>
    <tbody>
      <tr data-mineo-row-id="r1">
        <td>
          <input data-testid="row0" />
        </td>
      </tr>
      <tr data-mineo-row-id="r2">
        <td>
          <LockedCell rowId="r2" colIndex={0} testId="row1-locked" />
        </td>
      </tr>
      <tr data-mineo-row-id="r3">
        <td>
          <input data-testid="row2" />
        </td>
      </tr>
    </tbody>
  </StandardGridTable>
);

describe('tableKeyboardNavigation: vertikal navigation springer låste celler over', () => {
  it('ArrowDown springer den låste mellemrække over og lander på næste valgbare række', () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row0') as HTMLInputElement;
    const row2 = screen.getByTestId('row2') as HTMLInputElement;

    row0.focus();
    fireEvent.keyDown(row0, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row2);
  });

  it('ArrowUp springer den låste mellemrække over og lander på forrige valgbare række', () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row0') as HTMLInputElement;
    const row2 = screen.getByTestId('row2') as HTMLInputElement;

    row2.focus();
    fireEvent.keyDown(row2, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(row0);
  });

  it('Enter springer den låste mellemrække over', () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row0') as HTMLInputElement;
    const row2 = screen.getByTestId('row2') as HTMLInputElement;

    row0.focus();
    fireEvent.keyDown(row0, { key: 'Enter' });
    expect(document.activeElement).toBe(row2);
  });
});
