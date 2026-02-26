import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';

type DraftRow = { id: string; name: string };
type CommittedRow = { id: string; name?: string };

const makeConfig = (
  store: { committed: CommittedRow[] | undefined },
  resyncToken: unknown
) => ({
  getCommitted: () => store.committed,
  setCommitted: (updater: (prevRows: CommittedRow[] | undefined) => CommittedRow[] | undefined) => {
    store.committed = updater(store.committed);
  },
  toDraft: (rows: CommittedRow[]): DraftRow[] => rows.map((row) => ({ id: row.id, name: row.name ?? '' })),
  toCommittedRow: (draft: DraftRow): CommittedRow => ({ id: draft.id, name: draft.name.trim() || undefined }),
  isRowEmpty: (row: CommittedRow) => row.name === undefined,
  ensureRows: (rows: CommittedRow[] | undefined): CommittedRow[] => (rows && rows.length > 0 ? rows : [{ id: 'empty' }]),
  createId: () => `id-${Math.random().toString(36).slice(2)}`,
  createEmptyCommittedRow: (id: string): CommittedRow => ({ id }),
  resyncToken,
});

describe('useRowDrafts', () => {
  it('resyncer ikke drafts ved ekstern committed ændring uden resyncToken-skift', () => {
    const store: { committed: CommittedRow[] | undefined } = { committed: [{ id: 'r1', name: 'old' }] };
    const { result, rerender } = renderHook(
      ({ token }) => useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, token)),
      { initialProps: { token: 1 } }
    );

    act(() => {
      result.current.onFieldChange('r1', 'name')('draft-local');
    });
    expect(result.current.draftRows[0].name).toBe('draft-local');

    store.committed = [{ id: 'r1', name: 'external' }];
    rerender({ token: 1 });

    expect(result.current.draftRows[0].name).toBe('draft-local');
  });

  it('resyncer drafts når resyncToken ændres', () => {
    const store: { committed: CommittedRow[] | undefined } = { committed: [{ id: 'r1', name: 'old' }] };
    const { result, rerender } = renderHook(
      ({ token }) => useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, token)),
      { initialProps: { token: 1 } }
    );

    act(() => {
      result.current.onFieldChange('r1', 'name')('draft-local');
    });

    store.committed = [{ id: 'r1', name: 'external' }];
    rerender({ token: 2 });

    expect(result.current.draftRows[0].name).toBe('external');
  });

  it('commitRow opdaterer committed og resyncer draft', () => {
    const store: { committed: CommittedRow[] | undefined } = { committed: [{ id: 'r1', name: 'old' }] };
    const { result } = renderHook(() =>
      useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, 1))
    );

    act(() => {
      result.current.onFieldChange('r1', 'name')('new-value');
      result.current.commitRow('r1');
    });

    expect(store.committed?.[0].name).toBe('new-value');
    expect(result.current.draftRows[0].name).toBe('new-value');
  });

  it('addRow og removeRow påvirker ikke øvrige committed rows', () => {
    const store: { committed: CommittedRow[] | undefined } = {
      committed: [{ id: 'r1', name: 'a' }, { id: 'r2', name: 'b' }],
    };
    const { result } = renderHook(() =>
      useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, 1))
    );

    act(() => {
      result.current.addRow();
    });
    expect(store.committed?.some((row) => row.id === 'r1' && row.name === 'a')).toBe(true);
    expect(store.committed?.some((row) => row.id === 'r2' && row.name === 'b')).toBe(true);

    act(() => {
      result.current.removeRow('r2');
    });
    expect(store.committed?.some((row) => row.id === 'r2')).toBe(false);
    expect(store.committed?.some((row) => row.id === 'r1')).toBe(true);
  });
});
