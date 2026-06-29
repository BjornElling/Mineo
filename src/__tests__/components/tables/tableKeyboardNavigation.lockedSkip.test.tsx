// @vitest-environment jsdom
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

// act-wrap af focus/keyDown: grid-fokus-autoriteten opdaterer React-state via en
// rAF-planlagt focus-capture. Bare .focus()/fireEvent uden act ville lande den
// opdatering uden for act ("update to StandardGridTable not wrapped in act").
const focusInAct = async (element: HTMLElement) => {
  await act(async () => {
    element.focus();
  });
};

const keyDownInAct = async (element: HTMLElement, key: string) => {
  await act(async () => {
    fireEvent.keyDown(element, { key });
  });
};

describe('tableKeyboardNavigation: vertikal navigation springer låste celler over', () => {
  it('ArrowDown springer den låste mellemrække over og lander på næste valgbare række', async () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row0') as HTMLInputElement;
    const row2 = screen.getByTestId('row2') as HTMLInputElement;

    await focusInAct(row0);
    await keyDownInAct(row0, 'ArrowDown');
    expect(document.activeElement).toBe(row2);
  });

  it('ArrowUp springer den låste mellemrække over og lander på forrige valgbare række', async () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row0') as HTMLInputElement;
    const row2 = screen.getByTestId('row2') as HTMLInputElement;

    await focusInAct(row2);
    await keyDownInAct(row2, 'ArrowUp');
    expect(document.activeElement).toBe(row0);
  });

  it('Enter springer den låste mellemrække over', async () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row0') as HTMLInputElement;
    const row2 = screen.getByTestId('row2') as HTMLInputElement;

    await focusInAct(row0);
    await keyDownInAct(row0, 'Enter');
    expect(document.activeElement).toBe(row2);
  });
});
