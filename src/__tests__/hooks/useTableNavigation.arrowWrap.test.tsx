import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import useTableNavigation from '../../hooks/useTableNavigation';

const LooseTableHarness = () => {
  const tableData = React.useMemo(() => [{ id: 'r1' }], []);
  const nav = useTableNavigation({
    tableData,
    editableColumns: [0, 1, 2],
    loenperiode: 'maaned',
  });

  return (
    <div>
      {[0, 1, 2].map((colIdx) => (
        <input
          key={colIdx}
          data-testid={`cell-0-${colIdx}`}
          ref={(el) => nav.registerInput(0, colIdx, el)}
          onFocus={() => nav.handleFocus(0, colIdx)}
          onKeyDown={(e) => nav.handleKeyDown(e, 0, colIdx)}
        />
      ))}
    </div>
  );
};

describe('useTableNavigation arrow wrap (loose table)', () => {
  it('wraps ArrowLeft/ArrowRight within the same row', () => {
    render(<LooseTableHarness />);

    const left = screen.getByTestId('cell-0-0') as HTMLInputElement;
    const right = screen.getByTestId('cell-0-2') as HTMLInputElement;

    left.focus();
    expect(document.activeElement).toBe(left);

    fireEvent.keyDown(left, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(right);

    fireEvent.keyDown(right, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(left);
  });
});
