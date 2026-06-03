import * as React from 'react';
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StandardLoenTableRow, Loenperiode } from '../../../schemas/formSchemas';
import StandardLoenTable from '../../../components/tables/StandardLoenTable';

/**
 * Regression: clearing the only value in a month row, then switching loenperiode away and back,
 * resurrected the cleared value. Root cause was a non-deterministic row id minted inside the
 * setState updater; under StrictMode the double-invoked updater produced divergent ids, so the
 * id-sensitive persist guard rejected the cleared state and the parent kept the stale value.
 *
 * This test renders under <StrictMode> ON PURPOSE — without it the updater runs once and the bug
 * does not reproduce.
 */

const makeRow = (overrides: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  id: 'row1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
  ...overrides,
});

const SATSER = { ferie: 12.5, fritvalg: 1, shSo: 2, bededag: 0, pension: 10 };

const getFirstDataRowCells = (): HTMLElement[] => {
  const rows = screen.getAllByRole('row');
  return within(rows[1]).getAllByRole('cell');
};

const getMonthInput = (): HTMLInputElement =>
  within(getFirstDataRowCells()[0]).getByRole('textbox') as HTMLInputElement;

const flushAnimationFrame = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
};

// Stateful host mirroring the real page: loenperiode lives in component state, and table edits
// are persisted back into tableData via onTableDataChange (as sessionStorage rehydration would do).
const Host = React.forwardRef<
  { setLoenperiode: (p: Loenperiode) => void; latestData: () => StandardLoenTableRow[] | null },
  { initialPeriode: Loenperiode; initialRows: StandardLoenTableRow[] }
>(({ initialPeriode, initialRows }, ref) => {
  const [loenperiode, setLoenperiode] = React.useState<Loenperiode>(initialPeriode);
  const [tableData, setTableData] = React.useState<StandardLoenTableRow[]>(initialRows);
  const latestRef = React.useRef<StandardLoenTableRow[] | null>(null);
  React.useImperativeHandle(ref, () => ({ setLoenperiode, latestData: () => latestRef.current }), []);
  return (
    <StandardLoenTable
      loenperiode={loenperiode}
      satser={SATSER}
      tableData={tableData}
      onTableDataChange={(data) => {
        latestRef.current = data;
        setTableData(data);
      }}
    />
  );
});
Host.displayName = 'Host';

describe('StandardLoenTable — clear month then switch period (StrictMode regression)', () => {
  it('does not resurrect a cleared month value after switching loenperiode away and back', async () => {
    const user = userEvent.setup();
    const hostRef = React.createRef<{ setLoenperiode: (p: Loenperiode) => void; latestData: () => StandardLoenTableRow[] | null }>();

    render(
      <StrictMode>
        <Host ref={hostRef} initialPeriode="maaned" initialRows={[makeRow({ id: 'row1' })]} />
      </StrictMode>
    );

    // 1. Type "2" into the month cell, then blur.
    const monthInput = getMonthInput();
    await user.click(monthInput);
    await user.keyboard('2');
    await act(async () => {
      fireEvent.blur(monthInput);
    });
    await flushAnimationFrame();
    expect(getMonthInput().value).toBe('2');

    // 2. Clear the "2" via Backspace, then blur.
    const monthInput2 = getMonthInput();
    await user.dblClick(monthInput2);
    await user.keyboard('{Backspace}');
    await act(async () => {
      fireEvent.blur(monthInput2);
    });
    await flushAnimationFrame();
    expect(getMonthInput().value).toBe('');

    // The cleared state must have been persisted: no committed row may still hold "2".
    await waitFor(() => {
      const persisted = hostRef.current?.latestData();
      expect(persisted).not.toBeNull();
      expect(persisted?.some((row) => row.col0_maaned === '2')).toBe(false);
    });

    // 3. Switch to uge view, then back to maaned.
    act(() => {
      hostRef.current?.setLoenperiode('uge');
    });
    await flushAnimationFrame();
    act(() => {
      hostRef.current?.setLoenperiode('maaned');
    });
    await flushAnimationFrame();

    // 4. The cleared "2" must NOT reappear.
    await waitFor(() => {
      expect(getMonthInput().value).toBe('');
    });
  }, 30000);
});
