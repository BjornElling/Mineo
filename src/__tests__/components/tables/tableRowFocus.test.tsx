// @vitest-environment jsdom
import {
  applyRowRemovalFocusPlan,
  buildCommitFocusPlan,
  buildRemovedRowFallbackFocusPlan,
  buildRetainedEmptyRowFocusPlan,
  buildRowRemovalFocusPlan,
  evaluateRowCommit,
  type RowRemovalFocusPlan,
} from '../../../components/tables/gridCore/tableRowFocus';

type Row = { id: string };

const createNonEmptyClientRectList = (): DOMRectList => {
  const rect = {
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    top: 0,
    right: 100,
    bottom: 20,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
  const listLike = {
    0: rect,
    length: 1,
    item: (index: number) => (index === 0 ? rect : null),
    [Symbol.iterator]: function* iterator() {
      yield rect;
    },
  };
  return listLike as unknown as DOMRectList;
};

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
        Object.defineProperty(input, 'getClientRects', {
          configurable: true,
          value: () => createNonEmptyClientRectList(),
        });
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

  it('restores focus when the removed row is actually unmounted from DOM before apply', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2', 'r3'], colCount: 1 });
    const activeInput = getInput('r2', 0);
    const expectedTarget = getInput('r3', 0);
    expect(activeInput).not.toBeNull();
    expect(expectedTarget).not.toBeNull();

    activeInput!.focus();
    const plan = buildPlan({
      table,
      prevIds: ['r1', 'r2', 'r3'],
      nextIds: ['r1', 'r3'],
      visibleRowIds: ['r1', 'r2', 'r3'],
    });
    expect(plan).toEqual({ targetIndex: 1, colIndex: 0 });

    const removedRow = table.querySelector('tbody tr[data-mineo-row-id="r2"]');
    removedRow?.remove();

    applyRowRemovalFocusPlan({ table, plan: plan!, visibleRowIds: ['r1', 'r3'] });
    expect(document.activeElement).toBe(expectedTarget);
  });

  it('buildRemovedRowFallbackFocusPlan resolves target index without active cell in table', () => {
    const plan = buildRemovedRowFallbackFocusPlan({
      prevRows: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
      nextRows: [{ id: 'r1' }, { id: 'r3' }],
      rowId: 'r2',
      colIndex: 1,
      visibleRowIds: ['r1', 'r2', 'r3'],
      getRowId: (row) => row.id,
    });

    expect(plan).toEqual({ targetIndex: 1, colIndex: 1 });
  });

  it('buildRemovedRowFallbackFocusPlan returns null when row is not removed', () => {
    const plan = buildRemovedRowFallbackFocusPlan({
      prevRows: [{ id: 'r1' }, { id: 'r2' }],
      nextRows: [{ id: 'r1' }, { id: 'r2' }],
      rowId: 'r2',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      getRowId: (row) => row.id,
    });

    expect(plan).toBeNull();
  });

  it('buildRemovedRowFallbackFocusPlan returns null when row id is not in visible row ids', () => {
    const plan = buildRemovedRowFallbackFocusPlan({
      prevRows: [{ id: 'r1' }, { id: 'r2' }],
      nextRows: [{ id: 'r1' }],
      rowId: 'r2',
      colIndex: 0,
      visibleRowIds: ['r1'],
      getRowId: (row) => row.id,
    });

    expect(plan).toBeNull();
  });

  it('buildRetainedEmptyRowFocusPlan returns plan when active row becomes empty and is retained', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    getInput('r1', 0)!.focus();

    const plan = buildRetainedEmptyRowFocusPlan({
      table,
      prevRows: [{ id: 'r1', value: '100' }],
      nextRows: [{ id: 'r1', value: '' }],
      rowId: 'r1',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: (row) => row.value === '',
      getRowId: (row) => row.id,
    });

    expect(plan).toEqual({ targetIndex: 0, colIndex: 0 });
  });

  it('buildRetainedEmptyRowFocusPlan returns null when focus is outside table', () => {
    const { table } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();

    const plan = buildRetainedEmptyRowFocusPlan({
      table,
      prevRows: [{ id: 'r1', value: '100' }],
      nextRows: [{ id: 'r1', value: '' }],
      rowId: 'r1',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: (row) => row.value === '',
      getRowId: (row) => row.id,
    });

    expect(plan).toBeNull();
  });

  it('buildRetainedEmptyRowFocusPlan returns null when row was already empty before commit', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    getInput('r1', 0)!.focus();

    const plan = buildRetainedEmptyRowFocusPlan({
      table,
      prevRows: [{ id: 'r1', value: '' }],
      nextRows: [{ id: 'r1', value: '' }],
      rowId: 'r1',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: (row) => row.value === '',
      getRowId: (row) => row.id,
    });

    expect(plan).toBeNull();
  });

  it('buildCommitFocusPlan prefers row-removal plan when active removed row is focused', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2', 'r3'], colCount: 2 });
    getInput('r2', 1)!.focus();

    const plan = buildCommitFocusPlan({
      table,
      prevRows: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
      nextRows: [{ id: 'r1' }, { id: 'r3' }],
      rowId: 'r2',
      colIndex: 1,
      visibleRowIds: ['r1', 'r2', 'r3'],
      isRowEmpty: () => false,
      getRowId: (row) => row.id,
    });

    expect(plan).toEqual({ targetIndex: 1, colIndex: 1 });
  });

  it('buildCommitFocusPlan falls back to removed-row fallback when focus is outside table', () => {
    const { table } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();

    const plan = buildCommitFocusPlan({
      table,
      prevRows: [{ id: 'r1' }, { id: 'r2' }],
      nextRows: [{ id: 'r1' }],
      rowId: 'r2',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: () => false,
      getRowId: (row) => row.id,
    });

    expect(plan).toEqual({ targetIndex: 1, colIndex: 0 });
  });

  it('buildCommitFocusPlan uses retained-empty plan when row stays but becomes empty', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    getInput('r1', 0)!.focus();

    const plan = buildCommitFocusPlan({
      table,
      prevRows: [{ id: 'r1', value: '100' }, { id: 'r2', value: '' }],
      nextRows: [{ id: 'r1', value: '' }, { id: 'r2', value: '' }],
      rowId: 'r1',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: (row) => row.value === '',
      getRowId: (row) => row.id,
    });

    expect(plan).toEqual({ targetIndex: 0, colIndex: 0 });
  });

  it('evaluateRowCommit sets shouldPersist=false when fingerprint is unchanged', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    getInput('r1', 0)!.focus();

    const result = evaluateRowCommit({
      table,
      prevRows: [{ id: 'r1', value: '100' }],
      nextRows: [{ id: 'r1', value: '100' }],
      rowId: 'r1',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: (row) => row.value === '',
      getRowId: (row) => row.id,
      getFingerprint: (rows) => JSON.stringify(rows),
      lastPersistedFingerprint: JSON.stringify([{ id: 'r1', value: '100' }]),
    });

    expect(result.shouldPersist).toBe(false);
  });

  it('evaluateRowCommit sets shouldPersist=true and returns focus plan on delta', () => {
    const { table } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();

    const result = evaluateRowCommit({
      table,
      prevRows: [{ id: 'r1' }, { id: 'r2' }],
      nextRows: [{ id: 'r1' }],
      rowId: 'r2',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: () => false,
      getRowId: (row) => row.id,
      getFingerprint: (rows) => JSON.stringify(rows),
      lastPersistedFingerprint: JSON.stringify([{ id: 'r1' }, { id: 'r2' }]),
    });

    expect(result.shouldPersist).toBe(true);
    expect(result.focusPlan).toEqual({ targetIndex: 1, colIndex: 0 });
  });

  it('buildCommitFocusPlan still allows removed-row fallback when table is null', () => {
    const plan = buildCommitFocusPlan({
      table: null,
      prevRows: [{ id: 'r1' }, { id: 'r2' }],
      nextRows: [{ id: 'r1' }],
      rowId: 'r2',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: () => false,
      getRowId: (row) => row.id,
    });

    expect(plan).toEqual({ targetIndex: 1, colIndex: 0 });
  });

  it('buildCommitFocusPlan returns null when no strategy matches', () => {
    const { table, getInput } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    getInput('r1', 0)!.focus();

    const plan = buildCommitFocusPlan({
      table,
      prevRows: [{ id: 'r1', value: '100' }],
      nextRows: [{ id: 'r1', value: '100' }],
      rowId: 'r1',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: (row) => row.value === '',
      getRowId: (row) => row.id,
    });

    expect(plan).toBeNull();
  });

  it('evaluateRowCommit sets shouldPersist=true when last persisted fingerprint is null', () => {
    const { table } = buildTable({ rowIds: ['r1', 'r2'], colCount: 1 });
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();

    const result = evaluateRowCommit({
      table,
      prevRows: [{ id: 'r1' }, { id: 'r2' }],
      nextRows: [{ id: 'r1' }],
      rowId: 'r2',
      colIndex: 0,
      visibleRowIds: ['r1', 'r2'],
      isRowEmpty: () => false,
      getRowId: (row) => row.id,
      getFingerprint: (rows) => JSON.stringify(rows),
      lastPersistedFingerprint: null,
    });

    expect(result.shouldPersist).toBe(true);
  });
});
