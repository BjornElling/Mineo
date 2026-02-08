import { describe, it, expect, vi } from 'vitest';
import { toDanishDateString } from '../../types/branded';
import { toLoentrin } from '../../data/offentligLoenTypes';

describe('offentligLoenLookup - manglende løntrin', () => {
  it('kaster fejl hvis løntrin mangler i en regulering', async () => {
    vi.resetModules();

    vi.doMock('../../data/KL/klLoenSatser', () => ({
      klLoenSatser: [
        {
          effectiveDate: toDanishDateString('01-01-2024'),
          entries: [
            {
              loentrin: toLoentrin(1),
              maanedsLoen: { 0: 100, 1: 100, 2: 100, 3: 100, 4: 100 },
              timeLoen: { 0: 10, 1: 10, 2: 10, 3: 10, 4: 10 },
            },
          ],
        },
      ],
    }));

    vi.doMock('../../data/RLTN/rltnLoenSatser', () => ({
      rltnLoenSatser: [],
    }));

    const { getOffentligLoenForDato } = await import('../../data/offentligLoenLookup');

    expect(() =>
      getOffentligLoenForDato('KL', toDanishDateString('01-02-2024'), toLoentrin(2), 0)
    ).toThrow('Mangler løntrin');
  });
});
