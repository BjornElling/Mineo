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
});
