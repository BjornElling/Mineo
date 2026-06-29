// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import { StandardGridTable } from '../../../components/tables/StandardGridTable';
import type { GridCellCoord } from '../../../components/tables/gridCore/gridCoreTypes';
import TableTextInput from '../../../components/inputs/table/TableTextInput';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';
import TableAmountInput from '../../../components/inputs/table/TableAmountInput';
import TablePercentInput from '../../../components/inputs/table/TablePercentInput';
import TableDateInput from '../../../components/inputs/table/TableDateInput';
import TableWeekInput from '../../../components/inputs/table/TableWeekInput';
import TableYearInput from '../../../components/inputs/table/TableYearInput';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString, type ISODateString } from '../../../types/branded';

/**
 * Escape-kontrakt for ALLE redigerbare tabel-input-felter, kørt i BEGGE grid-varianter
 * (StandardGridTable og StandardLooseTable) og via BEGGE åbningsveje (dobbeltklik og tastetryk).
 *
 * For tabelceller håndteres Escape på grid-niveau (tableKeyboardNavigation → editorens
 * cancelEdit): draften gendannes til sidst committede værdi, editoren lukker, og INTET commit
 * (onBlur) udsendes. Eksisterende tests dækkede kun loose-tabellen via dobbeltklik; denne
 * kontrakt udvider til standard-grid og til tastetryk-åbning (hvor første tast både åbner
 * editoren og sætter draften — den variant der afslørede focus-snapshot-fejlen i fri-tekst-feltet).
 */

const gridCell: GridCellCoord = { rowId: 'row-1', colIndex: 0 };

type TableEscapeCase = Readonly<{
  label: string;
  typed: string;
  renderManaged: (onCommit: (next: unknown) => void) => React.JSX.Element;
}>;

/** Controlled-wrapper: holder cellens værdi, så et utilsigtet commit ville blive synligt. */
function ManagedCell<TValue>({
  initial,
  render,
  onCommit,
}: Readonly<{
  initial: TValue;
  render: (value: TValue, commit: (next: TValue) => void) => React.JSX.Element;
  onCommit: (next: unknown) => void;
}>): React.JSX.Element {
  const [value, setValue] = React.useState<TValue>(initial);
  return render(value, (next) => {
    onCommit(next);
    setValue(next);
  });
}

const FIELD_CASES: readonly TableEscapeCase[] = [
  {
    label: 'text',
    typed: 'xyz',
    renderManaged: (onCommit) => (
      <ManagedCell initial="abc" onCommit={onCommit} render={(value, commit) => (
        <TableTextInput gridCell={gridCell} value={value} onBlur={(e) => commit(e.target.value)} />
      )} />
    ),
  },
  {
    label: 'integer',
    typed: '99',
    renderManaged: (onCommit) => (
      <ManagedCell initial="42" onCommit={onCommit} render={(value, commit) => (
        <TableIntegerInput gridCell={gridCell} value={value} onBlur={(e) => commit(e.target.value)} />
      )} />
    ),
  },
  {
    label: 'amount',
    typed: '33',
    renderManaged: (onCommit) => (
      <ManagedCell<AmountValue | undefined> initial={{ kind: 'number', value: 12.5 }} onCommit={onCommit} render={(value, commit) => (
        <TableAmountInput gridCell={gridCell} value={value} onBlur={(e) => commit(e.target.value)} />
      )} />
    ),
  },
  {
    label: 'percent',
    typed: '33',
    renderManaged: (onCommit) => (
      <ManagedCell<number | undefined> initial={12.5} onCommit={onCommit} render={(value, commit) => (
        <TablePercentInput gridCell={gridCell} value={value} onBlur={(e) => commit(e.target.value)} />
      )} />
    ),
  },
  {
    label: 'date',
    typed: '15062025',
    renderManaged: (onCommit) => (
      <ManagedCell<ISODateString | undefined> initial={toISODateString('2025-01-01')} onCommit={onCommit} render={(value, commit) => (
        <TableDateInput gridCell={gridCell} value={value} onBlur={(e) => commit(e.target.value)} />
      )} />
    ),
  },
  {
    label: 'week',
    typed: '052024',
    renderManaged: (onCommit) => (
      <ManagedCell initial="01/2025" onCommit={onCommit} render={(value, commit) => (
        <TableWeekInput gridCell={gridCell} value={value} onBlur={(e) => commit(e.target.value)} />
      )} />
    ),
  },
  {
    label: 'year',
    typed: '2099',
    renderManaged: (onCommit) => (
      <ManagedCell initial="2025" onCommit={onCommit} render={(value, commit) => (
        <TableYearInput gridCell={gridCell} value={value} onBlur={(e) => commit(e.target.value)} />
      )} />
    ),
  },
];

const TABLE_KINDS = [
  ['StandardGridTable', (children: React.ReactNode) => <StandardGridTable tableWidth="200px"><tbody><tr data-mineo-row-id="row-1"><td>{children}</td></tr></tbody></StandardGridTable>],
  ['StandardLooseTable', (children: React.ReactNode) => <StandardLooseTable><tbody><tr data-mineo-row-id="row-1"><td>{children}</td></tr></tbody></StandardLooseTable>],
] as const;

const openByDoubleClick = async (user: ReturnType<typeof userEvent.setup>, input: HTMLInputElement, typed: string) => {
  await user.click(input);
  await user.click(input);
  await waitFor(() => expect(input).not.toHaveAttribute('readonly'));
  await user.clear(input);
  await user.type(input, typed);
};

const openByKeystroke = async (user: ReturnType<typeof userEvent.setup>, input: HTMLInputElement, typed: string) => {
  await user.click(input);
  await user.keyboard(typed.slice(0, 1));
  await waitFor(() => expect(input).not.toHaveAttribute('readonly'));
  if (typed.length > 1) await user.keyboard(typed.slice(1));
};

describe('Escape-kontrakt for tabel-input-felter', () => {
  const TEST_TIMEOUT_MS = 20000;

  describe.each(TABLE_KINDS)('%s', (_kindLabel, wrap) => {
    describe.each([
      ['dobbeltklik', openByDoubleClick],
      ['tastetryk', openByKeystroke],
    ] as const)('editor åbnet via %s', (_pathLabel, open) => {
      it.each(FIELD_CASES)('Escape annullerer $label-edit uden commit', async ({ renderManaged, typed }) => {
        const user = userEvent.setup();
        const onCommit = vi.fn();
        render(wrap(renderManaged(onCommit)));

        const input = screen.getByRole('textbox') as HTMLInputElement;
        const committedDisplay = input.value;
        expect(input).toHaveAttribute('readonly');

        await open(user, input, typed);
        expect(input.value).not.toBe(committedDisplay);

        await user.keyboard('{Escape}');

        expect(onCommit).not.toHaveBeenCalled();
        expect(input).toHaveValue(committedDisplay);
        await waitFor(() => expect(input).toHaveAttribute('readonly'));
      }, TEST_TIMEOUT_MS);
    });
  });
});
