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
            {
              loentrin: toLoentrin('55+'),
              maanedsLoen: { 0: 200, 1: 200, 2: 200, 3: 200, 4: 200 },
              timeLoen: { 0: 20, 1: 20, 2: 20, 3: 20, 4: 20 },
            },
          ],
        },
      ],
    }));

    // RLTN er irrelevant for denne test (vi tester KL's manglende-løntrin-sti), men
    // skal stadig passere den samlede offentlig-løn-load-guard. Giv derfor RLTN én valid
    // regulering, så guarden ikke fyrer på den tabel vi ikke er interesserede i.
    vi.doMock('../../data/RLTN/rltnLoenSatser', () => ({
      rltnLoenSatser: [
        {
          effectiveDate: toDanishDateString('01-01-2024'),
          entries: [
            {
              loentrin: toLoentrin(1),
              maanedsLoen: { 0: 100, 1: 100, 2: 100, 3: 100, 4: 100 },
              timeLoen: { 0: 10, 1: 10, 2: 10, 3: 10, 4: 10 },
            },
            {
              loentrin: toLoentrin('55+'),
              maanedsLoen: { 0: 200, 1: 200, 2: 200, 3: 200, 4: 200 },
              timeLoen: { 0: 20, 1: 20, 2: 20, 3: 20, 4: 20 },
            },
          ],
        },
      ],
    }));

    const { getOffentligLoenForDato } = await import('../../data/offentligLoenLookup');

    expect(() =>
      getOffentligLoenForDato('KL', toDanishDateString('01-02-2024'), toLoentrin(2), 0)
    ).toThrow('Mangler løntrin');
  });
});
