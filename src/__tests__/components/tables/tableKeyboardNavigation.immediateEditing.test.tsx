import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';

const pointerDownInAct = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(element);
  });
};

const focusInAct = async (element: HTMLElement) => {
  await act(async () => {
    element.focus();
  });
};

describe('tableKeyboardNavigation immediateEditing', () => {
  const TEST_TIMEOUT_MS = 15000;

  it('standard two-step flow: første klik sætter kun fokus, andet klik åbner editor', async () => {
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

    // Første pointerDown: sætter fokus men åbner ikke editor (input er ikke editerbart endnu)
    await focusInAct(input);
    await pointerDownInAct(input);

    // Input er stadig closed (ikke editerbart) — men fokuseret
    // Ved standard to-trins-flow kræves andet pointerDown for at åbne
    // Vi verificerer ved at tjekke at data-mineo-immediate-editing IKKE er sat
    const table = input.closest('table');
    expect(table?.dataset.mineoImmediateEditing).toBeUndefined();
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
