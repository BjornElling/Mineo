import { getKapitaliseringsTabelData } from '../../data/kapitalisering/kapitaliseringsTabeller';
import { resolveFactorTable, resolveKapitaliseringTabelvalg } from '../../domain/erhvervsevnetab/eetKapitaliseringOpslag';
import { toISODateString } from '../../types/branded';

describe('kapitalisering 2027 fra vejledning 10253/2026', () => {
  it('bevarer de aflæste endepunkter i alle relevante EET-tabeller', () => {
    const data = getKapitaliseringsTabelData('10253/2026');
    if (!data) throw new Error('Vejledning 10253/2026 mangler');
    // Selvstændigt aflæst fra original-PDF’ens afsnit 2.1–2.4.
    const facit = [
      ['A', 5, 64.010, 57, 8.548], ['B', 56, 8.580, 61, 5.115],
      ['C', 60, 5.129, 65, 1.877], ['D', 64, 1.878, 64, 1.878],
      ['F', 5, 59.026, 57, 8.039], ['G', 56, 8.099, 61, 4.913],
      ['H', 60, 4.939, 65, 1.858], ['I', 64, 1.861, 64, 1.861],
      ['K', 5, 34.332, 57, 6.897], ['L', 56, 6.946, 61, 4.370],
      ['M', 60, 4.392, 65, 1.722], ['N', 64, 1.724, 64, 1.724],
      ['P', 5, 10.458, 56, 7.391], ['Q', 56, 7.167, 60, 5.867],
      ['R', 60, 5.484, 64, 3.403], ['S', 64, 2.742, 64, 2.742],
    ] as const;
    expect(Object.keys(data.erhvervsevnetabTabeller)).toEqual(facit.map(([letter]) => letter));
    for (const [letter, firstAge, firstFactor, lastAge, lastFactor] of facit) {
      const rows = resolveFactorTable(data, letter, undefined).rows;
      expect(rows?.[0]).toEqual({ alder: firstAge, faktor: firstFactor });
      expect(rows?.at(-1)).toEqual({ alder: lastAge, faktor: lastFactor });
    }
    for (const [skade, letters] of [
      ['2021-01-01', ['A', 'B', 'C', 'D']],
      ['2011-01-01', ['F', 'G', 'H', 'I']],
      ['2007-07-01', ['K', 'L', 'M', 'N']],
      ['2005-01-01', ['P', 'Q', 'R', 'S']],
    ] as const) {
      for (const [index, birth] of ['1971-01-01', '1967-01-01', '1963-01-01', '1955-07-01'].entries()) {
        expect(resolveKapitaliseringTabelvalg(data, toISODateString(skade), toISODateString(birth),
          toISODateString('2027-01-01'))?.tabel).toBe(letters[index]);
      }
    }
  });

  it('bevarer forsørgertabets varierende restperioder og særfaktorerne', () => {
    const data = getKapitaliseringsTabelData('10253/2026');
    if (!data) throw new Error('Vejledning 10253/2026 mangler');
    expect(Object.keys(data.forsoergertabTabeller)).toEqual(['E', 'J', 'O', 'T']);
    for (const [letter, first, last] of [
      ['E', [0.627, 1.262, 1.905, 2.558, 3.218, 3.888, 4.567, 5.254, 5.951, 6.657], 0.624],
      ['J', [0.627, 1.261, 1.904, 2.554, 3.213, 3.880, 4.555, 5.239, 5.931, 6.631], 0.621],
      ['O', [0.584, 1.166, 1.748, 2.328, 2.907, 3.485, 4.062, 4.638, 5.212, 5.786], 0.578],
      ['T', [0.957, 1.827, 2.618, 3.336, 3.989, 4.582, 5.121, 5.611, 6.055, 6.460], 0.950],
    ] as const) {
      const rows = data.forsoergertabTabeller[letter];
      expect(rows).toHaveLength(49);
      expect(rows?.[0]).toEqual({ alder: 18, faktorerPraHeleAar: first });
      expect(rows?.at(-1)).toEqual({ alder: 66, faktorerPraHeleAar: [last] });
      expect(rows?.filter(({ alder }) => alder >= 60).map(({ faktorerPraHeleAar }) => faktorerPraHeleAar.length))
        .toEqual([9, 7, 6, 5, 4, 2, 1]);
    }
    expect(data.saerfaktorUnderToAarTilFpPerSkadesinterval).toEqual([
      { skadedatoFra: '2021-01-01', faktor: 1.246 },
      { skadedatoFra: '2011-01-01', faktor: 1.246 },
      { skadedatoFra: '2007-07-01', faktor: 1.168 },
    ]);
  });
});
