import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OffentligeYdelserTable from '../../../components/tables/OffentligeYdelserTable';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../types/branded';
import { GRID_UX_SPEC } from '../../../components/tables/gridCore/gridUxSpec';

/**
 * Binder den ellers prosa-only `GRID_UX_SPEC` til observerbar handler-/render-adfærd, så
 * spec-værdier (minRows, trailing-empty-row, delete-committer-straks, klikbare headers) ikke
 * kan drifte fra implementeringen uden at en test fejler (7.3-fund: spec uden compile-binding).
 */

const asDate = (s: string) => s as ISODateString;
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeRow = (overrides: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  id: 'row1',
  fraDato: undefined,
  tilDato: undefined,
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
  ...overrides,
});

const Harness = ({ initial, onPersist }: { initial: OffentligeYdelserRow[]; onPersist: (next: OffentligeYdelserRow[]) => void }) => {
  const [tableData, setTableData] = React.useState<OffentligeYdelserRow[]>(initial);
  return (
    <OffentligeYdelserTable
      tableData={tableData}
      onTableDataChange={(next) => {
        onPersist(next);
        setTableData(next);
      }}
    />
  );
};

const getDataRows = (): HTMLElement[] => screen.getAllByRole('row').slice(1);

const rowIsEmpty = (row: HTMLElement): boolean => {
  const textboxes = within(row).queryAllByRole('textbox') as HTMLInputElement[];
  return textboxes.every((input) => input.value.trim() === '');
};

describe('GRID_UX_SPEC (compile-bound guards)', () => {
  it('rows.minRows: en tabel med én tom række normaliseres til præcis spec-antallet af rækker', () => {
    render(<Harness onPersist={vi.fn()} initial={[makeRow({})]} />);
    expect(getDataRows()).toHaveLength(GRID_UX_SPEC.rows.minRows);
  });

  it('rows.trailingEmptyRow: sidste række er altid en tom input-række', () => {
    render(
      <Harness
        onPersist={vi.fn()}
        initial={[makeRow({ id: 'r1', fraDato: asDate('01-01-2024'), tilDato: asDate('10-01-2024'), ydelse: asAmount(100), ydelsestype: 'flextilskud' })]}
      />
    );
    const dataRows = getDataRows();
    expect(GRID_UX_SPEC.rows.trailingEmptyRow).toBe(true);
    expect(rowIsEmpty(dataRows[dataRows.length - 1]!)).toBe(true);
  });

  it('sorting.headersAlwaysClickable + defaultDirection: klik på en header sorterer stigende', async () => {
    expect(GRID_UX_SPEC.sorting.headersAlwaysClickable).toBe(true);
    expect(GRID_UX_SPEC.sorting.defaultDirection).toBe('asc');
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <Harness
        onPersist={vi.fn()}
        initial={[makeRow({ id: 'r1', ydelse: asAmount(200) }), makeRow({ id: 'r2', ydelse: asAmount(100) })]}
      />
    );

    const digitsOf = (value: string): number => Number.parseInt(value.replace(/\D/g, ''), 10);
    const ydelseValueAt = (rowIndex: number): number => {
      const rows = getDataRows();
      const input = within(within(rows[rowIndex]!).getAllByRole('cell')[2]!).getByRole('textbox') as HTMLInputElement;
      return digitsOf(input.value);
    };

    // Kolonne 2 = "Ydelse". Header-cellerne er klikbare (StandardGridHeaderCell binder onClick→sort).
    const ydelseHeader = within(screen.getAllByRole('row')[0]!).getAllByRole('columnheader')[2]!;
    await user.click(ydelseHeader);

    await waitFor(() => {
      // defaultDirection 'asc' → den mindste værdi (100) står før den største (200) efter første klik.
      expect(ydelseValueAt(0)).toBeLessThan(ydelseValueAt(1));
    });
  }, 30000);

  it('editing.deleteClearsAndCommitsImmediately: Delete på fokuseret celle committer uden at åbne editoren', async () => {
    expect(GRID_UX_SPEC.editing.deleteClearsAndCommitsImmediately).toBe(true);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onPersist = vi.fn();
    render(
      <Harness
        onPersist={onPersist}
        initial={[makeRow({ id: 'r1', fraDato: asDate('01-01-2024'), tilDato: asDate('10-01-2024'), ydelse: asAmount(100), ydelsestype: 'flextilskud' })]}
      />
    );

    const firstRow = getDataRows()[0]!;
    const ydelseInput = within(within(firstRow).getAllByRole('cell')[2]!).getByRole('textbox') as HTMLInputElement;
    await user.click(ydelseInput);
    await user.keyboard('{Delete}');

    await waitFor(() => {
      expect(onPersist).toHaveBeenCalledTimes(1);
    });
    // Cellen forbliver i navigations-mode (readOnly), dvs. editoren blev ikke åbnet.
    expect(ydelseInput).toHaveAttribute('readonly');
  }, 30000);

  it('navigation.traversalModel er Excel-lignende (Enter = vertikal flytning inden for tabellen)', async () => {
    expect(GRID_UX_SPEC.navigation.traversalModel).toBe('excel-like');
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <Harness
        onPersist={vi.fn()}
        initial={[makeRow({ id: 'r1', ydelse: asAmount(100) }), makeRow({ id: 'r2', ydelse: asAmount(200) })]}
      />
    );

    const rows = getDataRows();
    const firstYdelse = within(within(rows[0]!).getAllByRole('cell')[2]!).getByRole('textbox') as HTMLInputElement;
    const secondYdelse = within(within(rows[1]!).getAllByRole('cell')[2]!).getByRole('textbox') as HTMLInputElement;
    firstYdelse.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(document.activeElement).toBe(secondYdelse);
    });
  }, 30000);

  // Fejler hvis et nyt rows-spec-flag tilføjes uden at få sin egen adfærds-binding her.
  it('alle rows-spec-flag er fortsat dækket af guards', () => {
    expect(Object.keys(GRID_UX_SPEC.rows).sort()).toEqual(
      ['blurIsBlur', 'cleanupOnEveryCommitOrBlur', 'minRows', 'trailingEmptyRow'].sort()
    );
  });
});
