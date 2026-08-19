// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ROW_DELETE_LANE_WIDTH_PX,
  RowDeleteButton,
  RowDeleteLaneCell,
  rowDeleteLaneStyle,
} from '../../../components/tables/RowDeleteButton';

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

/**
 * Lane-cellen ER kontrakten: knappen er `position: absolute`, så uden `position: relative` på
 * cellen ville ikonet placere sig efter tabellens container i stedet for efter rækken, og uden
 * den reserverede `paddingRight` ville det ligge oven på celleindholdet.
 */
describe('slet-banens cellekontrakt', () => {
  it('rowDeleteLaneStyle lægger kontrakten oven på basisstilen', () => {
    expect(rowDeleteLaneStyle({ textAlign: 'right' })).toEqual({
      textAlign: 'right',
      position: 'relative',
      paddingRight: `${ROW_DELETE_LANE_WIDTH_PX}px`,
    });
  });

  it('rowDeleteLaneStyle kan ikke overskrives væk af basisstilen', () => {
    // En basisstil med egen paddingRight (StandardLoenTable har `padding: '4px'`) må ikke
    // spise banen; kontrakten lægges sidst.
    const style = rowDeleteLaneStyle({ padding: '4px', position: 'static' });
    expect(style.paddingRight).toBe(`${ROW_DELETE_LANE_WIDTH_PX}px`);
    expect(style.position).toBe('relative');
    expect(style.padding).toBe('4px');
  });

  it('RowDeleteLaneCell rendrer en celle med position: relative og den reserverede bane', () => {
    render(
      <table>
        <tbody>
          <tr>
            <RowDeleteLaneCell>
              <RowDeleteButton onDelete={() => undefined} />
            </RowDeleteLaneCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByLabelText('Slet rækken').closest('td');
    expect(cell).not.toBeNull();
    const computed = window.getComputedStyle(cell as HTMLElement);
    expect(computed.position).toBe('relative');
    expect(computed.paddingRight).toBe(`${ROW_DELETE_LANE_WIDTH_PX}px`);
  });

  it('RowDeleteLaneCells egen sx kan ikke fjerne kontrakten', () => {
    render(
      <table>
        <tbody>
          <tr>
            <RowDeleteLaneCell sx={{ position: 'static', paddingRight: '0px', width: 120 }}>
              <RowDeleteButton onDelete={() => undefined} />
            </RowDeleteLaneCell>
          </tr>
        </tbody>
      </table>
    );

    const cell = screen.getByLabelText('Slet rækken').closest('td') as HTMLElement;
    const computed = window.getComputedStyle(cell);
    expect(computed.position).toBe('relative');
    expect(computed.paddingRight).toBe(`${ROW_DELETE_LANE_WIDTH_PX}px`);
    // Kaldstedets ØVRIGE styling overlever – kontrakten er additiv, ikke en nulstilling.
    expect(computed.width).toBe('120px');
  });
});
