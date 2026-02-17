import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';
import TableDropdown from '../../../components/inputs/table/TableDropdown';

describe('tableKeyboardNavigation dropdown-celle integration', () => {
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
  });
});
