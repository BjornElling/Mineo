import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';
import TableDropdown from '../../../components/inputs/table/TableDropdown';

describe('tableKeyboardNavigation dropdown-celle integration', () => {
  const TEST_TIMEOUT_MS = 15000;

  it('ArrowRight kan fokusere en TableDropdown-celle i loose table', async () => {
    const user = userEvent.setup();

    render(
      <StandardLooseTable>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput
                gridCell={{ rowId: 'r1', colIndex: 0 }}
                value="1"
                onBlur={vi.fn()}
              />
            </td>
            <td>
              <TableDropdown
                gridCell={{ rowId: 'r1', colIndex: 1 }}
                value=""
                allowEmpty
                options={[{ value: 'a', label: 'A' }]}
                onChange={vi.fn()}
              />
            </td>
            <td>
              <TableIntegerInput
                gridCell={{ rowId: 'r1', colIndex: 2 }}
                value="2"
                onBlur={vi.fn()}
              />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const [firstInput] = screen.getAllByRole('textbox');
    const combobox = screen.getByRole('combobox');

    await user.click(firstInput);
    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(combobox);
  }, TEST_TIMEOUT_MS);

  it('ArrowDown i TableDropdown triggere ikke tabel-vertikal navigation', async () => {
    const user = userEvent.setup();

    render(
      <StandardLooseTable>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="1" onBlur={vi.fn()} />
            </td>
            <td>
              <TableDropdown
                gridCell={{ rowId: 'r1', colIndex: 1 }}
                value=""
                allowEmpty
                options={[{ value: 'a', label: 'A' }]}
                onChange={vi.fn()}
              />
            </td>
          </tr>
          <tr data-mineo-row-id="r2">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 0 }} value="2" onBlur={vi.fn()} />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 1 }} value="3" onBlur={vi.fn()} />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);

    await user.keyboard('{ArrowDown}');
    const secondRowCell = screen.getByDisplayValue('3');
    expect(document.activeElement).not.toBe(secondRowCell);
  }, TEST_TIMEOUT_MS);

  it('ArrowRight navigerer ikke væk når TableDropdown er åben', async () => {
    const user = userEvent.setup();

    render(
      <StandardLooseTable>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput
                gridCell={{ rowId: 'r1', colIndex: 0 }}
                value="1"
                onBlur={vi.fn()}
              />
            </td>
            <td>
              <TableDropdown
                gridCell={{ rowId: 'r1', colIndex: 1 }}
                value=""
                allowEmpty
                options={[{ value: 'a', label: 'A' }]}
                onChange={vi.fn()}
              />
            </td>
            <td>
              <TableIntegerInput
                gridCell={{ rowId: 'r1', colIndex: 2 }}
                value="2"
                onBlur={vi.fn()}
              />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const combobox = screen.getByRole('combobox');
    act(() => {
      combobox.focus();
    });
    expect(document.activeElement).toBe(combobox);

    combobox.setAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(combobox);
  }, TEST_TIMEOUT_MS);
});
