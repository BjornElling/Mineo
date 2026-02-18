import { fireEvent, render, screen } from '@testing-library/react';
import { handleTableKeyDownCapture } from '../../../components/tables/tableKeyboardNavigation';

const GridTableHarness = () => {
  return (
    <table onKeyDownCapture={handleTableKeyDownCapture}>
      <tbody>
        <tr data-mineo-row-id="r1">
          <td>
            <input data-testid="grid-0-0" />
          </td>
          <td>
            <input data-testid="grid-0-1" />
          </td>
          <td>
            <input data-testid="grid-0-2" />
          </td>
        </tr>
        <tr data-mineo-row-id="r2">
          <td>
            <input data-testid="grid-1-0" />
          </td>
          <td>
            <input data-testid="grid-1-1" />
          </td>
          <td>
            <input data-testid="grid-1-2" />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

describe('tableKeyboardNavigation arrow wrap (grid table)', () => {
  it('wraps ArrowLeft/ArrowRight within the same row', () => {
    render(<GridTableHarness />);

    const left = screen.getByTestId('grid-0-0') as HTMLInputElement;
    const right = screen.getByTestId('grid-0-2') as HTMLInputElement;

    left.focus();
    expect(document.activeElement).toBe(left);

    fireEvent.keyDown(left, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(right);

    fireEvent.keyDown(right, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(left);
  });

  it('uses tab-sequence start cell as Enter/Shift+Enter anchor (also across rows)', () => {
    render(<GridTableHarness />);

    const a1 = screen.getByTestId('grid-0-0') as HTMLInputElement;
    const c1 = screen.getByTestId('grid-0-2') as HTMLInputElement;
    const a2 = screen.getByTestId('grid-1-0') as HTMLInputElement;
    const c2 = screen.getByTestId('grid-1-2') as HTMLInputElement;

    a1.focus();
    fireEvent.keyDown(a1, { key: 'Tab' });
    c1.focus();
    fireEvent.keyDown(c1, { key: 'Enter' });
    expect(document.activeElement).toBe(a2);

    c2.focus();
    fireEvent.keyDown(c2, { key: 'Tab' });
    a1.focus();
    fireEvent.keyDown(a1, { key: 'Enter', shiftKey: true });
    expect(document.activeElement).toBe(c1);
  });
});
