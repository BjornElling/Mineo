import { reconcileGridRowIdentityForRestore } from '../../../components/tables/gridCore/gridModel';

type Row = { id: string; v?: string };

const getRowId = (row: Row) => row.id;
const isRowEmpty = (row: Row) => row.v === undefined || row.v === '';
const withRowId = (row: Row, id: string): Row => ({ ...row, id });

const reconcile = (incoming: readonly Row[], current: readonly Row[]) =>
  reconcileGridRowIdentityForRestore({ incoming, current, getRowId, isRowEmpty, withRowId });

const aliasesFor = (result: ReturnType<typeof reconcile>, rowId: string): readonly string[] =>
  result.undoAliasRowIdsByRowId.get(rowId) ?? [];

describe('reconcileGridRowIdentityForRestore', () => {
  it('bevarer ikke-tomme incoming-id og opretter fokus-alias fra tidligere position', () => {
    const incoming: Row[] = [
      { id: 'fresh-1', v: 'committed' },
      { id: 'fresh-2', v: undefined },
    ];
    const current: Row[] = [
      { id: 'R', v: 'tidligere' },
      { id: 'T', v: undefined },
    ];

    const result = reconcile(incoming, current);

    expect(result.rows.map((r) => r.id)).toEqual(['fresh-1', 'T']);
    expect(result.rows[0].v).toBe('committed');
    expect(aliasesFor(result, 'fresh-1')).toEqual(['R']);
  });

  it('tomme syntetiske rækker må arve nuværende id for at bevare invalidDraft/fokus', () => {
    const incoming: Row[] = [{ id: 'fresh-empty', v: undefined }];
    const current: Row[] = [{ id: 'R', v: 'før' }];

    const result = reconcile(incoming, current);

    expect(result.rows.map((r) => r.id)).toEqual(['R']);
    expect(result.undoAliasRowIdsByRowId.size).toBe(0);
  });

  it('beholder incoming-id når der ikke findes en nuværende række på positionen', () => {
    const incoming: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const current: Row[] = [{ id: 'R' }];

    const result = reconcile(incoming, current);

    expect(result.rows.map((r) => r.id)).toEqual(['R', 'b', 'c']);
  });

  it('er en no-op når id allerede matcher på positionen', () => {
    const incoming: Row[] = [{ id: 'R', v: 'ny' }];
    const current: Row[] = [{ id: 'R', v: 'gammel' }];

    const result = reconcile(incoming, current);

    expect(result.rows[0]).toBe(incoming[0]);
    expect(result.undoAliasRowIdsByRowId.size).toBe(0);
  });

  it('håndterer tom current ved at returnere incoming uændret', () => {
    const incoming: Row[] = [{ id: 'a' }, { id: 'b' }];

    const result = reconcile(incoming, []);

    expect(result.rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.undoAliasRowIdsByRowId.size).toBe(0);
  });

  it('grafter/aliaserer aldrig et id der kolliderer med et incoming-id senere i listen', () => {
    const current: Row[] = [
      { id: 'filled_A', v: 'a' },
      { id: 'offentlig_ydelse_empty_3', v: undefined },
    ];
    const incoming: Row[] = [
      { id: 'filled_A', v: 'a' },
      { id: 'syg_1', v: 'ny' },
      { id: 'offentlig_ydelse_empty_3', v: undefined },
    ];

    const result = reconcile(incoming, current);
    const ids = result.rows.map((r) => r.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['filled_A', 'syg_1', 'offentlig_ydelse_empty_3']);
    expect(result.undoAliasRowIdsByRowId.size).toBe(0);
  });

  it('aliaserer ikke et current-id der tilhører en senere incoming-række (slet+undo)', () => {
    const current: Row[] = [
      { id: 'B', v: 'data-B' },
      { id: 'row_empty_0', v: undefined },
    ];
    const incoming: Row[] = [
      { id: 'A', v: 'data-A' },
      { id: 'B', v: 'data-B' },
      { id: 'row_empty_0', v: undefined },
    ];

    const result = reconcile(incoming, current);
    const ids = result.rows.map((r) => r.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['A', 'B', 'row_empty_0']);
    expect(result.rows.map((r) => r.v)).toEqual(['data-A', 'data-B', undefined]);
    expect(result.undoAliasRowIdsByRowId.size).toBe(0);
  });
});
