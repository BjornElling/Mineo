// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';

type DraftRow = { id: string; name: string };
type CommittedRow = { id: string; name?: string };
type OrderedDraftRow = { id: string; first: string; second: string };
type OrderedCommittedRow = { id: string; first?: string; second?: string };

const makeConfig = (
  store: { committed: CommittedRow[] | undefined },
  resyncToken: unknown,
  nextId: () => string = () => `id-${Math.random().toString(36).slice(2)}`
) => ({
  getCommitted: () => store.committed,
  setCommitted: (updater: (prevRows: CommittedRow[] | undefined) => CommittedRow[] | undefined) => {
    store.committed = updater(store.committed);
  },
  toDraft: (rows: CommittedRow[]): DraftRow[] => rows.map((row) => ({ id: row.id, name: row.name ?? '' })),
  toCommittedRow: (draft: DraftRow): CommittedRow => ({ id: draft.id, name: draft.name.trim() || undefined }),
  isRowEmpty: (row: CommittedRow) => row.name === undefined,
  ensureRows: (rows: CommittedRow[] | undefined): CommittedRow[] => (rows && rows.length > 0 ? rows : [{ id: 'empty' }]),
  createId: nextId,
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

  it('commitRow resyncer ikke andre drafts ved no-op commit', () => {
    const store: { committed: CommittedRow[] | undefined } = {
      committed: [
        { id: 'r1', name: 'old' },
        { id: 'r2', name: 'keep' },
      ],
    };
    const { result } = renderHook(() =>
      useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, 1))
    );

    act(() => {
      result.current.onFieldChange('r2', 'name')('local-draft');
      const didChange = result.current.commitRow('r1');
      expect(didChange).toBe(false);
    });

    expect(store.committed?.find((row) => row.id === 'r1')?.name).toBe('old');
    expect(result.current.draftRows.find((row) => row.id === 'r2')?.name).toBe('local-draft');
  });

  it('commitRow no-op er uafhængig af committed row property-rækkefølge', () => {
    const store: { committed: OrderedCommittedRow[] | undefined } = {
      committed: [
        { id: 'r1', first: 'a', second: 'b' },
        { id: 'r2', first: 'x', second: 'y' },
      ],
    };
    const { result } = renderHook(() =>
      useRowDrafts<OrderedDraftRow, OrderedCommittedRow, 'first' | 'second'>({
        getCommitted: () => store.committed,
        setCommitted: (updater) => {
          store.committed = updater(store.committed);
        },
        toDraft: (rows) => rows.map((row) => ({ id: row.id, first: row.first ?? '', second: row.second ?? '' })),
        toCommittedRow: (draft) => ({
          second: draft.second || undefined,
          first: draft.first || undefined,
          id: draft.id,
        }),
        isRowEmpty: (row) => row.first === undefined && row.second === undefined,
        ensureRows: (rows) => (rows && rows.length > 0 ? rows : [{ id: 'empty' }]),
        createId: () => 'new',
        createEmptyCommittedRow: (id) => ({ id }),
        resyncToken: 1,
      })
    );

    act(() => {
      result.current.onFieldChange('r2', 'first')('local-draft');
      result.current.onFieldChange('r1', 'first')('a');
      result.current.onFieldChange('r1', 'second')('b');
      const didChange = result.current.commitRow('r1');
      expect(didChange).toBe(false);
    });

    expect(store.committed).toEqual([
      { id: 'r1', first: 'a', second: 'b' },
      { id: 'r2', first: 'x', second: 'y' },
    ]);
    expect(result.current.draftRows.find((row) => row.id === 'r2')?.first).toBe('local-draft');
  });

  it('addRow indsætter ny tom række før trailing empty row og bevarer øvrige rows', () => {
    const store: { committed: CommittedRow[] | undefined } = {
      committed: [{ id: 'r1', name: 'a' }, { id: 'empty' }],
    };
    const nextId = () => 'r2';
    const { result } = renderHook(() =>
      useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, 1, nextId))
    );

    act(() => {
      result.current.addRow();
    });

    expect(store.committed?.map((row) => row.id)).toEqual(['r1', 'r2', 'empty']);
    expect(result.current.draftRows.map((row) => row.id)).toEqual(['r1', 'r2', 'empty']);
  });

  it('removeRow med ikke-eksisterende id er en no-op og bevarer ucommitted drafts', () => {
    const store: { committed: CommittedRow[] | undefined } = {
      committed: [{ id: 'r1', name: 'a' }, { id: 'r2', name: 'b' }],
    };
    const { result } = renderHook(() =>
      useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, 1))
    );

    act(() => {
      result.current.onFieldChange('r2', 'name')('local-draft');
    });

    act(() => {
      // Fjern et id der ikke findes: ingen ændring → ingen resync → draften må ikke tabes.
      result.current.removeRow('does-not-exist');
    });

    expect(store.committed?.map((row) => row.id)).toEqual(['r1', 'r2']);
    expect(result.current.draftRows.find((row) => row.id === 'r2')?.name).toBe('local-draft');
  });

  it('reorderRows med uændret rækkefølge er en no-op og bevarer ucommitted drafts', () => {
    const store: { committed: CommittedRow[] | undefined } = {
      committed: [{ id: 'r1', name: 'a' }, { id: 'r2', name: 'b' }],
    };
    const { result } = renderHook(() =>
      useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, 1))
    );

    act(() => {
      result.current.onFieldChange('r2', 'name')('local-draft');
    });

    act(() => {
      result.current.reorderRows(['r1', 'r2']);
    });

    expect(store.committed?.map((row) => row.id)).toEqual(['r1', 'r2']);
    expect(result.current.draftRows.find((row) => row.id === 'r2')?.name).toBe('local-draft');
  });

  it('removeRow fjerner valgt række og resyncer øvrige drafts fra committed', () => {
    const store: { committed: CommittedRow[] | undefined } = {
      committed: [{ id: 'r1', name: 'a-committed' }, { id: 'r2', name: 'b' }, { id: 'empty' }],
    };
    const { result } = renderHook(() =>
      useRowDrafts<DraftRow, CommittedRow, 'name'>(makeConfig(store, 1))
    );

    act(() => {
      result.current.onFieldChange('r1', 'name')('a-draft');
    });

    act(() => {
      result.current.removeRow('r2');
    });

    expect(store.committed?.map((row) => row.id)).toEqual(['r1', 'empty']);
    expect(store.committed?.find((row) => row.id === 'r1')?.name).toBe('a-committed');
    expect(result.current.draftRows.find((row) => row.id === 'r1')?.name).toBe('a-committed');
  });
});
