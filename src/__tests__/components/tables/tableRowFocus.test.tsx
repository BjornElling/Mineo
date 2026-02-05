import { afterEach, describe, expect, it } from 'vitest';
import { applyRowRemovalFocusPlan, buildRowRemovalFocusPlan, type RowRemovalFocusPlan } from '../../../components/tables/tableRowFocus';

type Row = { id: string };

const buildTable = (params: {
  rowIds: readonly string[];
  colCount: number;
  noInputByCell?: ReadonlySet<string>;
  multiInputByCell?: ReadonlySet<string>;
}): {
  table: HTMLTableElement;
  getInput: (rowId: string, colIndex: number, inputIndex?: number) => HTMLInputElement | null;
} => {
  const { rowIds, colCount, noInputByCell, multiInputByCell } = params;
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  const inputByKey = new Map<string, HTMLInputElement[]>();

  for (const rowId of rowIds) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-mineo-row-id', rowId);
    tbody.appendChild(tr);
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const td = document.createElement('td');
      tr.appendChild(td);
      const cellKey = `${rowId}:${colIndex}`;
      if (noInputByCell?.has(cellKey)) {
        continue;
      }
      const inputs: HTMLInputElement[] = [];
      const createInput = () => {
        const input = document.createElement('input');
        input.type = 'text';
        td.appendChild(input);
        inputs.push(input);
      };
      createInput();
      if (multiInputByCell?.has(cellKey)) {
        createInput();
      }
      inputByKey.set(cellKey, inputs);
    }
  }

  document.body.appendChild(table);

  const getInput = (rowId: string, colIndex: number, inputIndex = 0) => {
    const inputs = inputByKey.get(`${rowId}:${colIndex}`) ?? [];
    return inputs[inputIndex] ?? null;
  };

  return { table, getInput };
};

const buildPlan = (params: {
  table: HTMLTableElement;
  prevIds: readonly string[];
  nextIds: readonly string[];
  visibleRowIds: readonly string[];
}): RowRemovalFocusPlan | null => {
  const prevRows: Row[] = params.prevIds.map((id) => ({ id }));
  const nextRows: Row[] = params.nextIds.map((id) => ({ id }));
  return buildRowRemovalFocusPlan({
    table: params.table,
    prevRows,
    nextRows,
    visibleRowIds: params.visibleRowIds,
    getRowId: (row) => row.id,
  });
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('tableRowFocus', () => {
  it('moves focus to the same column in the row below after removal', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2', 'r3'], colCount: 2 });
    const activeInput = getInput('r2', 0);
    const nextInput = getInput('r3', 0);
    expect(activeInput).not.toBeNull();
    expect(nextInput).not.toBeNull();

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2', 'r3'],
      nextIds: ['r1', 'r3'],
      visibleRowIds: ['r1', 'r2', 'r3'],
    });
    expect(plan).toEqual({ targetIndex: 1, colIndex: 0 });

    applyRowRemovalFocusPlan({ table, plan: plan!, visibleRowIds: ['r1', 'r3'] });
    expect(document.activeElement).toBe(nextInput);
  });

  it('does nothing when the active row is not removed', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2', 'r3'], colCount: 1 });
    const activeInput = getInput('r1', 0);
    expect(activeInput).not.toBeNull();

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2', 'r3'],
      nextIds: ['r1', 'r3'],
      visibleRowIds: ['r1', 'r2', 'r3'],
    });
    expect(plan).toBeNull();
  });

  it('does not focus when the target cell has no focusables', () => {
    const { table, getInput } = buildTable({
      rowIds: ['r1', 'r2', 'r3'],
      colCount: 1,
      noInputByCell: new Set(['r3:0']),
    });
    const activeInput = getInput('r2', 0);
    const sentinel = document.createElement('input');
    document.body.appendChild(sentinel);

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2', 'r3'],
      nextIds: ['r1', 'r3'],
      visibleRowIds: ['r1', 'r2', 'r3'],
    });
    sentinel.focus();
    applyRowRemovalFocusPlan({ table, plan: plan!, visibleRowIds: ['r1', 'r3'] });
    expect(document.activeElement).toBe(sentinel);
  });

  it('always focuses the first focusable in the target cell', () => {
    const { table, getInput } = buildTable({
      rowIds: ['r1', 'r2', 'r3'],
      colCount: 1,
      multiInputByCell: new Set(['r3:0']),
    });
    const activeInput = getInput('r2', 0);
    const firstTarget = getInput('r3', 0, 0);
    const secondTarget = getInput('r3', 0, 1);
    expect(firstTarget).not.toBeNull();
    expect(secondTarget).not.toBeNull();

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2', 'r3'],
      nextIds: ['r1', 'r3'],
      visibleRowIds: ['r1', 'r2', 'r3'],
    });

    applyRowRemovalFocusPlan({ table, plan: plan!, visibleRowIds: ['r1', 'r3'] });
    expect(document.activeElement).toBe(firstTarget);
  });

  it('does not focus when there is no row below at the target index', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    const activeInput = getInput('r2', 0);
    const sentinel = document.createElement('input');
    document.body.appendChild(sentinel);

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2'],
      nextIds: ['r1'],
      visibleRowIds: ['r1', 'r2'],
    });
    sentinel.focus();
    applyRowRemovalFocusPlan({ table, plan: plan!, visibleRowIds: ['r1'] });
    expect(document.activeElement).toBe(sentinel);
  });

  it('keeps target index stable when multiple rows are removed in one commit', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2', 'r3', 'r4'], colCount: 1 });
    const activeInput = getInput('r2', 0);
    const expectedTarget = getInput('r3', 0);
    expect(activeInput).not.toBeNull();
    expect(expectedTarget).not.toBeNull();

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2', 'r3', 'r4'],
      nextIds: ['r1', 'r3'],
      visibleRowIds: ['r1', 'r2', 'r3', 'r4'],
    });
    expect(plan).toEqual({ targetIndex: 1, colIndex: 0 });

    applyRowRemovalFocusPlan({ table, plan: plan!, visibleRowIds: ['r1', 'r3'] });
    expect(document.activeElement).toBe(expectedTarget);
  });

  it('moves focus to same non-first column when active removed row is part of multiple removals', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2', 'r3', 'r4'], colCount: 2 });
    const activeInput = getInput('r2', 1);
    const expectedTarget = getInput('r3', 1);
    expect(activeInput).not.toBeNull();
    expect(expectedTarget).not.toBeNull();

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2', 'r3', 'r4'],
      nextIds: ['r1', 'r3'],
      visibleRowIds: ['r1', 'r2', 'r3', 'r4'],
    });
    expect(plan).toEqual({ targetIndex: 1, colIndex: 1 });

    applyRowRemovalFocusPlan({ table, plan: plan!, visibleRowIds: ['r1', 'r3'] });
    expect(document.activeElement).toBe(expectedTarget);
  });
});
