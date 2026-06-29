// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RowDeleteButton } from '../../../components/tables/RowDeleteButton';

describe('RowDeleteButton', () => {
  it('rendrer med aria-label/tooltip "Slet rækken" og kalder onDelete ved klik', () => {
    const onDelete = vi.fn();
    render(
      <table>
        <tbody>
          <tr>
            <td style={{ position: 'relative' }}>
              <RowDeleteButton onDelete={onDelete} />
            </td>
          </tr>
        </tbody>
      </table>
    );

    const button = screen.getByLabelText('Slet rækken');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('er uden for tastatur-/grid-navigation (tabIndex=-1 + data-mineo-row-delete)', () => {
    render(
      <table>
        <tbody>
          <tr>
            <td style={{ position: 'relative' }}>
              <RowDeleteButton onDelete={() => undefined} />
            </td>
          </tr>
        </tbody>
      </table>
    );

    const button = screen.getByLabelText('Slet rækken');
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(button.closest('[data-mineo-row-delete="true"]')).not.toBeNull();
  });

  it('respekterer en custom title', () => {
    render(
      <table>
        <tbody>
          <tr>
            <td style={{ position: 'relative' }}>
              <RowDeleteButton onDelete={() => undefined} title="Fjern" />
            </td>
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByLabelText('Fjern')).toBeInTheDocument();
  });
});
