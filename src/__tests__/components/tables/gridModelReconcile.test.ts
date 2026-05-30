import { reconcileRowIdsByPosition } from '../../../components/tables/gridCore/gridModel';

type Row = { id: string; v?: string };

const getRowId = (row: Row) => row.id;
const withRowId = (row: Row, id: string): Row => ({ ...row, id });

describe('reconcileRowIdsByPosition', () => {
  it('genbruger nuværende rækkes id positionelt så DOM-identitet bevares', () => {
    const incoming: Row[] = [
      { id: 'fresh-1', v: undefined },
      { id: 'fresh-2', v: undefined },
    ];
    const current: Row[] = [
      { id: 'R', v: 'udfyldt' },
      { id: 'T', v: undefined },
    ];
    const result = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    expect(result.map((r) => r.id)).toEqual(['R', 'T']);
    // Værdier kommer fra incoming (committed), kun id'et arves.
    expect(result[0].v).toBeUndefined();
  });

  it('beholder incoming-id når der ikke findes en nuværende række på positionen', () => {
    const incoming: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const current: Row[] = [{ id: 'R' }];
    const result = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    expect(result.map((r) => r.id)).toEqual(['R', 'b', 'c']);
  });

  it('er en no-op når id allerede matcher på positionen', () => {
    const incoming: Row[] = [{ id: 'R', v: 'ny' }];
    const current: Row[] = [{ id: 'R', v: 'gammel' }];
    const result = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    expect(result[0]).toBe(incoming[0]); // samme reference, ingen unødig kopi
  });

  it('håndterer tom current (første resync) ved at returnere incoming uændret', () => {
    const incoming: Row[] = [{ id: 'a' }, { id: 'b' }];
    const result = reconcileRowIdsByPosition({ incoming, current: [], getRowId, withRowId });
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
