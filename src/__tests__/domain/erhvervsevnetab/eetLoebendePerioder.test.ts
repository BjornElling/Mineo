import {
  buildKapitaliseringEvents,
  type ResolvedAfgoerelse,
} from '../../../domain/erhvervsevnetab/eetLoebendePerioder';
import { toISODateString } from '../../../types/branded';

const resolvedRow = (patch: Partial<ResolvedAfgoerelse> = {}): ResolvedAfgoerelse => ({
  rowId: 'a',
  afgoerelsesdato: toISODateString('2024-01-01'),
  virkningsdato: toISODateString('2024-01-01'),
  afgoerelseType: 'Midlertidig',
  eetPct: 40,
  kapDato: toISODateString('2024-06-01'),
  kapPct: 10,
  fsTilbageholdtEet: 'Nej',
  sortKey: 'a',
  ...patch,
});

describe('buildKapitaliseringEvents', () => {
  it('sorterer events deterministisk på række-id, når kapitaliseringsdatoen er ens', () => {
    const result = buildKapitaliseringEvents(
      [
        resolvedRow({ rowId: 'b', sortKey: 'b' }),
        resolvedRow({ rowId: 'a', sortKey: 'a' }),
      ],
      toISODateString('2019-01-01'),
      toISODateString('1980-01-01')
    );

    expect(result.events.map(({ rowId, dato, pct }) => ({ rowId, dato, pct }))).toEqual([
      { rowId: 'a', dato: toISODateString('2024-06-01'), pct: 10 },
      { rowId: 'b', dato: toISODateString('2024-06-01'), pct: 10 },
    ]);
  });
});
