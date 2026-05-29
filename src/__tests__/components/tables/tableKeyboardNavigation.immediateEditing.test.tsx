import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';

const pointerDownInAct = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(element);
  });
};

describe('tableKeyboardNavigation immediateEditing', () => {
  const TEST_TIMEOUT_MS = 15000;

  it('standard two-step flow: første pointerDown sætter fokus men åbner ikke editor', async () => {
    render(
      <StandardLooseTable>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="42" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const input = screen.getByRole('textbox');

    // Første pointerDown uden forudgående fokus: fokus sættes, men editor åbnes ikke.
    // Input skal forblive readOnly (editor er ikke åben) efter første tryk.
    await pointerDownInAct(input);

    expect(input).toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);

  it('immediateEditing=true sætter data-mineo-immediate-editing attribut på table-elementet', () => {
    render(
      <StandardLooseTable immediateEditing={true}>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="42" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const input = screen.getByRole('textbox');
    const table = input.closest('table');
    expect(table?.dataset.mineoImmediateEditing).toBe('true');
  }, TEST_TIMEOUT_MS);

  it('immediateEditing=false sætter ikke data-mineo-immediate-editing attribut', () => {
    render(
      <StandardLooseTable immediateEditing={false}>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="42" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const input = screen.getByRole('textbox');
    const table = input.closest('table');
    expect(table?.dataset.mineoImmediateEditing).toBeUndefined();
  }, TEST_TIMEOUT_MS);

  it('immediateEditing=true: første pointerDown åbner editor (input ikke readOnly efter pointerDown)', async () => {
    render(
      <StandardLooseTable immediateEditing={true}>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="42" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const input = screen.getByRole('textbox');
    // Uden forudgående fokus — første pointerDown skal åbne editor direkte
    await pointerDownInAct(input);

    // Editor er åben: input er ikke readOnly
    expect(input).not.toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);

  it('immediateEditing=true: click-event efter pointerDown nulstiller ikke editor (pointerDown→click sekvens)', async () => {
    render(
      <StandardLooseTable immediateEditing={true}>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="42" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const input = screen.getByRole('textbox');

    // pointerDown åbner editor
    await pointerDownInAct(input);
    expect(input).not.toHaveAttribute('readonly');

    // click-event (som browser altid sender efter pointerDown) må ikke lukke eller nulstille editor
    await act(async () => { fireEvent.click(input); });
    expect(input).not.toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);

  it('immediateEditing=true: openEditing kaldes ikke igen på allerede åben celle (guard mod dobbeltkald)', async () => {
    render(
      <StandardLooseTable immediateEditing={true}>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="42" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    );

    const input = screen.getByRole('textbox');
    // Første pointerDown åbner editor
    await pointerDownInAct(input);
    expect(input).not.toHaveAttribute('readonly');

    // Andet pointerDown på samme celle — editor skal forblive åben, ingen undtagelse eller nulstilling
    await pointerDownInAct(input);
    expect(input).not.toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);
});
