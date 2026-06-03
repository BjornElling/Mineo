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

  // Regressionsværn (2026-06-03, duplicate-key-fejl ved sygedagpenge-indsættelse):
  // Når incoming er længere end current (fx rækker indsat før den efterfølgende tomme),
  // må positionel id-grafting ALDRIG flytte et current-id ind på en position, hvor det
  // kolliderer med et incoming-id der allerede står på en SENERE position. Det gav to rækker
  // med samme id (offentlig_ydelse_empty_N) → React duplicate-key + datakorruption.
  it('grafter ALDRIG et id ind så det kolliderer med et incoming-id senere i listen', () => {
    // current: én udfyldt + efterfølgende tom (seed 3).
    const current: Row[] = [
      { id: 'filled_A', v: 'a' },
      { id: 'offentlig_ydelse_empty_3', v: undefined },
    ];
    // incoming: to nye rækker indsat før den efterfølgende tomme, som beholder sit id.
    const incoming: Row[] = [
      { id: 'filled_A', v: 'a' },
      { id: 'syg_1', v: 'ny' },
      { id: 'offentlig_ydelse_empty_3', v: undefined },
    ];
    const result = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length); // ingen duplikater
    // Den nyindsatte række beholder sin egen identitet (bliver ikke grafted til den tommes id).
    expect(ids).toEqual(['filled_A', 'syg_1', 'offentlig_ydelse_empty_3']);
  });

  it('bevarer unikke id når current-rækker indbyrdes bytter id-position', () => {
    // Begge positioner grafter (current[i] ≠ incoming[i]); resultatet skal stadig være unikt.
    const current: Row[] = [{ id: 'A' }, { id: 'X' }];
    const incoming: Row[] = [{ id: 'X' }, { id: 'fresh' }];
    const result = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
