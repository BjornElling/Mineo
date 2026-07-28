import { toISODateString } from '../../../types/branded';
import {
  buildBeregningsperiodeTafOverlapErrorMessage,
  computeTafOverlapWithBeregningsperiode,
} from '../../../domain/erstatningsopgoerelse/engines/beregningsperiodeTafOverlap';

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

describe('computeTafOverlapWithBeregningsperiode — edge cases', () => {
  it('tom tafPerioder → ingen overlap', () => {
    const result = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: toISODateString('2024-01-01'), til: toISODateString('2024-12-31') },
      tafPerioder: [],
    });
    expect(result.overlapMessageByRowId).toEqual({});
    expect(result.firstOverlapMessage).toBeUndefined();
  });

  it('ugyldig beregningsperiode (fra > til) → ingen overlap uanset tafPerioder', () => {
    const result = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: toISODateString('2024-12-31'), til: toISODateString('2024-01-01') },
      tafPerioder: [
        { id: 'a', fra: toISODateString('2024-06-01'), til: toISODateString('2024-06-30') },
      ],
    });
    expect(result.overlapMessageByRowId).toEqual({});
    expect(result.firstOverlapMessage).toBeUndefined();
  });

  it('beregningsperiode med undefined fra → ingen overlap', () => {
    const result = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: undefined, til: toISODateString('2024-12-31') },
      tafPerioder: [
        { id: 'a', fra: toISODateString('2024-06-01'), til: toISODateString('2024-06-30') },
      ],
    });
    expect(result.overlapMessageByRowId).toEqual({});
    expect(result.firstOverlapMessage).toBeUndefined();
  });

  it('ingen af tafPerioderne overlapper → tom overlapMessageByRowId', () => {
    const result = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: toISODateString('2023-01-01'), til: toISODateString('2023-06-30') },
      tafPerioder: [
        { id: 'a', fra: toISODateString('2023-07-01'), til: toISODateString('2023-12-31') },
        { id: 'b', fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30') },
      ],
    });
    expect(result.overlapMessageByRowId).toEqual({});
    expect(result.firstOverlapMessage).toBeUndefined();
  });

  it('tafPerioder med ungyldig fra/til-kombinationer springes over', () => {
    const result = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: toISODateString('2024-01-01'), til: toISODateString('2024-12-31') },
      tafPerioder: [
        { id: 'ugyldig', fra: toISODateString('2024-06-30'), til: toISODateString('2024-06-01') }, // fra > til → ugyldig
        { id: 'valid', fra: toISODateString('2024-06-01'), til: toISODateString('2024-06-30') },
      ],
    });
    expect(Object.keys(result.overlapMessageByRowId)).toEqual(['valid']);
    expect(result.firstOverlapMessage).toBeDefined();
  });
});

