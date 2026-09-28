import {
  ERHVERVSEVNETAB_EAL_PCT_LABEL,
  resolveErhvervsevnetabMaksimumTekst,
} from '../../../domain/erhvervsevnetab/eetMaksimumTekst';

describe('EET-maksimumtekst', () => {
  it('bevarer den fælles label for EAL-procenten', () => {
    expect(ERHVERVSEVNETAB_EAL_PCT_LABEL).toBe('Erhvervsevnetab');
  });

  it.each([
    [true, 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'],
    [false, 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør'],
  ] as const)('vælger korrekt maksimumstekst ved reduceretTilMaks=%s', (reduceretTilMaks, expected) => {
    expect(resolveErhvervsevnetabMaksimumTekst(reduceretTilMaks)).toBe(expected);
  });
});
