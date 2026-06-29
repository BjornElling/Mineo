// @vitest-environment jsdom
// Regressionstest for fokus-autoritets-ændringen i commit 48dfbec5 ("ny samlet tabel-navigation").
//
// `handleTablePointerDownCapture` læste tidligere den fokuserede celle fra den modul-globale
// `physicalFocusByTable`-WeakMap (som blev SLETTET ved blur). Efter konsolideringen til ÉN
// fokus-autoritet læses cellen nu via `core.getFocusedCell()`, som IKKE nulstilles ved blur.
//
// Den eneste ting der forhindrer en stale (persisterende) fokuseret celle i FEJLAGTIGT at armere
// to-trins-redigering efter et blur + gen-indtræden, er `clickEditableCellByTable`-gaten, der FORTSAT
// slettes ved blur. Denne test pinner præcis den invariant: efter at tabellen har mistet fokus, må et
// enkelt klik på den tidligere-fokuserede celle IKKE åbne editoren (to-trins-semantikken skal overleve
// gen-indtræden). Den positive sti (andet klik på en allerede-fokuseret celle ÅBNER editoren) testes
// først, så vi ved at simuleringen rent faktisk driver de rigtige handlere (ikke en vacuous test).
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StandardLooseTable from '../../../components/tables/StandardLooseTable';
import TableIntegerInput from '../../../components/inputs/table/TableIntegerInput';

const TEST_TIMEOUT_MS = 15000;

const pointerDownInAct = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(element);
  });
};

const clickInAct = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

const focusInAct = async (element: HTMLElement) => {
  await act(async () => {
    element.focus();
  });
};

const renderCell = () =>
  render(
    <>
      <button type="button">uden for tabel</button>
      <StandardLooseTable>
        <tbody>
          <tr data-mineo-row-id="r1">
            <td>
              <TableIntegerInput gridCell={{ rowId: 'r1', colIndex: 0 }} value="42" />
            </td>
          </tr>
        </tbody>
      </StandardLooseTable>
    </>
  );

describe('to-trins-redigering: fokus-autoritet via core.getFocusedCell()', () => {
  it('andet klik på en allerede-fokuseret celle åbner editoren (positiv sti — beviser at simuleringen driver handlerne)', async () => {
    renderCell();
    const input = screen.getByRole('textbox');

    // Første interaktion: pointerDown (uden fokus) → fokus → klik. Armerer cellen, åbner ikke.
    await pointerDownInAct(input);
    await focusInAct(input);
    await clickInAct(input);
    expect(input).toHaveAttribute('readonly');

    // Anden interaktion på den samme, nu-fokuserede celle: pointerDown ser core-fokus === cellen
    // OG den armerede clickEditableCell === cellen → andet klik åbner editoren.
    await pointerDownInAct(input);
    await clickInAct(input);
    expect(input).not.toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);

  it('efter blur ud af tabellen åbner et enkelt klik IKKE editoren — stale core-fokus armerer ikke to-trins-redigering', async () => {
    renderCell();
    const input = screen.getByRole('textbox');
    const outside = screen.getByRole('button', { name: 'uden for tabel' });

    // Arm cellen (fokus + klik), men åbn ikke editoren.
    await pointerDownInAct(input);
    await focusInAct(input);
    await clickInAct(input);
    expect(input).toHaveAttribute('readonly');

    // Forlad tabellen: blur sletter clickEditableCell (men core.getFocusedCell() bevares bevidst).
    await act(async () => {
      fireEvent.blur(input, { relatedTarget: outside });
      outside.focus();
    });

    // Gen-indtræden med ÉT klik på den samme celle: core-fokus er stadig (stale) cellen, men
    // clickEditableCell-gaten er nulstillet → editoren må forblive lukket (forbliver readOnly).
    await pointerDownInAct(input);
    await focusInAct(input);
    await clickInAct(input);
    expect(input).toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);
});
