// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useSliceRowDrafts } from '../../rowDrafts/useSliceRowDrafts';
import type { SetValuesUpdater } from '../../hooks/usePersistedForm';

type DraftRow = { id: string; name: string };
type CommittedRow = { id: string; name?: string };

type Values = {
  rows: CommittedRow[] | undefined;
  // Søster-slice der ALDRIG må blive rørt af row-commits.
  sibling: string;
};

let idCounter = 0;
const nextId = () => `id-${(idCounter += 1)}`;

const makeConfig = (values: Values, setValues: SetValuesUpdater<Values>, resyncToken: unknown) => ({
  values,
  setValues,
  resyncToken,
  getSlice: (v: Values) => v.rows,
  setSlice: (v: Values, rows: CommittedRow[]): Values => ({ ...v, rows }),
  toDraft: (rows: CommittedRow[]): DraftRow[] => rows.map((row) => ({ id: row.id, name: row.name ?? '' })),
  toCommittedRow: (draft: DraftRow): CommittedRow => ({ id: draft.id, name: draft.name.trim() || undefined }),
  isRowEmpty: (row: CommittedRow) => row.name === undefined,
  ensureRows: (rows: CommittedRow[] | undefined): CommittedRow[] => (rows && rows.length > 0 ? rows : [{ id: 'empty' }]),
  createId: nextId,
  createEmptyCommittedRow: (id: string): CommittedRow => ({ id }),
  fieldColIndex: { name: 0 } as const,
});

describe('useSliceRowDrafts', () => {
  it('commit skriver kun til den valgte slice og lader søster-slice være urørt', () => {
    // Stabil store muteret in-place (som useRowDrafts-testen): afspejler at komponenten
    // re-rendrer med den nyeste values-reference efter setValues.
    const store: Values = { rows: [{ id: 'r1', name: 'old' }], sibling: 'bevaret' };
    const setValues: SetValuesUpdater<Values> = (updater) => {
      const next = updater(store) as Values;
      store.rows = next.rows;
      store.sibling = next.sibling;
    };

    const { result } = renderHook(() =>
      useSliceRowDrafts<Values, DraftRow, CommittedRow, 'name'>(makeConfig(store, setValues, 1))
    );

    act(() => {
      result.current.onFieldChange('r1', 'name')('ny-værdi');
      result.current.commitRow('r1');
    });

    expect(store.rows?.[0]?.name).toBe('ny-værdi');
    expect(store.sibling).toBe('bevaret');
    expect(result.current.draftRows[0]?.name).toBe('ny-værdi');
  });

  it('committedRowsEnsured og committedById afspejler den ensured committed slice', () => {
    const values: Values = { rows: [{ id: 'r1', name: 'a' }, { id: 'r2', name: 'b' }], sibling: 'x' };
    const { result } = renderHook(() =>
      useSliceRowDrafts<Values, DraftRow, CommittedRow, 'name'>(makeConfig(values, () => {}, 1))
    );

    expect(result.current.committedRowsEnsured.map((row) => row.id)).toEqual(['r1', 'r2']);
    expect(result.current.committedById.get('r1')?.name).toBe('a');
    expect(result.current.committedById.get('r2')?.name).toBe('b');
  });

  it('committedRowsEnsured anvender ensureRows når slicen er tom/undefined', () => {
    const values: Values = { rows: undefined, sibling: 'x' };
    const { result } = renderHook(() =>
      useSliceRowDrafts<Values, DraftRow, CommittedRow, 'name'>(makeConfig(values, () => {}, 1))
    );

    expect(result.current.committedRowsEnsured).toEqual([{ id: 'empty' }]);
  });

  it('setSlice-updateren læser slicen fra prev-snapshot (ikke en stale closure)', () => {
    const store: Values = { rows: [{ id: 'r1', name: 'old' }], sibling: 's' };
    const setValues: SetValuesUpdater<Values> = (updater) => {
      // Simulér at en anden mutation ramte storen umiddelbart før denne updater kører.
      store.sibling = 'ændret-eksternt';
      const next = updater(store) as Values;
      store.rows = next.rows;
      store.sibling = next.sibling;
    };

    const { result } = renderHook(() =>
      useSliceRowDrafts<Values, DraftRow, CommittedRow, 'name'>(makeConfig(store, setValues, 1))
    );

    act(() => {
      result.current.onFieldChange('r1', 'name')('ny');
      result.current.commitRow('r1');
    });

    // Den eksterne sibling-ændring bevares (updateren byggede oven på prev, ikke en stale closure).
    expect(store.sibling).toBe('ændret-eksternt');
    expect(store.rows?.[0]?.name).toBe('ny');
  });
});
