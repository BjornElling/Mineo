import { toISODateString } from '../../../types/branded';
import {
  buildBeregningsperiodeTafOverlapErrorMessage,
  computeTafOverlapWithBeregningsperiode,
} from '../../../domain/erstatningsopgoerelse/beregningsperiodeTafOverlap';

describe('beregningsperiodeTafOverlap', () => {
  it('formats overlap error message with Danish date ranges', () => {
    const msg = buildBeregningsperiodeTafOverlapErrorMessage({
      beregningsperiode: { fra: toISODateString('2023-05-01'), til: toISODateString('2023-05-31') },
      tafPeriode: { fra: toISODateString('2023-05-15'), til: toISODateString('2023-05-20') },
    });

    expect(msg).toBe(
      'Der er overlap mellem beregningsperioden (01-05-2023 - 31-05-2023) og en TAF-periode (15-05-2023 - 20-05-2023)'
    );
  });

  it('returns per-row overlap messages and selects the earliest overlapping TAF period deterministically', () => {
    const result = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: toISODateString('2023-05-01'), til: toISODateString('2023-05-31') },
      tafPerioder: [
        { id: 'b', fra: toISODateString('2023-05-20'), til: toISODateString('2023-06-10') },
        { id: 'a', fra: toISODateString('2023-05-10'), til: toISODateString('2023-05-12') },
        { id: 'c', fra: undefined, til: toISODateString('2023-05-15') },
      ],
    });

    expect(Object.keys(result.overlapMessageByRowId).sort()).toEqual(['a', 'b']);
    expect(result.firstOverlapMessage).toBe(
      'Der er overlap mellem beregningsperioden (01-05-2023 - 31-05-2023) og en TAF-periode (10-05-2023 - 12-05-2023)'
    );
  });
});

