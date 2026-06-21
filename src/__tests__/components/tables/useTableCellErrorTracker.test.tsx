import * as React from 'react';
import { render } from '@testing-library/react';
import {
  getRowIdFromCellKey,
  useTableCellErrorTracker,
  type TableCellErrorTracker,
} from '../../../components/tables/gridCore/useTableCellErrorTracker';

const renderTracker = (): TableCellErrorTracker => {
  const ref: { current: TableCellErrorTracker | null } = { current: null };
  const Comp = () => {
    ref.current = useTableCellErrorTracker();
    return null;
  };
  render(<Comp />);
  if (!ref.current) throw new Error('tracker not initialised');
  return ref.current;
};

describe('getRowIdFromCellKey', () => {
  it('udleder rowId som præfikset før første ":"', () => {
    expect(getRowIdFromCellKey('row_abc:3')).toBe('row_abc');
    expect(getRowIdFromCellKey('offentlig_ydelse_x:ydelsestype')).toBe('offentlig_ydelse_x');
  });

  it('returnerer null når der ingen separator er', () => {
    expect(getRowIdFromCellKey('row_abc')).toBeNull();
  });

  it('bruger kun det første ":" (col-segment kan ikke fejltolkes som rowId)', () => {
    // Række-id'er indeholder aldrig ":" — kun col-segmentet kan, og det skal ignoreres.
    expect(getRowIdFromCellKey('row_abc:a:b')).toBe('row_abc');
  });
});

describe('useTableCellErrorTracker', () => {
  it('setCellError returnerer kun true ved en reel transition', () => {
    const tracker = renderTracker();
    expect(tracker.setCellError('row1:0', true)).toBe(true);
    // Samme fejl igen er ingen transition.
    expect(tracker.setCellError('row1:0', false)).toBe(true);
    expect(tracker.setCellError('row1:0', false)).toBe(false);
  });

  it('hasAnyError/getActiveCellKeys filtrerer mod gyldige rækker ved læsning', () => {
    const tracker = renderTracker();
    tracker.setCellError('row1:0', true);
    tracker.setCellError('row2:1', true);

    expect(tracker.hasAnyError(new Set(['row1', 'row2']))).toBe(true);
    expect(tracker.getActiveCellKeys(new Set(['row1', 'row2'])).sort()).toEqual(['row1:0', 'row2:1']);

    // Kun row1 er gyldig: row2's fejl må ikke lække ind i resultatet.
    expect(tracker.getActiveCellKeys(new Set(['row1']))).toEqual(['row1:0']);
    expect(tracker.hasAnyError(new Set(['row1']))).toBe(true);

    // Ingen gyldige rækker → ingen aktive fejl (selv om sættet stadig indeholder dem).
    expect(tracker.hasAnyError(new Set())).toBe(false);
    expect(tracker.getActiveCellKeys(new Set())).toEqual([]);
  });

  it('read-time-filtrering beskytter mod en fjernet rækkes fejl uden prune', () => {
    const tracker = renderTracker();
    tracker.setCellError('row1:0', true);
    // Rækken fjernes (fx slettet) — uden at prune er kaldt skal fejlen alligevel ikke tælle med.
    expect(tracker.hasAnyError(new Set(['row2']))).toBe(false);
  });

  it('pruneToValidRowIds fjerner forældede rækkers fejl fra det bagvedliggende sæt', () => {
    const tracker = renderTracker();
    tracker.setCellError('row1:0', true);
    tracker.setCellError('row2:0', true);
    tracker.pruneToValidRowIds(new Set(['row1']));
    // row2 er prunet bort: at sætte hasError=false igen er nu ingen transition.
    expect(tracker.setCellError('row2:0', false)).toBe(false);
    // row1 er bevaret.
    expect(tracker.setCellError('row1:0', false)).toBe(true);
  });
});
