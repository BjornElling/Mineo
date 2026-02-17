import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';

describe('tableKeyboardNavigation loose table', () => {
  it('wraps ArrowLeft/ArrowRight within the same row in loose table', async () => {
    const user = userEvent.setup();

    render(
      <StandardLooseTable>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="1" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 1 }} value="2" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 2 }} value="3" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const [left, , right] = screen.getAllByRole('textbox');
    await user.click(left);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(right);

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(left);
  });

  it('skips locked cells on ArrowRight/ArrowLeft', async () => {
    const user = userEvent.setup();

    render(
      <StandardLooseTable>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="1" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 1 }} value="2" locked />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 2 }} value="3" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const [left, , right] = screen.getAllByRole('textbox');
    await user.click(left);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(right);

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(left);
  });

  it('Enter og Shift+Enter flytter vertikalt og committer edit først', async () => {
    const user = userEvent.setup();
    const onTopBlur = vi.fn<(value: string) => void>();
    const onBottomBlur = vi.fn<(value: string) => void>();

    const Wrapper = () => {
      const [top, setTop] = React.useState('1');
      const [bottom, setBottom] = React.useState('2');
      return (
        <StandardLooseTable>
          <tbody>
            <tr data-mineo-row-id="r1">
              <td>
                <TableIntegerInput
                  gridCell={{ rowId: 'r1', colIndex: 0 }}
                  value={top}
                  onBlur={(e) => {
                    onTopBlur(e.target.value);
                    setTop(e.target.value);
                  }}
                />
              </td>
            </tr>
            <tr data-mineo-row-id="r2">
              <td>
                <TableIntegerInput
                  gridCell={{ rowId: 'r2', colIndex: 0 }}
                  value={bottom}
                  onBlur={(e) => {
                    onBottomBlur(e.target.value);
                    setBottom(e.target.value);
                  }}
                />
              </td>
            </tr>
          </tbody>
        </StandardLooseTable>
      );
    };

    render(<Wrapper />);
    const [topInput, bottomInput] = screen.getAllByRole('textbox');

    await user.click(topInput);
    await user.click(topInput);
    await user.clear(topInput);
    await user.type(topInput, '42');
    await user.keyboard('{Enter}');

    expect(onTopBlur).toHaveBeenCalledWith('42');
    expect(document.activeElement).toBe(bottomInput);

    await user.click(bottomInput);
    await user.click(bottomInput);
    await user.clear(bottomInput);
    await user.type(bottomInput, '77');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onBottomBlur).toHaveBeenCalledWith('77');
    expect(document.activeElement).toBe(topInput);
  });

  it('single click åbner ikke editor, når cellen kun er husket men ikke fysisk fokuseret', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <StandardLooseTable>
          <tbody>
            <tr data-mineo-row-id="r1">
              <td>
                <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="1" />
              </td>
            </tr>
          </tbody>
        </StandardLooseTable>
        <button type="button">outside</button>
      </div>
    );

    const input = screen.getByRole('textbox');
    const outside = screen.getByRole('button', { name: 'outside' });

    await user.click(input);
    expect(input).toHaveAttribute('readonly');

    await user.click(outside);

    await user.click(input);
    expect(input).toHaveAttribute('readonly');

    await user.click(input);
    expect(input).not.toHaveAttribute('readonly');
  });
});
