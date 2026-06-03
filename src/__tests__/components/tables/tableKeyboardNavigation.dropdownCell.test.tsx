import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Container from '../../../components/layout/Container';
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

  it('ArrowDown i TableDropdown foelger tabel-vertikal navigation', async () => {
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
    await act(async () => {
      combobox.focus();
    });
    expect(document.activeElement).toBe(combobox);

    await user.keyboard('{ArrowDown}');
    const secondRowCell = screen.getByDisplayValue('3');
    expect(document.activeElement).toBe(secondRowCell);
  }, TEST_TIMEOUT_MS);

  it('ArrowDown i nederste TableDropdown-række aabner ikke menuen, men forlader tabellen som andre felter', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <StandardLooseTable>
          <tbody>
            <tr data-mineo-row-id="r1">
              <td>
                <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="1" onBlur={vi.fn()} />
              </td>
              <td>
                <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 1 }} value="2" onBlur={vi.fn()} />
              </td>
            </tr>
            <tr data-mineo-row-id="r2">
              <td>
                <TableIntegerInput gridCell={{ rowId: 'r2', colIndex: 0 }} value="3" onBlur={vi.fn()} />
              </td>
              <td>
                <TableDropdown
                  gridCell={{ rowId: 'r2', colIndex: 1 }}
                  value=""
                  allowEmpty
                  options={[{ value: 'a', label: 'A' }]}
                  onChange={vi.fn()}
                />
              </td>
            </tr>
          </tbody>
        </StandardLooseTable>
        <div className="row--label-right-hover">
          <input data-testid="below-first" type="text" readOnly style={{ position: 'fixed', width: '100px', height: '20px' }} />
          <input data-testid="below-last" type="text" readOnly style={{ position: 'fixed', width: '100px', height: '20px' }} />
        </div>
      </Container>
    );

    const combobox = screen.getByRole('combobox');
    const belowFirst = screen.getByTestId('below-first') as HTMLInputElement;
    const belowLast = screen.getByTestId('below-last') as HTMLInputElement;
    const belowRow = belowFirst.closest('.row--label-right-hover') as HTMLDivElement;

    Object.defineProperty(combobox, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 220, y: 240, width: 100, height: 20, top: 240, left: 220, right: 320, bottom: 260, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(belowFirst, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 10, y: 340, width: 100, height: 20, top: 340, left: 10, right: 110, bottom: 360, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(belowFirst, 'getClientRects', {
      configurable: true,
      value: () => [{ x: 10, y: 340, width: 100, height: 20, top: 340, left: 10, right: 110, bottom: 360, toJSON: () => ({}) }] as unknown as DOMRectList,
    });
    Object.defineProperty(belowLast, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 220, y: 340, width: 100, height: 20, top: 340, left: 220, right: 320, bottom: 360, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(belowLast, 'getClientRects', {
      configurable: true,
      value: () => [{ x: 220, y: 340, width: 100, height: 20, top: 340, left: 220, right: 320, bottom: 360, toJSON: () => ({}) }] as unknown as DOMRectList,
    });
    Object.defineProperty(belowRow, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 0, y: 340, width: 600, height: 40, top: 340, left: 0, right: 600, bottom: 380, toJSON: () => ({}) }) as DOMRect,
    });

    await act(async () => {
      combobox.focus();
    });
    expect(document.activeElement).toBe(combobox);

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(belowFirst);
      expect(document.activeElement).not.toBe(belowLast);
    });
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
