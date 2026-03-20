import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';

const keyDownInAct = async (element: HTMLElement, key: string, options?: Readonly<{ shiftKey?: boolean }>) => {
  await act(async () => {
    fireEvent.keyDown(element, { key, ...options });
  });
};

const focusInAct = async (element: HTMLElement) => {
  await act(async () => {
    element.focus();
  });
};

describe('tableKeyboardNavigation loose table', () => {
  const TEST_TIMEOUT_MS = 15000;

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
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

  it('Tab-sekvens forankrer startcelle for Enter/Shift+Enter (også på tværs af rækker)', async () => {
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
          <tr data-mineo-row-id="r2">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 0 }} value="4" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 1 }} value="5" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 2 }} value="6" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const [a1, b1, c1, a2, , c2] = screen.getAllByRole('textbox');

    await user.click(a1);
    await user.keyboard('{Tab}');
    await focusInAct(b1);
    await user.keyboard('{Tab}');
    await focusInAct(c1);
    expect(document.activeElement).toBe(c1);
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(a2);

    await user.click(c2);
    // Intentional: use keydown-only Tab to set table anchor without relying on JSDOM focus traversal.
    await keyDownInAct(c2, 'Tab');
    await focusInAct(a1);
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(document.activeElement).toBe(c1);
  }, TEST_TIMEOUT_MS);

  it('bevarer Tab-anker ved ArrowLeft/ArrowRight i edit mode', async () => {
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
          </tr>
          <tr data-mineo-row-id="r2">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 0 }} value="3" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 1 }} value="4" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const [a1, b1, a2] = screen.getAllByRole('textbox');

    await user.click(a1);
    await keyDownInAct(a1, 'Tab');
    await focusInAct(b1);

    // Open editor via keyboard to avoid pointer-down, which intentionally clears the Tab-anchor.
    await keyDownInAct(b1, '5');
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(a2);
  }, TEST_TIMEOUT_MS);

  it('Escape i edit mode bevarer fokus i aktiv celle og nulstiller Tab-anker', async () => {
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
          </tr>
          <tr data-mineo-row-id="r2">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 0 }} value="3" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 1 }} value="4" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const [a1, b1, a2, b2] = screen.getAllByRole('textbox');

    await user.click(a1);
    await keyDownInAct(a1, 'Tab');
    await focusInAct(b1);

    // Open editor from keyboard without pointer-down (which would clear anchor).
    await keyDownInAct(b1, '9');
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(b1);

    // Anchor must be cleared by Escape; Enter now navigates from current cell (b1 -> b2),
    // not from original tab-anchor (a1 -> a2).
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(b2);
    expect(document.activeElement).not.toBe(a2);
  }, TEST_TIMEOUT_MS);

  it('Enter-navigation nulstiller Tab-anker efter første hop', async () => {
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
          </tr>
          <tr data-mineo-row-id="r2">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 0 }} value="3" />
            </td>
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 1 }} value="4" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const [a1, b1, a2] = screen.getAllByRole('textbox');

    await user.click(a1);
    await keyDownInAct(a1, 'Tab');
    await focusInAct(b1);

    // First Enter uses tab-anchor (a1 -> a2).
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(a2);

    // Second Enter must navigate from current cell if anchor was reset (a2 -> a1 via wrap).
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(a1);
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);
});
